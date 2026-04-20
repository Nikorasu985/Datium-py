from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests
from api.models import System, SystemField, SystemRecord, SystemRecordValue, SystemTable, User


@dataclass(frozen=True)
class AiConfig:
    model: str = "openrouter:openai/gpt-4o-mini"
    fallback_model: str = "local:llama3.2"
    enabled: bool = True
    chatbot_id: str = "datium-default"


def build_schema_context(user: User, system_id: Optional[int]) -> str:
    systems = System.objects.filter(owner=user)
    if system_id:
        systems = systems.filter(id=system_id)

    if not systems.exists():
        return "El usuario no tiene sistemas registrados en este contexto."

    out = ["ESTRUCTURA COMPLETA DE DATOS (CRUD HABILITADO):"]
    for s in systems:
        out.append(f"[SISTEMA: {s.name} (ID:{s.id})]")
        for t in SystemTable.objects.filter(system=s).order_by("name"):
            fields = SystemField.objects.filter(table=t).order_by("order_index")
            f_list = ", ".join([f"{f.name}:{f.id}({f.type})" for f in fields])
            out.append(f" - {t.name} (ID:{t.id}): {f_list}")
    return "\n".join(out)


def _resolve_relation_value(field: SystemField, value: Any) -> Any:
    if not value or field.type != "relation" or not field.related_table_id:
        return value
    try:
        rel_rec_id = int(str(value).strip())
        related_record = SystemRecord.objects.get(id=rel_rec_id)
        display_field = field.related_display_field
        if display_field:
            val_obj = SystemRecordValue.objects.filter(record=related_record, field=display_field).first()
            if val_obj:
                return val_obj.value
        first_val = SystemRecordValue.objects.filter(record=related_record).first()
        return first_val.value if first_val else f"Ref:{value}"
    except Exception:
        return value


def build_real_data_context(user: User, message: str, system_id: Optional[int]) -> str:
    systems = System.objects.filter(owner=user)
    if system_id:
        systems = systems.filter(id=system_id)

    all_tables = SystemTable.objects.filter(system__in=systems)
    message_lower = (message or "").lower()

    mentioned = []
    if system_id and all_tables.exists():
        mentioned = list(all_tables)
    else:
        for t in all_tables:
            if t.name.lower() in message_lower or any(len(w) > 3 and w.lower() in message_lower for w in t.name.split()):
                mentioned.append(t)

    if not mentioned:
        return ""

    parts = ["DATOS REALES ENCONTRADOS (USA ESTOS DATOS LITERALES, NO INVENTES):"]
    for t in mentioned:
        fields = list(SystemField.objects.filter(table=t).order_by("order_index"))
        f_header = " | ".join([f.name for f in fields])
        records = SystemRecord.objects.filter(table=t).order_by("-id")[:20]

        rows = []
        for rec in records:
            vals = SystemRecordValue.objects.filter(record=rec).select_related("field")
            row_dict = {v.field.name: _resolve_relation_value(v.field, v.value) for v in vals}
            row_str = " | ".join([str(row_dict.get(f.name, "")) for f in fields])
            rows.append(f"| {row_str} |")

        if not rows:
            parts.append(f"\n[TABLA: {t.name}]\nCOLUMNAS: {f_header}\n(La tabla está vacía.)")
        else:
            parts.append(f"\n[TABLA: {t.name}]\nCOLUMNAS: {f_header}\n" + "\n".join(rows))

    return "\n".join(parts)


def build_system_prompt(*, user: User, system_id: Optional[int], user_message: str, file_context: str = "") -> str:
    schema = build_schema_context(user, system_id)
    real_data = build_real_data_context(user, user_message, system_id)
    user_name = (user.name or user.email or "Usuario").strip()

    return (
        "Eres la IA administrativa integrada de Datium.\n"
        "Hablas natural, ejecutiva, formal, clara y precisa. Jamás suenas robótica ni repites plantillas.\n"
        "REGLA CRÍTICA DE FORMATO: ESTÁ ESTRICTAMENTE PROHIBIDO USAR MARKDOWN. NO uses asteriscos (**), ni numerales (##), ni signos de más (++). Tu respuesta debe ser texto plano y formal.\n"
        "Tienes el mismo contexto operativo del usuario logueado dentro del sistema.\n"
        "\n"
        "REGLAS:\n"
        "- Responde como una persona formal, y cuando toque operar el sistema sé altamente precisa y ejecutiva.\n"
        "- Usa párrafos breves y directos. Evita listas decorativas innecesarias.\n"
        "- No inventes datos. Si no hay filas, responde literalmente: \"La tabla está vacía.\".\n"
        "- Siempre respeta el FOCO (sistema activo). Si existe un sistema enfocado, toda consulta o acción debe resolverse ahí.\n"
        "- Nunca reutilices plantillas fijas antiguas como asistencia escolar, CRM u otras, a menos que se pida explícitamente.\n"
        "- Si el usuario quiere crear una estructura, diseña exactamente lo que pidió con los campos mínimos necesarios.\n"
        "- Si propones crear, editar, mover o eliminar elementos, incluye además un bloque JSON al final para confirmación.\n"
        "- Si la acción elimina algo, advierte de forma breve que pedirá contraseña antes de ejecutar.\n"
        "- Si la acción es sensible, menciona que quedará registrada en auditoría.\n"
        "- El texto visible para el usuario debe poder leerse por sí solo, sin mencionar reglas internas.\n"
        "- Nunca mezcles caracteres raros, símbolos corruptos o texto con encoding roto. Solo español formal.\n"
        f"- Tratarás al usuario cordialmente como: {user_name}.\n"
        "\n"
        "CUANDO PROPONGAS CAMBIOS:\n"
        "- Explica breve qué vas a crear o modificar devolviendo siempre el contexto JSON.\n"
        "- Muestra la estructura propuesta en lenguaje humano.\n"
        "- Luego incluye un bloque JSON con este formato EXACTO:\n"
        "{\"confirmation_required\": true, \"summary\": \"...\", \"actions\": [{\"action\":\"...\",\"payload\":{...}}]}\n"
        "- Acciones válidas: create_system, update_system, delete_system, list_tables, create_table, update_table, delete_table, list_records, create_record, update_record, delete_record.\n"
        "- Estructura correcta create_system: {action:'create_system', payload:{name, description, imageUrl?, securityMode?, tables:[{name, description?, fields:[...]}]}}.\n"
        "- Tipos válidos campo: text, number, date, boolean, select, relation.\n"
        "\n"
        f"FOCO_SISTEMA_ID: {system_id if system_id else 'GLOBAL'}\n"
        f"\n{schema}\n"
        f"\n{real_data}\n"
        f"\nCONTEXTO_ARCHIVOS:\n{file_context.strip()}\n"
        f"\nMENSAJE_ACTUAL_DEL_USUARIO:\n{user_message.strip()}\n"
    ).strip()


def _clean_ai_text(text: str) -> str:
    if not text:
        return ""
    cleaned = text.replace("**", "").replace("##", "").replace("++", "")
    cleaned = cleaned.replace("```json", "").replace("```", "")
    cleaned = re.sub(r"^[#*+\-\s]+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__([^_]+)__", r"\1", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _get_env_value(key: str, default: str = "") -> str:
    value = os.getenv(key, "").strip()
    if value:
        return value
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as fh:
                for raw_line in fh:
                    line = raw_line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    name, raw_value = line.split("=", 1)
                    if name.strip() == key:
                        return raw_value.strip().strip('"').strip("'")
        except Exception:
            pass
    return default


def _chat_openrouter(model: str, messages: List[Dict[str, str]]) -> str:
    api_key = _get_env_value("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Falta OPENROUTER_API_KEY en el entorno.")

    target_model = model.split(":", 1)[1] if ":" in model else model
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": _get_env_value("DATIUM_SITE_URL", "https://datium.local"),
        "X-Title": "Datium IA",
    }
    data = {
        "model": target_model,
        "messages": messages,
        "temperature": 0.2,
    }
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=data,
        timeout=60,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Error de OpenRouter {response.status_code}: {response.text}")
    payload = response.json()
    choices = payload.get("choices", [])
    if not choices:
        raise RuntimeError("La API de OpenRouter devolvió una respuesta vacía.")
    return choices[0].get("message", {}).get("content", "")


def _chat_ollama(model: str, messages: List[Dict[str, str]]) -> str:
    target_model = model.split(":", 1)[1] if ":" in model else model
    base_url = _get_env_value("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    payload = {
        "model": target_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.2},
    }
    response = requests.post(f"{base_url}/api/chat", json=payload, timeout=180)
    if response.status_code != 200:
        raise RuntimeError(f"Error de Ollama {response.status_code}: {response.text}")
    data = response.json()
    return (data.get("message") or {}).get("content", "")


def _ollama_available_models() -> List[str]:
    base_url = _get_env_value("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        r = requests.get(f"{base_url}/api/tags", timeout=6)
        if r.status_code != 200:
            return []
        payload = r.json()
        models = payload.get("models", [])
        out = []
        for m in models:
            if isinstance(m, dict) and m.get("name"):
                out.append(str(m["name"]).strip())
        return out
    except Exception:
        return []


def _chat_ollama_with_fallback(model: str, messages: List[Dict[str, str]], fallback_model: Optional[str]) -> str:
    requested = model.split(":", 1)[1] if ":" in model else model
    configured_fallback = (fallback_model or "").split(":", 1)[1] if fallback_model and ":" in fallback_model else (fallback_model or "")
    candidate_models: List[str] = [requested]
    if configured_fallback:
        candidate_models.append(configured_fallback)
    # Prioridad solicitada: qwen cloud y luego local pequeño.
    candidate_models.extend(["qwen3.5:cloud", "qwen3.5:0.8b", "qwen3:latest", "llama3.2"])
    installed = _ollama_available_models()
    candidate_models.extend(installed)
    deduped = []
    seen = set()
    for c in candidate_models:
        name = str(c or "").strip()
        if name and name not in seen:
            seen.add(name)
            deduped.append(name)

    errors = []
    for m in deduped:
        try:
            return _chat_ollama(f"local:{m}", messages)
        except Exception as exc:
            errors.append(f"{m}: {exc}")
    raise RuntimeError("No hay modelo local de Ollama disponible. " + " | ".join(errors[:4]))


def ollama_chat(model: str, messages: List[Dict[str, str]], fallback_model: Optional[str] = None) -> str:
    errors = []
    try:
        if str(model).startswith("local:"):
            return _chat_ollama_with_fallback(model, messages, fallback_model)
        return _chat_openrouter(model, messages)
    except Exception as exc:
        errors.append(str(exc))

    if fallback_model:
        try:
            if str(fallback_model).startswith("openrouter:"):
                return _chat_openrouter(fallback_model, messages)
            return _chat_ollama_with_fallback(fallback_model, messages, fallback_model)
        except Exception as exc:
            errors.append(str(exc))

    # Último intento siempre local.
    try:
        return _chat_ollama_with_fallback("local:qwen3.5:cloud", messages, "local:qwen3.5:0.8b")
    except Exception as exc:
        errors.append(str(exc))

    raise RuntimeError("No pude conectar Datium con la IA. " + " | ".join(errors))


def _normalize_actions(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    actions = parsed.get("actions", [])
    if not isinstance(actions, list):
        return []

    normalized: List[Dict[str, Any]] = []
    shared_tables = parsed.get("tables") if isinstance(parsed.get("tables"), list) else None
    for action in actions:
        if not isinstance(action, dict):
            continue
        action_name = action.get("action") or action.get("type")
        payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}

        if action_name == "create_system":
            if "tables" not in payload:
                if isinstance(action.get("tables"), list):
                    payload["tables"] = action.get("tables")
                elif shared_tables is not None:
                    payload["tables"] = shared_tables
            action["payload"] = payload

        normalized.append(action)
    return normalized


def parse_actions_from_ai_text(ai_text: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {"confirmation_required": False, "summary": "", "actions": []}
    if not ai_text:
        return result

    json_part = ""
    if "```json" in ai_text:
        json_part = ai_text.split("```json", 1)[1].split("```", 1)[0].strip()
    else:
        # Fallback: detect full JSON object in plain text.
        match = re.search(r"\{[\s\S]*\}", ai_text)
        if match:
            json_part = match.group(0).strip()
    if not json_part:
        return result

    try:
        parsed = json.loads(json_part)
        if isinstance(parsed, dict):
            result["confirmation_required"] = bool(parsed.get("confirmation_required", False))
            result["summary"] = parsed.get("summary", "") or ""
            result["actions"] = _normalize_actions(parsed)
        return result
    except Exception:
        return result


def strip_json_block(ai_text: str) -> str:
    if not ai_text:
        return ""
    if "```json" not in ai_text:
        return _clean_ai_text(ai_text.strip())
    return _clean_ai_text(ai_text.split("```json", 1)[0].strip())

