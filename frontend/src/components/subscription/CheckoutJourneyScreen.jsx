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
    title = "Confirming your mandate...";
    message = "We're waiting for Razorpay to confirm your authorization. This usually takes only a few seconds.";
    steps = [
      { label: "Payment received", status: "complete" },
      { label: "Mandate approved", status: "complete" },
      { label: "Activating your subscription...", status: "active" }
    ];
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
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    </div>
                  )}
                  <span className={step.status === 'complete' ? "text-gray-500" : "text-gray-900 font-medium"}>
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
