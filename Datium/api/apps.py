from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        from django.db import connection
        try:
            # Check if the table exists before trying to seed
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = DATABASE() AND table_name = 'api_plan'"
                )
                if cursor.fetchone()[0] == 0:
                    return

            from .models import Plan
            if Plan.objects.count() == 0:
                Plan.objects.bulk_create([
                    Plan(name='Básico', max_systems=1, max_tables_per_system=3),
                    Plan(name='Pro', max_systems=10, max_tables_per_system=15),
                    Plan(name='Empresarial', max_systems=99999999, max_tables_per_system=99999999),
                ])
                print("✅ Planes iniciales creados: Básico, Pro, Empresarial")
        except Exception:
            pass  # Silently skip if DB not ready (e.g. during makemigrations)
