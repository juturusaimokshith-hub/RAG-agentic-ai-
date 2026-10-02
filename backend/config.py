import os

# =====================================================
# Project Paths
# =====================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

VECTOR_DB_DIR = os.path.join(BASE_DIR, "vector_db")

INDEX_FILE = os.path.join(VECTOR_DB_DIR, "index.faiss")

METADATA_FILE = os.path.join(VECTOR_DB_DIR, "metadata.json")

CHATS_FILE = os.path.join(VECTOR_DB_DIR, "chats.json")

# =====================================================
# Model Configuration
# =====================================================

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

LLM_MODEL = "llama3.2:3b"

# =====================================================
# Chunking
# =====================================================

CHUNK_SIZE = 1000

CHUNK_OVERLAP = 200

# =====================================================
# Retrieval
# =====================================================

TOP_K = 10

SEARCH_CANDIDATES = 20

# =====================================================
# Create Required Directories
# =====================================================

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

os.makedirs(VECTOR_DB_DIR, exist_ok=True)