#!/bin/sh
set -eu

if [ -f /data/options.json ]; then
  export HA_URL="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get(sys.argv[1].upper(), sys.argv[2]))' ha_url "http://supervisor/core")"
  export DISPLAY_REFRESH_SECONDS="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("DISPLAY_REFRESH_SECONDS", sys.argv[2]))' refresh_seconds 10)"
  export IMMICH_URL="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("IMMICH_URL", sys.argv[2]))' immich_url "http://192.168.0.201:2283")"
  export IMMICH_API_KEY="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("IMMICH_API_KEY", sys.argv[2]))' immich_api_key "")"
  export IMMICH_ALBUM_ID="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("IMMICH_ALBUM_ID", sys.argv[2]))' immich_album_id "")"
  export PHOTO_SYNC_MINUTES="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("PHOTO_SYNC_MINUTES", sys.argv[2]))' photo_sync_minutes 10)"
  export PHOTO_IDLE_SECONDS="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("PHOTO_IDLE_SECONDS", sys.argv[2]))' photo_idle_seconds 180)"
  export PHOTO_INTERVAL_SECONDS="$(python -c 'import json, os, sys; d=json.load(open("/data/options.json", encoding="utf-8")); print(d.get(sys.argv[1]) or os.environ.get("PHOTO_INTERVAL_SECONDS", sys.argv[2]))' photo_interval_seconds 12)"
fi

export PORT="${PORT:-8099}"
export PHOTO_CACHE_DIR="${PHOTO_CACHE_DIR:-/data/photo-frame}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers

