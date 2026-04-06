from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import auth, users, accounts, transactions, fraud, admin
from app.core.database import engine, Base
from app.core.config import settings
import traceback

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FraudGuard AI — Financial Fraud Detection API",
    description="Hybrid ML-powered real-time fraud detection system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global error handler — surfaces real errors instead of generic 500 ────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_detail = str(exc)
    print(f"\n❌ Unhandled exception on {request.method} {request.url}:")
    traceback.print_exc()

    # Make DB errors human-readable
    msg = error_detail
    if "could not connect to server" in error_detail or "Connection refused" in error_detail:
        msg = "Database connection failed — is PostgreSQL running on port 5432?"
    elif "password authentication failed" in error_detail:
        msg = "Database authentication failed — check DATABASE_URL in your .env file"
    elif "database" in error_detail.lower() and "does not exist" in error_detail.lower():
        msg = "Database 'fraudguard' does not exist — run: createdb fraudguard"
    elif "duplicate key" in error_detail or "UniqueViolation" in error_detail:
        if "email" in error_detail:
            msg = "Email already registered"
        elif "phone" in error_detail:
            msg = "Phone number already registered"
        else:
            msg = "A record with these details already exists"

    return JSONResponse(status_code=500, content={"detail": msg})

app.include_router(auth.router,         prefix="/api/auth",         tags=["Authentication"])
app.include_router(users.router,        prefix="/api/users",        tags=["Users"])
app.include_router(accounts.router,     prefix="/api/accounts",     tags=["Bank Accounts"])
app.include_router(transactions.router, prefix="/api/transactions",  tags=["Transactions"])
app.include_router(fraud.router,        prefix="/api/fraud",         tags=["Fraud Detection"])
app.include_router(admin.router,        prefix="/api/admin",         tags=["Admin"])

@app.get("/")
async def root():
    return {"status": "FraudGuard AI is live", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    # Also test DB connection
    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        db.execute(__import__('sqlalchemy').text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "healthy", "database": db_status}