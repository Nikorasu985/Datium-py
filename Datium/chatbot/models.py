from django.db import models
from api.models import User

class ChatMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    system_id = models.IntegerField(null=True, blank=True)
    role = models.CharField(max_length=10) # 'user' or 'ai'
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    file_path = models.CharField(max_length=255, null=True, blank=True)
    is_audio = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} - {self.role} - {self.timestamp}"
