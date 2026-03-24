import json
import os

from django.http import JsonResponse
from rest_framework.decorators import api_view

from .ai_engine import (
    build_system_prompt,
    ollama_chat,
    parse_actions_from_ai_text,
    strip_json_block,
)
from .file_handler import extract_text_from_file
from .permissions import ensure_ai_plan_access, ensure_authenticated, ensure_system_access
from .settings_panel import get_ai_config
from .settings_panel import ai_settings_view
from .system_context import get_active_system_id_from_request
from .action_router import route_action
from .models import ChatConversation, ChatMessage
from api.models import AuditLog, System, SystemRecord, SystemTable, User


def _get_conversation_id_from_request(request):
    try:
        cid = request.data.get("conversation_id")
    except Exception:
        cid = request.POST.get("conversation_id")
    if cid in (None, "", "null", "None"):
        return None
    try:
        return int(cid)
    except Exception:
        return None


def _get_or_create_conversation(user, system_id, conversation_id=None):
    if conversation_id:
        conv = ChatConversation.objects.filter(id=conversation_id, user=user).first()
        if conv:
            return conv

    conv = ChatConversation.objects.filter(user=user, system_id=system_id).order_by("-updated_at").first()
    if conv:
        return conv

    title = "Conversación"
    if system_id:
        sys = System.objects.filter(id=system_id, owner=user).first()
        if sys and sys.name:
            title = f"{sys.name} - Conversación"
    return ChatConversation.objects.create(user=user, system_id=system_id, title=title)


@api_view(["GET", "POST"])
def conversations_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({"error": perm.reason}, status=401)

    system_id = get_active_system_id_from_request(request)
    if system_id is None:
        raw = request.GET.get("system_id")
        if raw:
            try:
                system_id = int(raw)
            except Exception:
                system_id = None
    if request.method == "GET":
        qs = ChatConversation.objects.filter(user=user, system_id=system_id).order_by("-updated_at")
        return JsonResponse(
            {
                "status": "success",
                "conversations": [
                    {"id": c.id, "title": c.title, "system_id": c.system_id, "updated_at": c.updated_at.isoformat()}
                    for c in qs[:50]
                ],
            }
        )

    title = ""
    try:
        title = (request.data.get("title") or "").strip()
    except Exception:
        title = (request.POST.get("title") or "").strip()
    if not title:
        title = "Nueva conversación"
    conv = ChatConversation.objects.create(user=user, system_id=system_id, title=title)
    return JsonResponse({"status": "success", "conversation": {"id": conv.id, "title": conv.title}}, status=201)


@api_view(["GET", "DELETE"])
def conversation_history_view(request, conversation_id: int):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({"error": perm.reason}, status=401)

    conv = ChatConversation.objects.filter(id=conversation_id, user=user).first()
    if not conv:
        return JsonResponse({"error": "Conversación no encontrada"}, status=404)

    if request.method == "DELETE":
        ChatMessage.objects.filter(user=user, conversation=conv).delete()
        ChatConversation.objects.filter(id=conv.id).update(title=conv.title)
        return JsonResponse({"status": "success", "message": "Memoria del chat borrada ✅"})

    history = ChatMessage.objects.filter(user=user, conversation=conv).order_by("timestamp")
    return JsonResponse({"status": "success", "history": [{"role": m.role, "content": m.content} for m in history]})

@api_view(['GET', 'POST', 'DELETE'])
def chat_view(request, system_id=None):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({'error': perm.reason}, status=401)

    if request.method == 'GET':
        cid = request.GET.get("conversation_id")
        conv = _get_or_create_conversation(user, system_id, int(cid) if cid else None)
        history = ChatMessage.objects.filter(user=user, conversation=conv).order_by("timestamp")
        return JsonResponse(
            {
                "status": "success",
                "conversation": {"id": conv.id, "title": conv.title},
                "history": [{"role": m.role, "content": m.content} for m in history],
            }
        )

    elif request.method == 'DELETE':
        cid = request.GET.get("conversation_id")
        conv = _get_or_create_conversation(user, system_id, int(cid) if cid else None)
        ChatMessage.objects.filter(user=user, conversation=conv).delete()
        return JsonResponse({"status": "success", "message": "Memoria del chat borrada ✅"})

    elif request.method == 'POST':
        plan_perm = ensure_ai_plan_access(user)
        if not plan_perm.allowed:
            return JsonResponse(
                {
                    "error": plan_perm.reason,
                    "plans": [
                        {"id": 1, "name": "Básico", "ai": False},
                        {"id": 2, "name": "Pro", "ai": True},
                        {"id": 3, "name": "Empresarial", "ai": True},
                    ],
                    "upgradeUrl": "/profile.html",
                },
                status=402,
            )

        cfg = get_ai_config()
        if not cfg.enabled:
            return JsonResponse({'error': 'IA desactivada en configuración.'}, status=503)

        user_message_content = ""
        try:
            user_message_content = request.data.get("message", "") or ""
        except Exception:
            user_message_content = request.POST.get("message", "") or ""

        file_context = ""
        if getattr(request, "FILES", None):
            for file_obj in request.FILES.values():
                label, text = extract_text_from_file(file_obj)
                if text:
                    file_context += f"\n{label}\n{text}\n"
                else:
                    file_context += f"\n{label}\n(Sin texto extraíble)\n"

        if not user_message_content and not file_context:
            return JsonResponse({'error': 'Vacío'}, status=400)

        selected_system_id = get_active_system_id_from_request(request)
        perm2 = ensure_system_access(user, selected_system_id)
        if not perm2.allowed:
            return JsonResponse({'error': perm2.reason}, status=403)

        conv_id = _get_conversation_id_from_request(request)
        conv = _get_or_create_conversation(user, selected_system_id, conv_id)

        ChatMessage.objects.create(
            user=user,
            conversation=conv,
            system_id=selected_system_id,
            role='user',
            content=(user_message_content + ("\n" + file_context if file_context else "")).strip(),
        )

        system_prompt = build_system_prompt(
            user=user,
            system_id=selected_system_id,
            user_message=user_message_content,
            file_context=file_context,
        )

        history = ChatMessage.objects.filter(user=user, conversation=conv).order_by("timestamp")
        messages_llm = [{'role': 'system', 'content': system_prompt}]
        for msg in list(history)[-10:]:
            role = msg.role if msg.role in ('user', 'assistant', 'system') else 'user'
            messages_llm.append({'role': role, 'content': msg.content})

        try:
            ai_text = ollama_chat(cfg.model, messages_llm)
            parsed = parse_actions_from_ai_text(ai_text)
            content = strip_json_block(ai_text) or "No se obtuvo una respuesta válida del modelo."

            actions = parsed.get("actions", []) if isinstance(parsed, dict) else []
            if not isinstance(actions, list):
                actions = []

            if selected_system_id:
                for a in actions:
                    if not isinstance(a, dict):
                        continue
                    payload = a.get("payload")
                    if isinstance(payload, dict) and "systemId" not in payload:
                        if a.get("action") in ("create_table", "update_table", "delete_table", "list_tables"):
                            payload["systemId"] = selected_system_id

            if actions and not content:
                content = parsed.get("summary", "Se propone ejecutar cambios en el sistema.")
            ChatMessage.objects.create(user=user, conversation=conv, system_id=selected_system_id, role='assistant', content=content)
            return JsonResponse(
                {
                    'status': 'success',
                    'content': content,
                    'confirmation_required': bool(parsed.get('confirmation_required', False)),
                    'summary': parsed.get('summary', ''),
                    'actions': actions,
                    "conversation": {"id": conv.id, "title": conv.title},
                },
                status=201,
            )
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=503)

@api_view(['POST'])
def execute_action_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({'error': perm.reason}, status=401)

    plan_perm = ensure_ai_plan_access(user)
    if not plan_perm.allowed:
        return JsonResponse({'error': plan_perm.reason}, status=402)

    actions = []
    try:
        actions = request.data.get('actions', []) or []
    except Exception:
        actions = []

    results = []
    for a in actions:
        if not isinstance(a, dict):
            results.append({'ok': False, 'error': 'Acción inválida'})
            continue

        action_name = a.get("action") or a.get("type")
        payload = a.get("payload") or a

        try:
            system_id = payload.get("systemId")
            if not system_id:
                table_id = payload.get("tableId") or payload.get("table_id")
                if table_id:
                    system_id = SystemTable.objects.filter(id=int(table_id)).values_list("system_id", flat=True).first()
                else:
                    record_id = payload.get("recordId") or payload.get("record_id")
                    if record_id:
                        system_id = SystemRecord.objects.filter(id=int(record_id)).values_list("table__system_id", flat=True).first()
            system = System.objects.filter(id=int(system_id)).first() if system_id else None
            if system:
                AuditLog.objects.create(
                    user=user,
                    system=system,
                    action=f"IA_{str(action_name).upper()}",
                    details=json.dumps(payload, ensure_ascii=False)[:2000],
                    ip=request.META.get("REMOTE_ADDR", "") or "",
                )
        except Exception:
            pass

        r = route_action(request, action_name, payload)
        links = []
        try:
            if r.ok and isinstance(r.data, dict):
                if action_name in ("create_system", "update_system"):
                    sid = r.data.get("id")
                    name = r.data.get("name", "Sistema")
                    if sid:
                        links.append({"label": f"Abrir sistema {name}", "url": f"/system.html?id={sid}"})
                if action_name in ("create_table", "update_table"):
                    tid = r.data.get("id")
                    name = r.data.get("name", "Tabla")
                    if tid:
                        links.append({"label": f"Abrir tabla {name}", "url": f"/table.html?id={tid}"})
        except Exception:
            links = []

        results.append({'ok': r.ok, 'status_code': r.status_code, 'data': r.data, 'error': r.error, 'links': links})

    return JsonResponse({'status': 'success', 'results': results})

@api_view(['GET'])
def model_status(request):
    cfg = get_ai_config()
    if not cfg.enabled:
        return JsonResponse({'status': 'OFFLINE', 'model': cfg.model, 'enabled': False})
    try:
        import ollama  # type: ignore
        return JsonResponse({'status': 'ONLINE', 'model': cfg.model, 'enabled': True})
    except Exception:
        return JsonResponse({'status': 'OFFLINE', 'model': cfg.model, 'enabled': True})


@api_view(["POST"])
def api_message_view(request):
    resp = chat_view(request)
    try:
        if resp.status_code >= 400:
            return resp
        payload = json.loads(resp.content.decode("utf-8"))
        return JsonResponse({"reply": payload.get("content", ""), "actions": payload.get("actions", [])})
    except Exception:
        return JsonResponse({"reply": "", "actions": []}, status=200)


@api_view(["POST"])
def openclaw_bridge_view(request):
    configured_secret = os.getenv("DATIUM_OPENCLAW_SECRET", "").strip()
    provided_secret = (
        request.headers.get("X-OpenClaw-Secret")
        or request.headers.get("X-Datium-Secret")
        or request.data.get("secret")
        or ""
    ).strip()

    raw_request = getattr(request, "_request", request)
    user = None

    try:
        session_uid = raw_request.session.get("user_id")
    except Exception:
        session_uid = None

    if session_uid:
        user = User.objects.filter(id=session_uid).first()
    else:
        if not configured_secret:
            return JsonResponse({"error": "Bridge no configurado. Define DATIUM_OPENCLAW_SECRET."}, status=503)
        if provided_secret != configured_secret:
            return JsonResponse({"error": "No autorizado"}, status=401)

        user_id = request.data.get("user_id")
        email = (request.data.get("email") or "").strip().lower()

        if user_id not in (None, "", "null", "None"):
            try:
                user = User.objects.filter(id=int(user_id)).first()
            except Exception:
                user = None
        if user is None and email:
            user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return JsonResponse({"error": "Usuario no encontrado"}, status=404)

        raw_request.session["user_id"] = user.id
        try:
            raw_request.session.save()
        except Exception:
            pass

    system_id = request.data.get("system_id")
    if system_id not in (None, "", "null", "None"):
        try:
            system_id = int(system_id)
        except Exception:
            return JsonResponse({"error": "system_id inválido"}, status=400)
    else:
        system_id = None

    if system_id is not None and not System.objects.filter(id=system_id, owner=user).exists():
        return JsonResponse({"error": "El usuario no tiene acceso a ese sistema"}, status=403)

    response = chat_view(raw_request, system_id=system_id)
    try:
        payload = json.loads(response.content.decode("utf-8"))
    except Exception:
        payload = {}

    if response.status_code >= 400:
        return JsonResponse(payload or {"error": "Error del chatbot"}, status=response.status_code)

    return JsonResponse(
        {
            "ok": True,
            "reply": payload.get("content", ""),
            "actions": payload.get("actions", []),
            "conversation": payload.get("conversation", {}),
            "confirmation_required": bool(payload.get("confirmation_required", False)),
            "summary": payload.get("summary", ""),
            "user": {"id": user.id, "email": user.email, "name": user.name},
            "system_id": system_id,
        },
        status=response.status_code or 200,
    )
