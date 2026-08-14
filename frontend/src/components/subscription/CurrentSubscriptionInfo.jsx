// components/subscription/CurrentSubscriptionInfo.jsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Users, CreditCard, Clock, Gift, AlertCircle } from 'lucide-react';
import { deriveSubscriptionUIState, SUBSCRIPTION_UI_STATES } from '../../utils/subscriptionHelpers';
import SubscriptionPricingBreakdown from './SubscriptionPricingBreakdown';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { subscriptionAPI } from '../../services/subscriptionApi';

const CurrentSubscriptionInfo = ({ subscription, allPlanAddons }) => {
  // Canonical future-intent source (Ownership Law 5) — never the legacy
  // subscription.pendingUpdate/pendingAddonRemovals fields.
  const { scheduledChanges, keptAddons, removedAddons, fetchSubscription } = useSubscription();
  const pendingPlanOrCycleChange = (scheduledChanges || []).find(
    (c) => c.type === 'PLAN_CHANGE' || c.type === 'BILLING_CYCLE_CHANGE'
  );
  const [cancellingDowngrade, setCancellingDowngrade] = useState(false);

  // Escape hatch for the downgrade freeze rule (business contract, agreed
  // 2026-07-24) — the only other way out is cancelling the whole
  // subscription. Reverts pendingUpdate, restores any carry-forward
  // reduction it caused, unfreezes addon purchases/removals/plan changes.
  const handleCancelScheduledDowngrade = async () => {
    setCancellingDowngrade(true);
    try {
      const resp = await subscriptionAPI.cancelScheduledDowngrade();
      toast.success(resp.data?.message || 'Scheduled downgrade cancelled.');
      await fetchSubscription();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not cancel the scheduled downgrade.');
    } finally {
      setCancellingDowngrade(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    if (!date || d.getFullYear() < 2020) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // "allPending" (fully consumed by a scheduled REMOVE_ADDON) is computed by
  // comparing addonKey strings — but a scheduled plan change can remap this
  // SAME entitlement to a different key on the target plan (e.g. Growth's
  // "seat" -> Starter's "extra_seat"). That reads correctly to the backend
  // ("the string 'seat' isn't in the future add-ons") but wrong to a
  // customer, who only thinks "I have a seat, will I still have it after?".
  // Cross-reference by targetKey (the catalog's own equivalence concept,
  // the same field classifyAddonsForPlanChange uses server-side) against
  // whatever DID survive under the target plan's own catalog — purely a
  // display relabelling, never changes what's actually scheduled.
  const planChangeSC = (scheduledChanges || []).find(
    (c) => c.type === 'PLAN_CHANGE' || c.type === 'BILLING_CYCLE_CHANGE'
  );
  const myPlanCatalog = allPlanAddons?.[subscription?.planName] || [];
  const targetPlanCatalog = planChangeSC ? (allPlanAddons?.[planChangeSC.payload?.planId] || []) : [];

  const findCarriedEquivalent = (addonKey) => {
    if (!planChangeSC) return null;
    const myTargetKey = myPlanCatalog.find((a) => a.key === addonKey)?.targetKey;
    if (!myTargetKey) return null;
    return (keptAddons || []).find((k) => {
      const entry = targetPlanCatalog.find((a) => a.key === k.addonKey);
      return entry?.targetKey && entry.targetKey === myTargetKey;
    }) || null;
  };

  // Task 3 (Aug 2026): confirmed display-mismatch trace — this used to match
  // by addonKey ALONE, so a monthly + annual instance of the same key would
  // cross-contaminate each other's removal/pending state (same class of bug
  // already fixed in PlanCard.jsx earlier this session, but never propagated
  // to this second, separate render location). addonCycle is optional so
  // existing callers that don't pass it keep matching exactly as before.
  const getAddonRemovalState = (addonKey, quantity, addonCycle) => {
    const matchesCycle = (r) => addonCycle == null || (r.billingCycle || subscription.billingCycle) === addonCycle;
    const scheduledRemoval = (removedAddons || []).find((r) => r.addonKey === addonKey && matchesCycle(r));
    const pendingQty = scheduledRemoval?.quantity || 0;
    const remainingQty = Math.max(0, quantity - pendingQty);
    const allPending = remainingQty <= 0;
    const removalChange = (scheduledChanges || []).find(
      (change) => change.type === 'REMOVE_ADDON' && change.payload?.addonKey === addonKey &&
        (addonCycle == null || (change.payload?.billingCycle || subscription.billingCycle) === addonCycle)
    );
    const removalDate = removalChange?.effectiveAt ? formatDate(removalChange.effectiveAt) : null;
    const carriedEquivalent = allPending ? findCarriedEquivalent(addonKey) : null;
    return {
      pendingQty, remainingQty, removalDate,
      // Truly ending — nothing of it survives, under any key, anywhere.
      allPending: allPending && !carriedEquivalent,
      carriedEquivalent,
      carriedDisplayName: carriedEquivalent
        ? carriedEquivalent.addonKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : null,
    };
  };

  const calculateTimeRemaining = (trialEndDate) => {
    if (!trialEndDate) return { days: 0, hours: 0, isLessThanDay: false };
    
    const now = Date.now();
    const end = new Date(trialEndDate).getTime();
    
    const diffTime = end - now;
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If less than 24 hours remaining, show hours
    const isLessThanDay = diffHours < 24 && diffHours > 0;
    
    return {
      days: Math.max(0, diffDays),
      hours: Math.max(0, diffHours),
      isLessThanDay
    };
  };

  // Handle Active Trial — gated on the canonical derived state, not raw
  // isTrialActive. A conversion attempt already in flight (PENDING_MANDATE)
  // must not show "Free Trial Active" alongside "Complete Payment" on a plan
  // card — trial cleanup only runs once the mandate confirms, so
  // isTrialActive alone can't tell these two states apart (see
  // FRONTEND_CONVERGENCE_PLAN.md Journey 1).
  if (deriveSubscriptionUIState(subscription) === SUBSCRIPTION_UI_STATES.TRIAL) {
    const timeRemaining = calculateTimeRemaining(subscription.trialEnd);
    const totalTrialDays = subscription.trialStart && subscription.trialEnd 
      ? Math.ceil((new Date(subscription.trialEnd) - new Date(subscription.trialStart)) / (1000 * 60 * 60 * 24))
      : 7;

    // Determine display values
    const displayValue = timeRemaining.isLessThanDay ? timeRemaining.hours : timeRemaining.days;
    const displayUnit = timeRemaining.isLessThanDay 
      ? (timeRemaining.hours === 1 ? 'hour' : 'hours')
      : (timeRemaining.days === 1 ? 'day' : 'days');
    
    const isEndingSoon = timeRemaining.days <= 2;
    const isLastHours = timeRemaining.isLessThanDay;

    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-6 border-2 border-green-300 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-green-600" />
              <h3 className="text-base font-bold text-gray-900">Free Trial Active</h3>
            </div>
            
            {/* Trial Details */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold text-gray-900">Growth Plan Features</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-700">All premium features unlocked</span>
              </div>

              {/* Time Remaining */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-green-600" />
                <span className={`font-bold ${
                  isLastHours ? 'text-red-600' : 
                  isEndingSoon ? 'text-orange-600' : 
                  'text-green-700'
                }`}>
                  {displayValue} {displayUnit} remaining
                </span>
                <span className="text-gray-500">
                  (Ends: {formatDate(subscription.trialEnd)})
                </span>
              </div>

              {/* Trial Progress Bar */}
              <div className="mt-3">
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isLastHours ? 'bg-red-500' :
                      isEndingSoon ? 'bg-orange-500' : 
                      'bg-green-600'
                    }`}
                    style={{ 
                      width: `${timeRemaining.isLessThanDay 
                        ? ((24 - timeRemaining.hours) / 24) * 100
                        : ((totalTrialDays - timeRemaining.days) / totalTrialDays) * 100
                      }%` 
                    }}
                  />
                </div>
              </div>

              {/* Warning messages */}
              {isLastHours ? (
                <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    <span className="font-semibold">Trial expiring soon!</span> Only {displayValue} {displayUnit} left. Subscribe now to avoid any service interruption.
                  </p>
                </div>
              ) : isEndingSoon && (
                <div className="flex items-start gap-2 mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-800">
                    <span className="font-semibold">Trial ending soon!</span> Subscribe to a paid plan to continue using all features without interruption.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${
            isLastHours 
              ? 'bg-red-100 text-red-700 border-red-300' 
              : 'bg-green-100 text-green-700 border-green-300'
          }`}>
            {isLastHours ? 'Expiring Soon' : 'Trial Active'}
          </span>
        </div>
      </div>
    );
  }

  // No subscription or payment not confirmed (unless a downgrade/change is scheduled)
  if (!subscription || (!subscription.isPaymentConfirmed && !pendingPlanOrCycleChange)) {
    return null;
  }

  // Handle Pending Update — only render this card for a genuine scheduled
  // downgrade/cycle-change ScheduledChange record.
  if (pendingPlanOrCycleChange) {
    return (
      <div className="space-y-3 mb-6">
        {/* Current Subscription - Compact */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Current Subscription</h3>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-gray-900 capitalize">{subscription.planName}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{formatPrice(subscription.pricePerUser)}/user</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{subscription.userCount} users</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                Next billing: {formatDate(subscription.nextBillingDate)}
              </div>

              {/* Active Add-ons */}
              {(subscription.activeAddons || []).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Active Add-ons</p>
                  <div className="flex flex-wrap gap-1.5">
                    {subscription.activeAddons.map((addon) => {
                      const addonCycle = addon.billingCycle || subscription.billingCycle;
                      const { pendingQty, remainingQty, allPending, removalDate, carriedEquivalent, carriedDisplayName } = getAddonRemovalState(
                        addon.addonKey,
                        addon.quantity,
                        addonCycle
                      );
                      return (
                        <span key={`${addon.addonKey}-${addonCycle}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${allPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                          <span className={allPending ? 'line-through' : undefined}>
                            {addon.addonKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}×{addon.quantity}
                            <span className="text-[9px] uppercase tracking-wide text-gray-400 ml-1">{addonCycle === 'yearly' ? 'Annual' : 'Monthly'}</span>
                          </span>
                          {carriedEquivalent ? (
                            <span
                              className="text-[10px] text-blue-600 ml-0.5"
                              title={`Continues as ${carriedDisplayName}${carriedEquivalent.quantity !== addon.quantity ? ` ×${carriedEquivalent.quantity}` : ''}`}
                            >
                              continues after downgrade
                            </span>
                          ) : !allPending && pendingQty > 0 ? (
                            <span className="text-[10px] text-amber-600 ml-0.5">
                              {pendingQty} scheduled for removal{removalDate ? ` on ${removalDate}` : ""}
                            </span>
                          ) : null}
                          {allPending && (
                            <span className="text-[10px] text-amber-600 ml-0.5">
                              removing{removalDate ? ` ${removalDate}` : ""}
                            </span>
                          )}
                          {!allPending && !carriedEquivalent && remainingQty > 0 && pendingQty > 0 && (
                            <span className="text-[10px] text-gray-500 ml-0.5">
                              becomes ×{remainingQty}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              subscription.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {subscription.status?.charAt(0).toUpperCase() + subscription.status?.slice(1)}
            </span>
          </div>
        </div>

        {/* Pending Update - Compact: shows the FINAL subscription state that
            will be active on the effective date, folding together every
            scheduled change (plan downgrade + any addon removals) so the
            user sees one coherent end-state instead of piecing it together
            from separate signals. */}
        {(() => {
          // keptAddons/removedAddons come from getScheduledChanges' derived
          // view — computed LIVE from Subscription.activeAddons minus
          // whatever a sibling ScheduledChange{REMOVE_ADDON} targets. This
          // matches what the Renewal Engine actually does at execution time
          // (buildEffectiveSubscription starts from live activeAddons, never
          // a frozen snapshot) — the old local "frozen snapshot" framing
          // this block used to have didn't match execution reality; nothing
          // here is re-derived independently, it's the same backend
          // computation, not a second one.
          const carrying = keptAddons || [];
          // Only GENUINELY ending add-ons — removedAddons lists anything
          // whose CURRENT key doesn't appear in keptAddons, which includes
          // entries that actually survived under a remapped key (e.g.
          // Growth's "seat" -> Starter's "extra_seat"). Those aren't really
          // being removed; excluding them here is what makes "Add-ons" above
          // (carrying) and "Will be removed" below never both mention what
          // is, functionally, the same continuing entitlement.
          const removing = (removedAddons || []).filter((r) => !findCarriedEquivalent(r.addonKey));

          // Total is derived from the SAME live `carrying` list the addon
          // display above uses, so the two can never disagree.
          const carryingAddonsTotal = carrying.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
          const finalTotal = (pendingPlanOrCycleChange.payload?.pricePerUser || 0) + carryingAddonsTotal;
          const finalGST = Math.round(finalTotal * 0.18);

          return (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Scheduled Change</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-gray-900 capitalize">{pendingPlanOrCycleChange.payload?.planId}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">
                      {formatPrice(pendingPlanOrCycleChange.payload?.pricePerUser)}/user/{pendingPlanOrCycleChange.payload?.billingCycle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    Effective: {formatDate(pendingPlanOrCycleChange.effectiveAt)}
                  </div>

                  {/* Addons that survive onto the new plan — always shown, even
                      when empty, so the user never has to infer "what's left"
                      from the absence of a "Removed" line. */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500 mr-0.5">Add-ons after downgrade:</span>
                    {carrying.length > 0 ? (
                      carrying.map((a) => (
                        <span key={a.addonKey} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          {a.addonKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}×{a.quantity}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </div>

                  {/* Addons that will NOT carry over */}
                  {removing.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-gray-500 mr-0.5">Will be removed:</span>
                      {removing.map((a) => (
                        <span key={a.addonKey} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 line-through">
                          {a.addonKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}×{a.quantity}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Final recurring total once this change takes effect */}
                  <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-orange-200/60">
                    New recurring: <span className="font-semibold">{formatPrice(finalTotal)}</span>
                    {' '}<span className="text-gray-500">+ {formatPrice(finalGST)} GST</span>
                    {' '}<span className="text-gray-800 font-semibold">= {formatPrice(finalTotal + finalGST)}/{pendingPlanOrCycleChange.payload?.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </p>

                  {/* Escape hatch for the freeze rule — the only other way
                      out is cancelling the whole subscription. Styled to
                      match the existing "Cancel Subscription" button
                      elsewhere on this page, not as a plain text link. */}
                  <button
                    type="button"
                    onClick={handleCancelScheduledDowngrade}
                    disabled={cancellingDowngrade}
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-100 hover:border-orange-400 transition-all duration-200 font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancellingDowngrade ? 'Cancelling…' : 'Cancel Scheduled Change'}
                  </button>
                </div>
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold whitespace-nowrap">
                  Scheduled
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Active Paid Subscription
  return (
    <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Current Subscription</h3>
          </div>
          
          {/* Plan Details */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-2">
            <span className="font-medium text-gray-900 capitalize">{subscription.planName}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">
              {formatPrice(subscription.pricePerUser)}/user/{subscription.billingCycle}
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {subscription.userCount} users
            </span>
          </div>

          {/* Billing Info — itemized breakdown (plan, add-ons, coupon,
              subtotal, GST, recurring total) is rendered by the SAME shared
              component PlanCard's current-plan card uses, so the two
              surfaces can never show different numbers for one subscription. */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              Next billing: {formatDate(subscription.nextBillingDate)}
            </div>
            <SubscriptionPricingBreakdown subscription={subscription} />
          </div>

          {/* Active Add-ons */}
          {(subscription.activeAddons || []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Active Add-ons</p>
              <div className="flex flex-wrap gap-1.5">
                {subscription.activeAddons.map((addon) => {
                  // Task 3 (Aug 2026): confirmed bug — the price suffix below
                  // used to read subscription.billingCycle (the BASE plan's
                  // cycle) instead of this add-on's OWN billingCycle, so a
                  // monthly add-on on an annual base displayed "/yr" next to
                  // its actual monthly price. Not a fallback-for-missing-data
                  // case — addon.billingCycle was present and correct the
                  // whole time, this chip just never read it.
                  const addonCycle = addon.billingCycle || subscription.billingCycle;
                  const { pendingQty, remainingQty, allPending, removalDate } = getAddonRemovalState(
                    addon.addonKey,
                    addon.quantity,
                    addonCycle
                  );
                  return (
                    <span
                      key={`${addon.addonKey}-${addonCycle}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        allPending
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}
                    >
                      <span className={allPending ? 'line-through decoration-amber-400' : undefined}>
                        {addon.addonKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        <span className="font-bold ml-0.5">×{addon.quantity}</span>
                        <span className={allPending ? 'text-amber-400 ml-0.5' : 'text-blue-400 ml-0.5'}>
                          ({formatPrice(addon.pricePerUnit * addon.quantity)}/{addonCycle === 'monthly' ? 'mo' : 'yr'})
                        </span>
                        <span className="text-[9px] uppercase tracking-wide text-gray-400 ml-1">{addonCycle === 'yearly' ? 'Annual' : 'Monthly'}</span>
                      </span>
                      {!allPending && pendingQty > 0 && (
                        <span className="ml-0.5 text-[10px] font-normal text-amber-600">
                          {pendingQty} scheduled for removal{removalDate ? ` on ${removalDate}` : ""}
                        </span>
                      )}
                      {allPending && (
                        <span className="ml-0.5 text-[10px] font-normal text-amber-600">
                          removing {removalDate || 'soon'}
                        </span>
                      )}
                      {!allPending && remainingQty > 0 && pendingQty > 0 && (
                        <span className="ml-0.5 text-[10px] font-normal text-gray-500">
                          becomes ×{remainingQty}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
          subscription.status === 'active'
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {subscription.status?.charAt(0).toUpperCase() + subscription.status?.slice(1)}
        </span>
      </div>
    </div>
  );
};

export default CurrentSubscriptionInfo;
