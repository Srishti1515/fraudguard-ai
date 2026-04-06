from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_current_active_user, require_admin
from app.models.user import User, Transaction, TransactionStatus, RiskLevel

router = APIRouter()

# --- Fraud analysis router (re-exported on /api/fraud) ---
fraud_router = APIRouter()

@fraud_router.get("/predict-score")
def get_fraud_score_info():
    return {
        "model": "Hybrid RF + XGBoost Ensemble",
        "thresholds": {"low": "0–30%", "medium": "30–70%", "high": "70–100%"},
        "features": "PCA components (V1-V28) + engineered behavioral features",
    }

# --- Admin router ---
router = APIRouter()

@router.get("/dashboard")
def admin_dashboard(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()
    total_txns  = db.query(Transaction).count()
    fraud_txns  = db.query(Transaction).filter(Transaction.is_fraud == True).count()
    blocked_txns = db.query(Transaction).filter(Transaction.status == TransactionStatus.BLOCKED).count()

    total_volume = db.query(func.sum(Transaction.amount)).filter(
        Transaction.status == TransactionStatus.APPROVED
    ).scalar() or 0

    high_risk = db.query(Transaction).filter(Transaction.risk_level == RiskLevel.HIGH).count()

    recent_fraud = (
        db.query(Transaction)
        .filter(Transaction.is_fraud == True)
        .order_by(Transaction.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "summary": {
            "total_users": total_users,
            "total_transactions": total_txns,
            "fraud_detected": fraud_txns,
            "blocked_transactions": blocked_txns,
            "fraud_rate_pct": round(fraud_txns / total_txns * 100, 2) if total_txns else 0,
            "total_volume_approved": round(float(total_volume), 2),
            "high_risk_transactions": high_risk,
        },
        "recent_fraud": [
            {
                "id": t.id,
                "ref": t.transaction_ref,
                "amount": t.amount,
                "merchant": t.merchant,
                "risk_score": t.risk_score,
                "created_at": t.created_at.isoformat(),
            }
            for t in recent_fraud
        ],
    }

@router.get("/users")
def list_users(
    skip: int = 0,
    limit: int = 50,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).offset(skip).limit(limit).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "transaction_count": u.transaction_count,
            "risk_profile_score": u.risk_profile_score,
            "is_active": u.is_active,
        }
        for u in users
    ]
