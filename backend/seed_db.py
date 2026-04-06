"""
seed_db.py — Creates demo admin user + sample data
Run: python seed_db.py
"""
import sys
sys.path.insert(0, ".")

from app.core.database import SessionLocal, engine, Base
from app.models.user import User, BankAccount, Transaction, AccountType, TransactionStatus, RiskLevel
from app.core.security import get_password_hash
import uuid, random

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── Admin user ───────────────────────────────────────
if not db.query(User).filter(User.email == "admin@fraudguard.ai").first():
    admin = User(
        full_name="System Admin",
        email="admin@fraudguard.ai",
        phone_number="+91-9000000000",
        address="Mumbai, Maharashtra",
        hashed_password=get_password_hash("Admin@123"),
        is_admin=True,
        transaction_count=0,
        avg_transaction_amount=0,
        risk_profile_score=0.1,
    )
    db.add(admin)
    db.commit()
    print("✅ Admin created: admin@fraudguard.ai / Admin@123")

# ── Demo user ────────────────────────────────────────
demo = db.query(User).filter(User.email == "demo@fraudguard.ai").first()
if not demo:
    demo = User(
        full_name="Priya Sharma",
        email="demo@fraudguard.ai",
        phone_number="+91-9876543210",
        address="Bangalore, Karnataka",
        hashed_password=get_password_hash("Demo@123"),
        is_admin=False,
        transaction_count=0,
        avg_transaction_amount=1500,
        risk_profile_score=0.2,
    )
    db.add(demo)
    db.commit()
    db.refresh(demo)
    print("✅ Demo user created: demo@fraudguard.ai / Demo@123")

# ── Bank accounts ────────────────────────────────────
if not db.query(BankAccount).filter(BankAccount.user_id == demo.id).first():
    accounts = [
        BankAccount(user_id=demo.id, account_number="1234567890123456",
                    ifsc_code="HDFC0001234", bank_name="HDFC Bank",
                    account_type=AccountType.SAVINGS, balance=85000, is_primary=True),
        BankAccount(user_id=demo.id, account_number="9876543210654321",
                    ifsc_code="SBIN0001234", bank_name="State Bank of India",
                    account_type=AccountType.CURRENT, balance=250000, is_primary=False),
    ]
    for acc in accounts:
        db.add(acc)
    db.commit()
    print("✅ Bank accounts created")

# ── Sample transactions ──────────────────────────────
acc = db.query(BankAccount).filter(BankAccount.user_id == demo.id, BankAccount.is_primary == True).first()
if acc and db.query(Transaction).filter(Transaction.user_id == demo.id).count() == 0:
    merchants = [
        ("Amazon", "electronics", 3499, "local", "low"),
        ("BigBasket", "groceries", 1250, "local", "low"),
        ("Swiggy", "dining", 450, "local", "low"),
        ("Flipkart", "electronics", 12999, "local", "medium"),
        ("Crypto Exchange", "crypto", 50000, "foreign", "high"),
        ("MakeMyTrip", "travel", 8500, "domestic", "medium"),
        ("Zara", "clothing", 5999, "local", "low"),
        ("ATM Withdrawal", "general", 2000, "local", "low"),
        ("Foreign Wire Transfer", "wire_transfer", 75000, "foreign", "high"),
        ("Netflix", "entertainment", 499, "local", "low"),
    ]
    for merchant, cat, amount, loc, risk in merchants:
        status = TransactionStatus.APPROVED if risk == "low" else (
            TransactionStatus.BLOCKED if risk == "high" else TransactionStatus.APPROVED)
        risk_score = random.uniform(5, 25) if risk == "low" else (
            random.uniform(72, 95) if risk == "high" else random.uniform(35, 68))
        t = Transaction(
            user_id=demo.id,
            account_id=acc.id,
            transaction_ref=f"TXN{uuid.uuid4().hex[:12].upper()}",
            amount=amount,
            merchant=merchant,
            merchant_category=cat,
            location=loc,
            status=status,
            risk_level=RiskLevel[risk.upper()],
            risk_score=round(risk_score, 2),
            is_fraud=(risk == "high"),
        )
        db.add(t)
    # Update account balance
    acc.balance -= sum(a for _, _, a, _, r in merchants if r != "high")
    demo.transaction_count = len(merchants)
    demo.avg_transaction_amount = sum(a for _, _, a, _, _ in merchants) / len(merchants)
    db.commit()
    print("✅ Sample transactions created")

db.close()
print("\n🎉 Database seeded! Ready to go.")
print("   Admin:  admin@fraudguard.ai / Admin@123")
print("   Demo:   demo@fraudguard.ai  / Demo@123")
