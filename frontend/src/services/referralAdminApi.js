// services/referralAdminApi.js
//
// Super Admin referral management — wraps the existing per-organization
// referral admin endpoints (backend/routes/superAdminRoutes.js). No new
// backend was added for this UI; every call here already existed.
import API from './api';

export const referralAdminAPI = {
  // Per-org referral program config (get/update). Config changes only affect
  // rewards created AFTER the change (Reward is immutable) — see backend.
  getProgram: (organizationId) => API.get(`/super-admin/referrals/programs/${organizationId}`),
  updateProgram: (organizationId, data) => API.put(`/super-admin/referrals/programs/${organizationId}`, data),

  // Per-org overview: codes, referrals (sent/pending/qualified), rewards.
  getOrganizationOverview: (organizationId) => API.get(`/super-admin/referrals/organizations/${organizationId}`),

  // Manual reward grant (support/goodwill) + reward revocation.
  grantManualReward: (data) => API.post('/super-admin/referrals/rewards/manual', data),
  revokeReward: (rewardId) => API.post(`/super-admin/referrals/rewards/${rewardId}/revoke`),

  // Reuses the coupon module's org search endpoint (same Super Admin scope).
  searchOrganizations: (search) => API.get('/super-admin/coupons/organizations', { params: { search } }),
};
