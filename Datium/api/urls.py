from django.urls import path
from . import views
# from chatbot.views import api_message_view

urlpatterns = [
    # Auth
    path('autenticacion/login', views.login_view),
    path('autenticacion/registro', views.registro_view),
    path('autenticacion/logout', views.logout_view),
    path('autenticacion/recuperar-password', views.recuperar_password_view),

    # User
    path('user/profile', views.user_profile_view),
    path('autenticacion/usuario', views.user_profile_view),
    path('user/password', views.user_password_view),
    path('user/avatar', views.user_avatar_view),
    path('user/plan', views.user_plan_view),
    path('user/verify-password', views.user_verify_password_view),
    path('user/reports', views.user_reports_view),

    # Admin
    path('admin/dashboard', views.admin_dashboard_view, name='admin_dashboard'),
    path('admin/policies', views.admin_tyc_view, name='admin_policies'),
    path('admin/reports', views.admin_reports_view, name='admin_reports'),
    path('admin/reports/<int:pk>', views.admin_report_detail_view, name='admin_report_detail'),
    path('admin/plans', views.admin_plans_view, name='admin_plans'),
    path('admin/plans/<int:pk>', views.admin_plan_detail_view, name='admin_plan_detail'),
    path('admin/tyc', views.admin_tyc_view, name='admin_tyc'),
    path('admin/users', views.admin_users_list_view, name='admin_users'),
    path('admin/users/<int:pk>/action', views.admin_user_action_view, name='admin_user_action'),
    path('admin/blocked-ips', views.admin_blocked_ips_view, name='admin_blocked_ips'),
    path('admin/discounts', views.admin_discounts_view, name='admin_discounts'),
    path('admin/discounts/<int:pk>', views.admin_discount_detail_view, name='admin_discount_detail'),
    path('admin/payments', views.admin_payments_view, name='admin_payments'),
    path('user/process-payment', views.process_payment_view, name='process_payment'),
    
    # Admin Trash
    path('admin/trash/systems', views.admin_trash_systems_view, name='admin_trash_systems'),
    path('admin/trash/restore/<int:pk>', views.admin_trash_restore_view, name='admin_trash_restore'),
    path('admin/trash/export', views.admin_trash_export_view, name='admin_trash_export'),
    path('admin/users/export', views.admin_export_users_view, name='admin_export_users'),
    path('admin/reports/export', views.admin_export_reports_view, name='admin_export_reports'),

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
    path('tables/<int:pk>/styles', views.update_table_style_view),
    path('tables/<int:pk>/fields', views.table_fields_view),
    path('tables/<int:pk>/records', views.table_records_view),
    path('tables/<int:table_pk>/records/bulk-delete', views.table_records_bulk_delete_view),
    path('tables/<int:table_pk>/records/<int:record_pk>', views.table_record_detail_view),
    path('tables/<int:table_id>/import', views.import_records_view, name='table_import'),
    path('tables/<int:table_id>/export', views.export_records_view, name='table_export'),
    path('tables/<int:pk>/fields/reorder', views.reorder_fields_view),
    path('tables/<int:pk>/records/reorder', views.reorder_records_view),
    path('tables/<int:pk>/move', views.table_move_view),

    # Audit
    path('auditoria/logs/filtrar', views.audit_logs_global_view),
    path('auditoria/seguridad/filtrar', views.audit_security_global_view),
    path('auditoria/sistema/<int:pk>/logs/filtrar', views.audit_logs_system_view),
    path('auditoria/sistema/<int:pk>/seguridad/filtrar', views.audit_security_system_view),
    path('auditoria/sistema/<int:pk>/usuarios', views.audit_system_users_view),

    # Upload
    path('autenticacion/aceptar-terminos', views.accept_terms_view),
    path('usuario/security-settings', views.update_security_settings_view),
    path('upload/image', views.upload_image_view),

    # Chatbot (API)
    # path('chatbot/message', api_message_view),
]
