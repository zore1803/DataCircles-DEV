// pages/PaymentSuccess.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const razorpay_payment_id = searchParams.get('razorpay_payment_id');
    const razorpay_subscription_id = searchParams.get('razorpay_subscription_id');
    const razorpay_signature = searchParams.get('razorpay_signature');

    if (razorpay_payment_id && razorpay_subscription_id) {
      setStatus('success');
      setMessage('Payment successful! Your subscription has been activated.');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } else {
      setStatus('failed');
      setMessage('Payment verification failed. Please contact support.');
    }
  }, [searchParams, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Processing payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-4">
            {status === 'success' ? (
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            )}
          </div>
          
          <h1 className={`text-2xl font-bold mb-4 ${
            status === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {status === 'success' ? 'Payment Successful!' : 'Payment Failed'}
          </h1>
          
          <p className="text-gray-600 mb-6">{message}</p>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
