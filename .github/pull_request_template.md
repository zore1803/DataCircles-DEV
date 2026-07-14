## Purpose

<!-- What does this PR do, and why? Link the task/issue if one exists. -->

## Screenshots (if UI)

<!-- Before/after screenshots or a short GIF for any visible UI change. Delete this section if N/A. -->

## Backend changes

<!-- New/changed endpoints, services, models. "None" if not applicable. -->

## Database changes

<!-- New fields, indexes, migrations, or scripts run against the DB. "None" if not applicable.
     If you added a migration/seed script, confirm it lives in backend/scripts/ (not scratch/)
     and is included in this PR. -->

## Breaking changes

<!-- Anything that changes an existing contract (API shape, env vars, config). "None" if not applicable. -->

## Testing performed

<!-- What you actually ran and observed — manual steps, E2E script output, etc. Not just "tests pass". -->

## Documentation updated

<!-- If this PR changes Forms or Billing architecture, the relevant doc(s) under FORMS_*.md or
     docs/ MUST be updated in this same PR, not a follow-up. "N/A" only if genuinely no architectural
     surface changed. -->

## New environment variables

<!-- List any new env vars and confirm .env.example (backend and/or frontend) was updated.
     "None" if not applicable. -->

## Checklist

- [ ] No secrets, credentials, or `.env` files are included in this diff
- [ ] No throwaway/scratch scripts committed outside `backend/scripts/scratch/`
- [ ] This PR is one feature/fix, not a bundle of unrelated changes
- [ ] PR is reasonably small (~500 lines or less) — if not, explain why below
- [ ] If this touches Billing or Forms, I discussed it with the owner before starting
- [ ] Docs updated in this PR if architecture changed (see above)

## Notes for reviewer

<!-- Anything reviewers should pay special attention to, known trade-offs, or open questions. -->
