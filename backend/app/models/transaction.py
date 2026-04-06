"""
app/models/transaction.py
──────────────────────────
Transaction database model.
Stores every transaction attempt with full ML audit trail.
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class TransactionStatus(str, enum.Enum):
    PENDING     = "pending"
    APPROVED    = "approved"
    BLOCKED     = "blocked"
    OTP_PENDING = "otp_pending"


class RiskLevel(str, enum.Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class Transaction(Base):
    __tablename__ = "transactions"

    id              = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    user_id         = Column(Integer, ForeignKey("users.id",        ondelete="CASCADE"), nullable=False)
    account_id      = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)

    # Transaction identity
    transaction_ref = Column(String(50), unique=True, nullable=False, index=True)

    # Core transaction data
    amount          = Column(Float, nullable=False)
    merchant        = Column(String(100), nullable=False)
    merchant_category = Column(String(50), nullable=True)
    location        = Column(String(100), nullable=True)
    description     = Column(Text, nullable=True)

    # Decision
    status          = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False)
    risk_level      = Column(Enum(RiskLevel), nullable=True)
    risk_score      = Column(Float, nullable=True)   # 0.0 – 100.0
    is_fraud        = Column(Boolean, nullable=True)

    # OTP verification
    otp_code        = Column(String(255), nullable=True)   # stored as SHA-256 hash
    otp_expires_at  = Column(DateTime(timezone=True), nullable=True)
    otp_verified    = Column(Boolean, default=False)

    # Timestamps
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    processed_at    = Column(DateTime(timezone=True), nullable=True)

    # ── Raw Kaggle dataset feature columns ──────────────────────────────────
    # These are the PCA-anonymised V features from the Kaggle credit card dataset.
    # Storing them enables full audit trail and SHAP explainability.
    # Dataset: https://www.kaggle.com/datasets/shankarprasad/credit-card-data
    # Columns: Time, V1-V28, Amount, Class
    v1  = Column(Float, nullable=True)
    v2  = Column(Float, nullable=True)
    v3  = Column(Float, nullable=True)
    v4  = Column(Float, nullable=True)
    v5  = Column(Float, nullable=True)
    v6  = Column(Float, nullable=True)
    v7  = Column(Float, nullable=True)
    v8  = Column(Float, nullable=True)
    v9  = Column(Float, nullable=True)
    v10 = Column(Float, nullable=True)
    v11 = Column(Float, nullable=True)
    v12 = Column(Float, nullable=True)
    v13 = Column(Float, nullable=True)
    v14 = Column(Float, nullable=True)
    v15 = Column(Float, nullable=True)
    v16 = Column(Float, nullable=True)
    v17 = Column(Float, nullable=True)
    v18 = Column(Float, nullable=True)
    v19 = Column(Float, nullable=True)
    v20 = Column(Float, nullable=True)
    v21 = Column(Float, nullable=True)
    v22 = Column(Float, nullable=True)
    v23 = Column(Float, nullable=True)
    v24 = Column(Float, nullable=True)
    v25 = Column(Float, nullable=True)
    v26 = Column(Float, nullable=True)
    v27 = Column(Float, nullable=True)
    v28 = Column(Float, nullable=True)

    # Relationships
    user    = relationship("User",        back_populates="transactions")
    account = relationship("BankAccount", back_populates="transactions")

    def __repr__(self):
        return f"<Transaction {self.transaction_ref} ₹{self.amount} [{self.status.value}]>"
