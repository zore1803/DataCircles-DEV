# Ownership

Quick reference for who to coordinate with before touching a given area. See `.github/CODEOWNERS`
for the exact enforced file list and `CONTRIBUTING.md` for the full reasoning behind the
Billing/Forms boundary.

## Billing / Forms
- Billing (subscriptions, pricing, coupons, referrals, plan/addon config)
- Forms (architecture, builder, submission pipeline, duplicate review, versioning/publishing)
- Overall architecture and database schema
- No owner currently assigned — coordinate with the team before touching these areas

## Teammate
- CRM features (Contacts, Companies, Deals, Tasks, Vendors)
- Dashboard, Reports
- Styling, general UI, reusable components

## Shared
- Bug fixes outside Billing/Forms
- Utilities
- Documentation

If a task looks like it might touch Billing or Forms even indirectly, stop and coordinate before
starting — don't guess at the existing architecture (see `CONTRIBUTING.md`).
