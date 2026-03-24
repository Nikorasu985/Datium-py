from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from api.models import System, SystemField, SystemRecord, SystemRecordValue, SystemTable, User


@dataclass(frozen=True)
class AiConfig:
    model: str = "qwen3.5:cloud"
    enabled: bool = True


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
        "Hablas natural, clara y útil; no suenas robótica ni repites plantillas viejas.\n"
        "Tienes el mismo contexto operativo del usuario logueado dentro del sistema.\n"
        "\n"
        "REGLAS:\n"
        "- Responde como una persona normal, pero cuando toque operar el sistema sé precisa y ejecutiva.\n"
        "- No inventes datos. Si no hay filas, responde literalmente: \"La tabla está vacía.\".\n"
        "- Siempre respeta el FOCO (sistema activo). Si existe un sistema enfocado, toda consulta o acción debe resolverse ahí, salvo que el usuario pida explícitamente trabajar en otro o en modo global.\n"
        "- Nunca reutilices plantillas fijas antiguas como asistencia escolar, CRM, inventario u otras, a menos que el usuario lo pida explícitamente.\n"
        "- Si el usuario quiere crear una estructura, diseña exactamente lo que pidió con los campos mínimos necesarios.\n"
        "- Si faltan datos importantes para crear algo bien, pide solo el mínimo faltante.\n"
        "- Si propones crear, editar, mover o eliminar elementos, incluye además un bloque ```json al final para confirmación.\n"
        "- Si la acción elimina algo, advierte de forma breve que pedirá contraseña antes de ejecutar.\n"
        "- Si la acción es sensible, menciona que quedará registrada en auditoría.\n"
        "- El texto visible para el usuario debe poder leerse por sí solo, sin mencionar reglas internas ni JSON.\n"
        f"- Puedes tratar al usuario por su nombre si fluye natural: {user_name}.\n"
        "- Puedes usar emojis con moderación, solo si encajan.\n"
        "- No uses encabezados Markdown con '#'.\n"
        "\n"
        "CUANDO PROPONGAS CAMBIOS:\n"
        "- Explica breve qué vas a crear o modificar.\n"
        "- Muestra la estructura propuesta en lenguaje humano.\n"
        "- No des una vista previa genérica; debe coincidir exactamente con la petición actual.\n"
        "- Luego incluye un bloque ```json con este formato:\n"
        "{\"confirmation_required\": true, \"summary\": \"...\", \"actions\": [{\"action\":\"...\",\"payload\":{...}}]}\n"
        "- Acciones válidas: create_system, update_system, delete_system, list_tables, create_table, update_table, delete_table, list_records, create_record, update_record, delete_record, export_table, move_table.\n"
        "- Para create_table / update_table usa payload.fields con objetos como: {name, type, required, options?, relatedTableId?, relatedDisplayFieldId?}.\n"
        "- Para create_record / update_record usa values por ID de campo cuando esos IDs existan en el contexto.\n"
        "\n"
        "EJEMPLO DE AJUSTE CORRECTO:\n"
        "Si el usuario pide una asistencia para un evento y dice que solo necesita nombres, apellidos y si fue o no, entonces la propuesta debe parecerse a:\n"
        "- Tabla: Asistencias evento\n"
        "- Campos: Nombre, Apellido, Asistió\n"
        "y no debes proponer campos como Documento, Grado, Correo, Fecha u Observación salvo que el usuario los pida.\n"
        "\n"
        f"FOCO_SISTEMA_ID: {system_id if system_id else 'GLOBAL'}\n"
        f"\n{schema}\n"
        f"\n{real_data}\n"
        f"\nCONTEXTO_ARCHIVOS:\n{file_context.strip()}\n"
        f"\nMENSAJE_ACTUAL_DEL_USUARIO:\n{user_message.strip()}\n"
    ).strip()


def ollama_chat(model: str, messages: List[Dict[str, str]]) -> str:
    from ollama import chat  # type: ignore

    resp = chat(model=model, messages=messages)
    try:
        return resp.message.content  # type: ignore[attr-defined]
    except Exception:
        try:
            return resp["message"]["content"]  # type: ignore[index]
        except Exception:
            return str(resp)


def parse_actions_from_ai_text(ai_text: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {"confirmation_required": False, "summary": "", "actions": []}
    if not ai_text:
        return result

    if "```json" not in ai_text:
        return result

    try:
        parts = ai_text.split("```json", 1)
        json_part = parts[1].split("```", 1)[0].strip()
        parsed = json.loads(json_part)
        if isinstance(parsed, dict):
            result["confirmation_required"] = bool(parsed.get("confirmation_required", False))
            result["summary"] = parsed.get("summary", "") or ""
            actions = parsed.get("actions", [])
            result["actions"] = actions if isinstance(actions, list) else []
        return result
    except Exception:
        return result


def strip_json_block(ai_text: str) -> str:
    if not ai_text:
        return ""
    if "```json" not in ai_text:
        return ai_text.strip()
    return ai_text.split("```json", 1)[0].strip()

