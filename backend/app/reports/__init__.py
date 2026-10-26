"""JSON-ready responses assembled from the analysis tables (see docs/API.md)."""


class NoDataError(LookupError):
    """The requested day or window has no comparable data (HTTP 404)."""
