import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useOverlaySettingsRT, useOverlayState } from './useMatchState'
import { Classic, Flat, Neon, Stadium } from './scoreboards'

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
  const now = useNow()

  const [goalVisible, setGoalVisible] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  useEffect(() => {
    if (!state.goalAnimation.goalId || !state.goalAnimation.animationsEnabled) {
      return
    }
    setGoalVisible(true)
    const id = window.setTimeout(() => setGoalVisible(false), 5000)
    return () => window.clearTimeout(id)
  }, [state.goalAnimation.goalId, state.goalAnimation.animationsEnabled])

  useEffect(() => {
    if (!state.cardEvent.cardId) {
      return
    }
    setCardVisible(true)
    const id = window.setTimeout(() => setCardVisible(false), 4000)
    return () => window.clearTimeout(id)
  }, [state.cardEvent.cardId])

  const timerMs =
    state.timer.accumulatedTime + (state.timer.isRunning && state.timer.startTimestamp ? now - state.timer.startTimestamp : 0)
  const timerText = formatMs(timerMs)
  const scoreBoardPos = usePositionClass(settings.position)

  const scoreBoard = useMemo(() => {
    const props = { state, settings, timerText }
    switch (settings.scoreboard_style) {
      case 'stadium':
        return <Stadium {...props} />
      case 'flat':
        return <Flat {...props} />
      case 'neon':
        return <Neon {...props} />
      default:
        return <Classic {...props} />
    }
  }, [settings, state, timerText])

  const introCount = useMemo(() => {
    if (!state.introScreen.isActive || !state.introScreen.countdown) return null
    const elapsed = Math.floor((timerMs || 0) / 1000)
    return Math.max(0, state.introScreen.countdown - elapsed)
  }, [state.introScreen.countdown, state.introScreen.isActive, timerMs])

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
          {state.pauseScreen.audioUrl ? <audio src={state.pauseScreen.audioUrl} autoPlay loop /> : null}
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
