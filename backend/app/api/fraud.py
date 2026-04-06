from fastapi import APIRouter
router = APIRouter()

@router.get("/model-info")
def model_info():
    return {
        "model": "Hybrid RF + XGBoost Ensemble",
        "version": "1.0.0",
        "features": 17,
        "thresholds": {
            "low_risk": "< 30%",
            "medium_risk": "30% – 70%",
            "high_risk": "> 70%",
        },
        "techniques": ["SMOTE", "Class weighting", "Stratified K-Fold"],
        "evaluation_targets": {
            "accuracy": "97-98%",
            "roc_auc": "> 0.97",
        }
    }
