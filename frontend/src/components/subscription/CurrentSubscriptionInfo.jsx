// components/subscription/CurrentSubscriptionInfo.jsx
import React from 'react';
import { Calendar, Users, CreditCard, Clock, Gift, AlertCircle } from 'lucide-react';
import { hasValidPendingUpdate } from '../../utils/subscriptionHelpers';
import SubscriptionPricingBreakdown from './SubscriptionPricingBreakdown';

const CurrentSubscriptionInfo = ({ subscription, billingCycle }) => {
  
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

  // Handle Active Trial
  if (subscription?.isTrialActive) {
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
  if (!subscription || (!subscription.isPaymentConfirmed && !hasValidPendingUpdate(subscription))) {
    return null;
  }

  // Handle Pending Update — only render this card for a genuine scheduled
  // downgrade, not just because `pendingUpdate` happens to be a truthy object.
  if (hasValidPendingUpdate(subscription)) {
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
                      const removal = (subscription.pendingAddonRemovals || []).find((r) => r.addonKey === addon.addonKey);
                      const allPending = removal && addon.quantity - removal.quantity <= 0;
                      return (
                        <span key={addon.addonKey} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${allPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                          <span className={allPending ? 'line-through' : undefined}>
                            {addon.addonKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}×{addon.quantity}
                          </span>
                          {allPending && <span className="text-[10px] text-amber-600 ml-0.5">removing</span>}
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
          // The scheduled subscription is a FROZEN future state, decided at the
          // moment the downgrade was scheduled. It must NOT silently absorb
          // add-ons purchased on the current subscription afterward — those
          // purchases affect the active plan only, unless the user explicitly
          // edits the scheduled plan (a separate flow, not implemented here).
          // So we read carriedAddons/removedAddons from the snapshot taken at
          // schedule time, not by re-diffing today's activeAddons.
          const hasSnapshot = Array.isArray(subscription.pendingUpdate.carriedAddons);
          let carrying, removing;
          if (hasSnapshot) {
            carrying = subscription.pendingUpdate.carriedAddons;
            removing = subscription.pendingUpdate.removedAddons || [];
          } else {
            // Legacy fallback for pendingUpdate records created before this
            // snapshot existed — best-effort derive from live state.
            const removals = subscription.pendingAddonRemovals || [];
            const activeAddons = subscription.activeAddons || [];
            carrying = activeAddons.filter((a) => {
              const r = removals.find((r) => r.addonKey === a.addonKey);
              return !(r && r.quantity >= a.quantity);
            });
            removing = activeAddons.filter((a) => {
              const r = removals.find((r) => r.addonKey === a.addonKey);
              return r && r.quantity >= a.quantity;
            });
          }

          // Total is derived from the SAME frozen `carrying` snapshot, so the
          // add-on list and the total shown here can never disagree.
          const carryingAddonsTotal = carrying.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
          const finalTotal = (subscription.pendingUpdate.pricePerUser || 0) + carryingAddonsTotal;
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
                    <span className="font-medium text-gray-900 capitalize">{subscription.pendingUpdate.planName}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">
                      {formatPrice(subscription.pendingUpdate.pricePerUser)}/user/{subscription.pendingUpdate.billingCycle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    Effective: {formatDate(subscription.pendingUpdate.scheduledAt)}
                  </div>

                  {/* Addons that survive onto the new plan — always shown, even
                      when empty, so the user never has to infer "what's left"
                      from the absence of a "Removed" line. */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500 mr-0.5">Add-ons:</span>
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
                    {' '}<span className="text-gray-800 font-semibold">= {formatPrice(finalTotal + finalGST)}/{subscription.pendingUpdate.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </p>
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
                  const removal = (subscription.pendingAddonRemovals || []).find((r) => r.addonKey === addon.addonKey);
                  const allPending = removal && addon.quantity - removal.quantity <= 0;
                  const removalDate = removal?.effectiveAt
                    ? new Date(removal.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : null;
                  return (
                    <span
                      key={addon.addonKey}
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
                          ({formatPrice(addon.pricePerUnit * addon.quantity)}/{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'})
                        </span>
                      </span>
                      {allPending && (
                        <span className="ml-0.5 text-[10px] font-normal text-amber-600">
                          removing {removalDate || 'soon'}
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
