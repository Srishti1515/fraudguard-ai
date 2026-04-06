from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_active_user, require_admin
from app.models.user import User, Transaction, FraudAlert

router = APIRouter()

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None

@router.get("/me")
def get_profile(current_user: User = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "address": current_user.address,
        "transaction_count": current_user.transaction_count,
        "avg_transaction_amount": current_user.avg_transaction_amount,
        "risk_profile_score": current_user.risk_profile_score,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }

@router.put("/me")
def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if payload.full_name:
        current_user.full_name = payload.full_name
    if payload.phone_number:
        current_user.phone_number = payload.phone_number
    if payload.address is not None:
        current_user.address = payload.address
    db.commit()
    return {"message": "Profile updated"}

@router.get("/alerts")
def get_alerts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    alerts = (
        db.query(FraudAlert)
        .filter(FraudAlert.user_id == current_user.id)
        .order_by(FraudAlert.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "message": a.message,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]
