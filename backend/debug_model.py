"""
debug_model.py — Run this from the backend/ folder to diagnose model loading.

Usage:
    cd backend
    python debug_model.py

This will show you EXACTLY:
  - Where Python is looking for the model files
  - Whether they exist at those paths
  - Whether they can be loaded
  - What features the model expects
  - A live test prediction with a normal vs fraud transaction
"""
import os, sys

print("\n" + "="*65)
print("  FraudGuard AI — Model Diagnostics")
print("="*65)

# ── 1. Path check ──────────────────────────────────────────────────────────
this_dir   = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(this_dir, "ml_pipeline", "models")

model_path  = os.path.join(models_dir, "fraud_model.joblib")
scaler_path = os.path.join(models_dir, "scaler.joblib")
fnames_path = os.path.join(models_dir, "feature_names.joblib")
metrics_path= os.path.join(models_dir, "metrics.json")

print(f"\n📁 Paths")
print(f"   Backend folder : {this_dir}")
print(f"   Models dir     : {models_dir}")
print(f"   Model file     : {model_path}")
print(f"   Scaler file    : {scaler_path}")
print(f"   Feature names  : {fnames_path}")

print(f"\n📋 File existence")
for label, path in [
    ("fraud_model.joblib",  model_path),
    ("scaler.joblib",       scaler_path),
    ("feature_names.joblib",fnames_path),
    ("metrics.json",        metrics_path),
]:
    exists = os.path.exists(path)
    size   = f"({os.path.getsize(path):,} bytes)" if exists else ""
    status = "✅  FOUND" if exists else "❌  MISSING"
    print(f"   {status}  {label} {size}")

# ── 2. Load check ──────────────────────────────────────────────────────────
if not os.path.exists(model_path):
    print(f"\n❌  CANNOT CONTINUE — fraud_model.joblib is missing!")
    print(f"\n   FIX: Run the training script:")
    print(f"   cd backend")
    print(f"   python ml_pipeline/train_model.py --data ml_pipeline/creditcard.csv")
    sys.exit(1)

print(f"\n📦 Loading models...")
import joblib
import numpy as np

try:
    model  = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    print(f"   ✅  Model loaded:  {type(model).__name__}")
    print(f"   ✅  Scaler loaded: {type(scaler).__name__}")
except Exception as e:
    print(f"   ❌  Load error: {e}")
    print(f"   FIX: Delete the .joblib files and re-train.")
    sys.exit(1)

if os.path.exists(fnames_path):
    feature_names = joblib.load(fnames_path)
    print(f"   ✅  Features loaded: {len(feature_names)} features")
    print(f"   First 5: {feature_names[:5]}")
    print(f"   Last 5:  {feature_names[-5:]}")

if os.path.exists(metrics_path):
    import json
    with open(metrics_path) as f:
        m = json.load(f)
    print(f"\n📊 Training metrics")
    print(f"   Accuracy  : {m.get('accuracy', 'N/A'):.4%}")
    print(f"   Precision : {m.get('precision', 'N/A'):.4%}")
    print(f"   Recall    : {m.get('recall', 'N/A'):.4%}")
    print(f"   F1-Score  : {m.get('f1_score', 'N/A'):.4%}")
    print(f"   ROC-AUC   : {m.get('roc_auc', 'N/A'):.6f}")

# ── 3. Live prediction test ────────────────────────────────────────────────
print(f"\n🧪 Live prediction test")

# Build a 41-feature zero vector (all V features = 0)
n_features = len(feature_names) if os.path.exists(fnames_path) else 41

def make_vector(amount, v14=0.0, v17=0.0):
    v = [0.0] * 28
    v[13] = v14   # V14 is index 13
    v[16] = v17   # V17 is index 16
    import math
    amount_log     = math.log1p(amount)
    amount_squared = amount ** 2
    hour = 14     # 2pm — business hours
    is_night = 0; is_business = 1
    interactions = [0]*6   # all V interactions are 0 when V features are 0
    anomaly = 1 if (abs(v14) > 5 or abs(v17) > 5) else 0
    feat = v + [amount, amount_log, amount_squared, hour, is_night, is_business] + interactions + [anomaly]
    return feat

test_cases = [
    ("Normal transaction  (₹500, no V signals)",  500,   0.0,   0.0),
    ("Medium transaction  (₹5000, no V signals)",  5000,  0.0,   0.0),
    ("V14 fraud signal    (₹500, V14=-10)",        500,  -10.0,  0.0),
    ("V17 fraud signal    (₹500, V17=-8)",         500,   0.0,  -8.0),
    ("Both V fraud signals (₹500, V14=-10, V17=-8)", 500, -10.0, -8.0),
    ("High amount + fraud signals (₹75000, V14=-15)", 75000, -15.0, -10.0),
]

print(f"   {'Transaction':<50} {'Raw Prob':>10}  {'Score':>8}  {'Level'}")
print(f"   {'-'*50} {'-'*10}  {'-'*8}  {'-'*8}")
for label, amount, v14, v17 in test_cases:
    feat = make_vector(amount, v14, v17)
    if len(feat) != n_features:
        feat = feat[:n_features] if len(feat) > n_features else feat + [0.0]*(n_features-len(feat))
    vec = np.array(feat).reshape(1, -1)
    vec_sc = scaler.transform(vec)
    prob = model.predict_proba(vec_sc)[0][1]
    score = prob * 100
    level = "LOW" if prob < 0.30 else ("HIGH" if prob >= 0.60 else "MEDIUM")
    print(f"   {label:<50} {prob:>10.4f}  {score:>7.2f}%  {level}")

print(f"\n✅  Diagnostic complete!")
print(f"\n📝 If predictions look reasonable, the model is working correctly.")
print(f"   Restart your backend server and test the transaction endpoint.")
print(f"\n   Start command (from backend/ folder):")
print(f"   uvicorn main:app --reload --port 8000")
print("="*65 + "\n")
