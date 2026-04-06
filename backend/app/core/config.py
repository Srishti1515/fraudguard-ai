from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "FraudGuard AI"
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/fraudguard"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@fraudguard.ai"

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    REDIS_URL: str = "redis://localhost:6379"

    MODEL_PATH:  str = "ml_pipeline/models/fraud_model.joblib"
    SCALER_PATH: str = "ml_pipeline/models/scaler.joblib"

    # Thresholds — FIXED: lowered HIGH threshold so OTP triggers more reliably
    # Rule-based: crypto+foreign = ~0.63, which was below old 0.70 threshold
    LOW_RISK_THRESHOLD:  float = 0.30   # below 30% → auto-approve
    HIGH_RISK_THRESHOLD: float = 0.60   # above 60% → OTP required (was 0.70, too high)
    OTP_EXPIRE_SECONDS:  int   = 300

    class Config:
        env_file = ".env"

settings = Settings()
