# ToS Monitor

**Know when your vendors change the rules.**

ToS Monitor watches Terms of Service, Privacy Policies, and API agreements from 20+ SaaS companies and sends you plain-language alerts when something important changes.

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│   FastAPI    │────▶│  PostgreSQL  │
│   Frontend   │     │   Backend    │     │   Database   │
│  (port 3000) │     │  (port 8000) │     │  (port 5432) │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │   Scraper     │
                    │  (APScheduler)│
                    │  every 6 hrs  │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │ Sales Bridge  │──▶  sales-agent/
                    │  (JSON file)  │     (distribution)
                    └───────────────┘
```

### Stack
- **Backend**: FastAPI, SQLAlchemy (async), PostgreSQL, APScheduler
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Query
- **Scraper**: httpx + BeautifulSoup for fetching, difflib for diffs
- **AI**: OpenAI / Anthropic for plain-language summaries + severity scoring
- **Alerts**: Resend (email) + webhooks
- **Infrastructure**: Docker Compose

---

## Quick Start

### 1. Clone & configure

```bash
cd tos-monitor/backend
cp .env.example .env
# Edit .env with your database URL & API keys
```

### 2. Start with Docker

```bash
docker-compose up -d
```

This starts PostgreSQL, the backend API, and the frontend.

### 3. Run migrations & seed

```bash
# Run database migrations
docker-compose exec backend alembic upgrade head

# Seed default services (Stripe, OpenAI, AWS, etc.)
docker-compose exec backend python seed.py
```

### 4. Open the app

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/docs
- **Health check**: http://localhost:8000/health

---

## Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL locally, then:
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Current user |

### Services
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/services` | List monitored services |
| GET | `/api/services/{slug}` | Service detail |
| GET | `/api/services/categories/list` | List categories |
| POST | `/api/services/subscribe` | Subscribe to a service |
| DELETE | `/api/services/unsubscribe/{id}` | Unsubscribe |
| GET | `/api/services/me/subscriptions` | Your subscriptions |

### Changes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/changes` | List changes (filterable) |
| GET | `/api/changes/feed` | Public feed (no auth) |
| GET | `/api/changes/{id}` | Change detail with diff |
| GET | `/api/changes/dashboard/stats` | Dashboard stats |
| POST | `/api/admin/scan` | Trigger manual scan |

---

## Monitored Services (20 default)

| Service | Category | What We Watch |
|---------|----------|---------------|
| Stripe | Payments | ToS + Privacy |
| OpenAI | AI / ML | ToS + Privacy |
| AWS | Cloud | Service Terms + Privacy |
| Google Cloud | Cloud | ToS + Privacy |
| Vercel | DevOps | ToS + Privacy |
| GitHub | DevOps | ToS + Privacy |
| Twilio | Communications | ToS + Privacy |
| Shopify | E-commerce | ToS + Privacy |
| Slack | Communications | ToS + Privacy |
| Firebase | Cloud | ToS + Privacy |
| Supabase | Cloud | ToS + Privacy |
| Cloudflare | DevOps | ToS + Privacy |
| Anthropic | AI / ML | ToS + Privacy |
| MongoDB Atlas | Database | ToS + Privacy |
| Notion | Productivity | ToS + Privacy |
| Heroku | Cloud | ToS + Privacy |
| Auth0 | Auth | ToS + Privacy |
| Plaid | Fintech | ToS + Privacy |
| Datadog | DevOps | ToS + Privacy |
| HubSpot | Marketing | ToS + Privacy |

---

## Sales Agent Integration

ToS Monitor automatically feeds detected changes to the sales-agent pipeline via `sales_bridge.py`. When a change is detected:

1. **Scraper** fetches the page and creates a diff
2. **Summarizer** generates a plain-language summary with severity
3. **Sales Bridge** writes the change to `sales-agent/data/product_changes.json`
4. **Sales Agent** picks up the real change data for content generation, social posting, and cold outreach

This replaces the sample data with real, detected policy changes — making the entire distribution pipeline authentic.

---

## File Structure

```
tos-monitor/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic.ini
│   ├── seed.py
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/001_initial.py
│   └── app/
│       ├── main.py              # FastAPI app + scheduler
│       ├── config.py            # Pydantic settings
│       ├── database.py          # Async SQLAlchemy
│       ├── models.py            # 6 ORM models
│       ├── schemas.py           # Pydantic request/response schemas
│       ├── deps.py              # Auth dependencies
│       ├── scraper/
│       │   ├── fetcher.py       # Async page fetcher
│       │   ├── differ.py        # Text diff engine
│       │   ├── summarizer.py    # LLM-powered summaries
│       │   └── scheduler.py     # Periodic scan loop
│       ├── routers/
│       │   ├── auth.py          # Register, login, me
│       │   ├── services.py      # Service CRUD + subscriptions
│       │   └── changes.py       # Change feed + detail + stats
│       └── services/
│           ├── alerts.py        # Email + webhook delivery
│           └── sales_bridge.py  # Bridge to sales-agent
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── lib/api.ts           # Typed API client
│       ├── app/
│       │   ├── layout.tsx       # Root layout
│       │   ├── page.tsx         # Landing page
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   └── dashboard/
│       │       ├── page.tsx     # Dashboard with stats
│       │       ├── services/page.tsx
│       │       └── changes/
│       │           ├── page.tsx
│       │           └── [id]/page.tsx
│       └── components/
│           ├── Navbar.tsx
│           ├── Providers.tsx
│           ├── SeverityBadge.tsx
│           └── ChangeCard.tsx
```

---

## Deployment

### Railway / Render
1. Push to GitHub
2. Create PostgreSQL addon
3. Deploy backend as web service (Dockerfile)
4. Deploy frontend as web service (Dockerfile)
5. Set environment variables

### Fly.io
```bash
fly launch --dockerfile backend/Dockerfile
fly postgres create
fly secrets set DATABASE_URL=... JWT_SECRET=... OPENAI_API_KEY=...
```

---

## License

MIT
