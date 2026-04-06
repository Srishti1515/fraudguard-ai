"""
FraudGuard AI — ML Training Pipeline
======================================
Dataset (REQUIRED):
  https://www.kaggle.com/datasets/shankarprasad/credit-card-data

This script works ONLY with that exact Kaggle dataset.
The dataset has these columns:
  Time, V1, V2, V3, V4, V5, V6, V7, V8, V9, V10,
  V11, V12, V13, V14, V15, V16, V17, V18, V19, V20,
  V21, V22, V23, V24, V25, V26, V27, V28, Amount, Class

  - V1 to V28  : PCA-anonymised features (provided by Kaggle dataset)
  - Amount     : Transaction amount in dollars
  - Time       : Seconds since first transaction in dataset
  - Class      : 0 = legitimate, 1 = fraud  (target column)

Model:  Hybrid Soft-Voting Ensemble (Random Forest + XGBoost)
Handles imbalance: SMOTE + class_weight='balanced' + scale_pos_weight

Run:
  cd backend
  python ml_pipeline/train_model.py --data ml_pipeline/creditcard.csv

Outputs (saved to ml_pipeline/models/):
  fraud_model.joblib
  scaler.joblib
  feature_names.joblib
  metrics.json

Reports (saved to reports/):
  confusion_matrix.png
  roc_curve.png
  feature_importance.png
"""

import argparse
import json
import os
import sys
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")           # headless — no display required
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble         import RandomForestClassifier, VotingClassifier, IsolationForest
from sklearn.preprocessing    import StandardScaler
from sklearn.model_selection  import StratifiedKFold, cross_val_score, train_test_split
from sklearn.metrics          import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report,
    confusion_matrix, roc_curve,
)
from imblearn.over_sampling   import SMOTE
import xgboost as xgb

# ── Output directories ────────────────────────────────────────────────────────
MODELS_DIR  = os.path.join(os.path.dirname(__file__), "models")
REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")
os.makedirs(MODELS_DIR,  exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# ── Exact columns in the Kaggle credit-card dataset ───────────────────────────
KAGGLE_V_COLS = [f"V{i}" for i in range(1, 29)]   # V1 … V28
KAGGLE_REQUIRED_COLS = KAGGLE_V_COLS + ["Amount", "Time", "Class"]


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Load & validate the Kaggle dataset
# ─────────────────────────────────────────────────────────────────────────────

def load_and_validate(filepath: str) -> pd.DataFrame:
    print("\n📂  Loading Kaggle credit-card dataset...")
    if not os.path.exists(filepath):
        print(f"\n❌  ERROR: File not found: {filepath}")
        print("    Download from: https://www.kaggle.com/datasets/shankarprasad/credit-card-data")
        print("    Place as:      backend/ml_pipeline/creditcard.csv")
        sys.exit(1)

    df = pd.read_csv(filepath)
    print(f"    Raw shape: {df.shape}")

    # Validate that all expected Kaggle columns are present
    missing = [c for c in KAGGLE_REQUIRED_COLS if c not in df.columns]
    if missing:
        print(f"\n❌  ERROR: This does not look like the correct Kaggle dataset.")
        print(f"    Missing columns: {missing}")
        print(f"    Expected columns: {KAGGLE_REQUIRED_COLS}")
        print(f"    Actual columns:   {list(df.columns)}")
        print("\n    Please download the correct dataset from:")
        print("    https://www.kaggle.com/datasets/shankarprasad/credit-card-data")
        sys.exit(1)

    print(f"    ✅  All {len(KAGGLE_REQUIRED_COLS)} expected Kaggle columns found.")
    print(f"    Columns: {list(df.columns)}")

    # Class distribution
    fraud_count = int(df["Class"].sum())
    legit_count = len(df) - fraud_count
    fraud_pct   = fraud_count / len(df) * 100
    print(f"\n    Class distribution:")
    print(f"      Legitimate (0): {legit_count:,}")
    print(f"      Fraud      (1): {fraud_count:,}")
    print(f"      Fraud rate    : {fraud_pct:.4f}%")

    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Clean the dataset
# ─────────────────────────────────────────────────────────────────────────────

def clean(df: pd.DataFrame) -> pd.DataFrame:
    print("\n🧹  Cleaning dataset...")

    before = len(df)
    df = df.drop_duplicates()
    print(f"    Removed {before - len(df)} duplicate rows. Rows now: {len(df):,}")

    # Drop rows where all V features are null
    v_null_mask = df[KAGGLE_V_COLS].isnull().all(axis=1)
    df = df[~v_null_mask]
    print(f"    Removed {v_null_mask.sum()} all-null V-feature rows.")

    # Fill any remaining NaN in Amount with median
    if df["Amount"].isnull().any():
        median_amt = df["Amount"].median()
        df["Amount"] = df["Amount"].fillna(median_amt)
        print(f"    Filled NaN in Amount with median ({median_amt:.2f})")

    # Fill any remaining NaN in V features with column mean
    v_null_counts = df[KAGGLE_V_COLS].isnull().sum()
    if v_null_counts.any():
        df[KAGGLE_V_COLS] = df[KAGGLE_V_COLS].fillna(df[KAGGLE_V_COLS].mean())
        print(f"    Filled NaN in V-features with column means.")

    # Cap extreme Amount outliers at 99.9th percentile
    cap = df["Amount"].quantile(0.999)
    df["Amount"] = df["Amount"].clip(upper=cap)
    print(f"    Capped Amount outliers at ₹{cap:,.2f} (99.9th percentile)")

    print(f"    Final clean shape: {df.shape}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Feature engineering on top of Kaggle's existing V1-V28 features
# ─────────────────────────────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    print("\n⚙️   Engineering additional features from Kaggle columns...")
    df = df.copy()

    # Amount transformations (Amount is a raw Kaggle column)
    df["Amount_log"]     = np.log1p(df["Amount"])
    df["Amount_squared"] = df["Amount"] ** 2

    # Time-based features (Time is seconds-since-first-transaction in Kaggle dataset)
    df["Hour"]        = (df["Time"] / 3600).astype(int) % 24
    df["Is_night"]    = ((df["Hour"] >= 22) | (df["Hour"] <= 5)).astype(int)
    df["Is_business"] = ((df["Hour"] >= 9) & (df["Hour"] <= 17)).astype(int)

    # Key interaction terms between Kaggle's most fraud-predictive PCA components
    # (V14 and V17 are consistently the top fraud indicators in this dataset)
    interaction_pairs = [
        ("V1",  "V2"),
        ("V3",  "V4"),
        ("V10", "V12"),
        ("V14", "V17"),   # top-2 fraud predictors
        ("V1",  "V14"),
        ("V3",  "V17"),
    ]
    for a, b in interaction_pairs:
        df[f"{a}x{b}"] = df[a] * df[b]
    print(f"    Added {len(interaction_pairs)} interaction terms.")

    # Isolation Forest anomaly score as a meta-feature
    # Trained on all V-features + log-amount
    print("    Computing Isolation Forest anomaly scores (this may take ~1 min)...")
    iso_features = KAGGLE_V_COLS + ["Amount_log"]
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.002,
        random_state=42,
        n_jobs=-1,
    )
    iso_preds = iso.fit_predict(df[iso_features])
    df["anomaly_score"] = (iso_preds == -1).astype(int)
    anomaly_fraud_overlap = df[df["anomaly_score"] == 1]["Class"].mean() * 100
    print(f"    Anomaly score fraud-overlap: {anomaly_fraud_overlap:.1f}% of flagged rows are fraud.")

    print(f"    Total features after engineering: {df.shape[1]}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Select features and split
# ─────────────────────────────────────────────────────────────────────────────

def select_features(df: pd.DataFrame):
    """
    Use ALL Kaggle V-columns (V1-V28) plus engineered features.
    Drop only: Class (target) and Time (replaced by Hour).
    """
    drop_cols  = {"Class", "Time"}
    feature_cols = [c for c in df.columns if c not in drop_cols]
    X = df[feature_cols].values
    y = df["Class"].values
    print(f"\n🔍  Features selected: {len(feature_cols)}")
    print(f"    Feature names: {feature_cols[:5]} ... {feature_cols[-3:]}")
    return X, y, feature_cols


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Build the Hybrid Ensemble model
# ─────────────────────────────────────────────────────────────────────────────

def build_model(fraud_count: int, legit_count: int):
    """
    Soft-voting ensemble: Random Forest + XGBoost.
    Both models independently handle class imbalance.
    Final probability = weighted average of individual probabilities.
    """
    scale_pos = legit_count / max(fraud_count, 1)   # ~577 for this dataset
    print(f"\n🤖  Building Hybrid RF + XGBoost model (scale_pos_weight={scale_pos:.0f})...")

    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=1,
        class_weight="balanced",   # handles imbalance internally
        n_jobs=-1,
        random_state=42,
    )

    xgb_clf = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos,   # handles imbalance internally
        eval_metric="auc",
        use_label_encoder=False,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )

    # XGBoost gets 2× weight because it consistently outperforms RF on this dataset
    hybrid = VotingClassifier(
        estimators=[("rf", rf), ("xgb", xgb_clf)],
        voting="soft",
        weights=[1, 2],
    )
    return hybrid


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Train, evaluate, save
# ─────────────────────────────────────────────────────────────────────────────

def train(filepath: str):
    # 1. Load & validate
    df = load_and_validate(filepath)

    # 2. Clean
    df = clean(df)

    # 3. Feature engineering
    df = engineer_features(df)

    # 4. Feature selection
    X, y, feature_cols = select_features(df)

    # 5. Stratified train/test split (keep fraud ratio in both sets)
    print("\n✂️   Splitting into train (80%) / test (20%) — stratified...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    print(f"    Train: {X_train.shape}  |  fraud in train: {y_train.sum()}")
    print(f"    Test:  {X_test.shape}   |  fraud in test:  {y_test.sum()}")

    # 6. Scale (fit on train only, transform both)
    print("\n📐  Scaling features with StandardScaler...")
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)

    # 7. SMOTE on training set only (oversample minority fraud class)
    print("\n⚖️   Applying SMOTE to balance training classes...")
    print(f"    Before SMOTE — Legit: {(y_train==0).sum():,}  |  Fraud: {(y_train==1).sum():,}")
    smote = SMOTE(sampling_strategy=0.1, random_state=42, n_jobs=-1)
    X_res, y_res = smote.fit_resample(X_train_sc, y_train)
    print(f"    After  SMOTE — Legit: {(y_res==0).sum():,}  |  Fraud: {(y_res==1).sum():,}")

    # 8. Build model
    fraud_count = int(y_train.sum())
    legit_count = int((y_train == 0).sum())
    model = build_model(fraud_count, legit_count)

    # 9. Train
    print("\n🚀  Training hybrid ensemble (this may take 5–20 minutes)...")
    model.fit(X_res, y_res)
    print("    ✅  Training complete!")

    # 10. Cross-validation on original (un-SMOTE'd) training data
    print("\n📊  5-Fold stratified cross-validation on training set...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(
        model, X_train_sc, y_train, cv=cv, scoring="roc_auc", n_jobs=-1
    )
    print(f"    CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # 11. Test set evaluation
    print("\n🔬  Evaluating on held-out test set...")
    y_pred  = model.predict(X_test_sc)
    y_proba = model.predict_proba(X_test_sc)[:, 1]

    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    f1   = f1_score(y_test, y_pred, zero_division=0)
    auc  = roc_auc_score(y_test, y_proba)

    print(f"\n{'='*54}")
    print(f"  Accuracy  : {acc:.4%}")
    print(f"  Precision : {prec:.4%}")
    print(f"  Recall    : {rec:.4%}")
    print(f"  F1-Score  : {f1:.4%}")
    print(f"  ROC-AUC   : {auc:.6f}")
    print(f"  CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"{'='*54}")
    print()
    print(classification_report(y_test, y_pred, target_names=["Legitimate", "Fraud"]))

    metrics = {
        "dataset":      "Kaggle Credit Card Fraud (shankarprasad/credit-card-data)",
        "total_samples": int(len(df)),
        "fraud_samples": int(df["Class"].sum()),
        "features_used": len(feature_cols),
        "feature_names": feature_cols,
        "accuracy":      round(acc,  6),
        "precision":     round(prec, 6),
        "recall":        round(rec,  6),
        "f1_score":      round(f1,   6),
        "roc_auc":       round(auc,  6),
        "cv_roc_auc_mean": round(cv_scores.mean(), 6),
        "cv_roc_auc_std":  round(cv_scores.std(),  6),
        "model":         "Hybrid RF(w=1) + XGBoost(w=2) Soft-Voting Ensemble",
        "imbalance_handling": ["SMOTE(0.1)", "class_weight=balanced(RF)", f"scale_pos_weight={legit_count//max(fraud_count,1)}(XGB)"],
    }

    # 12. Save models
    model_path   = os.path.join(MODELS_DIR, "fraud_model.joblib")
    scaler_path  = os.path.join(MODELS_DIR, "scaler.joblib")
    feature_path = os.path.join(MODELS_DIR, "feature_names.joblib")
    metrics_path = os.path.join(MODELS_DIR, "metrics.json")

    joblib.dump(model,        model_path)
    joblib.dump(scaler,       scaler_path)
    joblib.dump(feature_cols, feature_path)
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\n💾  Saved:")
    print(f"    {model_path}")
    print(f"    {scaler_path}")
    print(f"    {feature_path}")
    print(f"    {metrics_path}")

    # 13. Generate report plots
    _plot_confusion_matrix(y_test, y_pred)
    _plot_roc_curve(y_test, y_proba, auc)
    _plot_feature_importance(model, feature_cols)
    print(f"\n📈  Reports saved to: {REPORTS_DIR}")

    print("\n🎉  Training complete! The backend will auto-load the model on next start.")
    return model, scaler, metrics


# ─────────────────────────────────────────────────────────────────────────────
# Plot helpers
# ─────────────────────────────────────────────────────────────────────────────

def _plot_confusion_matrix(y_test, y_pred):
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=["Legitimate", "Fraud"],
                yticklabels=["Legitimate", "Fraud"], ax=ax)
    ax.set_title("Confusion Matrix — FraudGuard Hybrid Model\n(Kaggle Credit Card Dataset)", pad=12)
    ax.set_ylabel("Actual")
    ax.set_xlabel("Predicted")
    plt.tight_layout()
    path = os.path.join(REPORTS_DIR, "confusion_matrix.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"    Saved: {path}")


def _plot_roc_curve(y_test, y_proba, auc_score):
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.plot(fpr, tpr, color="#4f46e5", lw=2.5,
            label=f"Hybrid RF+XGBoost  (AUC = {auc_score:.4f})")
    ax.plot([0, 1], [0, 1], color="#94a3b8", lw=1.5,
            linestyle="--", label="Random Classifier (AUC = 0.50)")
    ax.fill_between(fpr, tpr, alpha=0.08, color="#4f46e5")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve — FraudGuard AI\n(Kaggle Credit Card Fraud Dataset)")
    ax.legend(loc="lower right")
    ax.grid(alpha=0.3)
    plt.tight_layout()
    path = os.path.join(REPORTS_DIR, "roc_curve.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"    Saved: {path}")


def _plot_feature_importance(model, feature_names):
    try:
        rf_estimator = model.estimators_[0]   # first estimator is Random Forest
        importances  = rf_estimator.feature_importances_
        fi = pd.Series(importances, index=feature_names).sort_values(ascending=False).head(25)
        fig, ax = plt.subplots(figsize=(10, 8))
        fi.plot(kind="barh", color="#4f46e5", ax=ax)
        ax.invert_yaxis()
        ax.set_title("Top 25 Feature Importances (Random Forest component)\nKaggle V-features highlighted")
        ax.set_xlabel("Importance Score")
        # Highlight original Kaggle V-features in a different colour
        for i, (name, _) in enumerate(fi.items()):
            if name.startswith("V") and len(name) <= 4:
                ax.patches[i].set_facecolor("#0d9488")
        from matplotlib.patches import Patch
        legend = [
            Patch(facecolor="#4f46e5", label="Engineered features"),
            Patch(facecolor="#0d9488", label="Original Kaggle V-features"),
        ]
        ax.legend(handles=legend, loc="lower right")
        plt.tight_layout()
        path = os.path.join(REPORTS_DIR, "feature_importance.png")
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"    Saved: {path}")
    except Exception as e:
        print(f"    Feature importance plot skipped: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train FraudGuard AI model on the Kaggle credit card fraud dataset."
    )
    parser.add_argument(
        "--data",
        required=True,
        help=(
            "Path to creditcard.csv  "
            "(download from: https://www.kaggle.com/datasets/shankarprasad/credit-card-data)"
        ),
    )
    args = parser.parse_args()
    train(args.data)
