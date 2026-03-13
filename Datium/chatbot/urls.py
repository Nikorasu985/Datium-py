from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat_view_main'),
    path('chat/', views.chat_view, name='chat_view'),
    path('execute/', views.execute_action_view, name='execute_action'),
    path('status/', views.model_status, name='model_status'),
    path('history/', views.chat_view, name='get_history_global'),
    path('history/<int:system_id>/', views.chat_view, name='get_history'),
    path('history/clear/', views.chat_view, name='clear_history_global'),
    path('history/<int:system_id>/clear/', views.chat_view, name='clear_history'),
]
