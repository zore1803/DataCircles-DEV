// components/subscription/PaymentStatusAlert.jsx
import React from 'react';
import { AlertCircle, CreditCard, XCircle, Clock } from 'lucide-react';
import { hasValidPendingUpdate } from '../../utils/subscriptionHelpers';

const PaymentStatusAlert = ({ subscription, onRetryPayment, processing }) => {
  // Don't show if no subscription exists
  if (!subscription) return null;

  // Hide if trial is active - users don't need to see payment alerts during trial
  if (subscription.isTrialActive) return null;

  // Hide if payment is already confirmed
  if (subscription.isPaymentConfirmed) return null;

  // Hide if a downgrade or cancellation is scheduled — but only a REAL one;
  // a stale/partial pendingUpdate object must not suppress the payment alert
  // for what's actually just an incomplete new-subscription checkout.
  if (hasValidPendingUpdate(subscription) || subscription.cancelAtPeriodEnd) return null;

  const getAlertContent = () => {
    switch (subscription.paymentStatus) {
      case 'pending_payment':
        return {
          icon: <Clock className="w-5 h-5" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          title: 'Payment Pending',
          message: 'Your subscription is created but payment is pending. Please complete the payment to activate your plan.',
          showRetry: true,
          buttonText: 'Complete Payment'
        };
      case 'payment_failed':
        return {
          icon: <XCircle className="w-5 h-5" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          title: 'Payment Failed',
          message: 'Your payment could not be processed. Please try again to activate your subscription.',
          showRetry: true,
          buttonText: 'Retry Payment'
        };
      case 'payment_cancelled':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          title: 'Payment Cancelled',
          message: 'You cancelled the payment. Complete the payment to activate your subscription.',
          showRetry: true,
          buttonText: 'Try Again'
        };
      default:
        return null;
    }
  };

  let alertContent = getAlertContent();
  if (!alertContent) return null;

  // Override with processing state if payment is being processed
  if (processing) {
    alertContent = {
      icon: <Clock className="w-5 h-5 animate-spin" />,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      title: 'Processing Payment',
      message: 'Your payment is being processed. This may take time for confirmation...',
      showRetry: false,
    };
  }

  return (
    <div className={`${alertContent.bgColor} border ${alertContent.borderColor} rounded-lg p-4 mb-6`}>
      <div className="flex">
        <div className={`${alertContent.textColor} flex-shrink-0`}>
          {alertContent.icon}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${alertContent.textColor}`}>
            {alertContent.title}
          </h3>
          <p className={`mt-1 text-sm ${alertContent.textColor}`}>
            {alertContent.message}
          </p>
          {subscription.lastPaymentAttempt && (
            <p className={`mt-1 text-xs ${alertContent.textColor} opacity-75`}>
              Last attempt: {new Date(subscription.lastPaymentAttempt.attemptedAt).toLocaleString('en-IN')}
            </p>
          )}
          {alertContent.showRetry && (
            <div className="mt-3">
              <button
                onClick={onRetryPayment}
                disabled={processing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    {alertContent.buttonText}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusAlert;
