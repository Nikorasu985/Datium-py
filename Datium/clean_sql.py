
import os
import django
import sys

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Datium.settings')
django.setup()

from api.models import User, System, SystemTable, SystemField

def clean_sql_export():
    with open('datium.sql', 'w', encoding='utf-8') as f:
        f.write("-- Datium Clean Schema Export\n")
        f.write("-- Date: 2026-03-13\n\n")
        
        users = User.objects.all()
        for u in users:
            f.write(f"-- User: {u.email}\n")
            systems = System.objects.filter(owner=u)
            for s in systems:
                f.write(f"--   System: {s.name}\n")
                tables = SystemTable.objects.filter(system=s)
                for t in tables:
                    f.write(f"CREATE TABLE `{t.name}` (\n")
                    fields = SystemField.objects.filter(table=t)
                    f_parts = []
                    for field in fields:
                        type_str = field.type.upper()
                        if field.type == 'relation' and field.related_table:
                            type_str = f"RELATION_TO_{field.related_table.name.upper()}"
                        f_parts.append(f"  `{field.name}` {type_str}")
                    f.write(",\n".join(f_parts))
                    f.write("\n);\n\n")
    print("datium.sql cleaned and updated with current structure.")

if __name__ == "__main__":
    clean_sql_export()
