from django.db import migrations


def repair_chat_schema(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    with connection.cursor() as cursor:
        existing_tables = set(connection.introspection.table_names(cursor))

        if 'chatbot_chatconversation' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE chatbot_chatconversation (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    system_id INTEGER NULL,
                    title VARCHAR(200) NOT NULL DEFAULT 'Conversación',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    user_id BIGINT NOT NULL REFERENCES api_user(id) DEFERRABLE INITIALLY DEFERRED
                )
                '''
            )
            cursor.execute(
                'CREATE INDEX chatbot_chatconversation_user_id_18056a36 ON chatbot_chatconversation (user_id)'
            )

        columns = {c.name for c in connection.introspection.get_table_description(cursor, 'chatbot_chatmessage')}
        if 'conversation_id' not in columns:
            cursor.execute('ALTER TABLE chatbot_chatmessage ADD COLUMN conversation_id BIGINT NULL REFERENCES chatbot_chatconversation(id) DEFERRABLE INITIALLY DEFERRED')
            if vendor == 'sqlite':
                cursor.execute('CREATE INDEX IF NOT EXISTS chatbot_chatmessage_conversation_id_c1458541 ON chatbot_chatmessage (conversation_id)')
            else:
                cursor.execute('CREATE INDEX chatbot_chatmessage_conversation_id_c1458541 ON chatbot_chatmessage (conversation_id)')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('chatbot', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(repair_chat_schema, reverse_code=noop_reverse),
    ]
