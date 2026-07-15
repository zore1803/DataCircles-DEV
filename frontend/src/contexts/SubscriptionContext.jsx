// contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import toast from 'react-hot-toast';
import { subscriptionAPI } from '../services/subscriptionApi';
import AppToaster from "../components/AppToaster";

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { isLoading: authLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminNotice, setAdminNotice] = useState(null);
  const [seatStatus, setSeatStatus] = useState(null);

  // Check if user is authenticated via phone (localStorage token)
  const isPhoneAuthenticated = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  };

  // Check if user is authenticated via any method (Auth0 or Phone)
  const isUserAuthenticated = () => {
    return isAuthenticated || isPhoneAuthenticated();
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Don't make API call if not authenticated
      if (!isUserAuthenticated()) {
        setSubscription({ 
          hasSubscription: false, 
          trialEligible: true 
        });
        setLoading(false);
        return;
      }

      const response = await subscriptionAPI.getCurrentSubscription();
      setSubscription(response.data);

      // One-shot notice for super-admin-initiated changes (trial
      // adjusted/ended, subscription cancelled on the org's behalf). The
      // backend clears this server-side the moment it's returned, so it
      // only ever shows once. Surfaced two ways: a toast (easy to miss if
      // the tab isn't focused) and a persistent dismissible banner (stored
      // in state here, rendered by the app shell) that stays until the
      // user actually closes it — not on an auto-dismiss timer.
      const notice = response.data?.subscription?.adminNotice;
      if (notice?.message) {
        toast(notice.message, { icon: '📣', duration: 8000 });
        setAdminNotice(notice);
      }

      // Returned so callers polling for settlement (see utils/waitForSettlement)
      // can check the freshly-fetched value directly instead of reading
      // this hook's state — state updates are asynchronous and reading
      // `subscription` from a closure captured before this call resolves
      // would still show the pre-fetch value.
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setError(error.response?.data?.message || 'Failed to fetch subscription');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Seats are just the "extra_seat" add-on (see backend/docs/ARCHITECTURE.md
  // §8 rule #2) — one fetch path shared by every consumer that needs seat
  // counts (Billing Center sidebar, User Management), instead of each
  // component independently hitting the endpoint.
  const fetchSeatStatus = async () => {
    if (!isUserAuthenticated()) return null;
    try {
      const response = await subscriptionAPI.getSeatStatus();
      setSeatStatus(response.data);
      return response.data;
    } catch (error) {
      // Informational only — a failed seat-status fetch shouldn't surface
      // as a page-level error.
      return null;
    }
  };

  const fetchPlans = async () => {
    try {
      setError(null);
      const response = await subscriptionAPI.getPlans();
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setError(error.response?.data?.message || 'Failed to fetch plans');
    }
  };

  const startTrial = async () => {
    try {
      const response = await subscriptionAPI.startFreeTrial();
      await fetchSubscription(); // Refresh subscription data
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const createSubscription = async (planData) => {
    try {
      const response = await subscriptionAPI.createSubscription(planData);
      await fetchSubscription(); // Refresh subscription data
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const updateSubscription = async (planData) => {
    try {
      const response = await subscriptionAPI.updateSubscription(planData);
      await fetchSubscription(); // Refresh subscription data
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const cancelSubscription = async (cancelData) => {
    try {
      const response = await subscriptionAPI.cancelSubscription(cancelData);
      await fetchSubscription(); // Refresh subscription data
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    // For phone authenticated users, Auth0 loading is not relevant
    const isPhoneAuth = isPhoneAuthenticated();
    
    // Wait for Auth0 to finish loading only if not phone authenticated
    if (!isPhoneAuth && authLoading) {
      return;
    }

    // Always fetch plans (public endpoint)
    fetchPlans();
    
    // Check authentication status
    const isAuth = isUserAuthenticated();
    
    if (isAuth) {
      // Small delay to ensure token is available (especially for Auth0)
      const delay = isPhoneAuth ? 0 : 100;
      setTimeout(() => {
        fetchSubscription();
      }, delay);
    } else {
      // Set default state for unauthenticated users
      setSubscription({ 
        hasSubscription: false, 
        trialEligible: true 
      });
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]); // Dependencies remain the same

  useEffect(() => {
    if (subscription?.subscription?.isPaymentConfirmed) {
      fetchSeatStatus();
    }
  }, [subscription?.subscription?.isPaymentConfirmed]);

  // Listen for localStorage changes (phone login/logout)
  useEffect(() => {
    const handleStorageChange = (e) => {
      // If token was added or removed, refetch subscription
      if (e.key === 'token') {
        if (e.newValue) {
          // User logged in via phone
          fetchSubscription();
        } else {
          // User logged out
          setSubscription({ 
            hasSubscription: false, 
            trialEligible: true 
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plans,
        seatStatus,
        fetchSeatStatus,
        loading: loading || (!isPhoneAuthenticated() && authLoading), // Include Auth0 loading only for Auth0 users
        error,
        startTrial,
        createSubscription,
        updateSubscription,
        cancelSubscription,
        fetchSubscription,
        refetch: fetchSubscription,
        adminNotice,
        dismissAdminNotice: () => setAdminNotice(null),
        isAuthenticated: isUserAuthenticated() // Expose combined authentication status
      }}
    >
      <AppToaster />
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionProvider;
