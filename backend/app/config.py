"""Central configuration. Values can be overridden with environment variables."""
import os

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1/datasets")
CACHE_DIR = os.getenv("CACHE_DIR", "data/cache")

# Decision rule: UK day-ahead purchases for delivery day D are made on D-1.
# Decision cutoff = D-1 at DECISION_CUTOFF_LOCAL (Europe/London). The default is an
# assumption to confirm with the product owner (see README "Open questions").
DECISION_LEAD_DAYS = int(os.getenv("DECISION_LEAD_DAYS", "1"))
DECISION_CUTOFF_LOCAL = os.getenv("DECISION_CUTOFF_LOCAL", "11:00")
LOCAL_TZ = os.getenv("LOCAL_TZ", "Europe/London")
