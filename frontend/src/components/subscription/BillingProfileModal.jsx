// components/subscription/BillingProfileModal.jsx
import React, { useState } from 'react';
import { UserCircle } from 'lucide-react';
import API from '../../services/api';

// Charge-at-Will requires a Razorpay customer record with both email and
// phone, but signup only ever collects one of the two (email-only or
// phone-only are both valid sign-up paths and that stays unchanged). This
// collects only whichever field is actually missing, right before the first
// paid subscription attempt, instead of blocking signup or requiring a manual
// DB edit to test payments.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same pattern as Login.jsx's signup validation

const BillingProfileModal = ({ show, missingEmail, missingPhone, onSaved, onClose }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!show) return null;

  const handleSave = async () => {
    setError('');

    const payload = {};
    if (missingEmail) {
      if (!EMAIL_REGEX.test(email)) {
        setError('Please enter a valid email address');
        return;
      }
      payload.email = email;
    }
    if (missingPhone) {
      if (phone.length !== 10) {
        setError('Please enter a valid 10-digit phone number');
        return;
      }
      payload.phone = phone;
    }

    setSaving(true);
    try {
      const res = await API.post('/auth/profile', payload);
      const updatedUser = res.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onSaved(updatedUser);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[1000004]">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Billing Profile
          </h3>
          <p className="text-gray-600 text-sm">
            We need {missingEmail && missingPhone ? 'your email and phone number' : missingEmail ? 'your email' : 'your phone number'} to set up recurring billing.
          </p>
        </div>

        <div className="space-y-4">
          {missingEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={saving}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          {missingPhone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit number"
                disabled={saving}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="space-y-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingProfileModal;
