import { MatchState, OverlaySettings } from '../types'

interface Props {
  state: MatchState
  settings: OverlaySettings
  timerText: string
}

export function Stadium({ state, settings, timerText }: Props) {
  return (
    <div
      className="rounded-2xl border border-white/15 bg-black/45 px-8 py-4 text-white"
      style={{ transform: `scale(${settings.scale})` }}
    >
      <div className="grid grid-cols-3 items-center gap-4">
        <div className="text-right text-xl font-semibold">{state.teams.team1.name}</div>
        <div className="text-center text-4xl font-black" style={{ color: settings.color_score }}>
          {state.score.team1} : {state.score.team2}
        </div>
        <div className="text-left text-xl font-semibold">{state.teams.team2.name}</div>
      </div>
      <div className="mt-1 text-center font-mono text-sm text-white/80">{timerText}</div>
    </div>
  )
}
