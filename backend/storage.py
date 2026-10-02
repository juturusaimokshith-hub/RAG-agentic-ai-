"""
Global runtime storage for the application.
"""

from typing import Dict, Optional

from vector_store import VectorStore

# ---------------------------------------
# Runtime Objects
# ---------------------------------------

vector_store: Optional[VectorStore] = None

loaded_documents: Dict[str, dict] = {}

chat_sessions: Dict[str, list] = {}


def rebuild_loaded_documents():
    """
    Rebuild loaded_documents from metadata.
    """

    global loaded_documents

    loaded_documents.clear()

    if vector_store is None:
        return

    grouped = {}

    for item in vector_store.metadata:

        doc_id = item["document_id"]

        if doc_id not in grouped:
            grouped[doc_id] = {
                "pdf_name": item["pdf_name"],
                "file_hash": item.get("file_hash", ""),
                "pages": set(),
                "chunks": 0
            }

        grouped[doc_id]["pages"].add(item["page"])
        grouped[doc_id]["chunks"] += 1

    for doc_id, info in grouped.items():

        loaded_documents[doc_id] = {
            "pdf_name": info["pdf_name"],
            "file_hash": info.get("file_hash", ""),
            "pages": len(info["pages"]),
            "chunks": info["chunks"]
        }


def reset():

    global vector_store

    vector_store = None

    loaded_documents.clear()

    chat_sessions.clear()