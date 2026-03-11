from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat_view'),
    path('chat/', views.chat_api, name='chat_api'),
    path('status/', views.status_api, name='status_api'),
    path('upload/', views.upload_file, name='upload_file'),
    path('history/', views.get_history, name='get_history_global'),
    path('history/<int:system_id>/', views.get_history, name='get_history'),
    path('history/clear/', views.clear_history, name='clear_history_global'),
    path('history/<int:system_id>/clear/', views.clear_history, name='clear_history'),
]
