# Contributing

This is a small, two-developer team. This document is the authoritative source for how we work
together in this repo — supersedes any older workflow notes.

## Branch strategy

```
main      — production. Protected. No direct pushes, ever.
develop   — integration branch. Protected. No direct pushes, ever. Everything merges here first.
feature/<short-name>   — new work, branched from develop
fix/<short-name>       — bug fixes, branched from develop
```

Every task gets its own branch. Branch names are short and descriptive: `feature/deal-kanban-filters`,
`fix/contact-export-crash`.

**No one commits directly to `main` or `develop`.** Every change lands via a pull request.

## Workflow

1. `git checkout develop && git pull`
2. `git checkout -b feature/your-thing`
3. Do the work in small, focused commits.
4. Push and open a PR **into `develop`**, filling out the PR template completely.
5. Get the required review (see CODEOWNERS below) and address feedback.
6. **Squash merge** into `develop`.
7. Periodically (release time), `develop` is merged into `main` via a **merge commit** (not squashed) —
   this preserves the release boundary in `main`'s history.

**Never rebase `develop` or `main`.** Rebase is fine on your own feature branch before opening/updating
a PR, but never rewrite history that's already shared.

## Ownership boundaries — Billing and Forms

Billing and Forms are architecturally sensitive subsystems with invariants that aren't obvious from
reading the code alone (duplicate-detection scoring, subscription state machines, plan-modifier
resolution order, etc.). See `.github/CODEOWNERS` for the exact file list — any PR touching those
paths requires the listed owner's review before merging.

**For now, treat Billing and Forms as owned, not shared:**
- The owner is the only one who makes architectural decisions in these areas.
- The other developer can absolutely work in these areas — but as an **assigned task**, not an
  independent change. Open a PR as usual; the owner reviews and merges it.
- If a task outside Billing/Forms turns out to *touch* Billing or Forms indirectly (e.g. a CRM
  screen change that also needs a billing-gated permission check), **stop and ask** rather than
  guessing at the existing architecture.
- This isn't about hierarchy — it's because the owner has already built the mental model for these
  systems, and two people independently refactoring them before that knowledge is shared is the
  fastest way to introduce a subtle regression. Once both developers understand a subsystem equally
  well, these boundaries can relax.

**Everything else** — CRM screens, Dashboard, Contacts/Companies/Deals/Tasks/Products/Vendors UI,
Reports, styling, reusable components, general bug fixes — is open for either developer to work on
freely, no special review gate.

## Rules

- **Never modify Billing or Forms without discussing first.**
- **If a task touches Billing or Forms indirectly, stop and notify instead of assuming.**
- Keep PRs under ~500 lines whenever practical. If a change is naturally bigger, say why in the PR.
- One feature/fix per PR — don't bundle unrelated changes.
- **Architecture changes must update documentation in the same PR** (`FORMS_*.md` for Forms, or the
  relevant doc for Billing) — not a follow-up "I'll document it later."
- No temporary/scratch scripts committed. Use `backend/scripts/scratch/` (gitignored) for anything
  throwaway; real migrations/seed scripts go in `backend/scripts/` and ship in the PR that needs them.
- Never commit `.env` files. If you add a new environment variable, update the relevant
  `.env.example` in the same PR.
- **If two developers need to touch the same files, coordinate before starting — not after hitting a
  merge conflict.** A quick "I'm about to touch X" message is cheaper than resolving a conflict later.
- Prefer extending existing architecture over introducing a parallel implementation of the same
  concept. If the existing approach seems wrong, raise it — don't quietly route around it.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`,
`docs:`, `chore:`, `test:`, `perf:`. Scope when useful: `feat(deals): add kanban drag reorder`.

## Code review checklist (for reviewers)

- Does it do what the PR description says, not just "does it run"?
- No secrets/credentials anywhere in the diff.
- No stray `console.log`/debug code left in.
- Backend: is `organization` scoping server-derived, never trusted from the client?
- No throwaway scripts left outside `backend/scripts/scratch/`.
- If this touches Billing or Forms architecture, is the relevant doc updated in this same PR?
- Is the PR small enough to actually review carefully? If not, ask for it to be split.

## Getting started

See `docs/ONBOARDING.md` for environment setup.
