
import os
import django
import sys

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Datium.settings')
django.setup()

from api.models import User, System, SystemTable, SystemField, SystemRecord, SystemRecordValue

def analyze_db():
    print("=== TARGETED ANALYSIS (User 1) ===")
    user = User.objects.filter(id=1).first()
    if not user:
        print("User 1 not found")
        return

    systems = System.objects.filter(owner=user)
    for s in systems:
        print(f"\nSystem: {s.name} (ID: {s.id})")
        tables = SystemTable.objects.filter(system=s)
        for t in tables:
            fields = SystemField.objects.filter(table=t)
            records = SystemRecord.objects.filter(table=t)
            print(f"  Table: {t.name} (ID: {t.id}) - Fields: {fields.count()} - Records: {records.count()}")
            for f in fields:
                rel_info = f" -> {f.related_table.name if f.related_table else '?'}:{f.related_display_field.name if f.related_display_field else '?'}" if f.type == 'relation' else ""
                print(f"    - {f.name} ({f.type}){rel_info} (ID:{f.id})")
            
            # Show all records (up to 5)
            for rec in records[:5]:
                vals = SystemRecordValue.objects.filter(record=rec)
                v_map = {v.field.name: v.value for v in vals}
                print(f"    REC {rec.id}: {v_map}")

if __name__ == "__main__":
    analyze_db()
