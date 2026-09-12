import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

app = FastAPI(title="AI-Powered Indian Standards Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

standards = None
vectorizer = None
standards_matrix = None
DATASET_PATH = Path(__file__).resolve().parent / "processed_standards.json"

class QueryRequest(BaseModel):
    text: str
    top_k: int = 3

@app.on_event("startup")
def load_resources():
    global standards, vectorizer, standards_matrix
    print("Loading standards dataset and building search index...")
    try:
        with DATASET_PATH.open(encoding="utf-8") as dataset_file:
            standards = json.load(dataset_file)

        searchable_text = [item.get("searchable_text", "") for item in standards]
        vectorizer = TfidfVectorizer(
            lowercase=True,
            strip_accents="unicode",
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        standards_matrix = vectorizer.fit_transform(searchable_text)
        print(f"Loaded {len(standards)} standards successfully.")
    except Exception as e:
        print(f"Error loading processed_standards.json: {e}")

@app.get("/")
def health_check():
    return {"status": "online", "service": "IS Recommendation Engine API"}

@app.post("/api/recommend")
def recommend_standards(query: QueryRequest):
    if not query.text.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")
    return {"query": query.text, "recommendations": find_recommendations(query.text, query.top_k)}

@app.post("/api/upload-analyze")
async def upload_analyze_tender(file: UploadFile = File(...), top_k: int = 3):
    content = await file.read()
    tender_text = content.decode("utf-8", errors="ignore")

    if not tender_text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return {"filename": file.filename, "recommendations": find_recommendations(tender_text, top_k)}


def find_recommendations(text, top_k):
    if standards is None or vectorizer is None or standards_matrix is None:
        raise HTTPException(status_code=503, detail="Recommendation resources are not ready.")

    query_vector = vectorizer.transform([text])
    similarities = cosine_similarity(query_vector, standards_matrix)[0]
    result_count = max(1, min(int(top_k), len(standards)))
    top_indices = similarities.argsort()[::-1][:result_count]

    results = []
    for idx in top_indices:
        score = float(similarities[idx])
        row = standards[idx]
        results.append({
            "is_code": row["is_code"],
            "title": row["title"],
            "category": row["category"],
            "scope": row["scope"],
            "normative_references": row["normative_references"],
            "mandatory_certifications": row["mandatory_certifications"],
            "latest_version": row["latest_version"],
            "similarity_score": round(score, 4),
            "verification_status": "Verified" if score >= 0.45 else "Unverified",
        })

    return results