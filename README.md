# DataCircles CRM

A CRM system with Contacts, Companies, Deals, Tasks, Vendors, Billing/Subscriptions, and a
public-facing Forms pipeline (lead capture with duplicate detection and review).

- **Backend**: Node.js / Express / MongoDB — see [`backend/README.md`](backend/README.md)
- **Frontend**: React / Vite / Tailwind — see [`frontend/README.md`](frontend/README.md)

## Getting started

New to the project? Start with [`docs/ONBOARDING.md`](docs/ONBOARDING.md) for environment setup,
then [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branching/PR workflow and ownership boundaries
before opening your first PR.

## Architecture documentation

The Forms subsystem has detailed, actively-maintained architecture docs at the repo root:
`FORMS_ARCHITECTURE.md`, `FORMS_SCHEMA.md`, `FORMS_DOMAIN_MODEL.md`, `FORMS_IMPLEMENTATION.md`,
`FORMS_SCHEMA_IMPLEMENTATION_NOTES.md`. Changes to Forms (or Billing) require the subsystem owner's
review — see `.github/CODEOWNERS`.
