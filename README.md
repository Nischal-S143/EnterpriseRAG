# Pagani Zonda R – Enterprise Intelligence Showcase

A cinematic scrollytelling luxury car experience powered by an Enterprise Retrieval-Augmented Generation (RAG) backend using Google Gemini API.

## 🏎️ Overview

Italian luxury meets enterprise intelligence. This project combines a scroll-controlled image sequence (240 frames) with an AI-powered assistant that answers questions about the Pagani Zonda R using a RAG architecture.

## 🏗️ Architecture

```
Frontend (Next.js 16 + Tailwind v4)       Backend (FastAPI + Gemini)
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  Scroll Canvas (240 frames)  │          │  /api/register  (POST)      │
│  HUD Overlay (3 phases)      │   REST   │  /api/login     (POST)      │
│  ChatAssistant (streaming)   │ ◄──────► │  /api/refresh   (POST)      │
│  Auth Pages (login/register) │          │  /api/chat      (POST)      │
│  Glassmorphism Navbar        │          │  /api/chat/stream (POST)    │
└──────────────────────────────┘          │  /api/me        (GET)       │
                                          └──────────┬───────────────────┘
                                                     │
                                          ┌──────────▼───────────────────┐
                                          │  FAISS Vector Store          │
                                          │  (12 docs, 3072-dim)        │
                                          │  Gemini Embeddings           │
                                          │  L2 Normalized (cosine sim)  │
                                          │  Persisted to disk           │
                                          └──────────┬───────────────────┘
                                                     │
                                          ┌──────────▼───────────────────┐
                                          │  Gemini 2.0 Flash (LLM)     │
                                          │  RAG Pipeline                │
                                          │  Streaming + Structured resp │
                                          └──────────────────────────────┘
```

## ✨ Features

### Frontend
- **Scroll-controlled image sequence** – 240 frames rendered on HTML5 Canvas with `object-fit: contain` and Retina/4K scaling
- **HUD overlay** with 3 scroll phases (Hero → Design → Engine) using Framer Motion
- **ChatAssistant** – floating AI panel with streaming responses, source attribution, confidence indicators
- **Auth pages** – premium login/register with role-based access selection
- **Glassmorphism navbar** – scroll-reactive with INQUIRE button

### Backend
- **FAISS vector store** – 12 Pagani knowledge documents with `faiss.normalize_L2()` for cosine similarity
- **Gemini embeddings** (`gemini-embedding-001`) – 3072-dimensional vectors
- **RAG pipeline** – Gemini 2.0 Flash with explicit safety settings, structured responses
- **JWT authentication** – access + refresh tokens, bcrypt password hashing
- **RBAC** – 3 roles (admin/engineer/viewer) with document-level access control
- **Rate limiting** – slowapi (5/min login, 20/min chat)
- **Streaming** – Server-Sent Events for token-by-token responses
- **Persistence** – FAISS index saved to disk, skips re-embedding on restart

### Security
- API keys stored in `.env` (never exposed to frontend)
- JWT tokens with expiration (`exp` claim)
- Refresh token rotation
- Rate limiting on auth endpoints
- CORS restricted to localhost
- Global error handling

## 📁 Project Structure

```
pagani/
├── app/
│   ├── layout.tsx              # Root layout with Orbitron + Rajdhani fonts
│   ├── page.tsx                # Main page with scroll sequence + ChatAssistant
│   ├── globals.css             # Tailwind v4 @theme + custom scrollbar
│   ├── login/page.tsx          # Premium login page
│   └── register/page.tsx       # Registration with role selection
├── components/
│   ├── Navbar.tsx              # Glassmorphism navbar with auth state
│   ├── ZondaScrollCanvas.tsx   # 240-frame canvas renderer
│   ├── ZondaExperience.tsx     # HUD overlay with scroll phases
│   └── ChatAssistant.tsx       # AI assistant with streaming
├── lib/
│   ├── api.ts                  # Centralized fetch with 401 auto-refresh
│   └── auth.ts                 # Login/register/logout utilities
├── data/
│   └── carData.ts              # Car specification data
├── backend/
│   ├── main.py                 # FastAPI app (6 endpoints, rate limiting, CORS)
│   ├── auth.py                 # JWT auth + refresh tokens + RBAC + Pydantic models
│   ├── vector_store.py         # FAISS + Gemini embeddings + persistence
│   ├── rag_pipeline.py         # Gemini 2.0 Flash generation + streaming
│   └── requirements.txt        # Python dependencies
├── public/images/zonda-sequence/  # 240 car images (1.jpg - 240.jpg)
├── .env.local                  # NEXT_PUBLIC_API_URL
└── next.config.ts              # API proxy to FastAPI backend
```

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- Python 3.10+
- Google Gemini API key

### 1. Clone & Install Frontend
```bash
git clone https://github.com/Nischal-S143/EnterpriseRAG.git
cd EnterpriseRAG
npm install
```

### 2. Install Backend
```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment

**Backend** – Create `backend/.env`:
```
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET_KEY=your_jwt_secret
JWT_REFRESH_SECRET_KEY=your_refresh_secret
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

**Frontend** – Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Run Backend
```bash
cd backend
python main.py
# → http://localhost:8000
```

### 5. Run Frontend
```bash
npm run dev
# → http://localhost:3000
```

### 6. Usage
1. Open `http://localhost:3000`
2. Register at `/register` (choose Viewer/Engineer/Admin role)
3. Login at `/login`
4. Click **INQUIRE** → ask about the Zonda R
5. Try different roles to see RBAC in action

## 🔐 RBAC Document Access

| Role | Documents |
|---|---|
| **Viewer** | Heritage, engine specs, performance, interior, production, exhaust |
| **Engineer** | All Viewer docs + aerodynamics, brakes, suspension, tires |
| **Admin** | All docs + financial & ownership data |

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, Framer Motion |
| Canvas | HTML5 Canvas with devicePixelRatio scaling |
| Backend | FastAPI, Uvicorn, Python 3.10+ |
| Vector DB | FAISS (IndexFlatIP with L2 normalization) |
| Embeddings | Gemini `gemini-embedding-001` (3072-dim) |
| LLM | Gemini `2.0 Flash` |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Rate Limit | slowapi |

## 📄 API Endpoints

| Endpoint | Method | Auth | Rate Limit | Description |
|---|---|---|---|---|
| `/api/register` | POST | ✗ | 10/min | Register user |
| `/api/login` | POST | ✗ | 5/min | Get JWT tokens |
| `/api/refresh` | POST | Refresh | 10/min | Refresh access token |
| `/api/me` | GET | JWT | — | Current user info |
| `/api/chat` | POST | JWT | 20/min | RAG query |
| `/api/chat/stream` | POST | JWT | 20/min | Streaming RAG |
| `/api/health` | GET | ✗ | — | Health check |

## 📝 License

This is a tribute/educational project. Not affiliated with Pagani Automobili.
