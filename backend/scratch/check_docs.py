import os
from database import get_db_session
from models import Document

def check_docs():
    with get_db_session() as db:
        docs = db.query(Document).all()
        print(f"Found {len(docs)} documents.")
        for d in docs:
            print(f"ID: {d.id} | Filename: {d.filename} | FilePath: {d.file_path}")

if __name__ == "__main__":
    check_docs()
