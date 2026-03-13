
import os
import django
import sys

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Datium.settings')
django.setup()

from api.models import User, System, SystemTable, SystemField, SystemRecord, SystemRecordValue

def analyze_db():
    print("=== DATABASE ANALYSIS ===")
    users = User.objects.all()
    print(f"Total Users: {users.count()}")
    for user in users:
        print(f"\nUser: {user.email} (ID: {user.id})")
        systems = System.objects.filter(owner=user)
        print(f"  Systems: {systems.count()}")
        for s in systems:
            print(f"    System: {s.name} (ID: {s.id})")
            tables = SystemTable.objects.filter(system=s)
            print(f"      Tables: {tables.count()}")
            for t in tables:
                fields = SystemField.objects.filter(table=t)
                records = SystemRecord.objects.filter(table=t)
                print(f"        Table: {t.name} (ID: {t.id}) - Fields: {fields.count()} - Records: {records.count()}")
                for f in fields:
                    if f.type == 'relation':
                        print(f"          Field: {f.name} (TYPE: {f.type}) -> Related Table: {f.related_table.name if f.related_table else 'N/A'}")
                    else:
                        print(f"          Field: {f.name} (TYPE: {f.type})")
                
                # Sample 1 record
                if records.exists():
                    rec = records.first()
                    vals = SystemRecordValue.objects.filter(record=rec)
                    print(f"          Sample Record (ID: {rec.id}):")
                    for v in vals:
                        print(f"            {v.field.name}: {v.value}")

if __name__ == "__main__":
    analyze_db()
