from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .ai_engine import ollama_chat


@dataclass(frozen=True)
class ParsedCommand:
    action: Optional[str]
    payload: Dict[str, Any]
    confidence: float = 0.0


_CREATE_TABLE_RE = re.compile(
    r"\b(crea|crear|crea\s+una|crear\s+una)\s+tabla\s+(?P<table>[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ\- ]+)\s+con\s+(?P<fields>.+)$",
    re.IGNORECASE,
)


def _heuristic_parse(message: str) -> Optional[ParsedCommand]:
    """
    Parser rápido para casos comunes. Si no aplica, se delega al LLM.
    """
    msg = (message or "").strip()
    if not msg:
        return None

    m = _CREATE_TABLE_RE.search(msg)
    if m:
        table = (m.group("table") or "").strip().replace(" ", "_")
        fields_raw = (m.group("fields") or "").strip()
        fields = []
        for part in re.split(r"\s*(,|y)\s*", fields_raw):
            part = part.strip()
            if not part or part.lower() in {",", "y"}:
                continue
            name = part.strip().replace(" ", "_")
            fields.append({"name": name, "type": "text"})
        return ParsedCommand("create_table", {"table": table, "fields": fields}, confidence=0.65)

    return None


def llm_parse_to_action_json(*, model: str, message: str, system_id: Optional[int]) -> ParsedCommand:
    system_part = system_id if system_id is not None else "GLOBAL"
    prompt = (
        "Convierte el mensaje del usuario en un JSON de comando para un sistema CRUD.\n"
        "Responde SOLO con JSON válido (sin texto extra).\n"
        "Si no hay acción, devuelve: {\"action\": null, \"payload\": {}, \"confidence\": 0}\n"
        "\n"
        "Acciones soportadas (action):\n"
        "- create_system {name, description?, securityMode?}\n"
        "- update_system {systemId, name?, description?, securityMode?, generalPassword?}\n"
        "- delete_system {systemId}\n"
        "- create_table {systemId?, name, description?, fields:[{name,type,required?,options?,relatedTableId?,relatedDisplayFieldId?}]}\n"
        "- update_table {systemId?, tableId, name?, description?, fields?}\n"
        "- delete_table {systemId?, tableId}\n"
        "- list_tables {systemId?}\n"
        "- list_records {tableId}\n"
        "- create_record {tableId, values:{fieldId:value}}\n"
        "- update_record {tableId, recordId, values:{fieldId:value}}\n"
        "- delete_record {tableId, recordId}\n"
        "- export_table {tableId, format:\"csv\"|\"json\"}\n"
        "- move_table {tableId, targetSystemId}\n"
        "\n"
        f"FOCO_SISTEMA_ID: {system_part}\n"
        f"Mensaje: {message}\n"
    )

    text = ollama_chat(model, [{"role": "user", "content": prompt}])
    try:
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("JSON no-dict")
        return ParsedCommand(
            parsed.get("action"),
            parsed.get("payload") or {},
            float(parsed.get("confidence") or 0.0),
        )
    except Exception:
        return ParsedCommand(None, {}, 0.0)


def parse_command(*, model: str, message: str, system_id: Optional[int]) -> ParsedCommand:
    heur = _heuristic_parse(message)
    if heur:
        return heur
    return llm_parse_to_action_json(model=model, message=message, system_id=system_id)

