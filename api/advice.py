from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/advice")
async def advice(request: Request):
    body = await request.json()
    tone = body.get("tone", "helpful")
    report = body.get("report", {})

    # TODO: Implement full advice engine (Phase 5)
    return JSONResponse({
        "summary": "Advice engine coming soon.",
        "strengths": [],
        "weaknesses": [],
        "recommendations": [],
        "overall_score": 0,
        "grade": "?",
        "tone": tone,
    })
