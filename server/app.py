from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from settings import settings

app = FastAPI(
    title="Celery Soup",
    description="Modern Real-Time Monitoring for Celery",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8555",
        "http://127.0.0.1:8555",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.mount("/", StaticFiles(directory="static", html=True), name="static")


@app.get("/api/test")
def index():
    return "Hello world"

