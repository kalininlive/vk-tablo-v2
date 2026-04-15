BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS football_match_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overlay_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  scale NUMERIC NOT NULL DEFAULT 1.0,
  position TEXT NOT NULL DEFAULT 'top-left',
  logo_size INTEGER NOT NULL DEFAULT 64,
  glass_enabled BOOLEAN NOT NULL DEFAULT true,
  backdrop_color TEXT NOT NULL DEFAULT '#000000',
  backdrop_opacity NUMERIC NOT NULL DEFAULT 0,
  color_team_name TEXT NOT NULL DEFAULT '#ffffff',
  color_city TEXT NOT NULL DEFAULT '#93c5fd',
  color_city_badge TEXT NOT NULL DEFAULT '#dc2626',
  color_timer TEXT NOT NULL DEFAULT '#ffffff',
  color_half TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.4)',
  timer_warning_min INTEGER NOT NULL DEFAULT 35,
  sponsor_size INTEGER NOT NULL DEFAULT 80,
  scoreboard_style TEXT NOT NULL DEFAULT 'classic',
  logo_shape TEXT NOT NULL DEFAULT 'rounded',
  strip_enabled BOOLEAN NOT NULL DEFAULT false,
  strip_color TEXT NOT NULL DEFAULT '#ffffff',
  score_font TEXT NOT NULL DEFAULT 'default',
  color_score TEXT NOT NULL DEFAULT '#ffffff',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vk_channels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rtmp_url TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  control_api_url TEXT NOT NULL DEFAULT '',
  control_secret TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS media_library (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  data_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_match_state_updated_at ON football_match_state;
CREATE TRIGGER trg_match_state_updated_at
BEFORE UPDATE ON football_match_state
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_overlay_settings_updated_at ON overlay_settings;
CREATE TRIGGER trg_overlay_settings_updated_at
BEFORE UPDATE ON overlay_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO football_match_state (id, state)
VALUES (
  1,
  '{
    "teams": {
      "team1": {"name": "Team 1", "city": "City 1", "logo": "", "color": "#1d4ed8"},
      "team2": {"name": "Team 2", "city": "City 2", "logo": "", "color": "#dc2626"}
    },
    "score": {"team1": 0, "team2": 0},
    "timer": {"isRunning": false, "startTimestamp": null, "accumulatedTime": 0, "half": 1},
    "pauseScreen": {"isActive": false, "mediaUrl": "", "text": "", "audioUrl": ""},
    "bottomBanner": {"isActive": false, "text": "", "mode": "scroll", "size": "M", "imageUrl": "", "speed": 30},
    "subtitles": {"isActive": false, "text": "", "size": "M"},
    "goalAnimation": {
      "isActive": false,
      "goalId": 0,
      "teamSide": "team1",
      "teamName": "",
      "newScore": {"team1": 0, "team2": 0},
      "soundPlaylistIds": [],
      "concededPlaylistIds": [],
      "playlistMode": "sequence",
      "animationsEnabled": true
    },
    "ourTeam": null,
    "cardEvent": {"isActive": false, "cardId": 0, "teamSide": "team1", "cardType": "yellow", "playerName": ""},
    "introScreen": {"isActive": false, "countdown": null, "soundPlaylistIds": [], "playlistMode": "sequence"},
    "pauseScreenPlaylist": {"soundPlaylistIds": [], "playlistMode": "sequence"},
    "sponsorLogo": {"isActive": false, "imageUrl": "", "size": 80},
    "streamTitle": ""
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO overlay_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_config (id, username, password_hash, control_api_url, control_secret)
VALUES (1, 'admin', '', '', '')
ON CONFLICT (id) DO NOTHING;

GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON football_match_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON overlay_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON vk_channels TO anon;
GRANT ALL ON app_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_library TO anon;

GRANT USAGE, SELECT ON SEQUENCE vk_channels_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE media_library_id_seq TO anon;

ALTER TABLE football_match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vk_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_all_football_match_state ON football_match_state;
CREATE POLICY anon_all_football_match_state ON football_match_state
FOR ALL TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS anon_all_overlay_settings ON overlay_settings;
CREATE POLICY anon_all_overlay_settings ON overlay_settings
FOR ALL TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS anon_all_vk_channels ON vk_channels;
CREATE POLICY anon_all_vk_channels ON vk_channels
FOR ALL TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS anon_all_media_library ON media_library;
CREATE POLICY anon_all_media_library ON media_library
FOR ALL TO anon
USING (true)
WITH CHECK (true);

COMMIT;
