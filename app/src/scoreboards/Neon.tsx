import { MatchState, OverlaySettings } from '../types'

interface Props {
  state: MatchState
  settings: OverlaySettings
  timerText: string
}

export function Neon({ state, settings, timerText }: Props) {
  return (
    <div
      className="rounded-2xl border border-cyan-400/60 bg-slate-950/70 px-6 py-3"
      style={{
        transform: `scale(${settings.scale})`,
        boxShadow: '0 0 18px rgba(34,211,238,0.5), inset 0 0 12px rgba(34,211,238,0.35)'
      }}
    >
      <div className="flex items-center gap-4 text-cyan-100">
        <div>{state.teams.team1.name}</div>
        <div className="text-3xl font-black text-cyan-300" style={{ textShadow: '0 0 14px rgba(34,211,238,0.9)' }}>
          {state.score.team1} : {state.score.team2}
        </div>
        <div>{state.teams.team2.name}</div>
      </div>
      <div className="mt-1 text-center font-mono text-cyan-200/80">{timerText}</div>
    </div>
  )
}
