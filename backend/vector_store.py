import faiss
import numpy as np
from typing import List, Dict, Any


class VectorStore:
    """
    In-memory vector database.

    Responsible only for:
        - storing vectors
        - storing metadata
        - similarity search

    It DOES NOT handle saving/loading from disk.
    """

    def __init__(self, embedding_dimension: int):

        self.index = faiss.IndexFlatL2(embedding_dimension)

        self.metadata: List[Dict] = []

    # ---------------------------------------------------------
    # Add Documents
    # ---------------------------------------------------------

    def add_documents(
        self,
        embeddings: np.ndarray,
        documents: List[Dict[str, Any]],
        pdf_name: str,
        document_id: str,
        file_hash: str = ""
    ):
        """
        Add embeddings and document metadata to the store.
        """

        embeddings = np.asarray(
            embeddings,
            dtype=np.float32
        )

        self.index.add(embeddings)

        for doc in documents:

            self.metadata.append({
                "document_id": document_id,
                "pdf_name": pdf_name,
                "file_hash": file_hash,
                "page": doc.get("page", 1),
                "text": doc["text"]
            })

    # ---------------------------------------------------------
    # Search
    # ---------------------------------------------------------

    def search(
        self,
        query_embedding,
        top_k=20
    ):

        if self.index.ntotal == 0:
            return []

        query_embedding = np.asarray(
            [query_embedding],
            dtype=np.float32
        )

        distances, indices = self.index.search(
            query_embedding,
            min(top_k, self.index.ntotal)
        )

        results = []

        for idx, distance in zip(
            indices[0],
            distances[0]
        ):

            if idx == -1:
                continue

            item = self.metadata[idx].copy()

            item["distance"] = float(distance)

            results.append(item)

        return results

    # ---------------------------------------------------------
    # Utility Functions
    # ---------------------------------------------------------

    def total_vectors(self):

        return self.index.ntotal

    def total_documents(self):

        document_ids = {

            item["document_id"]

            for item in self.metadata

        }

        return len(document_ids)

    def clear(self):

        dimension = self.index.d

        self.index = faiss.IndexFlatL2(dimension)

        self.metadata.clear()