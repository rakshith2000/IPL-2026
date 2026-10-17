"""Shaping values for the templates and the JSON feeds."""
from datetime import datetime, date, time

def serialize(obj):
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize(i) for i in obj]
    elif isinstance(obj, (time, datetime, date)):
        return obj.isoformat()
    else:
        return obj

def num_suffix(num):
    if num % 100 in [11, 12, 13]:
        return str(num) + "th"
    elif (num % 10) == 1:
        return str(num) + "st"
    elif (num % 10) == 2:
        return str(num) + "nd"
    elif (num % 10) == 3:
        return str(num) + "rd"
    else:
        return str(num) + "th"
