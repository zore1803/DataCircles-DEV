# Developer Onboarding

## Prerequisites
- Node.js (see `backend/package.json` / `frontend/package.json` engines, if specified)
- A MongoDB connection string for a dev database (ask a project owner)
- Git

## First-time setup

```bash
git clone <repo-url>
cd <repo-folder>

# Backend
cd backend
npm install
cp .env.example .env
# Fill in .env with real values — ask a project owner for credentials, never invent them.

# Frontend
cd ../frontend
npm install
cp .env.example .env
# Fill in .env with real values.
```

Run the backend: `cd backend && npm run dev`
Run the frontend: `cd frontend && npm run dev`

## Git setup

```bash
git checkout develop
```

You should never be on `main` or `develop` while actively working — always branch off:

```bash
git checkout develop
git pull
git checkout -b feature/your-thing
```

See `CONTRIBUTING.md` at the repo root for the full branching, PR, and ownership workflow — read
it before your first PR.

## Repository structure

```
.
├── .github/                 PR template, issue templates, CODEOWNERS
├── docs/                    Project-wide documentation (this file, etc.)
├── backend/                 Express + Mongoose API
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── services/            Business logic — see backend's own docs/ for subsystem detail
│   ├── middlewares/
│   ├── scripts/              Real migration/seed scripts (committed)
│   │   └── scratch/           Throwaway verification scripts (gitignored — see its README)
│   └── .env.example
├── frontend/                 React + Vite + Tailwind
│   ├── src/
│   └── .env.example
├── FORMS_ARCHITECTURE.md     Forms subsystem — architecturally owned, see CODEOWNERS
├── FORMS_SCHEMA.md
├── FORMS_DOMAIN_MODEL.md
├── FORMS_IMPLEMENTATION.md
├── FORMS_SCHEMA_IMPLEMENTATION_NOTES.md
└── CONTRIBUTING.md
```

## Ownership boundaries

Billing and Forms are owned subsystems (see the root `.github/CODEOWNERS` for the exact file list,
and `CONTRIBUTING.md` for the reasoning). If your task touches either:
1. Confirm scope with the owner before starting.
2. Open your PR as normal.
3. The owner reviews and merges — GitHub will require their review automatically for any file listed
   in CODEOWNERS.

Everything else is open to work on freely.

## If something in this doc is wrong or outdated

Fix it in the same PR that made it wrong, or open a quick PR against `docs/ONBOARDING.md` directly —
this file should always reflect how the project actually works today.
