import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useOverlaySettingsRT, useOverlayState } from './useMatchState'
import { Classic, Flat, Neon, Stadium } from './scoreboards'

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function useTimerValue(accumulatedTime: number, startTimestamp: number | null, isRunning: boolean) {
  const now = Date.now()
  return accumulatedTime + (isRunning && startTimestamp ? now - startTimestamp : 0)
}

export default function Overlay() {
  const { state } = useOverlayState()
  const { settings } = useOverlaySettingsRT()

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => {
      document.body.classList.remove('overlay-mode')
    }
  }, [])

  const timerMs = useTimerValue(state.timer.accumulatedTime, state.timer.startTimestamp, state.timer.isRunning)
  const timerText = formatMs(timerMs)

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

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute left-8 top-8">{scoreBoard}</div>

      {state.goalAnimation.isActive ? (
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl bg-emerald-500/90 px-8 py-4 text-center text-white"
        >
          <div className="text-3xl font-black">GOOOL!</div>
          <div className="text-xl">{state.goalAnimation.teamName}</div>
          <div className="mt-1 text-2xl font-bold">
            {state.goalAnimation.newScore.team1} : {state.goalAnimation.newScore.team2}
          </div>
        </motion.div>
      ) : null}

      {state.cardEvent.isActive ? (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-6 py-3 text-white">
          <div className={`mb-2 inline-block h-8 w-6 ${state.cardEvent.cardType === 'yellow' ? 'bg-yellow-400' : 'bg-red-600'}`} />
          <div className="text-lg font-semibold">{state.cardEvent.playerName}</div>
        </div>
      ) : null}

      {state.bottomBanner.isActive && state.bottomBanner.text ? (
        <div className="absolute bottom-0 left-0 w-full overflow-hidden bg-black/70 py-2">
          <div className="animate-[ticker_18s_linear_infinite] whitespace-nowrap px-4 text-white">{state.bottomBanner.text}</div>
        </div>
      ) : null}
    </div>
  )
}
