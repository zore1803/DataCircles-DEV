import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

const CheckoutJourneyScreen = ({ state }) => {
  let title = "";
  let message = "";
  let icon = <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />;
  let steps = [];

  if (state === 'setting_up_recurring') {
    title = "Setting up your recurring payment...";
    message = "You'll now be redirected to Razorpay to securely approve your recurring payment mandate. Please don't close this tab. We'll automatically continue once you return.";
    steps = [
      { label: "Payment configuration complete", status: "complete" },
      { label: "Setting up your recurring billing...", status: "active" }
    ];
  } else if (state === 'confirming_mandate') {
    // Found via live QA: this checklist used to hardcode "Payment received"
    // and "Mandate approved" as status: "complete" the instant the frontend
    // entered this state — which happens unconditionally 2.5s after opening
    // the Razorpay tab (SubscriptionPlans.jsx), before the user has done
    // anything on Razorpay's page and before even a single poll has run. That
    // let the UI claim a mandate was approved when it hadn't been. The real
    // backend only confirms via startMandatePolling's waitForSettlement,
    // which re-fetches the subscription and checks isPaymentConfirmed — a
    // single combined fact (both the payment.captured AND token.confirmed
    // webhooks having landed; they can arrive in either order, see
    // CAW_BILLING_DESIGN.md §7a), not two separately-observable booleans. So
    // there is no real signal available here to honestly mark either step
    // "complete" before that poll settles — both stay "pending" for the
    // entire duration of this screen; only the transition to the 'success'
    // state (driven by the real poll result) ever represents actual
    // confirmation.
    //
    // Third fix (found via live QA, same conversation): tried reordering and
    // relabeling the "Payment received"/"Mandate approved" lines first, but
    // the actual objection (correctly raised) is deeper than ordering — we
    // have NO independent signal for either one at all. isPaymentConfirmed
    // is a single combined fact (both webhooks landed, in either order);
    // there is no intermediate state where the backend genuinely knows
    // "payment received" is true but "mandate approved" isn't, or vice
    // versa. Listing them as separate checklist items — even both grayed
    // out as "pending" — implies we're independently tracking two signals
    // we don't actually have. Removed entirely rather than keep reshuffling
    // a checklist for sub-steps that don't exist as observable facts; only
    // the spinner + honest waiting message remain, and the transition to
    // 'success' is the only point anything here becomes true.
    title = "Confirming your mandate...";
    message = "We're waiting for Razorpay to confirm your authorization. This usually takes only a few seconds.";
    steps = [];
  } else if (state === 'confirming_payment') {
    title = "Confirming your payment...";
    message = "We're verifying the transaction with Razorpay. This usually takes only a few seconds.";
    steps = [
      { label: "Payment received", status: "complete" },
      { label: "Verifying transaction...", status: "active" }
    ];
  } else if (state === 'success') {
    title = "Subscription Active";
    message = "Your mandate has been confirmed and your subscription is now active. Redirecting...";
    icon = <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />;
  } else if (state === 'preparing_payment') {
    title = "Preparing checkout...";
    message = "Setting up your secure payment session.";
    steps = [
      { label: "Preparing payment...", status: "active" }
    ];
  }

  return (
    <div className="fixed inset-0 bg-white z-[200000] flex flex-col items-center justify-center px-4 animate-in fade-in duration-300">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center">{icon}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-8">{message}</p>
        
        {steps.length > 0 && (
          <div className="text-left bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {step.status === 'complete' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : step.status === 'active' ? (
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    </div>
                  ) : (
                    // 'pending' — not yet known to have happened. Distinct
                    // from 'active' (currently in progress): a hollow, static
                    // circle rather than a pulsing dot, so it never reads as
                    // "in progress" for something we have no real signal on.
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300" />
                    </div>
                  )}
                  <span className={step.status === 'complete' ? "text-gray-500" : step.status === 'active' ? "text-gray-900 font-medium" : "text-gray-400"}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutJourneyScreen;
