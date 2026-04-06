"""
app/services/fraud_service.py  — FIXED VERSION
================================================
Bugs fixed in this file:

  BUG 1 (CRITICAL — main cause of your problem):
    transactions.py passed v_features with LOWERCASE keys {"v1": x, "v14": y}
    but _build_feature_vector looked for UPPERCASE "V1", "V14".
    Result: all 28 V-features were always 0.0 → near-identical risk scores.
    Fix: normalise to uppercase at entry point of predict().

  BUG 2 (CRITICAL — why model never loaded):
    MODEL_PATH was resolved relative to the CURRENT WORKING DIRECTORY
    (wherever you ran uvicorn), not the backend folder.
    If you ran uvicorn from anywhere other than backend/, os.path.exists()
    returned False and it silently fell back to rules.
    Fix: resolve all paths relative to __file__ (this file's location).

  BUG 3 (rule-based fallback also broken):
    _rule_based_score also used uppercase V keys but received lowercase dict.
    Fix: handled by the same normalisation in predict().
"""
import os
import joblib
import numpy as np
from typing import Dict, Tuple, Optional
from app.core.config import settings

# ── Path resolution anchored to backend/ ─────────────────────────────────────
# This file lives at:  backend/app/services/fraud_service.py
# So _BACKEND is:      backend/
_BACKEND    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_MODELS_DIR = os.path.join(_BACKEND, "ml_pipeline", "models")


def _resolve(config_path: str) -> str:
    """Make a possibly-relative path absolute, anchored at backend/."""
    if os.path.isabs(config_path):
        return config_path
    return os.path.normpath(os.path.join(_BACKEND, config_path))


class FraudDetectionService:

    def __init__(self):
        self.model: Optional[object] = None
        self.scaler: Optional[object] = None
        self.feature_names: Optional[list] = None
        self.load_status = "not_attempted"
        self._load_models()

    # ── Model loading ──────────────────────────────────────────────────────────

    def _load_models(self):
        model_path  = _resolve(settings.MODEL_PATH)
        scaler_path = _resolve(settings.SCALER_PATH)
        fname_path  = os.path.join(_MODELS_DIR, "feature_names.joblib")

        print(f"\n{'='*60}")
        print(f"  FraudGuard AI — Model Loader")
        print(f"  Backend root   : {_BACKEND}")
        print(f"  Models dir     : {_MODELS_DIR}")
        print(f"  Model path     : {model_path}")
        print(f"  Model exists?  : {os.path.exists(model_path)}")
        print(f"  Scaler exists? : {os.path.exists(scaler_path)}")
        print(f"{'='*60}")

        if not os.path.exists(model_path):
            # Last-resort: try hardcoded standard path
            fallback = os.path.join(_MODELS_DIR, "fraud_model.joblib")
            if os.path.exists(fallback):
                print(f"  Using fallback path: {fallback}")
                model_path  = fallback
                scaler_path = os.path.join(_MODELS_DIR, "scaler.joblib")

        if os.path.exists(model_path) and os.path.exists(scaler_path):
            try:
                self.model  = joblib.load(model_path)
                self.scaler = joblib.load(scaler_path)
                if os.path.exists(fname_path):
                    self.feature_names = joblib.load(fname_path)
                    print(f"\n✅  ML model loaded | {len(self.feature_names)} features")
                else:
                    print(f"\n✅  ML model loaded | no feature_names.joblib (positional match)")
                self.load_status = "loaded"
            except Exception as exc:
                print(f"\n❌  Model load error: {exc}")
                self.load_status = f"error:{exc}"
        else:
            print(f"\n⚠️   Model files not found — using rule-based fallback")
            print(f"    Run: python ml_pipeline/train_model.py --data ml_pipeline/creditcard.csv")
            self.load_status = "not_found"

    def get_status(self) -> dict:
        return {
            "ml_model_active": self.model is not None,
            "load_status": self.load_status,
            "feature_count": len(self.feature_names) if self.feature_names else None,
            "backend_root": _BACKEND,
            "models_dir": _MODELS_DIR,
        }

    # ── Feature engineering ────────────────────────────────────────────────────

    def _build_feature_vector(
        self,
        amount: float,
        v_upper: Dict[str, float],  # uppercase "V1"…"V28"
        hour: int,
        user_avg_amount: float,
    ) -> np.ndarray:
        # 28 Kaggle V-features
        v = [v_upper.get(f"V{i}", 0.0) for i in range(1, 29)]

        # Amount features
        amount_log     = np.log1p(amount)
        amount_squared = amount ** 2

        # Time features
        is_night    = 1 if (hour >= 22 or hour <= 5) else 0
        is_business = 1 if (9 <= hour <= 17) else 0

        # Interaction terms (matches train_model.py)
        v1, v2   = v[0],  v[1]
        v3, v4   = v[2],  v[3]
        v10, v12 = v[9],  v[11]
        v14, v17 = v[13], v[16]
        interactions = [
            v1 * v2, v3 * v4, v10 * v12,
            v14 * v17, v1 * v14, v3 * v17,
        ]

        # Anomaly approximation
        anomaly_score = 1 if (abs(v14) > 5 or abs(v17) > 5 or abs(v12) > 5) else 0

        feature_vector = (
            v
            + [amount, amount_log, amount_squared]
            + [hour, is_night, is_business]
            + interactions
            + [anomaly_score]
        )
        return np.array(feature_vector, dtype=np.float64).reshape(1, -1)

    # ── Main predict ───────────────────────────────────────────────────────────

    def predict(
        self,
        amount: float,
        v_features: Dict[str, float],
        hour: int,
        day_of_week: int,
        user_avg_amount: float,
        user_tx_count: int,
        merchant_category: str = "general",
        location: str = "local",
    ) -> Tuple[bool, float, str, Dict]:

        # CRITICAL FIX: normalise to uppercase — transactions.py passes lowercase
        v_upper = {k.upper(): float(v) for k, v in v_features.items()}

        if self.model is not None:
            vec        = self._build_feature_vector(amount, v_upper, hour, user_avg_amount)
            vec_scaled = self.scaler.transform(vec)
            fraud_prob = float(self.model.predict_proba(vec_scaled)[0][1])
        else:
            fraud_prob = self._rule_based_score(
                amount, user_avg_amount, hour, merchant_category, location, v_upper
            )

        risk_score = round(fraud_prob * 100, 2)
        risk_level = (
            "low"    if fraud_prob < settings.LOW_RISK_THRESHOLD  else
            "medium" if fraud_prob < settings.HIGH_RISK_THRESHOLD else
            "high"
        )
        is_fraud    = fraud_prob >= 0.5
        explanation = self._explain(
            amount, user_avg_amount, hour, merchant_category, location, v_upper, risk_score
        )
        return is_fraud, risk_score, risk_level, explanation

    # ── Rule-based fallback ────────────────────────────────────────────────────

    def _rule_based_score(
        self,
        amount: float,
        user_avg: float,
        hour: int,
        category: str,
        location: str,
        v_upper: Dict[str, float],  # uppercase keys
    ) -> float:
        score = 0.08

        if user_avg > 0:
            ratio = amount / user_avg
            if   ratio > 15: score += 0.45
            elif ratio > 10: score += 0.35
            elif ratio > 5:  score += 0.22
            elif ratio > 3:  score += 0.12

        if   hour in range(0, 3): score += 0.20
        elif hour in range(3, 6): score += 0.15

        cat = category.lower()
        if   cat in {"crypto", "wire_transfer"}:   score += 0.30
        elif cat in {"gambling", "jewelry"}:        score += 0.22
        elif cat in {"electronics", "travel"}:      score += 0.05

        loc = location.lower()
        if   loc in {"foreign", "unknown", "vpn"}: score += 0.25
        elif loc == "domestic":                     score += 0.05

        if abs(v_upper.get("V14", 0)) > 5: score += 0.18
        if abs(v_upper.get("V17", 0)) > 5: score += 0.12
        if abs(v_upper.get("V12", 0)) > 5: score += 0.10
        if abs(v_upper.get("V10", 0)) > 5: score += 0.08

        return min(score, 0.98)

    # ── Explanation ────────────────────────────────────────────────────────────

    def _explain(
        self,
        amount: float,
        user_avg: float,
        hour: int,
        category: str,
        location: str,
        v_upper: Dict[str, float],
        risk_score: float,
    ) -> Dict:
        factors = []

        if user_avg > 0 and amount > user_avg * 3:
            factors.append({
                "factor": "Unusually large amount",
                "detail": f"₹{amount:,.0f} is {amount/user_avg:.1f}× your average (₹{user_avg:,.0f})",
                "impact": "high",
            })
        if hour in range(0, 6):
            factors.append({
                "factor": "Odd-hours transaction",
                "detail": f"Transaction at {hour:02d}:00 — outside normal activity window",
                "impact": "medium",
            })
        if category.lower() in {"gambling", "crypto", "wire_transfer", "jewelry"}:
            factors.append({
                "factor": "High-risk merchant category",
                "detail": f"'{category}' has elevated fraud association",
                "impact": "high",
            })
        if location.lower() in {"foreign", "unknown", "vpn"}:
            factors.append({
                "factor": "Unfamiliar location",
                "detail": "Transaction origin differs from your usual locations",
                "impact": "high",
            })
        v14 = abs(v_upper.get("V14", 0))
        v17 = abs(v_upper.get("V17", 0))
        if v14 > 3:
            factors.append({
                "factor": "Anomalous pattern (V14)",
                "detail": f"V14 = {v_upper.get('V14', 0):.3f} — outside normal range",
                "impact": "high" if v14 > 5 else "medium",
            })
        if v17 > 3:
            factors.append({
                "factor": "Anomalous pattern (V17)",
                "detail": f"V17 = {v_upper.get('V17', 0):.3f} — outside normal range",
                "impact": "medium",
            })

        return {
            "risk_score":  risk_score,
            "top_factors": factors[:4],
            "model":       "Hybrid RF + XGBoost Ensemble" if self.model else "Rule-based Engine",
            "ml_active":   self.model is not None,
            "dataset":     "Kaggle Credit Card Fraud — V1-V28",
        }


# Singleton
fraud_service = FraudDetectionService()
