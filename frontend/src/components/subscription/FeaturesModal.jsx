// components/FeaturesModal.jsx
import React from 'react';
import { X, Check } from 'lucide-react';

const FeaturesModal = ({ isOpen, onClose, plan }) => {
  if (!isOpen) return null;

  const getColorClasses = () => {
    if (plan.popular) {
      return {
        header: 'bg-gradient-to-r from-purple-600 to-blue-600',
        badge: 'bg-yellow-400 text-gray-900',
        checkBg: 'bg-purple-100',
        checkIcon: 'text-purple-600',
      };
    }
    
    switch (plan.color) {
      case 'blue': return { header: 'bg-blue-600', badge: 'bg-blue-500', checkBg: 'bg-blue-50', checkIcon: 'text-blue-600' };
      case 'purple': return { header: 'bg-purple-600', badge: 'bg-purple-500', checkBg: 'bg-purple-50', checkIcon: 'text-purple-600' };
      case 'green': return { header: 'bg-green-600', badge: 'bg-green-500', checkBg: 'bg-green-50', checkIcon: 'text-green-600' };
      case 'amber': return { header: 'bg-amber-600', badge: 'bg-amber-500', checkBg: 'bg-amber-50', checkIcon: 'text-amber-600' };
      default: return { header: 'bg-gray-600', badge: 'bg-gray-500', checkBg: 'bg-gray-50', checkIcon: 'text-gray-600' };
    }
  };

  const colors = getColorClasses();

  return (
    <div className="fixed inset-0 z-[100003] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className={`${colors.header} text-white p-6 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              {plan.icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{plan.name} Plan</h2>
              <p className="text-white/80 text-sm">{plan.tagline}</p>
            </div>
          </div>
          
          {plan.popular && (
            <div className={`inline-flex items-center gap-1 ${colors.badge} px-3 py-1 rounded-full text-xs font-bold mt-2`}>
              Most Popular Choice
            </div>
          )}
          
          {plan.trial && (
            <div className={`inline-flex items-center gap-1 ${colors.badge} text-white px-3 py-1 rounded-full text-xs font-bold mt-2`}>
              {plan.trialDays} Days Free Trial
            </div>
          )}
        </div>

        {/* Features List */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            All Features Included ({plan.features.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`flex-shrink-0 w-5 h-5 ${colors.checkBg} rounded-full flex items-center justify-center mt-0.5`}>
                  <Check className={`w-3 h-3 ${colors.checkIcon}`} />
                </div>
                <span className="text-sm text-gray-700 flex-1">{feature.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeaturesModal;
