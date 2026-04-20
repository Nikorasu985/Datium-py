from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict

from django.http import JsonResponse
from rest_framework.decorators import api_view

from .ai_engine import AiConfig
from .permissions import ensure_authenticated


# Config simple en memoria.
_CONFIG = AiConfig(model="openrouter:openai/gpt-4o-mini", fallback_model="local:llama3.2", enabled=True)


@api_view(["GET", "PUT"])
def ai_settings_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({"error": perm.reason}, status=401)

    global _CONFIG
    if request.method == "GET":
        return JsonResponse({"ok": True, "config": asdict(_CONFIG)})

    data: Dict[str, Any] = {}
    try:
        data = request.data or {}
    except Exception:
        data = {}

    enabled = data.get("enabled", _CONFIG.enabled)
    model = data.get("model", _CONFIG.model)
    fallback_model = data.get("fallback_model", _CONFIG.fallback_model)
    _CONFIG = AiConfig(model=str(model), fallback_model=str(fallback_model), enabled=bool(enabled))
    return JsonResponse({"ok": True, "config": asdict(_CONFIG)})


def get_ai_config() -> AiConfig:
    return _CONFIG

