from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, BankAccount, AccountType

router = APIRouter()

class AccountCreate(BaseModel):
    account_number: str
    ifsc_code: str
    bank_name: str
    account_type: AccountType = AccountType.SAVINGS
    initial_balance: float = 0.0

class AccountTopUp(BaseModel):
    account_id: int
    amount: float

@router.post("/link", status_code=201)
def link_account(
    payload: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if db.query(BankAccount).filter(BankAccount.account_number == payload.account_number).first():
        raise HTTPException(status_code=400, detail="Account number already linked")

    is_primary = db.query(BankAccount).filter(
        BankAccount.user_id == current_user.id
    ).count() == 0  # First account is primary

    account = BankAccount(
        user_id=current_user.id,
        account_number=payload.account_number,
        ifsc_code=payload.ifsc_code,
        bank_name=payload.bank_name,
        account_type=payload.account_type,
        balance=payload.initial_balance,
        is_primary=is_primary,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return {"message": "Account linked successfully", "account_id": account.id, "is_primary": is_primary}

@router.get("/my-accounts")
def get_my_accounts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    accounts = db.query(BankAccount).filter(
        BankAccount.user_id == current_user.id,
        BankAccount.is_active == True,
    ).all()
    return [
        {
            "id": a.id,
            "account_number": f"****{a.account_number[-4:]}",
            "full_account_number": a.account_number,
            "ifsc_code": a.ifsc_code,
            "bank_name": a.bank_name,
            "account_type": a.account_type.value,
            "balance": a.balance,
            "is_primary": a.is_primary,
        }
        for a in accounts
    ]

@router.post("/topup")
def top_up_balance(
    payload: AccountTopUp,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    account = db.query(BankAccount).filter(
        BankAccount.id == payload.account_id,
        BankAccount.user_id == current_user.id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.balance += payload.amount
    db.commit()
    return {"message": "Balance updated", "new_balance": account.balance}

@router.delete("/{account_id}")
def remove_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    account = db.query(BankAccount).filter(
        BankAccount.id == account_id,
        BankAccount.user_id == current_user.id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.is_active = False
    db.commit()
    return {"message": "Account removed"}
