import { MatchState, OverlaySettings } from '../types'

interface Props {
  state: MatchState
  settings: OverlaySettings
  timerText: string
}

export function Modern({ state, settings, timerText }: Props) {
  const half = state.timer.half === 1 ? '1ˣ' : '2ˣ'
  return (
    <div
      className="flex items-center gap-0 rounded-none text-white"
      style={{
        transform: `scale(${settings.scale})`,
        fontFamily: "'Impact', sans-serif"
      }}
    >
      <div className="flex items-center gap-3 bg-gradient-to-r from-blue-900/90 to-blue-800/90 px-5 py-3">
        {state.teams.team1.logo ? (
          <img src={state.teams.team1.logo} alt={state.teams.team1.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">{state.teams.team1.name.charAt(0)}</div>
        )}
        <div className="text-right">
          <div className="text-xl font-bold uppercase tracking-wide">{state.teams.team1.name}</div>
          <div className="text-sm font-medium uppercase text-blue-200">{state.teams.team1.city}</div>
        </div>
      </div>
      
      <div className="flex flex-col items-center bg-black/80 px-4 py-2">
        <div className="text-xs font-medium uppercase tracking-widest text-yellow-400">{half}</div>
        <div className="font-mono text-3xl font-bold tracking-wider">{timerText}</div>
      </div>
      
      <div className="flex items-center gap-3 bg-gradient-to-l from-red-900/90 to-red-800/90 px-5 py-3">
        <div className="text-left">
          <div className="text-xl font-bold uppercase tracking-wide">{state.teams.team2.name}</div>
          <div className="text-sm font-medium uppercase text-red-200">{state.teams.team2.city}</div>
        </div>
        {state.teams.team2.logo ? (
          <img src={state.teams.team2.logo} alt={state.teams.team2.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">{state.teams.team2.name.charAt(0)}</div>
        )}
      </div>
      
      <div className="flex items-center bg-white px-3 py-1">
        <div className="flex gap-0.5 text-4xl font-bold text-black">
          <span>{state.score.team1}</span>
          <span className="text-red-600">-</span>
          <span>{state.score.team2}</span>
        </div>
      </div>
    </div>
  )
}