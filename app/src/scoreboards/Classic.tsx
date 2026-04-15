import { MatchState, OverlaySettings } from '../types'

interface Props {
  state: MatchState
  settings: OverlaySettings
  timerText: string
}

export function Classic({ state, settings, timerText }: Props) {
  const half = `${state.timer.half}T`
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-white/20 px-4 py-3 text-white"
      style={{
        background: settings.glass_enabled
          ? `rgba(0,0,0,${Math.max(0.15, settings.backdrop_opacity)})`
          : settings.backdrop_color,
        transform: `scale(${settings.scale})`
      }}
    >
      <TeamBlock name={state.teams.team1.name} city={state.teams.team1.city} logo={state.teams.team1.logo} />
      <div className="rounded-md bg-black/40 px-2 py-1 text-xs text-white/80">{half}</div>
      <div className="rounded-md bg-black/40 px-2 py-1 font-mono text-lg">{timerText}</div>
      <Score score1={state.score.team1} score2={state.score.team2} color={settings.color_score} />
      <TeamBlock name={state.teams.team2.name} city={state.teams.team2.city} logo={state.teams.team2.logo} />
    </div>
  )
}

function TeamBlock({ name, city, logo }: { name: string; city: string; logo: string }) {
  return (
    <div className="flex items-center gap-2">
      {logo ? <img src={logo} alt={name} className="h-10 w-10 rounded object-cover" /> : null}
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-sky-200">{city}</div>
      </div>
    </div>
  )
}

function Score({ score1, score2, color }: { score1: number; score2: number; color: string }) {
  return (
    <div className="rounded-lg bg-black/50 px-4 py-1 text-2xl font-bold" style={{ color }}>
      {score1} : {score2}
    </div>
  )
}
