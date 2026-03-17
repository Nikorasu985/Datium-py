from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class SystemContext:
    system_id: Optional[int] = None


def get_active_system_id_from_request(request) -> Optional[int]:
    sys_id = None
    try:
        sys_id = request.data.get("system_id")
    except Exception:
        pass
    if sys_id is None:
        try:
            sys_id = request.POST.get("system_id")
        except Exception:
            sys_id = None

    if sys_id in (None, "", "null", "None"):
        return None
    try:
        return int(sys_id)
    except Exception:
        return None

