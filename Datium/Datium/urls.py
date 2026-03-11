"""
URL configuration for Datium project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    
    # Frontend Routes
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('index.html', TemplateView.as_view(template_name='index.html')),
    path('login.html', TemplateView.as_view(template_name='login.html')),
    path('register.html', TemplateView.as_view(template_name='register.html')),
    path('dashboard.html', TemplateView.as_view(template_name='dashboard.html')),
    path('profile.html', TemplateView.as_view(template_name='profile.html')),
    path('system.html', TemplateView.as_view(template_name='system.html')),
    path('system_form.html', TemplateView.as_view(template_name='system_form.html')),
    path('table.html', TemplateView.as_view(template_name='table.html')),
    path('table_form.html', TemplateView.as_view(template_name='table_form.html')),
    path('connections.html', TemplateView.as_view(template_name='connections.html')),
    path('audit.html', TemplateView.as_view(template_name='audit.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
