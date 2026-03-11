from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PlanViewSet, UserViewSet, SystemViewSet, SystemTableViewSet,
    SystemFieldViewSet, SystemFieldOptionViewSet, SystemRecordViewSet,
    SystemRecordValueViewSet, SystemRelationshipViewSet, AuditLogViewSet,
    SecurityAuditViewSet, login_view, registro_view
)

router = DefaultRouter()
router.register(r'plans', PlanViewSet)
router.register(r'users', UserViewSet)
router.register(r'systems', SystemViewSet)
router.register(r'tables', SystemTableViewSet)
router.register(r'fields', SystemFieldViewSet)
router.register(r'field-options', SystemFieldOptionViewSet)
router.register(r'records', SystemRecordViewSet)
router.register(r'record-values', SystemRecordValueViewSet)
router.register(r'relationships', SystemRelationshipViewSet)
router.register(r'audit-logs', AuditLogViewSet)
router.register(r'security-audits', SecurityAuditViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('autenticacion/login', login_view, name='api_login'),
    path('autenticacion/registro', registro_view, name='api_register'),
]
