# 🛡️ RetailGuard AI — Intelligent Retail Security Platform

AI-powered security camera system for retail loss prevention with facial recognition, theft detection, and real-time alert management.

## 🚀 Quick Start (Railway Deployment)

### Prerequisites
- Railway account (railway.app)
- Git repository with this code

### Deploy to Railway

1. **Push code to GitHub**
2. **Create Railway project** with 3 services:

#### Service 1: PostgreSQL Database
- Add PostgreSQL from Railway's database templates
- Note the `DATABASE_URL` connection string

#### Service 2: Backend API
- Source: `./backend` directory
- Set environment variables:
  ```
  DATABASE_URL=<from PostgreSQL service>
  SECRET_KEY=<generate with: openssl rand -hex 32>
  ```

#### Service 3: Frontend Dashboard
- Source: `./frontend` directory
- Build args:
  ```
  VITE_API_URL=<backend service URL>
  BACKEND_URL=<backend internal URL>
  ```

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # Edit with your settings
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## 🏗️ Architecture

```
├── backend/                  # Python FastAPI
│   ├── app/
│   │   ├── ai/              # AI Detection Pipeline
│   │   │   ├── face_engine.py         # Facial recognition (dlib + DeepFace)
│   │   │   ├── concealment_detector.py # Theft detection (MediaPipe Pose)
│   │   │   ├── identity_matcher.py    # Multi-feature identity fusion
│   │   │   └── detection_pipeline.py  # Main orchestration loop
│   │   ├── api/              # REST API Routes
│   │   │   ├── auth.py       # JWT authentication
│   │   │   ├── incidents.py  # Incident review workflow
│   │   │   ├── alerts.py     # Real-time alerts + WebSocket
│   │   │   ├── persons.py    # Person/offender management
│   │   │   └── cameras.py    # Camera configuration
│   │   ├── models/           # SQLAlchemy database models
│   │   ├── config.py         # Application settings
│   │   └── main.py           # FastAPI entry point
│   └── Dockerfile
│
├── frontend/                 # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx    # Main layout with sidebar + WebSocket alerts
│   │   │   └── AlertPanel.tsx # Critical slide-in alert panel
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # Security overview
│   │   │   ├── ReviewQueuePage.tsx  # Incident review (Theft/Not Theft)
│   │   │   ├── AlertsPage.tsx       # Active alert management
│   │   │   ├── OffendersPage.tsx    # Known offender database
│   │   │   ├── BlacklistPage.tsx    # Blacklisted persons
│   │   │   ├── CamerasPage.tsx      # Camera management
│   │   │   └── PersonDetailPage.tsx # Individual person profile
│   │   └── services/api.ts   # API client + WebSocket
│   └── Dockerfile
│
└── railway.json              # Railway deployment config
```

## 🔑 Default Login
- Username: `admin`
- Password: `admin123`

## 🧠 AI Features

### Facial Recognition
- dlib CNN face detection + 128-dim encoding
- Multi-embedding storage (5 best per person from different angles)
- Quality-weighted matching with 0.45 tolerance (strict)
- DeepFace ArcFace verification for high-stakes matches

### Concealment Detection
- MediaPipe Pose body keypoint tracking
- Hand trajectory analysis (shelf → pocket/bag movement)
- Hand state detection (holding item → empty)
- 5-signal confidence scoring:
  - Shelf reach (15%)
  - Downward-to-pocket motion (25%)
  - Hand state transition (30%)
  - Concealment zone entry (20%)
  - Quick motion pattern (10%)

### Composite Identity Matching
- Face: 45% weight
- Body build: 20% weight
- Gait pattern: 15% weight
- Height: 10% weight
- Distinguishing marks: 10% weight
- Minimum 72% composite score for positive identification

## 📋 Core Workflows

1. **Detection** → AI spots concealment behavior → 10-30 sec clip captured
2. **Review** → Clerk reviews clip → Marks as Theft / Not Theft / Unsure
3. **Tracking** → If Theft: person flagged in database
4. **Alert** → Next visit: real-time alert with previous theft video
5. **Action** → Clerk chooses: 🚔 Call Police | 🤚 Let Go | ⛔ Blacklist
