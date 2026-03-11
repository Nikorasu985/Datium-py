from rest_framework import viewsets
from .models import (
    Plan, User, System, SystemTable, SystemField,
    SystemFieldOption, SystemRecord, SystemRecordValue,
    SystemRelationship, AuditLog, SecurityAudit
)

from .serializers import (
    PlanSerializer, UserSerializer, SystemSerializer,
    SystemTableSerializer, SystemFieldSerializer,
    SystemFieldOptionSerializer, SystemRecordSerializer,
    SystemRecordValueSerializer, SystemRelationshipSerializer,
    AuditLogSerializer, SecurityAuditSerializer
)


class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class SystemViewSet(viewsets.ModelViewSet):
    queryset = System.objects.all()
    serializer_class = SystemSerializer


class SystemTableViewSet(viewsets.ModelViewSet):
    queryset = SystemTable.objects.all()
    serializer_class = SystemTableSerializer


class SystemFieldViewSet(viewsets.ModelViewSet):
    queryset = SystemField.objects.all()
    serializer_class = SystemFieldSerializer


class SystemFieldOptionViewSet(viewsets.ModelViewSet):
    queryset = SystemFieldOption.objects.all()
    serializer_class = SystemFieldOptionSerializer


class SystemRecordViewSet(viewsets.ModelViewSet):
    queryset = SystemRecord.objects.all()
    serializer_class = SystemRecordSerializer


class SystemRecordValueViewSet(viewsets.ModelViewSet):
    queryset = SystemRecordValue.objects.all()
    serializer_class = SystemRecordValueSerializer


class SystemRelationshipViewSet(viewsets.ModelViewSet):
    queryset = SystemRelationship.objects.all()
    serializer_class = SystemRelationshipSerializer


class AuditLogViewSet(viewsets.ModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer


class SecurityAuditViewSet(viewsets.ModelViewSet):
    queryset = SecurityAudit.objects.all()
    serializer_class = SecurityAuditSerializer


from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import uuid

@api_view(['POST'])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')
    
    try:
        user = User.objects.get(email=email)
        # Simplified password check for MVP purposes
        if user.password_hash == password:
            return Response({
                'token': str(uuid.uuid4()), # Generate a dummy token
                'usuario': UserSerializer(user).data
            }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)
    except User.DoesNotExist:
        return Response({'error': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
def registro_view(request):
    nombre = request.data.get('nombre')
    email = request.data.get('email')
    password = request.data.get('password')
    plan_id = request.data.get('planId', 1)
    
    if User.objects.filter(email=email).exists():
        return Response({'error': 'El email ya está en uso'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        plan = Plan.objects.get(id=plan_id)
    except Plan.DoesNotExist:
        plan = None
        
    user = User.objects.create(
        name=nombre,
        email=email,
        password_hash=password, # Simplified for MVP
        plan=plan
    )
    
    return Response({
        'token': str(uuid.uuid4()),
        'usuario': UserSerializer(user).data
    }, status=status.HTTP_201_CREATED)