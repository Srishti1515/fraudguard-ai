import json
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User, Transaction

class BehavioralProfileService:
    """
    Adaptive Fraud Intelligence — learns user spending patterns over time.
    Personalizes fraud thresholds based on behavioral history.
    """

    def update_user_profile(self, db: Session, user: User, transaction_amount: float, location: str):
        """Update user's behavioral profile after each approved transaction."""
        count = user.transaction_count or 0
        avg = user.avg_transaction_amount or 0.0

        # Exponential moving average for gradual adaptation
        new_count = count + 1
        alpha = 0.1  # learning rate — 10% weight to new data
        new_avg = (1 - alpha) * avg + alpha * transaction_amount if count > 0 else transaction_amount

        # Update location history (last 10 unique locations)
        try:
            locations = json.loads(user.usual_locations or "[]")
        except Exception:
            locations = []
        if location and location not in locations:
            locations.append(location)
        locations = locations[-10:]

        user.transaction_count = new_count
        user.avg_transaction_amount = new_avg
        user.usual_locations = json.dumps(locations)

        # Recalculate risk profile score
        user.risk_profile_score = self._calculate_risk_profile(user, db)
        db.commit()

    def _calculate_risk_profile(self, user: User, db: Session) -> float:
        """
        0.0 = very low risk user, 1.0 = high-risk user profile.
        Based on: transaction history, fraud flags, account age.
        """
        fraud_count = db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.is_fraud == True,
        ).count()

        total = user.transaction_count or 1
        fraud_rate = fraud_count / total

        # Experienced users with no fraud history get lower risk baseline
        experience_factor = min(user.transaction_count / 100, 1.0)
        base_risk = 0.5 - (0.3 * experience_factor) + (0.5 * fraud_rate)
        return round(min(max(base_risk, 0.0), 1.0), 4)

    def get_adaptive_threshold(self, user: User, amount: float) -> Dict[str, Any]:
        """
        Returns personalized risk context for this user + amount combination.
        """
        avg = user.avg_transaction_amount or 500.0
        try:
            usual_locations = json.loads(user.usual_locations or "[]")
        except Exception:
            usual_locations = []

        ratio = amount / avg if avg > 0 else 1.0
        profile_score = user.risk_profile_score or 0.5

        # Adjust thresholds based on user's reliability
        base_low  = 0.30
        base_high = 0.70
        low_threshold  = base_low  + (0.1 * (1 - profile_score))
        high_threshold = base_high - (0.1 * profile_score)

        return {
            "user_avg_amount": avg,
            "amount_ratio": round(ratio, 2),
            "usual_locations": usual_locations,
            "profile_risk_score": profile_score,
            "adjusted_low_threshold": round(low_threshold, 3),
            "adjusted_high_threshold": round(high_threshold, 3),
            "is_unusually_large": ratio > 5,
            "is_very_large": ratio > 10,
        }


behavioral_service = BehavioralProfileService()
