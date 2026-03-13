import os
import io
import json
from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view
from .models import ChatMessage
from api.models import System, SystemRecord, SystemTable, SystemField, SystemRecordValue, AuditLog, User


def get_current_user(request):
    uid = request.session.get('user_id')
    if not uid:
        return None
    try:
        return User.objects.get(id=uid)
    except User.DoesNotExist:
        return None

def check_pro_plan(user):
    return True

def resolve_value(field, value):
    if not value or field.type != 'relation' or not field.related_table:
        return value
    try:
        # value is the ID of a SystemRecord in the related table
        rel_rec_id = int(str(value).strip())
        related_record = SystemRecord.objects.get(id=rel_rec_id)
        display_field = field.related_display_field
        
        if display_field:
            val_obj = SystemRecordValue.objects.filter(record=related_record, field=display_field).first()
            if val_obj: return val_obj.value
        
        # Fallback: try to find a field named 'Nombre' or similar in the target table
        first_val = SystemRecordValue.objects.filter(record=related_record).first()
        return first_val.value if first_val else f"Ref:{value}"
    except:
        return value

def extract_text_from_file(file_obj):
    text = ""
    filename = file_obj.name.lower()
    try:
        if filename.endswith('.pdf'):
            import PyPDF2
            reader = PyPDF2.PdfReader(file_obj)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif filename.endswith('.docx'):
            from docx import Document
            doc = Document(file_obj)
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            text = file_obj.read().decode('utf-8', errors='ignore')
    except Exception as e:
        pass
    return text

def build_real_data_context(user, message, system_id=None):
    systems = System.objects.filter(owner=user)
    if system_id:
        systems = systems.filter(id=system_id)
        
    context_parts = []
    
    # Smarter table detection
    all_tables = SystemTable.objects.filter(system__in=systems)
    mentioned_tables = []
    message_lower = message.lower()
    
    # If a system is focused, we assume the user is talking about its tables
    if system_id and all_tables.exists():
        mentioned_tables = list(all_tables)
    else:
        for t in all_tables:
            # Match if table name is in message OR if a significant word from name is in message
            if t.name.lower() in message_lower or any(len(w) > 3 and w.lower() in message_lower for w in t.name.split()):
                mentioned_tables.append(t)
    
    if mentioned_tables:
        context_parts.append("DATOS REALES ENCONTRADOS (USA ESTOS DATOS LITERALES, NO INVENTES):")
        for t in mentioned_tables:
            fields = SystemField.objects.filter(table=t)
            f_header = " | ".join([f.name for f in fields])
            records = SystemRecord.objects.filter(table=t).order_by('-id')[:20]
            
            rows = []
            for rec in records:
                vals = SystemRecordValue.objects.filter(record=rec)
                row_dict = {v.field.name: resolve_value(v.field, v.value) for v in vals}
                row_str = " | ".join([str(row_dict.get(f.name, "")) for f in fields])
                rows.append(f"| {row_str} |")
            
            context_parts.append(f"\n[TABLA: {t.name}]\nCOLUMNAS: {f_header}\n" + "\n".join(rows))
    
    return "\n".join(context_parts)

def build_global_context_detailed(user, system_id=None):
    systems = System.objects.filter(owner=user)
    if system_id:
        systems = systems.filter(id=system_id)
        
    if not systems.exists():
        return "El usuario no tiene sistemas registrados en este contexto."
    context = "ESTRUCTURA COMPLETA DE DATOS (CRUD HABILITADO):\n"
    for s in systems:
        context += f"\n[SISTEMA: {s.name} (ID:{s.id})]\n"
        for t in SystemTable.objects.filter(system=s):
            fields = SystemField.objects.filter(table=t)
            f_list = ", ".join([f"{f.name}:{f.id}" for f in fields])
            context += f" - {t.name} (ID:{t.id}): {f_list}\n"
    return context

@api_view(['GET', 'POST', 'DELETE'])
def chat_view(request, system_id=None):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'No autenticado'}, status=401)

    if request.method == 'GET':
        history = ChatMessage.objects.filter(user=user).order_by('timestamp')
        return JsonResponse({'status': 'success', 'history': [{'role': m.role, 'content': m.content} for m in history]})

    elif request.method == 'DELETE':
        ChatMessage.objects.filter(user=user).delete()
        return JsonResponse({'status': 'success', 'message': 'Chat limpiado correctamente'})

    elif request.method == 'POST':
        user_message_content = request.data.get('message', '')
        file_context = ""
        if request.FILES:
            for file_obj in request.FILES.values():
                file_context += f"\n[ARCHIVO: {file_obj.name}]\n{extract_text_from_file(file_obj)}\n"

        if not user_message_content and not file_context:
            return JsonResponse({'error': 'Vacío'}, status=400)

        ChatMessage.objects.create(user=user, role='user', content=user_message_content + file_context)
        
        selected_system_id = request.data.get('system_id') or request.POST.get('system_id')

        global_structure = build_global_context_detailed(user, system_id=selected_system_id)
        real_data = build_real_data_context(user, user_message_content, system_id=selected_system_id)
        
        # Audit Context check
        audit_context = ""
        if any(w in user_message_content.lower() for w in ['audit', 'historial', 'cambios', 'actividad']):
            logs = AuditLog.objects.filter(user=user).order_by('-timestamp')[:15]
            if logs:
                audit_context = "\n[HISTORIAL DE ACTIVIDAD RECIENTE]:\n" + "\n".join([f"- {l.timestamp}: {l.action} en {l.table_name or 'N/A'}" for l in logs])
        
        system_prompt = (
            "Eres Datium AI, la extensión del usuario con acceso TOTAL e INSTANTÁNEO a MySQL y Python.\n"
            "1. CERO DUDAS: Nunca digas que tus datos son limitados. Si hay 'DATOS REALES', úsalos. Si no hay, indica que la tabla está vacía.\n"
            "2. RESPUESTA INMEDIATA: No saludes. Directo a la información.\n"
            "3. FORMATO:\n"
            "   Sistema: [Nombre]\n"
            "   Tabla: [Nombre]\n"
            "   Estado: [Resumen humano]\n"
            "4. LITERALIDAD: Usa nombres reales (ej. 'Ana Díaz'), NO IDs. Convierte booleanos a Sí/No o Presente/Ausente.\n"
            "5. TABLAS: Usa tablas Markdown premium.\n"
            f"6. FOCO ACTIVO: {selected_system_id or 'Contexto Global'}.\n"
            f"\nESTRUCTURA: {global_structure}\n"
            f"\nDATOS REALES: {real_data}\n"
            f"{audit_context}\n"
            "\nGenera la respuesta con los DATOS REALES arriba."
        )

        history = ChatMessage.objects.filter(user=user).order_by('timestamp')
        messages_llm = [{'role': 'system', 'content': system_prompt}]
        for msg in list(history)[-10:]:
            messages_llm.append({'role': msg.role, 'content': msg.content})

        try:
            from zhipuai import ZhipuAI
            client = ZhipuAI(api_key="14f85efe418842258598efb71438945a.FaYfCchiuqEwaEGKFWV-3J7f")
            
            response = client.chat.completions.create(
                model="glm-4",
                messages=messages_llm
            )
            ai_content = response.choices[0].message.content
            
            # Fast parsing
            conf_req = False
            summary, actions = "", []
            if "```json" in ai_content:
                try:
                    parts = ai_content.split("```json")
                    ai_content = parts[0].strip()
                    parsed = json.loads(parts[1].split("```")[0].strip())
                    conf_req = parsed.get("confirmation_required", False)
                    summary = parsed.get("summary", "")
                    actions = parsed.get("actions", [])
                except: pass

            if not ai_content or ai_content.strip() == "":
                ai_content = "Lo siento, la base de datos no devolvió información clara. ¿Podrías intentar ser más específico o verificar el sistema seleccionado?"

            ChatMessage.objects.create(user=user, role='assistant', content=ai_content)
            return JsonResponse({'status': 'success', 'content': ai_content, 'confirmation_required': conf_req, 'summary': summary, 'actions': actions}, status=201)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': str(e)}, status=503)

@api_view(['POST'])
def execute_action_view(request):
    user = get_current_user(request)
    if not user: return JsonResponse({'error': '401'}, status=401)
    actions = request.data.get('actions', [])
    results = []
    for action in actions:
        try:
            a_type = action.get('type')
            if a_type == 'system_create':
                s = System.objects.create(owner=user, name=action.get('name', 'Nuevo Sistema'))
                results.append({'status': 'ok', 'id': s.id, 'msg': 'Sistema creado'})
            elif a_type == 'system_update':
                s = System.objects.get(id=action['system_id'], owner=user)
                if 'name' in action: s.name = action['name']
                if 'description' in action: s.description = action['description']
                s.save()
                results.append({'status': 'ok', 'msg': 'Sistema actualizado'})
            elif a_type == 'system_delete':
                System.objects.get(id=action['system_id'], owner=user).delete()
                results.append({'status': 'ok', 'msg': 'Sistema eliminado'})
            elif a_type == 'table_create':
                sys = System.objects.get(id=action['system_id'], owner=user)
                t = SystemTable.objects.create(system=sys, name=action.get('name', 'Nueva Tabla'))
                results.append({'status': 'ok', 'id': t.id, 'msg': 'Tabla creada'})
            elif a_type == 'table_delete':
                SystemTable.objects.get(id=action['table_id'], system__owner=user).delete()
                results.append({'status': 'ok', 'msg': 'Tabla eliminada'})
            elif a_type == 'field_create':
                table = SystemTable.objects.get(id=action['table_id'], system__owner=user)
                f = SystemField.objects.create(table=table, name=action['name'], type=action.get('type_field', 'text'))
                results.append({'status': 'ok', 'id': f.id, 'msg': 'Campo creado'})
            
            # Legacy/Record actions
            elif a_type == 'create':
                table = SystemTable.objects.get(id=action['table_id'], system__owner=user)
                rec = SystemRecord.objects.create(table=table)
                for f_id, val in action.get('field_values', {}).items():
                    f = SystemField.objects.get(id=int(f_id), table=table)
                    SystemRecordValue.objects.create(record=rec, field=f, value=str(val))
                results.append({'status': 'ok', 'id': rec.id})
            elif a_type == 'update':
                table = SystemTable.objects.get(id=action['table_id'], system__owner=user)
                rec = SystemRecord.objects.get(id=action['record_id'], table=table)
                for f_id, val in action.get('field_values', {}).items():
                    f = SystemField.objects.get(id=int(f_id), table=table)
                    rv, _ = SystemRecordValue.objects.get_or_create(record=rec, field=f)
                    rv.value = str(val); rv.save()
                results.append({'status': 'ok'})
            elif a_type == 'delete':
                table = SystemTable.objects.get(id=action['table_id'], system__owner=user)
                SystemRecord.objects.get(id=action['record_id'], table=table).delete()
                results.append({'status': 'ok'})
        except Exception as e:
            results.append({'status': 'error', 'msg': str(e)})
    return JsonResponse({'status': 'success', 'results': results})

@api_view(['GET'])
def model_status(request):
    return JsonResponse({'status': 'ONLINE', 'model': 'qwen3.5:0.8b'})
