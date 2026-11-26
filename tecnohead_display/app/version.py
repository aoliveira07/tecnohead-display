"""Runtime version information shared by the backend and dashboard."""

from __future__ import annotations

import os

APP_NAME = "Tecnohead Display"
APP_VERSION = os.environ.get("TECNOHEAD_DISPLAY_REV", "0.10.1")
