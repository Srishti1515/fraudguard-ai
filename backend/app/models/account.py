"""
app/models/account.py
─────────────────────
BankAccount database model.
Each user can link multiple bank accounts.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class AccountType(str, enum.Enum):
    SAVINGS = "savings"
    CURRENT = "current"


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Account details
    account_number = Column(String(20), unique=True, nullable=False, index=True)
    ifsc_code      = Column(String(15), nullable=False)
    bank_name      = Column(String(100), nullable=False)
    account_type   = Column(Enum(AccountType), default=AccountType.SAVINGS, nullable=False)

    # Balance & status
    balance        = Column(Float, default=0.0, nullable=False)
    is_primary     = Column(Boolean, default=False, nullable=False)
    is_active      = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner          = relationship("User",        back_populates="accounts")
    transactions   = relationship("Transaction", back_populates="account",
                                  cascade="all, delete-orphan")

    def __repr__(self):
        return f"<BankAccount {self.bank_name} ****{self.account_number[-4:]}>"
