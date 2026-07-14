// utils/referralRewards.js
//
// The reward RESERVATION LIFECYCLE — the single place reserved/consumed/
// released transitions happen. See REFERRAL_SYSTEM_DESIGN.md §6/§9 and the
// CONCURRENCY note in models/RewardUsage.js.
//
// Design constraints held here:
//   - Reward is IMMUTABLE (never written here except by the caller's revoke).
//     Availability is DERIVED by scanning RewardUsage, never a cached flag.
//   - RewardUsage rows transition reserved -> consumed | released. Those
//     transitions are done with ATOMIC conditional updates (findOneAndUpdate
//     guarded on the current status), so duplicate webhook deliveries and
//     concurrent checkouts are idempotent / race-free.
//   - The partial unique index on RewardUsage {reward, status:'reserved'} is
//     the actual atomic guard for reservation; this module catches its
//     duplicate-key error and retries.
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const { emitBillingEvent } = require('./billingEvents');

const DEFAULT_RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes — covers a normal checkout

async function emitRewardEvent(eventType, reward, usage) {
  await emitBillingEvent({
    organization: reward.organization,
    subscription: usage?.subscription,
    eventType,
    status: 'completed',
    metadata: { rewardId: reward._id, usageId: usage?._id, invoiceId: usage?.invoiceId },
  });
}

// A Reward is "available" if it isn't revoked, isn't expired, and has no
// RewardUsage row that currently occupies it (a 'consumed' row, or a
// 'reserved' row still within its expiry window). Returns the oldest
// available reward (FIFO — earliest-earned consumed first), or null.
//
// NOTE: this is a READ used to SELECT a candidate. It is NOT the atomic
// guarantee on its own — reserveNextAvailableReward pairs it with the
// unique-index-guarded insert to make the select+reserve atomic.
async function getNextAvailableReward(organizationId) {
  const now = new Date();
  const rewards = await Reward.find({
    organization: organizationId,
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).sort({ createdAt: 1 });

  for (const reward of rewards) {
    const activeUsage = await RewardUsage.findOne({
      reward: reward._id,
      $or: [
        { status: 'consumed' },
        { status: 'reserved', expiresAt: { $gt: now } },
      ],
    });
    if (!activeUsage) return reward;
  }
  return null;
}

// Flips any expired 'reserved' usages (optionally scoped to a set of reward
// ids) to 'released' and emits REFERRAL_REWARD_RELEASED for each. Idempotent:
// the conditional update means a row already moved by a concurrent caller is
// simply skipped. Called both in the reservation path (so the system never
// depends on a cron running on time) and by a future scheduled cleanup job.
async function releaseExpiredReservations(rewardIds = null) {
  const now = new Date();
  const filter = { status: 'reserved', expiresAt: { $lte: now } };
  if (rewardIds) filter.reward = { $in: rewardIds };

  const expired = await RewardUsage.find(filter);
  let releasedCount = 0;
  for (const stale of expired) {
    const usage = await RewardUsage.findOneAndUpdate(
      { _id: stale._id, status: 'reserved' },
      { $set: { status: 'released', releasedAt: now } },
      { new: true }
    );
    if (!usage) continue; // a concurrent caller already released/consumed it
    releasedCount += 1;
    const reward = await Reward.findById(usage.reward);
    if (reward) await emitRewardEvent('REFERRAL_REWARD_RELEASED', reward, usage);
  }
  return releasedCount;
}

// Atomically reserves the next available reward for an organization, or
// returns null if none is available. Safe under concurrent checkouts:
//   1. Release any expired reservations first (frees jammed index slots).
//   2. Select a candidate (read), attempt a guarded insert (write). If the
//      unique index rejects it (another checkout won the same reward), retry
//      against the next candidate. Bounded so a pathological race can't loop
//      forever.
// Returns { reward, usage } or null. Emits REFERRAL_REWARD_RESERVED on success.
async function reserveNextAvailableReward(organizationId, { invoiceId = null, subscription = null, ttlMs = DEFAULT_RESERVATION_TTL_MS } = {}) {
  const orgRewards = await Reward.find({ organization: organizationId }).select('_id');
  await releaseExpiredReservations(orgRewards.map((r) => r._id));

  for (let attempt = 0; attempt < 5; attempt++) {
    const reward = await getNextAvailableReward(organizationId);
    if (!reward) return null;

    try {
      const usage = await RewardUsage.create({
        reward: reward._id,
        invoiceId,
        subscription,
        status: 'reserved',
        expiresAt: new Date(Date.now() + ttlMs),
      });
      await emitRewardEvent('REFERRAL_REWARD_RESERVED', reward, usage);
      return { reward, usage };
    } catch (err) {
      // Lost the race for THIS reward — the partial unique index rejected a
      // second concurrent 'reserved' row. Try the next available reward.
      if (err && err.code === 11000) continue;
      throw err;
    }
  }
  return null; // extremely contended — treat as "no reward available" this round
}

// Atomically consumes a reserved usage. Idempotent: a duplicate webhook (or
// any second caller) finds the row no longer 'reserved' and returns null
// without re-emitting an event. Returns the consumed usage or null.
async function consumeReservation(usageId) {
  if (!usageId) return null;
  const usage = await RewardUsage.findOneAndUpdate(
    { _id: usageId, status: 'reserved' },
    { $set: { status: 'consumed', consumedAt: new Date() } },
    { new: true }
  );
  if (!usage) return null; // already consumed/released/expired-then-released
  const reward = await Reward.findById(usage.reward);
  if (reward) await emitRewardEvent('REFERRAL_REWARD_CONSUMED', reward, usage);
  return usage;
}

// Atomically releases a reserved usage (e.g. the order it backed failed to
// create, or was abandoned). Idempotent. Returns the released usage or null.
async function releaseReservation(usageId) {
  if (!usageId) return null;
  const usage = await RewardUsage.findOneAndUpdate(
    { _id: usageId, status: 'reserved' },
    { $set: { status: 'released', releasedAt: new Date() } },
    { new: true }
  );
  if (!usage) return null;
  const reward = await Reward.findById(usage.reward);
  if (reward) await emitRewardEvent('REFERRAL_REWARD_RELEASED', reward, usage);
  return usage;
}

module.exports = {
  getNextAvailableReward,
  reserveNextAvailableReward,
  consumeReservation,
  releaseReservation,
  releaseExpiredReservations,
  DEFAULT_RESERVATION_TTL_MS,
};
