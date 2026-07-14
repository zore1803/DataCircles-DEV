// Shared polling helper for "waiting on backend settlement after checkout".
//
// Per backend/docs/ARCHITECTURE.md §8 rule #1: the frontend never confirms
// its own settlement — a Razorpay checkout success callback is evidence a
// charge was attempted, not proof the backend has settled it (activated the
// add-on, updated the plan, sent the invite email, etc). The only correct
// way to know settlement happened is to re-fetch canonical state and check
// it, repeatedly, until it reflects the change or a timeout is reached.
//
// `fetchLatest` MUST return the freshly-fetched value directly (not read it
// off React state) — reading component/context state from inside a
// setInterval closure captures whatever that state was when the closure was
// created, and never sees later updates from inside the same loop. That was
// the root cause of a real bug: two independent polling implementations
// each read a stale `subscription` variable and could never observe their
// own fetchSubscription() calls succeeding, so every payment ran the full
// timeout before falling back to "taking longer than expected".
export async function waitForSettlement({
  fetchLatest,
  isSettled,
  intervalMs = 3000,
  timeoutMs = 30000,
}) {
  const deadline = Date.now() + timeoutMs;

  // Check once immediately — the backend's webhook may have already
  // settled by the time the checkout handler runs.
  let latest = await fetchLatest();
  if (isSettled(latest)) return { settled: true, data: latest };

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    latest = await fetchLatest();
    if (isSettled(latest)) return { settled: true, data: latest };
  }

  return { settled: false, data: latest };
}
