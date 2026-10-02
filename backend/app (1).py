from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime
import shutil
import os
import uuid
import hashlib
from fastapi.middleware.cors import CORSMiddleware

from config import UPLOAD_FOLDER
from pdf_processor import extract_pages
from text_chunker import chunk_pages
from embedding import generate_embeddings
from vector_store import VectorStore
from rag import RAG
from services.persistent import persistence
import storage


@asynccontextmanager
async def lifespan(app: FastAPI):

    storage.vector_store = persistence.load()

    if storage.vector_store is not None:

        storage.rebuild_loaded_documents()

        print(
            f"Loaded {storage.vector_store.total_vectors()} vectors "
            f"from {storage.vector_store.total_documents()} documents."
        )

    else:

        print("No existing vector database found.")

    yield

    print("Server shutdown.")


app = FastAPI(
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = RAG()


class ChatRequest(BaseModel):
    chat_id: str
    question: str

class RenameChatRequest(BaseModel):
    chat_name: str


@app.get("/")
def home():

    return {

        "message": "AI PDF Chatbot Backend Running"

    }


@app.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    document_id = f"doc_{uuid.uuid4().hex}"
    master_hash_obj = hashlib.sha256()
    
    all_pages = []
    total_chunks = 0
    pdf_names = []
    
    for file in files:
        if file.content_type != "application/pdf":
            continue

        file_content = await file.read()
        file_hash = hashlib.sha256(file_content).hexdigest()
        master_hash_obj.update(file_hash.encode('utf-8'))
        
        pdf_names.append(file.filename)

        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        pages = extract_pages(file_path)
        if pages:
            documents = chunk_pages(pages)
            if documents:
                embeddings = generate_embeddings(documents)

                if storage.vector_store is None:
                    storage.vector_store = VectorStore(embeddings.shape[1])

                storage.vector_store.add_documents(
                    embeddings=embeddings,
                    documents=documents,
                    pdf_name=file.filename,
                    document_id=document_id,
                    file_hash=file_hash
                )
                
                all_pages.extend(pages)
                total_chunks += len(documents)

    if not all_pages:
        raise HTTPException(
            status_code=400,
            detail="No valid text found in the uploaded PDFs."
        )

    master_hash = master_hash_obj.hexdigest()
    
    # Determine master pdf_name
    if len(pdf_names) == 1:
        master_pdf_name = pdf_names[0]
    else:
        master_pdf_name = f"Combined Document ({len(pdf_names)} PDFs)"

    storage.loaded_documents[document_id] = {
        "pdf_name": master_pdf_name,
        "file_hash": master_hash,
        "pages": len(all_pages),
        "chunks": total_chunks
    }
    
    chat_id = f"chat_{uuid.uuid4().hex}"

    # Create Chat Session
    storage.chat_sessions[chat_id] = {
        "chat_id": chat_id,
        "document_id": document_id,
        "pdf_name": master_pdf_name,
        "chat_name": None,
        "messages": []
    }

    # Save changes (new vector or just new chat session)
    if storage.vector_store is not None:
        persistence.save(storage.vector_store)

    return {
        "message": f"Successfully processed {len(pdf_names)} PDFs.",
        "chat_id": chat_id,
        "document_id": document_id,
        "pdf_name": master_pdf_name,
        "is_duplicate": False
    }


@app.post("/chat")
async def chat(request: ChatRequest):

    if storage.vector_store is None:
        raise HTTPException(
            status_code=400,
            detail="Knowledge base is empty."
        )

    if request.chat_id not in storage.chat_sessions:
        raise HTTPException(
            status_code=404,
            detail="Invalid chat_id."
        )

    chat_session = storage.chat_sessions[request.chat_id]
    document_id = chat_session["document_id"]

    # Optional: pass chat history to RAG. For now we just ask the new question.
    # We could format a conversation string here if needed.
    response = rag.ask(
        document_id=document_id,
        question=request.question
    )

    # Auto-generate title if this is the first message
    title_generated = False
    if not chat_session.get("chat_name"):
        try:
            chat_session["chat_name"] = rag.generate_title(request.question)
            title_generated = True
        except Exception:
            chat_session["chat_name"] = "New Chat"

    # Append to history
    chat_session["messages"].append({
        "role": "user",
        "content": request.question
    })
    chat_session["messages"].append({
        "role": "ai",
        "content": response["answer"],
        "sources": response.get("sources", [])
    })

    # Save the updated session
    persistence.save(storage.vector_store)

    if title_generated:
        response["chat_name"] = chat_session["chat_name"]

    return response

@app.get("/documents")
def list_documents():
    documents = []
    for document_id, info in storage.loaded_documents.items():
        documents.append({
            "document_id": document_id,
            **info
        })
    return documents

@app.get("/chats")
def list_chats():
    chats = []
    for chat_id, info in storage.chat_sessions.items():
        chats.append({
            "chat_id": chat_id,
            "document_id": info["document_id"],
            "pdf_name": info["pdf_name"],
            "chat_name": info.get("chat_name")
        })
    # Return newest first
    return list(reversed(chats))

@app.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    if chat_id not in storage.chat_sessions:
        raise HTTPException(
            status_code=404,
            detail="Chat not found."
        )
    return storage.chat_sessions[chat_id]

@app.patch("/chats/{chat_id}")
def rename_chat(chat_id: str, request: RenameChatRequest):
    if chat_id not in storage.chat_sessions:
        raise HTTPException(
            status_code=404,
            detail="Chat not found."
        )
    
    storage.chat_sessions[chat_id]["chat_name"] = request.chat_name
    
    if storage.vector_store is not None:
        persistence.save(storage.vector_store)
        
    return {"message": "Chat renamed successfully.", "chat_name": request.chat_name}

@app.delete("/documents")
def clear_documents():

    persistence.clear()

    storage.reset()

    upload_folder = UPLOAD_FOLDER

    for filename in os.listdir(upload_folder):

        file_path = os.path.join(
            upload_folder,
            filename
        )

        if os.path.isfile(file_path):

            os.remove(file_path)

    return {

        "message": "Knowledge base cleared."

    } 