from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpRequest
from rest_framework.test import APIRequestFactory

from api import views as api_views
from api.models import System, SystemRecord, SystemTable


@dataclass(frozen=True)
class ActionResult:
    ok: bool
    status_code: int
    data: Any = None
    error: Optional[str] = None


def _attach_session(new_req: HttpRequest, original_request) -> None:
    try:
        new_req.session = original_request.session
        return
    except Exception:
        pass

    middleware = SessionMiddleware(lambda r: None)
    middleware.process_request(new_req)
    new_req.session.save()


def _internal_request(original_request, method: str, path: str, data: Any = None, query: str = "") -> HttpRequest:
    factory = APIRequestFactory()
    method_upper = method.upper()
    full_path = path + (f"?{query}" if query else "")
    if method_upper == "GET":
        req = factory.get(full_path, data=data or {})
    elif method_upper == "POST":
        req = factory.post(full_path, data=data or {}, format="json")
    elif method_upper == "PUT":
        req = factory.put(full_path, data=data or {}, format="json")
    elif method_upper == "DELETE":
        req = factory.delete(full_path, data=data or {}, format="json")
    else:
        raise ValueError(f"Método no soportado: {method}")

    _attach_session(req, getattr(original_request, "_request", original_request))
    return req


def _call(view_func: Callable, req: HttpRequest, *args, **kwargs) -> Tuple[int, Any]:
    resp = view_func(req, *args, **kwargs)
    try:
        return int(getattr(resp, "status_code", 200)), getattr(resp, "data", None)
    except Exception:
        return 200, resp


def route_action(original_request, action: str, payload: Dict[str, Any]) -> ActionResult:
    try:
        try:
            uid = getattr(getattr(original_request, "_request", original_request), "session", {}).get("user_id")
        except Exception:
            uid = None

        if action == "create_system":
            req = _internal_request(original_request, "POST", "/api/systems", payload)
            code, data = _call(api_views.systems_list_view, req)
            return ActionResult(code < 400, code, data=data)

        if action == "update_system":
            system_id = int(payload["systemId"])
            if uid and not System.objects.filter(id=system_id, owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para editar este sistema.")
            req = _internal_request(original_request, "PUT", f"/api/systems/{system_id}", payload)
            code, data = _call(api_views.systems_detail_view, req, pk=system_id)
            return ActionResult(code < 400, code, data=data)

        if action == "delete_system":
            system_id = int(payload["systemId"])
            if uid and not System.objects.filter(id=system_id, owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para eliminar este sistema.")
            req = _internal_request(original_request, "DELETE", f"/api/systems/{system_id}")
            code, data = _call(api_views.systems_detail_view, req, pk=system_id)
            return ActionResult(code < 400, code, data=data)

        if action == "list_tables":
            system_id = payload.get("systemId")
            if not system_id:
                return ActionResult(False, 400, error="systemId requerido para listar tablas.")
            system_id = int(system_id)
            if uid and not System.objects.filter(id=system_id, owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para ver las tablas de este sistema.")
            req = _internal_request(original_request, "GET", f"/api/systems/{system_id}/tables")
            code, data = _call(api_views.system_tables_view, req, pk=system_id)
            return ActionResult(code < 400, code, data=data)

        if action == "create_table":
            system_id = payload.get("systemId")
            if not system_id:
                return ActionResult(False, 400, error="systemId requerido para crear tabla.")
            system_id = int(system_id)
            if uid and not System.objects.filter(id=system_id, owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para crear tablas en este sistema.")
            req = _internal_request(original_request, "POST", f"/api/systems/{system_id}/tables", payload)
            code, data = _call(api_views.system_tables_view, req, pk=system_id)
            return ActionResult(code < 400, code, data=data)

        if action == "update_table":
            system_id = payload.get("systemId")
            table_id = int(payload["tableId"])
            if not system_id:
                return ActionResult(False, 400, error="systemId requerido para editar tabla.")
            system_id = int(system_id)
            if uid and not SystemTable.objects.filter(id=table_id, system_id=system_id, system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para editar esta tabla.")
            req = _internal_request(original_request, "PUT", f"/api/systems/{system_id}/tables/{table_id}", payload)
            code, data = _call(api_views.system_table_detail_view, req, system_pk=system_id, table_pk=table_id)
            return ActionResult(code < 400, code, data=data)

        if action == "delete_table":
            system_id = payload.get("systemId")
            table_id = int(payload["tableId"])
            if not system_id:
                return ActionResult(False, 400, error="systemId requerido para eliminar tabla.")
            system_id = int(system_id)
            if uid and not SystemTable.objects.filter(id=table_id, system_id=system_id, system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para eliminar esta tabla.")
            req = _internal_request(original_request, "DELETE", f"/api/systems/{system_id}/tables/{table_id}", payload)
            code, data = _call(api_views.system_table_detail_view, req, system_pk=system_id, table_pk=table_id)
            return ActionResult(code < 400, code, data=data)

        if action == "list_records":
            table_id = int(payload["tableId"])
            if uid and not SystemTable.objects.filter(id=table_id, system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para consultar esta tabla.")
            req = _internal_request(original_request, "GET", f"/api/tables/{table_id}/records")
            code, data = _call(api_views.table_records_view, req, pk=table_id)
            return ActionResult(code < 400, code, data=data)

        if action == "create_record":
            table_id = int(payload["tableId"])
            if uid and not SystemTable.objects.filter(id=table_id, system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para insertar en esta tabla.")
            req = _internal_request(original_request, "POST", f"/api/tables/{table_id}/records", {"values": payload.get("values", {})})
            code, data = _call(api_views.table_records_view, req, pk=table_id)
            return ActionResult(code < 400, code, data=data)

        if action == "update_record":
            table_id = int(payload["tableId"])
            record_id = int(payload["recordId"])
            if uid and not SystemRecord.objects.filter(id=record_id, table_id=table_id, table__system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para editar este registro.")
            req = _internal_request(
                original_request,
                "PUT",
                f"/api/tables/{table_id}/records/{record_id}",
                {"values": payload.get("values", {})},
            )
            code, data = _call(api_views.table_record_detail_view, req, table_pk=table_id, record_pk=record_id)
            return ActionResult(code < 400, code, data=data)

        if action == "delete_record":
            table_id = int(payload["tableId"])
            record_id = int(payload["recordId"])
            if uid and not SystemRecord.objects.filter(id=record_id, table_id=table_id, table__system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para eliminar este registro.")
            req = _internal_request(original_request, "DELETE", f"/api/tables/{table_id}/records/{record_id}")
            code, data = _call(api_views.table_record_detail_view, req, table_pk=table_id, record_pk=record_id)
            return ActionResult(code < 400, code, data=data)

        if action == "export_table":
            table_id = int(payload["tableId"])
            fmt = payload.get("format", "csv")
            if uid and not SystemTable.objects.filter(id=table_id, system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para exportar esta tabla.")
            req = _internal_request(original_request, "GET", f"/api/tables/{table_id}/export", query=f"format={fmt}")
            code, data = _call(api_views.table_export_view, req, pk=table_id)
            return ActionResult(code < 400, code, data=data)

        if action == "move_table":
            table_id = int(payload["tableId"])
            target_system_id = int(payload["targetSystemId"])
            if uid and not SystemTable.objects.filter(id=table_id, system__owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para mover esta tabla.")
            if uid and not System.objects.filter(id=target_system_id, owner_id=uid).exists():
                return ActionResult(False, 403, error="No tienes permiso para mover a ese sistema.")
            req = _internal_request(original_request, "PUT", f"/api/tables/{table_id}/move", query=f"targetSystemId={target_system_id}")
            code, data = _call(api_views.table_move_view, req, pk=table_id)
            return ActionResult(code < 400, code, data=data)

        return ActionResult(False, 400, error=f"Acción no soportada: {action}")
    except KeyError as e:
        return ActionResult(False, 400, error=f"Falta parámetro: {e}")
    except Exception as e:
        return ActionResult(False, 500, error=str(e))

