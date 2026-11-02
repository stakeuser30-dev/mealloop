# MealLoop — FastAPI & PostgreSQL Backend Service

This directory contains the production-ready FastAPI backend for **MealLoop**, the campus food-ordering platform. It supports full campus pickup operations, PostgreSQL / SQLite persistence, atomic single-use QR token redemption, progressive dynamic rescue discounts, group deal unlocking, Razorpay Test Mode payments, and the LoopAI campus assistant.

---

## Architecture Overview

- **Framework**: FastAPI (Python 3.11+)
- **ORM & Database**: SQLAlchemy with PostgreSQL (`psycopg2`) and zero-config local SQLite fallback
- **Containerization**: Multi-service `docker-compose.yml` with dedicated PostgreSQL 16 Alpine container and health checks
- **Security & Integrity**: 
  - Integer-paise authoritative math (no floating point errors)
  - Cryptographically random single-use pickup tokens (`ML-TKN-XXXX-YYY`)
  - Strict atomic scan verification rejecting duplicate pickups (`409 Conflict`)
  - Role-based authorization for Student, Canteen Staff, Admin, and NGO

---

## Directory Structure

```
backend/
├── Dockerfile              # Python 3.11 slim container running Uvicorn on port 8000
├── Dockerfile.db           # PostgreSQL 16 Alpine with custom initialization
├── docker-compose.yml      # Orchestrates FastAPI + PostgreSQL with persistent volume
├── requirements.txt        # Pinned Python dependencies
├── database.py             # Database engine, session maker, and Base
├── models.py               # SQLAlchemy ORM models (Users, Canteens, Orders, FoodItems, etc.)
├── schemas.py              # Pydantic validation schemas
├── main.py                 # FastAPI application with all REST API endpoints
├── seed.py                 # CLI database seeding script
└── README.md               # Backend documentation
```

---

## Quickstart

### Option A: Run with Docker Compose (Recommended for Full Stack with PostgreSQL)

1. Make sure Docker is running on your machine.
2. From the project root or `backend/` directory, run:

```bash
docker compose -f backend/docker-compose.yml up --build
```

- **FastAPI API & Docs**: Available at `http://localhost:8000/docs`
- **PostgreSQL**: Running on port `5432` (database `mealloop`, user `mealloop_user`)

---

### Option B: Run Standalone Python (Fast Local Dev with SQLite)

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Seed database and start server:
```bash
python seed.py
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI Swagger UI is available at **`http://localhost:8000/docs`**.

---

## Key API Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `GET` | `/api/auth/me` | Current authenticated persona and membership status |
| | `POST` | `/api/auth/switch-demo` | Instant persona switcher (`student`, `staff`, `admin`, `ngo`) |
| | `POST` | `/api/auth/google/login` | Google OIDC credential verification & login |
| **Canteen** | `GET` | `/api/canteen` | Central Food Court operating hours, slots, counter |
| | `GET` | `/api/food-items` | Menu items with category, price filter, stock |
| | `PATCH` | `/api/food-items/{id}/stock` | Canteen staff real-time inventory updater |
| **Group Deals**| `GET` | `/api/group-deals` | Active group deals (`6/8 → 7/8 → 8/8`) |
| | `POST` | `/api/group-deals/{id}/join`| Student joins deal; triggers unlock on threshold |
| | `POST` | `/api/group-deals/{id}/simulate-peer` | Demo trigger simulating peer hostel mate joining |
| **Rescue** | `GET` | `/api/rescue-batches` | Progressive discount surplus batches |
| | `POST` | `/api/demo-clock/advance`| Advances virtual canteen clock (`+1h`, `+2h`, `+4h`) |
| | `POST` | `/api/rescue-batches/approve`| Staff surplus batch lister |
| **NGO** | `GET` | `/api/donations` | Robin Hood Army food recovery queue |
| | `POST` | `/api/donations/{id}/accept`| NGO accept dispatch |
| | `POST` | `/api/donations/{id}/handover`| Canteen staff verified physical handover |
| **Cart & Pay**| `POST` | `/api/cart/calculate` | Integer-paise calculations, GST, coupons, membership |
| | `POST` | `/api/payments/create-razorpay-order` | Generates simulated Razorpay Test Mode order |
| | `POST` | `/api/payments/verify-and-order` | Validates payment and mints secure QR code |
| **Pickup QR** | `POST` | `/api/pickup/scan` | Atomic single-use check; returns `409` on duplicate |
| **Orders** | `GET` | `/api/orders` | Student order history or canteen active queue |
| **AI Assist** | `POST` | `/api/ai/chat` | LoopAI menu tool search, budget filter, cart proposal |
| **Metrics** | `GET` | `/api/metrics` | Platform stats (waste diverted, savings, pickups) |
| **Audit** | `GET` | `/api/audit-logs` | Immutable audit trail for all campus operations |
