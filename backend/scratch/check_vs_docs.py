
import sys
import os
sys.path.append(os.getcwd())

from backend.vector_store import vector_store

vector_store.initialize()
print(f"Total documents in VectorStore: {len(vector_store.documents)}")
unique_sources = set(doc.get("source") for doc in vector_store.documents)
print("Sources in VectorStore:")
for src in sorted(list(unique_sources)):
    print(f" - {src}")

doc_id = "rag_test_document_2.pdf"
res = vector_store.get_document(doc_id)
print(f"\nSearching for '{doc_id}':")
if res:
    print(f"FOUND! Content length: {len(res.get('content', ''))}")
else:
    print("NOT FOUND")
