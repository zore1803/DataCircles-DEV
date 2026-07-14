// components/subscription/FAQ.jsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const faqItems = [
    {
      question: "Can I change my plan later?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at the end of your billing cycle."
    },
    {
      question: "What happens after my free trial ends?",
      answer: "After your 7-day free trial, you'll automatically move to the Free plan unless you choose a paid plan. All your data is preserved, and you can upgrade at any time to regain access to premium features."
    },
    {
      question: "Is there a setup fee or hidden charges?",
      answer: "No, there are no setup fees or hidden charges. You only pay the monthly or annual subscription fee based on your chosen plan. All prices are transparent and include all features listed."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. If you cancel, you'll continue to have access to paid features until the end of your current billing period, after which you'll revert to the Free plan."
    },
    {
      question: "Do you offer discounts for non-profits or educational institutions?",
      answer: "Yes, we offer special pricing for non-profit organizations and educational institutions. Please contact our sales team with your documentation to learn more about our discount programs."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, debit cards, and UPI payments through our secure payment gateway. Annual plans can also be paid via bank transfer for enterprise customers."
    }
  ];

  const toggleItem = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Title Section */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
          <HelpCircle className="w-7 h-7 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Frequently Asked Questions
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Find answers to common questions about our pricing, features, and subscription plans
        </p>
      </div>

      {/* FAQ Grid - 2 Columns with proper alignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          
          return (
            <div
              key={index}
              className={`bg-white rounded-xl border transition-all duration-300 ${
                isOpen 
                  ? 'border-blue-400 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
              }`}
              style={{ 
                // Prevent grid row issues during expansion
                gridRowStart: 'auto',
                alignSelf: 'start'
              }}
            >
              <button
                className="w-full px-5 py-4 text-left flex items-start justify-between gap-3 focus:outline-none"
                onClick={() => toggleItem(index)}
                aria-expanded={isOpen}
              >
                <span className={`font-semibold text-base pr-2 leading-snug transition-colors ${
                  isOpen ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {item.question}
                </span>
                <div className="flex-shrink-0 mt-0.5">
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-blue-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>
              
              {/* Animated content with proper height calculation */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  isOpen 
                    ? 'grid-rows-[1fr] opacity-100' 
                    : 'grid-rows-[0fr] opacity-0'
                }`}
                style={{
                  display: 'grid',
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-4">
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FAQ;
