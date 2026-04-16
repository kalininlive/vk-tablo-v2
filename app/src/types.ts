export type TeamSide = 'team1' | 'team2'

export interface TeamInfo {
  name: string
  city: string
  logo: string
  color: string
}

export interface MatchState {
  teams: {
    team1: TeamInfo
    team2: TeamInfo
  }
  score: {
    team1: number
    team2: number
  }
  timer: {
    isRunning: boolean
    startTimestamp: number | null
    accumulatedTime: number
    half: number
  }
  pauseScreen: {
    isActive: boolean
    mediaUrl: string
    text: string
    audioUrl: string
  }
  bottomBanner: {
    isActive: boolean
    text: string
    mode: 'scroll' | 'image'
    size: 'S' | 'M' | 'L'
    imageUrl: string
    speed: number
  }
  subtitles: {
    isActive: boolean
    text: string
    size: 'S' | 'M' | 'L'
  }
  goalAnimation: {
    isActive: boolean
    goalId: string
    teamSide: TeamSide
    teamName: string
    newScore: {
      team1: number
      team2: number
    }
    soundPlaylistIds: number[]
    concededPlaylistIds: number[]
    playlistMode: 'sequence' | 'random'
    animationsEnabled: boolean
  }
  ourTeam: TeamSide | null
  cardEvent: {
    isActive: boolean
    cardId: string
    teamSide: TeamSide
    cardType: 'yellow' | 'red'
    playerName: string
  }
  introScreen: {
    isActive: boolean
    startedAt: number | null
    countdown: number | null
    soundPlaylistIds: number[]
    playlistMode: 'sequence' | 'random'
  }
  pauseScreenPlaylist: {
    soundPlaylistIds: number[]
    playlistMode: 'sequence' | 'random'
  }
  sponsorLogo: {
    isActive: boolean
    imageUrl: string
    size: number
  }
  streamTitle: string
}

export interface OverlaySettings {
  id: number
  scale: number
  position: string
  logo_size: number
  glass_enabled: boolean
  backdrop_color: string
  backdrop_opacity: number
  color_team_name: string
  color_city: string
  color_city_badge: string
  color_timer: string
  color_half: string
  timer_warning_min: number
  sponsor_size: number
  scoreboard_style: 'classic' | 'stadium' | 'flat' | 'neon'
  logo_shape: 'square' | 'rounded' | 'circle' | 'circle-border'
  strip_enabled: boolean
  strip_color: string
  score_font: 'default' | 'mono' | 'bold'
  color_score: string
}

export interface VKChannel {
  id: number
  name: string
  rtmp_url: string
  stream_key: string
  is_active: boolean
  created_at: string
}

export interface MediaItem {
  id: number
  name: string
  data_url: string
  created_at: string
}

export interface AppConfig {
  id: number
  username: string
  password_hash: string
  control_api_url: string
  control_secret: string
}

export const defaultMatchState: MatchState = {
  teams: {
    team1: { name: 'Team 1', city: 'City 1', logo: '', color: '#1d4ed8' },
    team2: { name: 'Team 2', city: 'City 2', logo: '', color: '#dc2626' }
  },
  score: { team1: 0, team2: 0 },
  timer: { isRunning: false, startTimestamp: null, accumulatedTime: 0, half: 1 },
  pauseScreen: { isActive: false, mediaUrl: '', text: '', audioUrl: '' },
  bottomBanner: { isActive: false, text: '', mode: 'scroll', size: 'M', imageUrl: '', speed: 30 },
  subtitles: { isActive: false, text: '', size: 'M' },
  goalAnimation: {
    isActive: false,
    goalId: '',
    teamSide: 'team1',
    teamName: '',
    newScore: { team1: 0, team2: 0 },
    soundPlaylistIds: [],
    concededPlaylistIds: [],
    playlistMode: 'sequence',
    animationsEnabled: true
  },
  ourTeam: null,
  cardEvent: { isActive: false, cardId: '', teamSide: 'team1', cardType: 'yellow', playerName: '' },
  introScreen: { isActive: false, startedAt: null, countdown: null, soundPlaylistIds: [], playlistMode: 'sequence' },
  pauseScreenPlaylist: { soundPlaylistIds: [], playlistMode: 'sequence' },
  sponsorLogo: { isActive: false, imageUrl: '', size: 80 },
  streamTitle: ''
}
