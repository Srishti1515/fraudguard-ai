# app/models/__init__.py
# Import all models so SQLAlchemy discovers them during Base.metadata.create_all()

from app.models.account     import BankAccount, AccountType                   # noqa
from app.models.transaction import Transaction, TransactionStatus, RiskLevel  # noqa
from app.models.user        import User, OTPLog, FraudAlert                   # noqa
