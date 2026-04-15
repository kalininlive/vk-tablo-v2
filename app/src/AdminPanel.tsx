import { FormEvent, useMemo, useState } from 'react'
import {
  checkCredentials,
  useMatchState,
  useMediaLibrary,
  useOverlaySettings,
  useStreamControl,
  useVKChannels
} from './useMatchState'

const API_SECRET_LABEL = 'x-secret из app_config.control_secret'

type TabId = 'air' | 'match' | 'design' | 'media' | 'fx' | 'access'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'air', label: 'Эфир' },
  { id: 'match', label: 'Матч' },
  { id: 'design', label: 'Дизайн' },
  { id: 'media', label: 'Медиатека' },
  { id: 'fx', label: 'FX' },
  { id: 'access', label: 'Доступ' }
]

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const ok = await checkCredentials(username, password)
    setLoading(false)
    if (!ok) {
      setError('Неверный логин или пароль')
      return
    }
    localStorage.setItem('vk_auth', '1')
    onSuccess()
  }

  return (
    <div className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-white/20 bg-black/30 p-6">
      <h1 className="mb-4 text-2xl font-bold">VK Tablo v2</h1>
      <p className="mb-6 text-sm text-white/70">Вход в админ-панель</p>
      <form className="space-y-3" onSubmit={submit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-2"
          placeholder="Логин"
          autoComplete="username"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-2"
          placeholder="Пароль"
          type="password"
          autoComplete="current-password"
        />
        <button disabled={loading} className="w-full rounded bg-emerald-500 px-3 py-2 font-semibold text-black">
          {loading ? 'Проверка...' : 'Войти'}
        </button>
      </form>
      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
    </div>
  )
}

export default function AdminPanel() {
  const [auth, setAuth] = useState(localStorage.getItem('vk_auth') === '1')
  const [tab, setTab] = useState<TabId>('air')

  const { state, patchState } = useMatchState()
  const { settings, patchSettings } = useOverlaySettings()
  const { channels, addChannel, deleteChannel, setActive } = useVKChannels()
  const { items, uploadItem, deleteItem } = useMediaLibrary()
  const stream = useStreamControl()

  const timerMs = useMemo(() => {
    const now = Date.now()
    return state.timer.accumulatedTime + (state.timer.isRunning && state.timer.startTimestamp ? now - state.timer.startTimestamp : 0)
  }, [state.timer.accumulatedTime, state.timer.isRunning, state.timer.startTimestamp])

  if (!auth) {
    return <LoginScreen onSuccess={() => setAuth(true)} />
  }

  const scoreDelta = async (team: 'team1' | 'team2', delta: 1 | -1) => {
    const nextScore = Math.max(0, state.score[team] + delta)
    const newScore = { ...state.score, [team]: nextScore }
    const patch: any = { score: newScore }
    if (delta > 0) {
      patch.goalAnimation = {
        ...state.goalAnimation,
        isActive: true,
        goalId: Date.now(),
        teamSide: team,
        teamName: state.teams[team].name,
        newScore
      }
    }
    await patchState(patch)
  }

  const toggleRun = async () => {
    if (state.timer.isRunning) {
      const elapsed = timerMs - state.timer.accumulatedTime
      await patchState({
        timer: {
          ...state.timer,
          isRunning: false,
          startTimestamp: null,
          accumulatedTime: state.timer.accumulatedTime + elapsed
        }
      })
      return
    }
    await patchState({
      timer: {
        ...state.timer,
        isRunning: true,
        startTimestamp: Date.now()
      }
    })
  }

  return (
    <div className="min-h-screen p-3 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Пульт трансляции</h1>
        <button
          className="rounded bg-white/10 px-3 py-2 text-sm"
          onClick={() => {
            localStorage.removeItem('vk_auth')
            setAuth(false)
          }}
        >
          Выйти
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            className={`rounded px-3 py-2 text-sm ${tab === entry.id ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'air' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-white/20 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Эфир</h2>
            <button
              disabled={stream.loading}
              className={`rounded px-4 py-2 font-semibold ${stream.streaming ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}
              onClick={() => void (stream.streaming ? stream.stop() : stream.start())}
            >
              {stream.streaming ? 'ОФФЛАЙН' : 'В ЭФИР'}
            </button>
            <div className="mt-3 text-sm text-white/70">Статус: {stream.streaming ? 'в эфире' : 'остановлен'}</div>
            <div className="text-xs text-white/50">Авторизация API: {API_SECRET_LABEL}</div>
            {stream.message ? <div className="mt-2 text-sm text-amber-300">{stream.message}</div> : null}
          </section>

          <section className="rounded-xl border border-white/20 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Таймер и счёт</h2>
            <div className="mb-3 text-3xl font-mono">{formatTime(timerMs)}</div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button onClick={() => void toggleRun()} className="rounded bg-white/10 px-3 py-2">
                {state.timer.isRunning ? 'Стоп таймер' : 'Старт таймер'}
              </button>
              <button
                onClick={() =>
                  void patchState({ timer: { ...state.timer, half: state.timer.half === 1 ? 2 : 1 } })
                }
                className="rounded bg-white/10 px-3 py-2"
              >
                Тайм: {state.timer.half}
              </button>
              <button
                onClick={() =>
                  void patchState({
                    timer: { ...state.timer, isRunning: false, startTimestamp: null, accumulatedTime: 0 },
                    score: { team1: 0, team2: 0 }
                  })
                }
                className="rounded bg-white/10 px-3 py-2"
              >
                Сброс матча
              </button>
            </div>

            <div className="space-y-2">
              <ScoreRow name={state.teams.team1.name} score={state.score.team1} onPlus={() => void scoreDelta('team1', 1)} onMinus={() => void scoreDelta('team1', -1)} />
              <ScoreRow name={state.teams.team2.name} score={state.score.team2} onPlus={() => void scoreDelta('team2', 1)} onMinus={() => void scoreDelta('team2', -1)} />
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'match' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <TeamEditor
            title="Команда 1"
            name={state.teams.team1.name}
            city={state.teams.team1.city}
            onName={(value) => void patchState({ teams: { ...state.teams, team1: { ...state.teams.team1, name: value } } })}
            onCity={(value) => void patchState({ teams: { ...state.teams, team1: { ...state.teams.team1, city: value } } })}
          />
          <TeamEditor
            title="Команда 2"
            name={state.teams.team2.name}
            city={state.teams.team2.city}
            onName={(value) => void patchState({ teams: { ...state.teams, team2: { ...state.teams.team2, name: value } } })}
            onCity={(value) => void patchState({ teams: { ...state.teams, team2: { ...state.teams.team2, city: value } } })}
          />
        </div>
      ) : null}

      {tab === 'design' ? (
        <section className="max-w-xl rounded-xl border border-white/20 bg-black/30 p-4">
          <h2 className="mb-3 text-lg font-semibold">Стиль оверлея</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm">Стиль табло</span>
              <select
                className="w-full rounded bg-white/10 px-3 py-2"
                value={settings.scoreboard_style}
                onChange={(e) => void patchSettings({ scoreboard_style: e.target.value as any })}
              >
                <option value="classic">Classic</option>
                <option value="stadium">Stadium</option>
                <option value="flat">Flat</option>
                <option value="neon">Neon</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Масштаб: {settings.scale.toFixed(2)}x</span>
              <input
                className="w-full"
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.scale}
                onChange={(e) => void patchSettings({ scale: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Цвет счёта</span>
              <input
                type="color"
                value={settings.color_score}
                onChange={(e) => void patchSettings({ color_score: e.target.value })}
              />
            </label>
          </div>
        </section>
      ) : null}

      {tab === 'media' ? <MediaTab onUpload={uploadItem} items={items} onDelete={deleteItem} /> : null}

      {tab === 'fx' ? (
        <section className="rounded-xl border border-white/20 bg-black/30 p-4">
          <h2 className="mb-2 text-lg font-semibold">FX</h2>
          <p className="text-sm text-white/70">Загруженные треки/изображения доступны в Медиатеке. Здесь будут плейлисты голов и заставок.</p>
        </section>
      ) : null}

      {tab === 'access' ? (
        <AccessTab channels={channels} onAdd={addChannel} onDelete={deleteChannel} onActive={setActive} />
      ) : null}
    </div>
  )
}

function ScoreRow({
  name,
  score,
  onPlus,
  onMinus
}: {
  name: string
  score: number
  onPlus: () => void
  onMinus: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
      <div>{name}</div>
      <div className="flex items-center gap-2">
        <button onClick={onMinus} className="rounded bg-white/10 px-2">-1</button>
        <span className="w-8 text-center text-xl font-bold">{score}</span>
        <button onClick={onPlus} className="rounded bg-white/10 px-2">+1</button>
      </div>
    </div>
  )
}

function TeamEditor({
  title,
  name,
  city,
  onName,
  onCity
}: {
  title: string
  name: string
  city: string
  onName: (value: string) => void
  onCity: (value: string) => void
}) {
  return (
    <section className="rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        <input value={name} onChange={(e) => onName(e.target.value)} className="w-full rounded bg-white/10 px-3 py-2" placeholder="Название" />
        <input value={city} onChange={(e) => onCity(e.target.value)} className="w-full rounded bg-white/10 px-3 py-2" placeholder="Город" />
      </div>
    </section>
  )
}

function MediaTab({
  items,
  onUpload,
  onDelete
}: {
  items: Array<{ id: number; name: string; data_url: string }>
  onUpload: (name: string, dataUrl: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const upload = async () => {
    if (!file || !name) {
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    await onUpload(name, dataUrl)
    setName('')
    setFile(null)
  }

  return (
    <section className="rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-3 text-lg font-semibold">Медиатека</h2>
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded bg-white/10 px-3 py-2" placeholder="Название" />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="rounded bg-white/10 px-3 py-2" />
        <button onClick={() => void upload()} className="rounded bg-emerald-500 px-3 py-2 text-black">Загрузить</button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
            <div className="truncate pr-4">{item.name}</div>
            <button onClick={() => void onDelete(item.id)} className="rounded bg-red-500/80 px-3 py-1 text-sm">
              Удалить
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function AccessTab({
  channels,
  onAdd,
  onDelete,
  onActive
}: {
  channels: Array<{ id: number; name: string; rtmp_url: string; stream_key: string; is_active: boolean }>
  onAdd: (name: string, rtmp: string, key: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onActive: (id: number) => Promise<void>
}) {
  const [name, setName] = useState('VK Channel')
  const [rtmp, setRtmp] = useState('rtmp://ovsu.okcdn.ru/input/')
  const [key, setKey] = useState('')

  return (
    <section className="rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-3 text-lg font-semibold">VK каналы</h2>
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded bg-white/10 px-3 py-2" placeholder="Название" />
        <input value={rtmp} onChange={(e) => setRtmp(e.target.value)} className="rounded bg-white/10 px-3 py-2" placeholder="RTMP URL" />
        <input value={key} onChange={(e) => setKey(e.target.value)} className="rounded bg-white/10 px-3 py-2" placeholder="Stream key" />
        <button
          onClick={() => {
            void onAdd(name, rtmp, key)
            setKey('')
          }}
          className="rounded bg-emerald-500 px-3 py-2 text-black"
        >
          Добавить
        </button>
      </div>

      <div className="space-y-2">
        {channels.map((channel) => (
          <div key={channel.id} className="rounded bg-white/5 p-3">
            <div className="mb-1 font-semibold">{channel.name}</div>
            <div className="text-xs text-white/70">{channel.rtmp_url}</div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void onActive(channel.id)}
                className={`rounded px-3 py-1 text-sm ${channel.is_active ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}
              >
                {channel.is_active ? 'Активен' : 'Сделать активным'}
              </button>
              <button onClick={() => void onDelete(channel.id)} className="rounded bg-red-500/80 px-3 py-1 text-sm">
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
