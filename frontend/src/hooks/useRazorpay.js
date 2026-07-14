// hooks/useRazorpay.js
import { useEffect, useState } from 'react';

const useRazorpay = () => {
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const loadScript = (src) => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    const loadRazorpay = async () => {
      const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      setRazorpayLoaded(res);
    };

    if (!window.Razorpay) {
      loadRazorpay();
    } else {
      setRazorpayLoaded(true);
    }
  }, []);

  const openCheckout = (options) => {
    if (!razorpayLoaded || !window.Razorpay) {
      console.error('Razorpay SDK not loaded');
      return;
    }
    const rzp = new window.Razorpay(options);
    rzp.open();

    rzp.on('payment.failed', function (response) {
      console.error('Payment failed:', response.error);
      if (options.onPaymentFailed) {
        options.onPaymentFailed(response.error);
      }
    });

    return rzp;
  };

  return { razorpayLoaded, openCheckout };
};

export default useRazorpay;
