import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useMediaLibrary, useOverlaySettingsRT, useOverlayState } from './useMatchState'
import { Classic, Flat, Neon, Stadium } from './scoreboards'

const SCOREBOARD_REGISTRY: Record<string, React.ComponentType<any>> = {
  classic: Classic,
  stadium: Stadium,
  flat: Flat,
  neon: Neon
}

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

function usePositionClass(position: string) {
  switch (position) {
    case 'top-center':
      return 'top-8 left-1/2 -translate-x-1/2'
    case 'top-right':
      return 'top-8 right-8'
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
    case 'bottom-left':
      return 'bottom-8 left-8'
    case 'bottom-center':
      return 'bottom-8 left-1/2 -translate-x-1/2'
    case 'bottom-right':
      return 'bottom-8 right-8'
    default:
      return 'top-8 left-8'
  }
}

export default function Overlay() {
  const { state } = useOverlayState()
  const { settings } = useOverlaySettingsRT()
  const { items: mediaItems } = useMediaLibrary()
  const now = useNow()

  const [goalVisible, setGoalVisible] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const goalAudioRef = useRef<HTMLAudioElement | null>(null)
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null)
  const sequenceIndexesRef = useRef<Record<string, number>>({})
  const prevPauseActiveRef = useRef(false)
  const prevPauseSignatureRef = useRef('')
  const prevIntroActiveRef = useRef(false)

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  useEffect(() => {
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const warmup = async () => {
      try {
        await ctx.resume()
        const buf = ctx.createBuffer(1, 1, 22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start()
      } catch {
        // noop
      }
    }
    void warmup()
    return () => {
      goalAudioRef.current?.pause()
      goalAudioRef.current = null
      backgroundAudioRef.current?.pause()
      backgroundAudioRef.current = null
      audioContextRef.current = null
      void ctx.close()
    }
  }, [])

  const mediaById = useMemo(() => {
    const map: Record<number, string> = {}
    for (const item of mediaItems) {
      map[item.id] = item.data_url
    }
    return map
  }, [mediaItems])

  const pausePlaylistSources = useMemo(
    () => state.pauseScreenPlaylist.soundPlaylistIds.map((id) => mediaById[id] || '').join('|'),
    [mediaById, state.pauseScreenPlaylist.soundPlaylistIds]
  )

  const resumeAudioEngine = async () => {
    const ctx = audioContextRef.current
    if (!ctx) {
      return
    }
    try {
      if (ctx.state !== 'running') {
        await ctx.resume()
      }
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start()
    } catch {
      // noop
    }
  }

  const pickTrack = (
    ids: number[],
    mode: 'sequence' | 'random',
    key: string
  ) => {
    const urls = ids.map((id) => mediaById[id]).filter((url): url is string => Boolean(url))
    if (urls.length === 0) {
      return null
    }
    if (mode === 'random') {
      return urls[Math.floor(Math.random() * urls.length)]
    }
    const index = sequenceIndexesRef.current[key] || 0
    const selected = urls[index % urls.length]
    sequenceIndexesRef.current[key] = (index + 1) % urls.length
    return selected
  }

  const playGoalSound = async (url: string | null) => {
    if (!url || !url.startsWith('data:audio')) {
      return
    }
    await resumeAudioEngine()
    goalAudioRef.current?.pause()
    const audio = new Audio(url)
    audio.volume = 1
    goalAudioRef.current = audio
    try {
      await audio.play()
    } catch {
      // noop
    }
  }

  const playBackgroundSound = async (url: string | null) => {
    if (!url || !url.startsWith('data:audio')) {
      backgroundAudioRef.current?.pause()
      backgroundAudioRef.current = null
      return
    }
    await resumeAudioEngine()
    if (backgroundAudioRef.current?.src === url && !backgroundAudioRef.current.paused) {
      return
    }
    backgroundAudioRef.current?.pause()
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = 0.9
    backgroundAudioRef.current = audio
    try {
      await audio.play()
    } catch {
      // noop
    }
  }

  useEffect(() => {
    if (!state.goalAnimation.goalId) return
    if (!state.goalAnimation.animationsEnabled) {
      setGoalVisible(false)
      return
    }
    setGoalVisible(true)
    const id = window.setTimeout(() => setGoalVisible(false), 5000)
    return () => window.clearTimeout(id)
  }, [state.goalAnimation.goalId, state.goalAnimation.animationsEnabled])

  useEffect(() => {
    if (!state.goalAnimation.goalId || !state.goalAnimation.isActive) {
      return
    }
    const isOurGoal = state.ourTeam ? state.ourTeam === state.goalAnimation.teamSide : true
    const playlist = isOurGoal
      ? state.goalAnimation.soundPlaylistIds
      : state.goalAnimation.concededPlaylistIds
    const url = pickTrack(
      playlist,
      state.goalAnimation.playlistMode,
      isOurGoal ? 'goal-main' : 'goal-conceded'
    )
    void playGoalSound(url)
  }, [
    mediaById,
    state.goalAnimation.concededPlaylistIds,
    state.goalAnimation.goalId,
    state.goalAnimation.isActive,
    state.goalAnimation.playlistMode,
    state.goalAnimation.soundPlaylistIds,
    state.goalAnimation.teamSide,
    state.ourTeam
  ])

  useEffect(() => {
    if (!state.cardEvent.cardId) {
      return
    }
    setCardVisible(true)
    const id = window.setTimeout(() => setCardVisible(false), 4000)
    return () => window.clearTimeout(id)
  }, [state.cardEvent.cardId])

  useEffect(() => {
    const isPauseActive = state.pauseScreen.isActive
    const signature = [
      isPauseActive ? '1' : '0',
      state.pauseScreen.audioUrl,
      state.pauseScreenPlaylist.playlistMode,
      state.pauseScreenPlaylist.soundPlaylistIds.join(','),
      pausePlaylistSources
    ].join('::')

    if (isPauseActive && (!prevPauseActiveRef.current || prevPauseSignatureRef.current !== signature)) {
      const playlistUrl = pickTrack(
        state.pauseScreenPlaylist.soundPlaylistIds,
        state.pauseScreenPlaylist.playlistMode,
        'pause-playlist'
      )
      const url = state.pauseScreen.audioUrl || playlistUrl
      void playBackgroundSound(url)
    }

    if (!isPauseActive && prevPauseActiveRef.current) {
      void playBackgroundSound(null)
    }
    prevPauseActiveRef.current = isPauseActive
    prevPauseSignatureRef.current = signature
  }, [
    pausePlaylistSources,
    state.pauseScreen.audioUrl,
    state.pauseScreen.isActive,
    state.pauseScreenPlaylist.playlistMode,
    state.pauseScreenPlaylist.soundPlaylistIds
  ])

  useEffect(() => {
    const isIntroActive = state.introScreen.isActive
    if (isIntroActive && !prevIntroActiveRef.current) {
      const url = pickTrack(
        state.introScreen.soundPlaylistIds,
        state.introScreen.playlistMode,
        'intro-playlist'
      )
      void playGoalSound(url)
    }
    prevIntroActiveRef.current = isIntroActive
  }, [mediaById, state.introScreen.isActive, state.introScreen.playlistMode, state.introScreen.soundPlaylistIds])

  const timerMs =
    state.timer.accumulatedTime + (state.timer.isRunning && state.timer.startTimestamp ? now - state.timer.startTimestamp : 0)
  const timerText = formatMs(timerMs)
  const scoreBoardPos = usePositionClass(settings.position)

  const scoreBoard = useMemo(() => {
    const props = { state, settings, timerText }
    const ScoreboardComponent = SCOREBOARD_REGISTRY[settings.scoreboard_style] || Classic
    return <ScoreboardComponent {...props} />
  }, [settings, state, timerText])

  const introCount = useMemo(() => {
    if (!state.introScreen.isActive || !state.introScreen.countdown) return null
    if (!state.introScreen.startedAt) return state.introScreen.countdown
    const elapsed = Math.floor((now - state.introScreen.startedAt) / 1000)
    return Math.max(0, state.introScreen.countdown - elapsed)
  }, [state.introScreen.countdown, state.introScreen.isActive, state.introScreen.startedAt, now])

  return (
    <div className="relative h-screen w-screen">
      <div className={`absolute ${scoreBoardPos}`}>{scoreBoard}</div>

      {goalVisible && state.goalAnimation.isActive ? (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl bg-emerald-500/90 px-8 py-4 text-center text-white"
        >
          <div className="text-3xl font-black">GOOOL!</div>
          <div className="text-xl">{state.goalAnimation.teamName}</div>
          <div className="mt-1 text-2xl font-bold">
            {state.goalAnimation.newScore.team1} : {state.goalAnimation.newScore.team2}
          </div>
        </motion.div>
      ) : null}

      {cardVisible && state.cardEvent.isActive ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 px-6 py-3 text-white"
        >
          <div className={`mb-2 inline-block h-8 w-6 ${state.cardEvent.cardType === 'yellow' ? 'bg-yellow-400' : 'bg-red-600'}`} />
          <div className="text-lg font-semibold">{state.cardEvent.playerName}</div>
        </motion.div>
      ) : null}

      {state.subtitles.isActive && state.subtitles.text ? (
        <div className="absolute bottom-20 left-1/2 w-[85vw] -translate-x-1/2 rounded bg-black/65 px-4 py-2 text-center text-lg text-white">
          {state.subtitles.text}
        </div>
      ) : null}

      {state.bottomBanner.isActive ? (
        <div className="absolute bottom-0 left-0 w-full overflow-hidden bg-black/70 py-2">
          {state.bottomBanner.mode === 'image' && state.bottomBanner.imageUrl ? (
            <img src={state.bottomBanner.imageUrl} alt="banner" className="mx-auto h-12 object-contain" />
          ) : (
            <div className="whitespace-nowrap px-4 text-white" style={{ animation: `ticker ${Math.max(5, state.bottomBanner.speed)}s linear infinite` }}>
              {state.bottomBanner.text}
            </div>
          )}
        </div>
      ) : null}

      {state.sponsorLogo.isActive && state.sponsorLogo.imageUrl ? (
        <img
          src={state.sponsorLogo.imageUrl}
          alt="sponsor"
          className="absolute right-8 top-8 object-contain"
          style={{ width: state.sponsorLogo.size, height: state.sponsorLogo.size }}
        />
      ) : null}

      {state.pauseScreen.isActive ? (
        <div className="absolute inset-0 bg-black/70">
          {state.pauseScreen.mediaUrl.startsWith('data:video') ? (
            <video className="h-full w-full object-cover" src={state.pauseScreen.mediaUrl} autoPlay loop muted />
          ) : state.pauseScreen.mediaUrl ? (
            <img className="h-full w-full object-cover" src={state.pauseScreen.mediaUrl} alt="pause" />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white drop-shadow-lg">
            {state.pauseScreen.text || 'ПАУЗА'}
          </div>
        </div>
      ) : null}

      {state.introScreen.isActive ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <div className="mb-2 text-xl text-white/80">До начала</div>
            <div className="text-7xl font-black text-white">{introCount ?? state.introScreen.countdown ?? 0}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
