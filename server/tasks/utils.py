from datetime import datetime


def timestamp_to_datetime(timestamp: float | None) -> datetime:
    return None if timestamp is None else datetime.fromtimestamp(timestamp)
