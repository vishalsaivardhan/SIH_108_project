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
food_rules = None
DATASET_PATH = Path(__file__).resolve().parent / "processed_standards.json"
FOOD_RULES_PATH = Path(__file__).resolve().parent / "food_tender_rules.json"

class QueryRequest(BaseModel):
    text: str
    top_k: int = 3

@app.on_event("startup")
def load_resources():
    global standards, vectorizer, standards_matrix, food_rules
    print("Loading standards dataset and building search index...")
    try:
        with DATASET_PATH.open(encoding="utf-8") as dataset_file:
            standards = json.load(dataset_file)
        with FOOD_RULES_PATH.open(encoding="utf-8") as rules_file:
            food_rules = json.load(rules_file)

        searchable_text = [item.get("searchable_text", "") for item in standards]
        vectorizer = TfidfVectorizer(
            lowercase=True,
            strip_accents="unicode",
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        standards_matrix = vectorizer.fit_transform(searchable_text)
        print(f"Loaded {len(standards)} standards and food tender rules successfully.")
    except Exception as e:
        print(f"Error loading processed_standards.json: {e}")

@app.get("/")
def health_check():
    return {"status": "online", "service": "IS Recommendation Engine API"}

@app.post("/api/recommend")
def recommend_standards(query: QueryRequest):
    if not query.text.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")
    return {
        "query": query.text,
        "recommendations": find_recommendations(query.text, query.top_k),
        "tender_analysis": analyze_food_tender(query.text),
    }

@app.post("/api/upload-analyze")
async def upload_analyze_tender(file: UploadFile = File(...), top_k: int = 3):
    content = await file.read()
    tender_text = content.decode("utf-8", errors="ignore")

    if not tender_text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return {
        "filename": file.filename,
        "recommendations": find_recommendations(tender_text, top_k),
        "tender_analysis": analyze_food_tender(tender_text),
    }


def analyze_food_tender(text):
    """Screen a tender for food-safety evidence; this does not validate certificates externally."""
    if food_rules is None:
        raise HTTPException(status_code=503, detail="Food tender rules are not ready.")

    normalized_text = text.lower()
    checks = []
    total_weight = 0
    earned_weight = 0
    issues = []

    for group_name, group_key in (("certificate", "certificate_checks"), ("requirement", "requirement_checks")):
        for rule in food_rules[group_key]:
            found = any(pattern.lower() in normalized_text for pattern in rule["patterns"])
            total_weight += rule["weight"]
            if found:
                earned_weight += rule["weight"]
            checks.append({
                "id": rule["id"],
                "label": rule["label"],
                "type": group_name,
                "status": "evidence_found" if found else "missing",
                "verification": "document_evidence_only" if found else "not_found",
                "critical": rule["critical"],
            })
            if not found:
                issues.append({
                    "severity": "high" if rule["critical"] else "medium",
                    "area": group_name,
                    "message": f"{rule['label']} is not stated in the tender.",
                    "action": f"Request and verify {rule['label']} before award.",
                })

    score = round((earned_weight / total_weight) * 100) if total_weight else 0
    critical_missing = sum(1 for check in checks if check["critical"] and check["status"] == "missing")
    if critical_missing:
        rating = "High risk"
    elif score >= 85:
        rating = "Ready for verification"
    elif score >= 65:
        rating = "Needs review"
    else:
        rating = "High risk"

    return {
        "domain": food_rules["domain"],
        "rating": rating,
        "score": score,
        "confidence": "screening only",
        "certificate_verification_note": "Evidence found in the submitted text is not external validation. Confirm certificate number, legal entity, scope, validity, and issuer directly.",
        "certificate_checks": [check for check in checks if check["type"] == "certificate"],
        "requirement_checks": [check for check in checks if check["type"] == "requirement"],
        "issues": sorted(issues, key=lambda issue: 0 if issue["severity"] == "high" else 1),
        "issue_count": len(issues),
    }


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