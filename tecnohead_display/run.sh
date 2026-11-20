#!/bin/sh
set -eu

if [ -f /data/options.json ]; then
  export HA_URL="$(python -c 'import json, os; p="/data/options.json"; d=json.load(open(p, encoding="utf-8")); print(d.get("ha_url") or os.environ.get("HA_URL", "http://supervisor/core"))')"
  export DISPLAY_REFRESH_SECONDS="$(python -c 'import json, os; p="/data/options.json"; d=json.load(open(p, encoding="utf-8")); print(d.get("refresh_seconds") or os.environ.get("DISPLAY_REFRESH_SECONDS", "10"))')"
fi

export PORT="${PORT:-8099}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers

