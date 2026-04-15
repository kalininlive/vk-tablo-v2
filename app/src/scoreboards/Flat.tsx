import { MatchState, OverlaySettings } from '../types'

interface Props {
  state: MatchState
  settings: OverlaySettings
  timerText: string
}

export function Flat({ state, settings, timerText }: Props) {
  return (
    <div className="flex items-center gap-4 border border-white/10 bg-black/30 px-4 py-2 text-white" style={{ transform: `scale(${settings.scale})` }}>
      <div className="text-sm">{state.teams.team1.name}</div>
      <div className="text-lg" style={{ color: settings.color_score }}>{state.score.team1}</div>
      <div className="text-white/60">:</div>
      <div className="text-lg" style={{ color: settings.color_score }}>{state.score.team2}</div>
      <div className="text-sm">{state.teams.team2.name}</div>
      <div className="ml-4 font-mono text-sm text-white/80">{timerText}</div>
    </div>
  )
}
