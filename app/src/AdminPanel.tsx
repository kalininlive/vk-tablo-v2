import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  checkCredentials,
  useMatchState,
  useMediaLibrary,
  useOverlaySettings,
  useStreamControl,
  useVKChannels
} from './useMatchState'
import { Classic, Flat, Neon, Stadium, Modern, Split } from './scoreboards'

type TabId = 'air' | 'match' | 'design' | 'media' | 'fx' | 'access'

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 3000)
    return () => clearTimeout(id)
  }, [onClose])
  return (
    <div className={`fixed right-3 top-3 z-50 rounded-lg px-4 py-3 shadow-lg ${type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white`}>
      {message}
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-white/20 bg-black/80 p-5">
        <div className="mb-5 text-center text-lg">{message}</div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="min-h-[48px] flex-1 rounded-lg bg-white/10">Отмена</button>
          <button onClick={onConfirm} className="min-h-[48px] flex-1 rounded-lg bg-red-500 font-semibold text-white">Сброс</button>
        </div>
      </div>
    </div>
  )
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'air', label: 'Эфир' },
  { id: 'match', label: 'Матч' },
  { id: 'design', label: 'Дизайн' },
  { id: 'media', label: 'Медиатека' },
  { id: 'fx', label: 'FX эффекты' },
  { id: 'access', label: 'Доступ' }
]

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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
    <div className="mx-auto mt-20 w-full max-w-md rounded-2xl border border-white/20 bg-black/30 p-6">
      <h1 className="mb-4 text-2xl font-bold">VK Tablo v2</h1>
      <p className="mb-6 text-sm text-white/70">Вход в админ-панель</p>
      <form className="space-y-3" onSubmit={submit}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="min-h-[48px] w-full rounded bg-white/10 px-3 py-3" placeholder="Логин" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-[48px] w-full rounded bg-white/10 px-3 py-3" placeholder="Пароль" type="password" />
        <button disabled={loading} className="min-h-[48px] w-full rounded bg-emerald-500 px-3 py-3 font-semibold text-black">
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
  const [now, setNow] = useState(Date.now())
  const [confirmReset, setConfirmReset] = useState(false)

  const { state, patchState, loading } = useMatchState()
  const { settings, patchSettings } = useOverlaySettings()
  const { channels, addChannel, deleteChannel, setActive } = useVKChannels()
  const { items, uploadItem, deleteItem } = useMediaLibrary()
  const stream = useStreamControl()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  const timerMs = useMemo(
    () => state.timer.accumulatedTime + (state.timer.isRunning && state.timer.startTimestamp ? now - state.timer.startTimestamp : 0),
    [now, state.timer.accumulatedTime, state.timer.isRunning, state.timer.startTimestamp]
  )

  if (!auth) {
    return <LoginScreen onSuccess={() => setAuth(true)} />
  }

  if (loading) {
    return <div className="p-6 text-white/70">Загрузка данных...</div>
  }

  const scoreDelta = async (team: 'team1' | 'team2', delta: 1 | -1) => {
    const nextScore = Math.max(0, state.score[team] + delta)
    const newScore = { ...state.score, [team]: nextScore }
    const patch: any = { score: newScore }
    if (delta > 0) {
      patch.goalAnimation = {
        ...state.goalAnimation,
        isActive: true,
        goalId: crypto.randomUUID(),
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
    <div className="min-h-screen pb-20 p-3 md:pb-3 md:p-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 md:mb-4">
          <h1 className="text-xl font-bold md:text-2xl">Пульт трансляции</h1>
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

        <div className="mb-4 hidden flex-wrap gap-2 md:mb-4 md:flex md:flex-nowrap">
          {tabs.map((entry) => (
          <button
            key={entry.id}
            className={`flex-1 rounded px-2 py-2 text-xs md:flex-none md:px-3 md:py-2 md:text-sm ${tab === entry.id ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 md:hidden">
        <div className="flex">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 ${tab === entry.id ? 'text-emerald-400' : 'text-white/60'}`}
            >
              <span className="text-lg">{entry.id === 'air' ? '📺' : entry.id === 'match' ? '⚽' : entry.id === 'design' ? '🎨' : entry.id === 'media' ? '📁' : entry.id === 'fx' ? '🎵' : '🔑'}</span>
              <span className="text-xs">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'air' ? (
        <div className="grid gap-4">
          {/* Блок: Эфир */}
          <section className="rounded-xl border border-white/20 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Эфир</h2>
            <button
              disabled={stream.loading}
              className={`min-h-[48px] w-full rounded-xl py-3 font-bold text-base transition-colors ${stream.streaming ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}
              onClick={() => void (stream.streaming ? stream.stop() : stream.start())}
            >
              {stream.streaming ? '⏹ ОФФЛАЙН' : '▶ В ЭФИР'}
            </button>
            <div className="mt-2 text-center text-sm text-white/50">{stream.streaming ? '🔴 в эфире' : '⚫ остановлен'}</div>
            {stream.message ? <div className="mt-2 text-sm text-amber-300">{stream.message}</div> : null}

            <label className="mt-4 mb-1 block text-sm text-white/70">Наша команда</label>
            <select
              className="min-h-[48px] w-full rounded-lg bg-white/10 px-3 py-2"
              value={state.ourTeam || ''}
              onChange={(e) => void patchState({ ourTeam: (e.target.value || null) as any })}
            >
              <option value="">Не выбрано</option>
              <option value="team1">{state.teams.team1.name}</option>
              <option value="team2">{state.teams.team2.name}</option>
            </select>
          </section>

          {/* Блок: Таймер и счёт */}
          <section className="rounded-xl border border-white/20 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Таймер и счёт</h2>

            {/* Таймер */}
            {(() => {
              const isOverTime = timerMs >= settings.timer_warning_min * 60 * 1000
              return (
                <div className={`mb-1 text-center text-5xl font-mono font-bold tracking-wider transition-colors ${isOverTime ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                  {formatTime(timerMs)}{isOverTime ? ' 🔥' : ''}
                </div>
              )
            })()}

            {/* Тайм */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => void patchState({ timer: { ...state.timer, half: 1 } })}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${state.timer.half === 1 ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70'}`}
              >
                1-й тайм
              </button>
              <button
                onClick={() => void patchState({ timer: { ...state.timer, half: 2 } })}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${state.timer.half === 2 ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70'}`}
              >
                2-й тайм
              </button>
            </div>

            {/* Старт/Стоп + Сброс */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => void toggleRun()}
                className={`flex-1 rounded-lg py-3 font-bold text-base transition-colors ${state.timer.isRunning ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}
              >
                {state.timer.isRunning ? '⏸ СТОП' : '▶ СТАРТ'}
              </button>
              <button
                onClick={() => setConfirmReset(true)}
                className="rounded-lg bg-white/10 px-4 py-3 text-sm text-white/70"
              >
                Сброс
              </button>
            </div>

            {/* Пресеты времени */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {([1, 30, 35, 40, 45] as const).map((min) => (
                <button
                  key={min}
                  onClick={() => void patchState({ timer: { ...state.timer, isRunning: false, startTimestamp: null, accumulatedTime: min * 60 * 1000 } })}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20 transition-colors"
                >
                  {min} мин
                </button>
              ))}
            </div>

            <ScoreRow name={state.teams.team1.name} score={state.score.team1} onPlus={() => void scoreDelta('team1', 1)} onMinus={() => void scoreDelta('team1', -1)} />
            <ScoreRow name={state.teams.team2.name} score={state.score.team2} onPlus={() => void scoreDelta('team2', 1)} onMinus={() => void scoreDelta('team2', -1)} />
          </section>

          {/* Блок: Быстрые эффекты */}
          <section className="rounded-xl border border-white/20 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Быстрые эффекты</h2>
            <div className="space-y-2">
              <Toggle label="Пауза" value={state.pauseScreen.isActive} onChange={(value) => void patchState({ pauseScreen: { ...state.pauseScreen, isActive: value } })} />
              <Toggle label="Нижний баннер" value={state.bottomBanner.isActive} onChange={(value) => void patchState({ bottomBanner: { ...state.bottomBanner, isActive: value } })} />
              <Toggle label="Субтитры" value={state.subtitles.isActive} onChange={(value) => void patchState({ subtitles: { ...state.subtitles, isActive: value } })} />
              <Toggle
                label="Интро"
                value={state.introScreen.isActive}
                onChange={(value) =>
                  void patchState({ introScreen: { ...state.introScreen, isActive: value, startedAt: value ? Date.now() : null } })
                }
              />
              <Toggle label="Логотип спонсора" value={state.sponsorLogo.isActive} onChange={(value) => void patchState({ sponsorLogo: { ...state.sponsorLogo, isActive: value } })} />
            </div>

            {/* Карточки по командам */}
            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold text-white/70">Карточки</div>
              <input
                className="min-h-[48px] mb-3 w-full rounded-lg bg-white/10 px-3 py-3 text-sm"
                placeholder="Имя игрока"
                value={state.cardEvent.playerName}
                onChange={(e) => void patchState({ cardEvent: { ...state.cardEvent, playerName: e.target.value } })}
              />
              {(['team1', 'team2'] as const).map((team) => (
                <div key={team} className="mb-2 flex min-h-[48px] items-center gap-2 rounded-lg bg-white/5 px-2 py-2">
                  <span className="flex-1 truncate text-sm">{state.teams[team].name}</span>
                  <button
                    type="button"
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-yellow-400 px-3 font-bold text-black"
                    onClick={() => void patchState({ cardEvent: { ...state.cardEvent, isActive: true, cardId: crypto.randomUUID(), teamSide: team, cardType: 'yellow' } })}
                  >
                    Ж
                  </button>
                  <button
                    type="button"
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-red-600 px-3 font-bold text-white"
                    onClick={() => void patchState({ cardEvent: { ...state.cardEvent, isActive: true, cardId: crypto.randomUUID(), teamSide: team, cardType: 'red' } })}
                  >
                    К
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="min-h-[48px] mt-1 w-full rounded-lg bg-white/10 py-2 text-sm text-white/60"
                onClick={() => void patchState({ cardEvent: { ...state.cardEvent, isActive: false } })}
              >
                Скрыть карточку
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'match' ? <div className="max-w-[1280px]"><MatchTab state={state} patchState={patchState} channels={channels} /></div> : null}
      {tab === 'design' ? <div className="max-w-[1280px]"><DesignTab settings={settings} patchSettings={patchSettings} /></div> : null}
      {tab === 'media' ? <div className="max-w-[1280px]"><MediaTab onUpload={uploadItem} items={items} onDelete={deleteItem} /></div> : null}
      {tab === 'fx' ? <div className="max-w-[1280px]"><FxTab state={state} patchState={patchState} items={items} /></div> : null}
      {tab === 'access' ? <div className="max-w-[1280px]"><AccessTab channels={channels} onAdd={addChannel} onDelete={deleteChannel} onActive={setActive} /></div> : null}

      {confirmReset && (
        <ConfirmModal
          message="Сбросить таймер и счёт?"
          onConfirm={async () => {
            setConfirmReset(false)
            await patchState({
              timer: { ...state.timer, isRunning: false, startTimestamp: null, accumulatedTime: 0, half: 1 },
              score: { team1: 0, team2: 0 }
            })
            setToast({ message: 'Сброшено', type: 'success' })
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 transition-all ${value ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-white/5 border border-white/10'}`}
    >
      <span className={`font-medium transition-colors ${value ? 'text-emerald-300' : 'text-white/70'}`}>{label}</span>
      <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${value ? 'bg-emerald-500' : 'bg-white/20'}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function ScoreRow({ name, score, onPlus, onMinus }: { name: string; score: number; onPlus: () => void; onMinus: () => void }) {
  return (
    <div className="mb-2 flex min-h-[48px] items-center justify-between rounded bg-white/5 px-3 last:mb-0">
      <div className="truncate">{name}</div>
      <div className="flex items-center gap-2">
        <button onClick={onMinus} className="min-h-[40px] min-w-[40px] rounded-lg bg-white/10 px-3">
          -1
        </button>
        <span className="w-8 text-center text-xl font-bold">{score}</span>
        <button onClick={onPlus} className="min-h-[40px] min-w-[40px] rounded-lg bg-white/10 px-3">
          +1
        </button>
      </div>
    </div>
  )
}

function MatchTab({ state, patchState, channels }: any) {
  const uploadTeamLogo = async (team: 'team1' | 'team2', file: File | null) => {
    if (!file) return
    const logo = await fileToDataUrl(file)
    await patchState({ teams: { ...state.teams, [team]: { ...state.teams[team], logo } } })
  }

  const uploadBottomImage = async (file: File | null) => {
    if (!file) return
    const imageUrl = await fileToDataUrl(file)
    await patchState({ bottomBanner: { ...state.bottomBanner, imageUrl, mode: 'image' } })
  }

  const uploadPauseMedia = async (file: File | null) => {
    if (!file) return
    const mediaUrl = await fileToDataUrl(file)
    await patchState({ pauseScreen: { ...state.pauseScreen, mediaUrl } })
  }

  const uploadPauseAudio = async (file: File | null) => {
    if (!file) return
    const audioUrl = await fileToDataUrl(file)
    await patchState({ pauseScreen: { ...state.pauseScreen, audioUrl } })
  }

  const uploadSponsor = async (file: File | null) => {
    if (!file) return
    const imageUrl = await fileToDataUrl(file)
    await patchState({ sponsorLogo: { ...state.sponsorLogo, imageUrl } })
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-white/20 bg-black/30 p-4">
        <h2 className="mb-3 text-lg font-semibold">Команды</h2>
        <TeamEditor teamKey="team1" state={state} patchState={patchState} onUpload={uploadTeamLogo} />
        <TeamEditor teamKey="team2" state={state} patchState={patchState} onUpload={uploadTeamLogo} />
      </section>

      <section className="rounded-xl border border-white/20 bg-black/30 p-4">
        <h2 className="mb-3 text-lg font-semibold">Контент</h2>
        <label className="mb-1 block text-sm">Заголовок трансляции</label>
        <input className="mb-3 w-full rounded bg-white/10 px-3 py-2" value={state.streamTitle} onChange={(e) => void patchState({ streamTitle: e.target.value })} />

        <label className="mb-1 block text-sm">Нижний баннер текст</label>
        <input className="mb-2 w-full rounded bg-white/10 px-3 py-2" value={state.bottomBanner.text} onChange={(e) => void patchState({ bottomBanner: { ...state.bottomBanner, text: e.target.value } })} />
        <div className="mb-2 flex gap-2">
          <select className="rounded bg-white/10 px-2 py-1" value={state.bottomBanner.mode} onChange={(e) => void patchState({ bottomBanner: { ...state.bottomBanner, mode: e.target.value as any } })}>
            <option value="scroll">Scroll</option>
            <option value="image">Image</option>
          </select>
          <input type="number" className="w-24 rounded bg-white/10 px-2" value={state.bottomBanner.speed} onChange={(e) => void patchState({ bottomBanner: { ...state.bottomBanner, speed: Number(e.target.value) || 30 } })} />
          <select className="rounded bg-white/10 px-2 py-1" value={state.bottomBanner.size} onChange={(e) => void patchState({ bottomBanner: { ...state.bottomBanner, size: e.target.value as any } })}>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
          </select>
        </div>
        <input type="file" className="mb-3 w-full rounded bg-white/10 px-2 py-1" onChange={(e) => void uploadBottomImage(e.target.files?.[0] || null)} />

        <label className="mb-1 block text-sm">Субтитры</label>
        <input className="mb-2 w-full rounded bg-white/10 px-3 py-2" value={state.subtitles.text} onChange={(e) => void patchState({ subtitles: { ...state.subtitles, text: e.target.value } })} />

        <label className="mb-1 block text-sm">Заставка паузы (медиа + аудио)</label>
        <input type="file" className="mb-2 w-full rounded bg-white/10 px-2 py-1" onChange={(e) => void uploadPauseMedia(e.target.files?.[0] || null)} />
        <input type="file" className="mb-2 w-full rounded bg-white/10 px-2 py-1" onChange={(e) => void uploadPauseAudio(e.target.files?.[0] || null)} />
        <input className="mb-2 w-full rounded bg-white/10 px-3 py-2" value={state.pauseScreen.text} onChange={(e) => void patchState({ pauseScreen: { ...state.pauseScreen, text: e.target.value } })} placeholder="Текст паузы" />

        <label className="mb-1 block text-sm">Интро countdown</label>
        <input type="number" className="mb-2 w-24 rounded bg-white/10 px-3 py-2" value={state.introScreen.countdown || 10} onChange={(e) => void patchState({ introScreen: { ...state.introScreen, countdown: Number(e.target.value) || 10 } })} />

        <label className="mb-1 block text-sm">Логотип спонсора</label>
        <input type="file" className="mb-2 w-full rounded bg-white/10 px-2 py-1" onChange={(e) => void uploadSponsor(e.target.files?.[0] || null)} />
        <input type="range" min={40} max={200} value={state.sponsorLogo.size} onChange={(e) => void patchState({ sponsorLogo: { ...state.sponsorLogo, size: Number(e.target.value) } })} className="w-full" />

        <label className="mt-3 mb-1 block text-sm">Активный VK канал</label>
        <select
          className="w-full rounded bg-white/10 px-3 py-2"
          value={channels.find((it: any) => it.is_active)?.id || ''}
          onChange={(e) => {
            const id = Number(e.target.value)
            if (id) {
              const channel = channels.find((it: any) => it.id === id)
              if (channel) {
                void patchState({ streamTitle: channel.name })
              }
            }
          }}
        >
          <option value="">Выбери в вкладке Доступ</option>
          {channels.map((channel: any) => (
            <option key={channel.id} value={channel.id}>{channel.name}</option>
          ))}
        </select>
      </section>
    </div>
  )
}

function TeamEditor({ teamKey, state, patchState, onUpload }: any) {
  const team = state.teams[teamKey]
  return (
    <div className="mb-4 rounded-lg bg-white/5 p-3 last:mb-0">
      <div className="mb-2 font-semibold">{teamKey === 'team1' ? 'Команда 1' : 'Команда 2'}</div>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded bg-white/10 px-3 py-2" value={team.name} placeholder="Название" onChange={(e) => void patchState({ teams: { ...state.teams, [teamKey]: { ...team, name: e.target.value } } })} />
        <input className="rounded bg-white/10 px-3 py-2" value={team.city} placeholder="Город" onChange={(e) => void patchState({ teams: { ...state.teams, [teamKey]: { ...team, city: e.target.value } } })} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input type="color" value={team.color} onChange={(e) => void patchState({ teams: { ...state.teams, [teamKey]: { ...team, color: e.target.value } } })} />
        <input type="file" className="w-full rounded bg-white/10 px-2 py-1" onChange={(e) => void onUpload(teamKey, e.target.files?.[0] || null)} />
      </div>
    </div>
  )
}

function ScoreboardPreview({ settings }: { settings: any }) {
  const dummyState = {
    teams: { team1: { name: 'Команда 1', city: 'Москва', logo: '', color: '#ef4444' }, team2: { name: 'Команда 2', city: 'СПб', logo: '', color: '#3b82f6' } },
    score: { team1: 2, team2: 1 },
    timer: { isRunning: false, half: 1, accumulatedTime: 2700000, startTimestamp: null },
    goalAnimation: { isActive: false, goalId: '', teamSide: 'team1', teamName: '', newScore: { team1: 0, team2: 0 }, soundPlaylistIds: [], concededPlaylistIds: [], animationsEnabled: true, playlistMode: 'sequence', volume: 1 },
    pauseScreen: { isActive: false, text: '', mediaUrl: '', audioUrl: '', mode: 'text' },
    bottomBanner: { isActive: false, text: '', imageUrl: '', mode: 'scroll', speed: 30, size: 'M' },
    subtitles: { isActive: false, text: '', size: 'M' },
    introScreen: { isActive: false, startedAt: null, countdown: 10, soundPlaylistIds: [], playlistMode: 'sequence', volume: 1 },
    sponsorLogo: { isActive: false, imageUrl: '', size: 80 },
    cardEvent: { isActive: false, playerName: '', cardId: '', teamSide: 'team1', cardType: 'yellow' },
    streamTitle: '',
    ourTeam: null,
    pauseScreenPlaylist: { soundPlaylistIds: [], playlistMode: 'sequence', volume: 1 }
  }
  const timerText = '45:00'
  const PreviewComponent = { classic: Classic, stadium: Stadium, flat: Flat, neon: Neon, modern: Modern, split: Split }[settings.scoreboard_style] || Classic
  const scale = settings.scale || 1
  
  const posMap = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4'
  }
  const positionClass = posMap[settings.position as keyof typeof posMap] || 'top-4 left-4'
  
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '16/9' }}>
      <div 
        className={`absolute ${positionClass}`}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <PreviewComponent state={dummyState} settings={settings} timerText={timerText} />
      </div>
    </div>
  )
}

function DesignTab({ settings, patchSettings }: any) {
  return (
    <section className="rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-3 text-lg font-semibold">Дизайн оверлея</h2>
      
      <div className="mb-4">
        <span className="mb-1 block text-sm">Превью</span>
        <ScoreboardPreview settings={settings} />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Общие</h3>
          <label className="block">
            <span className="mb-1 block text-sm">Стиль табло</span>
            <select className="w-full rounded bg-white/10 px-3 py-2" value={settings.scoreboard_style} onChange={(e) => void patchSettings({ scoreboard_style: e.target.value })}>
              <option value="classic">Classic</option>
              <option value="stadium">Stadium</option>
              <option value="flat">Flat</option>
              <option value="neon">Neon</option>
              <option value="modern">Modern (UEFA)</option>
              <option value="split">Split (pre-match)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Scale {settings.scale.toFixed(2)}x</span>
            <input type="range" min={0.5} max={2} step={0.05} value={settings.scale} onChange={(e) => void patchSettings({ scale: Number(e.target.value) })} className="w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Позиция</span>
            <select className="w-full rounded bg-white/10 px-3 py-2" value={settings.position} onChange={(e) => void patchSettings({ position: e.target.value })}>
              {['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </label>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Тайминг</h3>
          <label className="block">
            <span className="mb-1 block text-sm">Timer warning min</span>
            <input type="number" className="w-full rounded bg-white/10 px-3 py-2" value={settings.timer_warning_min} onChange={(e) => void patchSettings({ timer_warning_min: Number(e.target.value) || 35 })} />
          </label>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Визуальные эффекты</h3>
          <Toggle label="Glass effect" value={settings.glass_enabled} onChange={(value) => void patchSettings({ glass_enabled: value })} />
          <Toggle label="Accent strip" value={settings.strip_enabled} onChange={(value) => void patchSettings({ strip_enabled: value })} />
          <label className="block">
            <span className="mb-1 block text-sm">Backdrop opacity {Math.round(settings.backdrop_opacity * 100)}%</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.backdrop_opacity} onChange={(e) => void patchSettings({ backdrop_opacity: Number(e.target.value) })} className="w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Backdrop color</span>
            <input type="color" value={settings.backdrop_color} onChange={(e) => void patchSettings({ backdrop_color: e.target.value })} />
          </label>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Цвета</h3>
          <ColorInput label="Team name" value={settings.color_team_name} onChange={(value) => void patchSettings({ color_team_name: value })} />
          <ColorInput label="City" value={settings.color_city} onChange={(value) => void patchSettings({ color_city: value })} />
          <ColorInput label="Timer" value={settings.color_timer} onChange={(value) => void patchSettings({ color_timer: value })} />
          <ColorInput label="Half" value={settings.color_half.startsWith('#') ? settings.color_half : '#ffffff'} onChange={(value) => void patchSettings({ color_half: value })} />
          <ColorInput label="Score" value={settings.color_score} onChange={(value) => void patchSettings({ color_score: value })} />
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Логотип</h3>
          <label className="block">
            <span className="mb-1 block text-sm">Logo shape</span>
            <select className="w-full rounded bg-white/10 px-3 py-2" value={settings.logo_shape} onChange={(e) => void patchSettings({ logo_shape: e.target.value })}>
              {['square', 'rounded', 'circle', 'circle-border'].map((shape) => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Score font</span>
            <select className="w-full rounded bg-white/10 px-3 py-2" value={settings.score_font} onChange={(e) => void patchSettings({ score_font: e.target.value })}>
              {['default', 'mono', 'bold'].map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Действия</h3>
        <button
          className="rounded bg-white/10 px-3 py-2"
          onClick={() =>
            void patchSettings({
              scale: 1,
              position: 'top-left',
              logo_size: 64,
              glass_enabled: true,
              backdrop_color: '#000000',
              backdrop_opacity: 0,
              color_team_name: '#ffffff',
              color_city: '#93c5fd',
              color_city_badge: '#dc2626',
              color_timer: '#ffffff',
              color_half: 'rgba(255,255,255,0.4)',
              timer_warning_min: 35,
              sponsor_size: 80,
              scoreboard_style: 'classic',
              logo_shape: 'rounded',
              strip_enabled: false,
              strip_color: '#ffffff',
              score_font: 'default',
              color_score: '#ffffff'
            })
          }
        >
            Сбросить по умолчанию
          </button>
          <div className="mt-4 flex gap-2">
            <button
              className="flex-1 rounded bg-blue-500/80 px-3 py-2 text-sm"
              onClick={() => {
                const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'overlay-settings.json'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Экспорт
            </button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              id="import-settings"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (ev) => {
                  try {
                    const imported = JSON.parse(ev.target?.result as string)
                    patchSettings(imported)
                  } catch {
                    alert('Ошибка импорта')
                }
              }
              reader.readAsText(file)
            }}
          />
          <label htmlFor="import-settings" className="flex-1 cursor-pointer rounded bg-emerald-500/80 px-3 py-2 text-center text-sm">
            Импорт
          </label>
        </div>
        </div>
      </div>
    </section>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function MediaTab({ items, onUpload, onDelete }: any) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const upload = async () => {
    if (!file || !name) return
    const dataUrl = await fileToDataUrl(file)
    await onUpload(name, dataUrl)
    setName('')
    setFile(null)
  }

  const audioItems = items.filter((i: any) => i.data_url.startsWith('data:audio/'))

  return (
    <section className="rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-3 text-lg font-semibold">Медиатека</h2>
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded bg-white/10 px-3 py-2" placeholder="Название" />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="rounded bg-white/10 px-3 py-2" />
        <button onClick={() => void upload()} className="rounded bg-emerald-500 px-3 py-2 text-black">Загрузить</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item: any) => (
          <div key={item.id} className="rounded bg-white/5 p-3">
            <div className="truncate font-medium">{item.name}</div>
            {item.data_url.startsWith('data:image/') ? <img src={item.data_url} alt={item.name} className="mt-2 h-20 w-full rounded object-cover" /> : null}
            {item.data_url.startsWith('data:audio/') ? <audio controls src={item.data_url} className="mt-2 w-full" /> : null}
            <button onClick={() => void onDelete(item.id)} className="mt-2 rounded bg-red-500/80 px-3 py-1 text-sm">Удалить</button>
          </div>
        ))}
      </div>
      {audioItems.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-sm text-white/70">Аудио для плейлистов (ID: {audioItems.map((i: any) => i.id).join(', ')})</div>
        </div>
      )}
    </section>
  )
}

function MediaPicker({ items, selectedIds, onChange, label }: { items: any[]; selectedIds: number[]; onChange: (ids: number[]) => void; label: string }) {
  const audioItems = items.filter((i) => i.data_url.startsWith('data:audio/'))
  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }
  return (
    <div className="mb-3">
      <div className="mb-2 text-sm text-white/70">{label}</div>
      <div className="grid max-h-32 grid-cols-3 gap-2 overflow-y-auto md:grid-cols-4">
        {audioItems.map((item: any) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`truncate rounded p-2 text-xs ${selectedIds.includes(item.id) ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}
          >
            {item.name}
          </button>
        ))}
      </div>
      {audioItems.length === 0 && <div className="text-xs text-white/40">Нет аудио в медиатеке</div>}
    </div>
  )
}

function FxTab({ state, patchState, items }: any) {
  const parseIds = (value: string) =>
    value
      .split(',')
      .map((it) => Number(it.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)

  const updatePlaylist = (key: string, ids: number[]) => {
    const dots = ids.join(',')
    if (key === 'goal') {
      patchState({ goalAnimation: { ...state.goalAnimation, soundPlaylistIds: ids } })
    } else if (key === 'conceded') {
      patchState({ goalAnimation: { ...state.goalAnimation, concededPlaylistIds: ids } })
    } else if (key === 'intro') {
      patchState({ introScreen: { ...state.introScreen, soundPlaylistIds: ids } })
    } else if (key === 'pause') {
      patchState({ pauseScreenPlaylist: { ...state.pauseScreenPlaylist, soundPlaylistIds: ids } })
    }
  }

  return (
    <section className="max-w-[1280px] rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-2 text-lg font-semibold">FX плейлисты</h2>
      <MediaPicker label="Голы" items={items} selectedIds={state.goalAnimation.soundPlaylistIds} onChange={(ids) => updatePlaylist('goal', ids)} />
      <label className="block">
        <span className="mb-1 block text-sm">Громкость: Голы {Math.round(state.goalAnimation.volume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.1} value={state.goalAnimation.volume} onChange={(e) => void patchState({ goalAnimation: { ...state.goalAnimation, volume: Number(e.target.value) } })} className="w-full" />
      </label>
      <MediaPicker label="Пропущенные" items={items} selectedIds={state.goalAnimation.concededPlaylistIds} onChange={(ids) => updatePlaylist('conceded', ids)} />
      <MediaPicker label="Интро" items={items} selectedIds={state.introScreen.soundPlaylistIds} onChange={(ids) => updatePlaylist('intro', ids)} />
      <label className="block">
        <span className="mb-1 block text-sm">Громкость: Интро {Math.round(state.introScreen.volume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.1} value={state.introScreen.volume} onChange={(e) => void patchState({ introScreen: { ...state.introScreen, volume: Number(e.target.value) } })} className="w-full" />
      </label>
      <MediaPicker label="Пауза" items={items} selectedIds={state.pauseScreenPlaylist.soundPlaylistIds} onChange={(ids) => updatePlaylist('pause', ids)} />
      <label className="block">
        <span className="mb-1 block text-sm">Громкость: Пауза {Math.round(state.pauseScreenPlaylist.volume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.1} value={state.pauseScreenPlaylist.volume} onChange={(e) => void patchState({ pauseScreenPlaylist: { ...state.pauseScreenPlaylist, volume: Number(e.target.value) } })} className="w-full" />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm">Голы (soundPlaylistIds)</span>
          <input
            className="w-full rounded bg-white/10 px-3 py-2"
            value={state.goalAnimation.soundPlaylistIds.join(',')}
            onChange={(e) => void patchState({ goalAnimation: { ...state.goalAnimation, soundPlaylistIds: parseIds(e.target.value) } })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Пропущенные (concededPlaylistIds)</span>
          <input
            className="w-full rounded bg-white/10 px-3 py-2"
            value={state.goalAnimation.concededPlaylistIds.join(',')}
            onChange={(e) => void patchState({ goalAnimation: { ...state.goalAnimation, concededPlaylistIds: parseIds(e.target.value) } })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Интро playlist</span>
          <input className="w-full rounded bg-white/10 px-3 py-2" value={state.introScreen.soundPlaylistIds.join(',')} onChange={(e) => void patchState({ introScreen: { ...state.introScreen, soundPlaylistIds: parseIds(e.target.value) } })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Пауза playlist</span>
          <input className="w-full rounded bg-white/10 px-3 py-2" value={state.pauseScreenPlaylist.soundPlaylistIds.join(',')} onChange={(e) => void patchState({ pauseScreenPlaylist: { ...state.pauseScreenPlaylist, soundPlaylistIds: parseIds(e.target.value) } })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Режим плейлиста: Голы</span>
          <select className="w-full rounded bg-white/10 px-3 py-2" value={state.goalAnimation.playlistMode} onChange={(e) => void patchState({ goalAnimation: { ...state.goalAnimation, playlistMode: e.target.value } })}>
            <option value="sequence">sequence</option>
            <option value="random">random</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Режим плейлиста: Интро</span>
          <select className="w-full rounded bg-white/10 px-3 py-2" value={state.introScreen.playlistMode} onChange={(e) => void patchState({ introScreen: { ...state.introScreen, playlistMode: e.target.value } })}>
            <option value="sequence">sequence</option>
            <option value="random">random</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Режим плейлиста: Пауза</span>
          <select className="w-full rounded bg-white/10 px-3 py-2" value={state.pauseScreenPlaylist.playlistMode} onChange={(e) => void patchState({ pauseScreenPlaylist: { ...state.pauseScreenPlaylist, playlistMode: e.target.value } })}>
            <option value="sequence">sequence</option>
            <option value="random">random</option>
          </select>
        </label>
        <Toggle label="Анимации голов" value={state.goalAnimation.animationsEnabled} onChange={(value) => void patchState({ goalAnimation: { ...state.goalAnimation, animationsEnabled: value } })} />
      </div>
    </section>
  )
}

function AccessTab({ channels, onAdd, onDelete, onActive }: any) {
  const [name, setName] = useState('VK Channel')
  const [rtmp, setRtmp] = useState('rtmp://ovsu.okcdn.ru/input/')
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  return (
    <section className="rounded-xl border border-white/20 bg-black/30 p-4">
      <h2 className="mb-3 text-lg font-semibold">VK каналы</h2>
      <div className="mb-4 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="min-h-[48px] w-full rounded bg-white/10 px-3 py-3" placeholder="Название" />
        <input value={rtmp} onChange={(e) => setRtmp(e.target.value)} className="min-h-[48px] w-full rounded bg-white/10 px-3 py-3" placeholder="RTMP URL" />
        <div className="flex gap-2">
          <input type={showKey ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} className="min-h-[48px] flex-1 rounded bg-white/10 px-3 py-3" placeholder="Stream key" />
          <button onClick={() => setShowKey(!showKey)} className={`min-h-[48px] rounded bg-white/10 px-3 py-2 text-sm ${showKey ? 'text-yellow-400' : ''}`}>
            {showKey ? '🙈' : '👁'}
          </button>
          <button
            onClick={() => {
              if (!name || !rtmp || !key) return
              void onAdd(name, rtmp, key)
              setKey('')
            }}
            className="min-h-[48px] flex-1 rounded bg-emerald-500 px-3 py-3 text-black"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {channels.map((channel: any) => (
          <div key={channel.id} className="rounded bg-white/5 p-3">
            <div className="mb-1 font-semibold">{channel.name}</div>
            <div className="text-xs text-white/70">{channel.rtmp_url}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => void onActive(channel.id)} className={`rounded px-3 py-1 text-sm ${channel.is_active ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}>
                {channel.is_active ? 'Активен' : 'Сделать активным'}
              </button>
              <button onClick={() => void onDelete(channel.id)} className="rounded bg-red-500/80 px-3 py-1 text-sm">Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
