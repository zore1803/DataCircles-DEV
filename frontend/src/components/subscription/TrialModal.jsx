// components/subscription/TrialModal.jsx
import React from 'react';
import { Gift } from 'lucide-react';

const TrialModal = ({ showTrialModal, onClose, onStartTrial, processing }) => {
  if (!showTrialModal) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[1000004]">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Start Your Free Trial
          </h3>
          <p className="text-gray-600 mb-6">
            Get access to all Growth plan features for 7 days. No credit card required.
          </p>
          <div className="space-y-3">
            <button
              onClick={onStartTrial}
              disabled={processing}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? 'Starting Trial...' : 'Start Free Trial'}
            </button>
            <button
              onClick={onClose}
              disabled={processing}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialModal;
