# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import trips

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Navia API",
    version="0.1.0",
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # or ["*"] during dev if you want
    allow_credentials=True,
    allow_methods=["*"],          # allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],          # allow all headers
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(trips.router)
