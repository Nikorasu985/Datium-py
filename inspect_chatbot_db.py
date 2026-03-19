import sqlite3
conn = sqlite3.connect(r'C:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\db.sqlite3')
cur = conn.cursor()
for table in ['chatbot_chatmessage', 'chatbot_chatconversation', 'django_migrations']:
    print(f'== {table} ==')
    row = cur.execute("select name from sqlite_master where type='table' and name=?", (table,)).fetchone()
    print('exists:', bool(row))
    if row:
        for col in cur.execute(f'pragma table_info({table})'):
            print(col)
    print()
print('chatbot migrations:')
for row in cur.execute("select app, name from django_migrations where app='chatbot' order by name"):
    print(row)
