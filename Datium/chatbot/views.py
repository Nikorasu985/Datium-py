import os
import json
import requests
import shutil
import traceback
from functools import wraps
from django.shortcuts import render
from api.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage
from django.conf import settings
from .models import ChatMessage

def token_required(f):
    @wraps(f)
    def decorated(request, *args, **kwargs):
        user_id = request.session.get('user_id')
        if not user_id:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                if token.isdigit():
                    user_id = token
        
        if not user_id:
            return JsonResponse({'status': 'error', 'message': 'Acceso denegado. Inicie sesión.'}, status=401)
        
        try:
            user = User.objects.get(id=user_id)
            request.user_obj = user
            return f(request, *args, **kwargs)
        except User.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Usuario no encontrado.'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
            
    return decorated

def chat_view(request):
    return render(request, 'chat.html')
@csrf_exempt
@token_required
def chat_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=400)
        
    system_id = request.POST.get('system_id')
    if system_id == 'null' or not system_id:
        system_id = None
        
    message = request.POST.get('message')
    if not message:
        return JsonResponse({'status': 'error', 'message': 'Mensaje vacío'}, status=400)

    try:
        # Save user message
        ChatMessage.objects.create(
            user=request.user_obj, 
            system_id=system_id, 
            role='user', 
            content=message
        )
        
        ai_response = f"Respuesta simulada para {'el sistema ' + str(system_id) if system_id else 'General'}: He recibido tu mensaje."
        
        # Save AI response
        ChatMessage.objects.create(
            user=request.user_obj, 
            system_id=system_id, 
            role='ai', 
            content=ai_response
        )
        
        return JsonResponse({
            'status': 'success',
            'content': ai_response,
            'model': 'qwen3.5:cloud'
        })
    except Exception as e:
        log_path = os.path.join(settings.BASE_DIR, 'chatbot_error.log')
        with open(log_path, 'a') as f:
            f.write(traceback.format_exc() + '\n')
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@csrf_exempt
@token_required
def clear_history(request, system_id=None):
    # Delete from DB
    ChatMessage.objects.filter(user=request.user_obj, system_id=system_id).delete()
    
    # Optionally delete physical files if they exist
    files_dir = os.path.join(settings.MEDIA_ROOT, 'chatbot', str(system_id))
    if os.path.exists(files_dir):
        try:
            shutil.rmtree(files_dir)
        except Exception as e:
            print(f"Error deleting files: {e}")
            
    return JsonResponse({'status': 'success', 'message': 'Historial y archivos eliminados'})

from datetime import datetime, timedelta
from django.utils import timezone

def check_auto_delete(user):
    # Pro Plan = 30 days history. Empresarial = Never.
    if not hasattr(user, 'plan') or not user.plan:
        return
        
    plan_name = user.plan.name.lower()
    if 'pro' in plan_name:
        limit_date = timezone.now() - timedelta(days=30)
        # Delete old messages for this user
        ChatMessage.objects.filter(user=user, timestamp__lt=limit_date).delete()
    # If entrepreneurial, we do nothing (keep forever)

@token_required
def status_api(request):
    model = request.GET.get('model', 'qwen3.5:cloud')
    # Check if Ollama is online
    try:
        r = requests.get('http://localhost:11434/api/tags', timeout=2)
        if r.status_code == 200:
            return JsonResponse({'status': 'ONLINE', 'model': model})
    except:
        pass
    return JsonResponse({'status': 'OFFLINE', 'model': model})

@csrf_exempt
@token_required
def upload_file(request):
    if request.method == 'POST' and request.FILES.get('file'):
        file = request.FILES['file']
        path = default_storage.save(f'chatbot_uploads/{file.name}', file)
        return JsonResponse({'status': 'success', 'path': path})
    return JsonResponse({'status': 'error', 'message': 'No file uploaded'}, status=400)

# @token_required
def get_history(request, system_id=None):
    # For debug, try getting a hardcoded user
    user = User.objects.first()
    request.user_obj = user
    try:
        check_auto_delete(request.user_obj)
    except:
        pass
        
    messages = ChatMessage.objects.filter(user=request.user_obj, system_id=system_id).order_by('timestamp')
    data = []
    for m in messages:
        data.append({
            'role': m.role,
            'content': m.content,
            'timestamp': str(m.timestamp) if m.timestamp else None,
            'file': m.file_path
        })
    return JsonResponse({'status': 'success', 'history': data})
