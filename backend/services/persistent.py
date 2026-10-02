import json
import os
import tempfile
import faiss

from config import INDEX_FILE, METADATA_FILE, CHATS_FILE
from vector_store import VectorStore
import storage


class PersistenceManager:
    """
    Handles saving/loading the vector database.
    """

    def save(self, vector_store: VectorStore):

        # -----------------------------
        # Save FAISS Index
        # -----------------------------

        faiss.write_index(
            vector_store.index,
            INDEX_FILE
        )

        metadata = {

            "version": 1,

            "embedding_dimension": vector_store.index.d,

            "documents": vector_store.metadata

        }

        # -----------------------------
        # Atomic Metadata Save
        # -----------------------------

        metadata_dir = os.path.dirname(METADATA_FILE)

        with tempfile.NamedTemporaryFile(
            mode="w",
            delete=False,
            dir=metadata_dir,
            encoding="utf-8"
        ) as temp_file:

            json.dump(
                metadata,
                temp_file,
                indent=4,
                ensure_ascii=False
            )

            temp_path = temp_file.name

        os.replace(
            temp_path,
            METADATA_FILE
        )

        # -----------------------------
        # Atomic Chats Save
        # -----------------------------
        with tempfile.NamedTemporaryFile(
            mode="w",
            delete=False,
            dir=metadata_dir,
            encoding="utf-8"
        ) as temp_file:
            json.dump(
                storage.chat_sessions,
                temp_file,
                indent=4,
                ensure_ascii=False
            )
            chats_temp_path = temp_file.name

        os.replace(
            chats_temp_path,
            CHATS_FILE
        )

    def load(self):

        if (
            not os.path.exists(INDEX_FILE)
            or
            not os.path.exists(METADATA_FILE)
        ):

            return None

        with open(
            METADATA_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            metadata = json.load(f)

        embedding_dimension = metadata["embedding_dimension"]

        vector_store = VectorStore(
            embedding_dimension
        )

        vector_store.index = faiss.read_index(
            INDEX_FILE
        )

        vector_store.metadata = metadata["documents"]

        if os.path.exists(CHATS_FILE):
            with open(CHATS_FILE, "r", encoding="utf-8") as f:
                storage.chat_sessions = json.load(f)
        else:
            storage.chat_sessions = {}

        return vector_store
    
    def clear(self):
        """
        Remove persisted vector database.
        """

        import os

        from config import INDEX_FILE, METADATA_FILE, CHATS_FILE

        if os.path.exists(INDEX_FILE):
            os.remove(INDEX_FILE)

        if os.path.exists(METADATA_FILE):
            os.remove(METADATA_FILE)

        if os.path.exists(CHATS_FILE):
            os.remove(CHATS_FILE)


persistence = PersistenceManager()