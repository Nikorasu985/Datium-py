from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('chatbot', '0002_alter_chatmessage_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatmessage',
            name='file_path',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='is_audio',
            field=models.BooleanField(default=False),
        ),
    ]
