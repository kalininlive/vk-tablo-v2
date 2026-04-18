import { MatchState, OverlaySettings } from '../types'

interface Props {
  state: MatchState
  settings: OverlaySettings
  timerText: string
}

export function Split({ state, settings, timerText }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 text-white"
      style={{
        transform: `scale(${settings.scale})`
      }}
    >
      <div className="flex items-center gap-8">
        <TeamLarge name={state.teams.team1.name} city={state.teams.team1.city} logo={state.teams.team1.logo} color={state.teams.team1.color} />
        <div className="text-6xl font-bold">VS</div>
        <TeamLarge name={state.teams.team2.name} city={state.teams.team2.city} logo={state.teams.team2.logo} color={state.teams.team2.color} />
      </div>
      <div className="flex items-center gap-4 rounded-full bg-white/10 px-6 py-2">
        <span className="text-lg font-medium uppercase text-yellow-400">{state.timer.half === 1 ? '1-й тайм' : '2-й тайм'}</span>
        <span className="font-mono text-2xl">{timerText}</span>
      </div>
      <div className="flex gap-8">
        <ScoreBox score={state.score.team1} label="ГОЛ" />
        <ScoreBox score={state.score.team2} label="ГОЛ" />
      </div>
    </div>
  )
}

function TeamLarge({ name, city, logo, color }: { name: string; city: string; logo: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {logo ? (
        <img src={logo} alt={name} className="h-32 w-32 rounded-2xl object-cover shadow-xl" style={{ borderColor: color, borderWidth: 4 }} />
      ) : (
        <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-white/10 text-5xl font-bold" style={{ borderColor: color, borderWidth: 4 }}>{name.charAt(0)}</div>
      )}
      <div className="text-center">
        <div className="text-2xl font-bold uppercase">{name}</div>
        <div className="text-lg uppercase text-white/60">{city}</div>
      </div>
    </div>
  )
}

function ScoreBox({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-full bg-white px-8 py-4">
        <div className="text-6xl font-bold text-black">{score}</div>
      </div>
      <div className="mt-1 text-sm font-medium uppercase text-white/60">{label}</div>
    </div>
  )
}