from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="AI-Powered Indian Standards Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
standards_df = None
embeddings_matrix = None
DATASET_PATH = Path(__file__).resolve().parent / "processed_standards.json"

class QueryRequest(BaseModel):
    text: str
    top_k: int = 3

@app.on_event("startup")
def load_resources():
    global model, standards_df, embeddings_matrix
    print("Loading embedding model and standards dataset...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    try:
        standards_df = pd.read_json(DATASET_PATH)
        embeddings_matrix = np.array(standards_df['embedding'].tolist())
        print(f"Loaded {len(standards_df)} standards successfully.")
    except Exception as e:
        print(f"Error loading processed_standards.json: {e}")

@app.get("/")
def health_check():
    return {"status": "online", "service": "IS Recommendation Engine API"}

@app.post("/api/recommend")
def recommend_standards(query: QueryRequest):
    if not query.text.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")
    
    query_vector = model.encode([query.text])
    similarities = cosine_similarity(query_vector, embeddings_matrix)[0]
    top_indices = similarities.argsort()[::-1][:query.top_k]
    
    results = []
    for idx in top_indices:
        score = float(similarities[idx])
        status = "Verified" if score >= 0.45 else "Unverified"
        row = standards_df.iloc[idx]
        results.append({
            "is_code": row["is_code"],
            "title": row["title"],
            "category": row["category"],
            "scope": row["scope"],
            "normative_references": row["normative_references"],
            "mandatory_certifications": row["mandatory_certifications"],
            "latest_version": row["latest_version"],
            "similarity_score": round(score, 4),
            "verification_status": status
        })
        
    return {"query": query.text, "recommendations": results}

@app.post("/api/upload-analyze")
async def upload_analyze_tender(file: UploadFile = File(...), top_k: int = 3):
    try:
        content = await file.read()
        tender_text = content.decode("utf-8", errors="ignore")
        
        if not tender_text.strip():
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
        query_vector = model.encode([tender_text])
        similarities = cosine_similarity(query_vector, embeddings_matrix)[0]
        top_indices = similarities.argsort()[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            status = "Verified" if score >= 0.45 else "Unverified"
            row = standards_df.iloc[idx]
            results.append({
                "is_code": row["is_code"],
                "title": row["title"],
                "category": row["category"],
                "scope": row["scope"],
                "normative_references": row["normative_references"],
                "mandatory_certifications": row["mandatory_certifications"],
                "latest_version": row["latest_version"],
                "similarity_score": round(score, 4),
                "verification_status": status
            })
            
        return {"filename": file.filename, "recommendations": results}
    except Exception as e:
        print(f"Error processing file upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))