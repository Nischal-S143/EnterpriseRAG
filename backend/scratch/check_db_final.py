
import sqlite3
import os
db_path = os.path.join('backend', 'pagani.db')
print(f"Connecting to {db_path}...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id, filename FROM documents")
rows = cursor.fetchall()
print(f"Documents in DB: {len(rows)}")
for row in rows:
    print(row)
conn.close()
