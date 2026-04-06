# 🛡️ FraudGuard AI — Full-Stack Financial Fraud Detection System

> Research-level ML fraud detection with real-time OTP security, behavioral profiling, and a fintech-grade UI.

---

## 📁 Project Structure

```
fraud-detection/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route handlers
│   │   │   ├── auth.py         — JWT login & register
│   │   │   ├── transactions.py — Core fraud detection flow
│   │   │   ├── accounts.py     — Bank account management
│   │   │   ├── users.py        — Profile & alerts
│   │   │   ├── fraud.py        — Model info endpoint
│   │   │   └── admin.py        — Admin analytics panel
│   │   ├── core/
│   │   │   ├── config.py       — Environment settings
│   │   │   ├── database.py     — SQLAlchemy engine
│   │   │   └── security.py     — JWT + password hashing
│   │   ├── models/
│   │   │   └── user.py         — All DB models (User, Account, Transaction...)
│   │   └── services/
│   │       ├── fraud_service.py       — Hybrid ML prediction engine
│   │       ├── otp_service.py         — OTP generation + Email/SMS
│   │       └── behavioral_service.py  — Adaptive user profiling
│   ├── ml_pipeline/
│   │   ├── train_model.py      — Full training script (RF + XGBoost + SMOTE)
│   │   └── models/             — Saved .joblib model files go here
│   ├── main.py                 — FastAPI app entry point
│   ├── seed_db.py              — Database seeder with demo data
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx   — Charts, stats, recent activity
│   │   │   ├── TransactionPage.tsx — Submit tx + live risk score + OTP
│   │   │   ├── AccountsPage.tsx    — Link/manage bank accounts
│   │   │   ├── HistoryPage.tsx     — Filterable transaction history
│   │   │   ├── ProfilePage.tsx     — User profile + risk meter
│   │   │   └── AdminPage.tsx       — Admin analytics
│   │   ├── components/
│   │   │   ├── layout/Layout.tsx   — Sidebar navigation
│   │   │   └── dashboard/RiskMeter.tsx — SVG semi-circle risk gauge
│   │   ├── hooks/useAuthStore.ts   — Zustand auth state (persisted)
│   │   ├── utils/api.ts            — Axios client with interceptors
│   │   ├── styles/globals.css      — Tailwind + custom component classes
│   │   └── App.tsx                 — React Router setup
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## 🚀 Quick Start (Recommended: Docker Compose)

```bash
git clone <your-repo>
cd fraud-detection

# Start all services (PostgreSQL, Redis, FastAPI, React)
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000
- API Docs (Swagger) → http://localhost:8000/docs

---

## 🛠️ Manual Setup (No Docker)

### Prerequisites
- Python 3.10+
- Node.js 20+
- PostgreSQL 14+
- Redis (optional, for Celery)

---

### Step 1 — PostgreSQL database

```bash
psql -U postgres
CREATE DATABASE fraudguard;
\q
```

---

### Step 2 — Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, SECRET_KEY, and optionally SMTP/Twilio

# Create database tables
python -c "from app.core.database import engine, Base; from app.models.user import *; Base.metadata.create_all(bind=engine)"

# Seed with demo data
python seed_db.py

# Start backend server
uvicorn main:app --reload --port 8000
```

---

### Step 3 — Frontend setup

```bash
cd frontend

# Install Node packages
npm install

# Start dev server
npm run dev
```

Visit http://localhost:3000

---

### Step 4 — Train the ML Model

```bash
# 1. Download the dataset from Kaggle:
#    https://www.kaggle.com/datasets/shankarprasad/credit-card-data
#    Save as: backend/ml_pipeline/creditcard.csv

cd backend

# 2. Run the training pipeline
python ml_pipeline/train_model.py --data ml_pipeline/creditcard.csv

# This will:
#   - Clean & engineer features
#   - Apply SMOTE for class balancing
#   - Train RF + XGBoost hybrid ensemble
#   - Run 5-fold cross-validation
#   - Output performance metrics
#   - Save: ml_pipeline/models/fraud_model.joblib
#          ml_pipeline/models/scaler.joblib
#   - Generate: reports/confusion_matrix.png
#               reports/roc_curve.png
#               reports/feature_importance.png

# 3. Restart backend — it auto-loads the saved model
uvicorn main:app --reload --port 8000
```

> **Without training:** The system falls back to a rule-based scoring engine so you can test all features immediately.

---

## 🔐 Demo Credentials

After running `seed_db.py`:

| Role  | Email                   | Password   |
|-------|-------------------------|------------|
| Admin | admin@fraudguard.ai     | Admin@123  |
| User  | demo@fraudguard.ai      | Demo@123   |

---

## 🧠 ML Architecture

### Hybrid Ensemble Model

```
Input Features (17 engineered features)
    ↓
┌─────────────────────────────────┐
│  Feature Engineering Pipeline   │
│  • Log-transform (Amount)        │
│  • Time features (hour, weekend) │
│  • Interaction terms (V1×V14)    │
│  • Isolation Forest score        │
│  • User behavioral features      │
└─────────────┬───────────────────┘
              ↓
    SMOTE (oversample fraud class)
              ↓
    StandardScaler normalization
              ↓
┌─────────────────────────────────┐
│   Soft Voting Ensemble (1:2)    │
│  ┌──────────────────────────┐   │
│  │  Random Forest (weight 1) │  │
│  │  300 trees, balanced CW  │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  XGBoost    (weight 2)   │   │
│  │  scale_pos_weight=577    │   │
│  └──────────────────────────┘   │
└─────────────┬───────────────────┘
              ↓
     Fraud Probability (0–1)
              ↓
    Risk Score (0–100%)
```

### Target Performance
| Metric    | Target   |
|-----------|----------|
| Accuracy  | 97–98%   |
| Precision | > 95%    |
| Recall    | > 92%    |
| F1-Score  | > 93%    |
| ROC-AUC   | > 0.97   |

---

## 💳 Transaction Security Flow

```
User submits transaction
        ↓
   ML Risk Assessment
        ↓
  ┌─────┴──────┐
  │ Risk Score │
  └─────┬──────┘
        │
  < 30% │ LOW RISK
        │──────────→ ✅ AUTO-APPROVED
        │
  30–70%│ MEDIUM RISK
        │──────────→ ⚠️  OTP sent to Email + SMS
        │              User enters OTP within 5 mins
        │              ✅ Correct OTP → APPROVED
        │              ❌ Wrong/Expired → BLOCKED
        │
  > 70% │ HIGH RISK
        │──────────→ 🚫 OTP required (same flow)
```

---

## 🌟 Key Features

### Security
- JWT authentication with 24-hour expiry
- Bcrypt password hashing
- OTP-based transaction authorization (email + SMS)
- 5-minute OTP expiry with hash storage (never plain-text)
- Transaction reference IDs (audit trail)

### Adaptive Fraud Intelligence
- Exponential moving average of user spending
- Location history tracking (last 10 locations)
- Dynamic risk thresholds per user
- Behavioral risk profile score (0–1)
- Automatic threshold adjustment for reliable users

### Explainable AI
- Top risk factors returned per transaction
- Factor labels: "Unusual amount", "Odd-hours transaction", etc.
- SHAP integration ready (runs when model is trained)
- Feature importance visualization

### Frontend
- Dark fintech UI (slate/indigo palette)
- Animated SVG semi-circle risk gauge
- Live OTP countdown timer
- Real-time Recharts dashboards (area, bar, pie)
- Framer Motion page transitions
- Zustand persisted auth state
- Mobile-responsive layout

---

## 🌐 API Reference

| Method | Endpoint                          | Description                  |
|--------|-----------------------------------|------------------------------|
| POST   | /api/auth/register                | Create new user              |
| POST   | /api/auth/login                   | Get JWT token                |
| GET    | /api/users/me                     | Get profile                  |
| PUT    | /api/users/me                     | Update profile               |
| GET    | /api/users/alerts                 | Get fraud alerts             |
| POST   | /api/accounts/link                | Link bank account            |
| GET    | /api/accounts/my-accounts         | List user accounts           |
| POST   | /api/accounts/topup               | Top up balance               |
| DELETE | /api/accounts/{id}                | Remove account               |
| POST   | /api/transactions/initiate        | Submit transaction (ML scan) |
| POST   | /api/transactions/verify-otp      | Verify OTP for transaction   |
| GET    | /api/transactions/history         | Transaction history          |
| GET    | /api/transactions/stats           | User statistics              |
| GET    | /api/admin/dashboard              | Admin analytics (admin only) |
| GET    | /api/admin/users                  | List all users (admin only)  |

Full interactive docs at: **http://localhost:8000/docs**

---

## 🚀 Deployment

### Backend (Render / Railway)

```bash
# Set environment variables in your hosting platform:
DATABASE_URL=postgresql://...
SECRET_KEY=your-production-secret
SMTP_USER=your-email
SMTP_PASSWORD=your-app-password
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Start command:
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel / Netlify)

```bash
# Build
npm run build

# Set env vars:
VITE_API_URL=https://your-backend.onrender.com/api
```

### Database (Supabase / Neon / Railway)
Use the free PostgreSQL tier from any of these providers. Copy the connection string to `DATABASE_URL`.

---

## 🔬 Research Alignment

This project implements the **Hybrid Machine Learning Approach for Intelligent Financial Fraud Risk Assessment** paper:

| Paper Concept             | Implementation                              |
|---------------------------|---------------------------------------------|
| Hybrid ensemble model     | RF + XGBoost soft voting (1:2 weight)       |
| Class imbalance handling  | SMOTE + scale_pos_weight + balanced CW      |
| Feature engineering       | Log-transform, time features, interactions  |
| Behavioral profiling      | EMA of spending + location history          |
| Explainability            | SHAP values + rule-based factor labels      |
| Real-time assessment      | FastAPI async prediction endpoint           |
| Adaptive thresholds       | Per-user dynamic risk scoring               |

---

## 📊 Dataset

**Kaggle Credit Card Fraud Dataset**
- URL: https://www.kaggle.com/datasets/shankarprasad/credit-card-data
- 284,807 transactions, 492 fraudulent (0.172%)
- 28 PCA-anonymized features (V1–V28) + Amount + Time
- Binary classification: Class 0 (legit) / Class 1 (fraud)

---

## 📄 License

MIT License — free to use for academic and commercial projects.
