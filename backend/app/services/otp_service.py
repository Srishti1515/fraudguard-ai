import random
import string
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

class OTPService:
    def generate_otp(self, length: int = 6) -> str:
        return ''.join(random.choices(string.digits, k=length))

    def hash_otp(self, otp: str) -> str:
        return hashlib.sha256(otp.encode()).hexdigest()

    def verify_otp(self, plain_otp: str, hashed_otp: str) -> bool:
        return self.hash_otp(plain_otp) == hashed_otp

    def get_expiry(self) -> datetime:
        return datetime.utcnow() + timedelta(seconds=settings.OTP_EXPIRE_SECONDS)

    async def send_email_otp(
        self,
        recipient_email: str,
        recipient_name: str,
        otp: str,
        amount: float,
        merchant: str,
    ) -> bool:
        """Send OTP via SMTP email."""
        if not settings.SMTP_USER:
            print(f"[DEV MODE] OTP for {recipient_email}: {otp}")
            return True

        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px;">
                <h1 style="color: #f8fafc; margin: 0 0 8px;">🛡 FraudGuard AI</h1>
                <p style="color: #94a3b8; margin: 0;">Security Verification</p>
            </div>
            <div style="padding: 30px 0;">
                <p style="color: #334155; font-size: 16px;">Hi <strong>{recipient_name}</strong>,</p>
                <p style="color: #334155;">A <strong>suspicious transaction</strong> has been flagged on your account.</p>
                <div style="background: #f1f5f9; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Transaction Details</p>
                    <p style="margin: 4px 0; color: #0f172a; font-weight: bold; font-size: 20px;">₹{amount:,.2f}</p>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Merchant: {merchant}</p>
                </div>
                <p style="color: #334155;">Your one-time verification code is:</p>
                <div style="background: #0f172a; color: #38bdf8; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 12px; letter-spacing: 12px; margin: 20px 0;">
                    {otp}
                </div>
                <p style="color: #94a3b8; font-size: 13px;">⏱ This code expires in 5 minutes.</p>
                <p style="color: #ef4444; font-size: 13px; font-weight: bold;">⚠ If you did not initiate this transaction, do NOT enter this OTP and contact support immediately.</p>
            </div>
        </div>
        """

        message = MIMEMultipart("alternative")
        message["Subject"] = f"🔐 OTP: Verify ₹{amount:,.0f} transaction - FraudGuard AI"
        message["From"] = settings.FROM_EMAIL
        message["To"] = recipient_email
        message.attach(MIMEText(html_body, "html"))

        try:
            async with aiosmtplib.SMTP(
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                use_tls=False,
            ) as smtp:
                await smtp.starttls()
                await smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                await smtp.send_message(message)
            return True
        except Exception as e:
            print(f"Email send error: {e}")
            return False

    async def send_sms_otp(
        self,
        phone_number: str,
        otp: str,
        amount: float,
    ) -> bool:
        """Send OTP via Twilio SMS."""
        if not settings.TWILIO_ACCOUNT_SID:
            print(f"[DEV MODE] SMS OTP to {phone_number}: {otp}")
            return True
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=f"FraudGuard AI: Your OTP to approve ₹{amount:,.0f} is {otp}. Expires in 5 mins. Do NOT share this.",
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone_number,
            )
            return True
        except Exception as e:
            print(f"SMS send error: {e}")
            return False


otp_service = OTPService()
