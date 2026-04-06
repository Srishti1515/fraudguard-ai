"""
app/models/user.py
───────────────────
User, OTPLog, and FraudAlert models.
BankAccount → app/models/account.py
Transaction  → app/models/transaction.py

Re-exports everything so other modules can still do:
    from app.models.user import User, BankAccount, Transaction, ...
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Re-export sibling models so existing imports keep working
from app.models.account     import BankAccount, AccountType                   # noqa: F401
from app.models.transaction import Transaction, TransactionStatus, RiskLevel  # noqa: F401


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    full_name        = Column(String(100), nullable=False)
    email            = Column(String(150), unique=True, index=True, nullable=False)
    phone_number     = Column(String(20),  unique=True, nullable=False)
    address          = Column(Text, nullable=True)
    hashed_password  = Column(String(255), nullable=False)
    is_active        = Column(Boolean, default=True)
    is_admin         = Column(Boolean, default=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    # Adaptive Fraud Intelligence — updated after each approved transaction
    avg_transaction_amount = Column(Float,   default=0.0)
    transaction_count      = Column(Integer, default=0)
    usual_locations        = Column(Text,    default="[]")  # JSON list
    risk_profile_score     = Column(Float,   default=0.5)

    accounts     = relationship("BankAccount", back_populates="owner",
                                cascade="all, delete-orphan")
    transactions = relationship("Transaction",  back_populates="user",
                                cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"


class OTPLog(Base):
    __tablename__ = "otp_logs"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    otp_hash       = Column(String(255), nullable=False)
    is_used        = Column(Boolean, default=False)
    attempts       = Column(Integer, default=0)
    expires_at     = Column(DateTime(timezone=True), nullable=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


class FraudAlert(Base):
    __tablename__ = "fraud_alerts"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    alert_type     = Column(String(50), nullable=False)
    message        = Column(Text, nullable=False)
    is_resolved    = Column(Boolean, default=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
