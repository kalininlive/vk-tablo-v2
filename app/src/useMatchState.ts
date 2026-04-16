import { useCallback, useEffect, useMemo, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { AppConfig, defaultMatchState, MatchState, MediaItem, OverlaySettings, VKChannel } from './types'

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends object ? PartialDeep<T[K]> : T[K]
}

const defaultOverlaySettings: OverlaySettings = {
  id: 1,
  scale: 1,
  position: 'top-left',
  logo_size: 64,
  glass_enabled: true,
  backdrop_color: '#000000',
  backdrop_opacity: 0,
  color_team_name: '#ffffff',
  color_city: '#93c5fd',
  color_city_badge: '#dc2626',
  color_timer: '#ffffff',
  color_half: 'rgba(255,255,255,0.4)',
  timer_warning_min: 35,
  sponsor_size: 80,
  scoreboard_style: 'classic',
  logo_shape: 'rounded',
  strip_enabled: false,
  strip_color: '#ffffff',
  score_font: 'default',
  color_score: '#ffffff'
}

function deepMerge<T extends Record<string, any>>(base: T, patch: PartialDeep<T>): T {
  const output: Record<string, any> = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof output[key] === 'object') {
      output[key] = deepMerge(output[key], value as Record<string, any>)
    } else {
      output[key] = value
    }
  }
  return output as T
}

function useRealtimeTable(
  table: string,
  onChange: () => Promise<void>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const channel: RealtimeChannel = supabase
      .channel(`rt-${table}-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          void onChange()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, onChange, table])
}

export function useMatchState() {
  const [state, setState] = useState<MatchState>(defaultMatchState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from('football_match_state')
      .select('state')
      .eq('id', 1)
      .single()
    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }
    setState((data?.state as MatchState) || defaultMatchState)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeTable('football_match_state', load)

  const patchState = useCallback(
    async (patch: PartialDeep<MatchState>) => {
      const previous = state
      const merged = deepMerge(state, patch)
      setState(merged)
      const { error: dbError } = await supabase.from('football_match_state').update({ state: merged }).eq('id', 1)
      if (dbError) {
        setState(previous)
        setError(dbError.message)
      }
    },
    [state]
  )

  return { state, loading, error, patchState, reload: load }
}

export function useOverlayState() {
  const [state, setState] = useState<MatchState>(defaultMatchState)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('football_match_state').select('state').eq('id', 1).single()
    setState((data?.state as MatchState) || defaultMatchState)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeTable('football_match_state', load)

  return { state, loading }
}

export function useOverlaySettings() {
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('overlay_settings').select('*').eq('id', 1).single()
    setSettings((data as OverlaySettings) || defaultOverlaySettings)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchSettings = useCallback(async (patch: Partial<OverlaySettings>) => {
    const merged = { ...settings, ...patch }
    setSettings(merged)
    await supabase.from('overlay_settings').update(patch).eq('id', 1)
  }, [settings])

  return { settings, loading, patchSettings, reload: load }
}

export function useOverlaySettingsRT() {
  const settingsState = useOverlaySettings()
  useRealtimeTable('overlay_settings', settingsState.reload)
  return settingsState
}

export function useVKChannels() {
  const [channels, setChannels] = useState<VKChannel[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase.from('vk_channels').select('*').order('id', { ascending: true })
    setChannels((data as VKChannel[]) || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeTable('vk_channels', load)

  const addChannel = useCallback(async (name: string, rtmpUrl: string, streamKey: string) => {
    await supabase.from('vk_channels').insert({ name, rtmp_url: rtmpUrl, stream_key: streamKey, is_active: false })
    await load()
  }, [load])

  const deleteChannel = useCallback(async (id: number) => {
    await supabase.from('vk_channels').delete().eq('id', id)
    await load()
  }, [load])

  const setActive = useCallback(async (id: number) => {
    const { error: e1 } = await supabase.from('vk_channels').update({ is_active: false }).neq('id', -1)
    if (e1) {
      await load()
      return
    }
    const { error: e2 } = await supabase.from('vk_channels').update({ is_active: true }).eq('id', id)
    if (e2) {
      await load()
      return
    }
    await load()
  }, [load])

  return { channels, addChannel, deleteChannel, setActive, reload: load }
}

export function useMediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase.from('media_library').select('*').order('id', { ascending: false })
    setItems((data as MediaItem[]) || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeTable('media_library', load)

  const uploadItem = useCallback(async (name: string, dataUrl: string) => {
    await supabase.from('media_library').insert({ name, data_url: dataUrl })
    await load()
  }, [load])

  const deleteItem = useCallback(async (id: number) => {
    await supabase.from('media_library').delete().eq('id', id)
    await load()
  }, [load])

  return { items, uploadItem, deleteItem, reload: load }
}

async function getAppConfig(): Promise<AppConfig | null> {
  const { data } = await supabase.from('app_config').select('*').eq('id', 1).single()
  return (data as AppConfig) || null
}

export function useStreamControl() {
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [apiConfig, setApiConfig] = useState<AppConfig | null>(null)

  const apiBase = useMemo(() => {
    if (apiConfig?.control_api_url) {
      return apiConfig.control_api_url.replace(/\/$/, '')
    }
    return `${window.location.origin}/stream-control`
  }, [apiConfig?.control_api_url])

  const loadConfig = useCallback(async () => {
    const config = await getAppConfig()
    setApiConfig(config)
  }, [])

  const status = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/status`)
      const data = await response.json()
      setStreaming(Boolean(data.streaming))
    } catch {
      setMessage('API недоступен')
    }
  }, [apiBase])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    void status()
    const id = window.setInterval(() => {
      void status()
    }, 10000)
    return () => window.clearInterval(id)
  }, [status])

  const call = useCallback(
    async (endpoint: 'start' | 'stop') => {
      setLoading(true)
      setMessage('')
      try {
        const response = await fetch(`${apiBase}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-secret': apiConfig?.control_secret || ''
          }
        })
        const data = await response.json()
        if (!response.ok) {
          setMessage(data.error || 'Ошибка API')
        } else {
          setMessage(endpoint === 'start' ? 'Стрим запущен' : 'Стрим остановлен')
          await status()
        }
      } catch {
        setMessage('Не удалось выполнить команду')
      } finally {
        setLoading(false)
      }
    },
    [apiBase, apiConfig?.control_secret, status]
  )

  return {
    streaming,
    loading,
    message,
    start: () => call('start'),
    stop: () => call('stop'),
    refresh: status
  }
}

export function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  return crypto.subtle.digest('SHA-256', encoded).then((hashBuffer) => {
    const arr = Array.from(new Uint8Array(hashBuffer))
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('')
  })
}

export async function checkCredentials(username: string, password: string) {
  const hash = await sha256Hex(password)
  const { data } = await supabase.from('app_config').select('username,password_hash').eq('id', 1).single()
  if (!data) {
    return false
  }
  return data.username === username && data.password_hash === hash
}
