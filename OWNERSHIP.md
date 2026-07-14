# Ownership

Quick reference for who to coordinate with before touching a given area. See `.github/CODEOWNERS`
for the exact enforced file list (GitHub requires their review on those paths automatically) and
`CONTRIBUTING.md` for the full reasoning behind the Billing/Forms boundary.

## Chaitya (@Chaityad97)
- Billing (subscriptions, pricing, coupons, referrals, plan/addon config)
- Forms (architecture, builder, submission pipeline, duplicate review, versioning/publishing)
- Overall architecture and database schema
- Reviews all PRs touching the areas above

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
