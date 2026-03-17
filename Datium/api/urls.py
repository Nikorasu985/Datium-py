from django.urls import path
from . import views
from chatbot.views import api_message_view

urlpatterns = [
    # Auth
    path('autenticacion/login', views.login_view),
    path('autenticacion/registro', views.registro_view),
    path('autenticacion/logout', views.logout_view),
    path('autenticacion/recuperar-password', views.recuperar_password_view),

    # User
    path('user/profile', views.user_profile_view),
    path('user/password', views.user_password_view),
    path('user/avatar', views.user_avatar_view),
    path('user/plan', views.user_plan_view),
    path('user/verify-password', views.user_verify_password_view),

    # Systems (estadisticas MUST be before <int:pk>)
    path('systems', views.systems_list_view),
    path('systems/estadisticas', views.systems_estadisticas_view),
    path('systems/<int:pk>', views.systems_detail_view),
    path('systems/<int:pk>/verify-password', views.system_verify_password_view),
    path('systems/<int:pk>/tables', views.system_tables_view),
    path('systems/<int:system_pk>/tables/<int:table_pk>', views.system_table_detail_view),
    path('systems/<int:pk>/invitations', views.system_invitations_view),
    path('systems/<int:pk>/invite', views.system_invite_view),
    path('systems/<int:system_pk>/invitations/<int:share_pk>', views.system_invitation_delete_view),

    # Tables
    path('tables/<int:pk>', views.table_detail_view),
    path('tables/<int:pk>/fields', views.table_fields_view),
    path('tables/<int:pk>/records', views.table_records_view),
    path('tables/<int:table_pk>/records/<int:record_pk>', views.table_record_detail_view),
    path('tables/<int:pk>/export', views.table_export_view),
    path('tables/<int:pk>/move', views.table_move_view),

    # Audit
    path('auditoria/logs/filtrar', views.audit_logs_global_view),
    path('auditoria/seguridad/filtrar', views.audit_security_global_view),
    path('auditoria/sistema/<int:pk>/logs/filtrar', views.audit_logs_system_view),
    path('auditoria/sistema/<int:pk>/seguridad/filtrar', views.audit_security_system_view),
    path('auditoria/sistema/<int:pk>/usuarios', views.audit_system_users_view),

    # Upload
    path('upload/image', views.upload_image_view),

    # Chatbot (API)
    path('chatbot/message', api_message_view),
]
