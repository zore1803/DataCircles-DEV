# scratch/

This folder is for **throwaway verification scripts only** — the kind written to hit the real dev
database once, assert some behavior, print results, and clean up after themselves. Everything in
this folder except this file is gitignored: nothing here is ever committed.

## When to use this folder
- Verifying a service-layer change end-to-end against the dev DB.
- One-off debugging scripts.
- Anything you intend to delete (or that git will silently ignore) within the same session.

## When NOT to use this folder
- Real data migrations → `backend/scripts/migrations/`, committed in the PR that needs them.
- Seed scripts meant to be reused → `backend/scripts/`, committed.
- Anything another developer might need to run later.

## Convention
Write your script, run it, confirm the result, then delete it (or just leave it — it's gitignored
either way, so it never pollutes a diff). If you find yourself wanting to keep a script around,
that's a signal it isn't actually throwaway — move it out of `scratch/` and commit it properly.
