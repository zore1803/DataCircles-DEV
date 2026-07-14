// components/vendor/PaymentReceiptModal.jsx
import React from 'react';
import { X, Download, Printer } from 'lucide-react';

const PaymentReceiptModal = ({ isOpen, onClose, payment, vendor }) => {
  if (!isOpen || !payment) return null;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentId = () => {
    return `${payment.direction === "OUT" ? "PAYOUT" : "PAYIN"}-${payment._id.slice(-6).toUpperCase()}`;
  };

  const handleDownload = () => {
    window.print();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Payment Receipt {getPaymentId()}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Download"
            >
              <Download size={20} />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Print"
            >
              <Printer size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-8 bg-white" id="receipt-content">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-blue-600 mb-2">
              PAYMENT ACKNOWLEDGEMENT
            </h1>
            <div className="text-lg font-semibold text-gray-900">
              {vendor?.company || 'Unsquare'}
            </div>
            <div className="text-sm text-gray-600">
              Mobile: {vendor?.phone || '+919090909098'} | Email: {vendor?.email || 'saiganesh3108@gmail.com'}
            </div>
          </div>

          {/* Payment Details Grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-600 block">Payment#:</span>
                <span className="text-lg font-bold text-gray-900">{getPaymentId()}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 block">Payment Date:</span>
                <span className="text-gray-900 font-medium">
                  {formatDate(payment.paymentDate)} {formatTime(payment.paymentDate)}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 block">Status:</span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  payment.direction === 'OUT' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {payment.direction === 'OUT' ? 'PAID OUT' : 'RECEIVED'}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-600 block">Mode:</span>
                <span className="text-gray-900 font-medium">{payment.paymentType || 'UPI'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 block">Amount:</span>
                <h6 className="text-2xl font-bold text-gray-900">₹{payment.amount?.toFixed(2)}</h6>
              </div>
              {payment.bank && (
                <div>
                  <span className="text-sm font-medium text-gray-600 block">Bank:</span>
                  <span className="text-gray-900 font-medium">{payment.bank}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          {payment.notes && (
            <div className="mb-8">
              <span className="text-sm font-medium text-gray-600 block mb-2">Notes:</span>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <span className="text-gray-900">{payment.notes}</span>
              </div>
            </div>
          )}

          {/* Vendor Details */}
          <div className="border-t border-gray-200 pt-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Details:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600 block">Name:</span>
                <span className="text-gray-900 font-medium">{vendor?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 block">Company:</span>
                <span className="text-gray-900 font-medium">{vendor?.company || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 block">Phone:</span>
                <span className="text-gray-900 font-medium">{vendor?.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 block">Email:</span>
                <span className="text-gray-900 font-medium">{vendor?.email || 'N/A'}</span>
              </div>
              {vendor?.gstin && (
                <div>
                  <span className="text-sm font-medium text-gray-600 block">GSTIN:</span>
                  <span className="text-gray-900 font-medium">{vendor.gstin}</span>
                </div>
              )}
              {vendor?.address && (
                <div>
                  <span className="text-sm font-medium text-gray-600 block">Address:</span>
                  <span className="text-gray-900 font-medium">
                    {[
                      vendor.address.line1,
                      vendor.address.line2,
                      vendor.address.city,
                      vendor.address.state,
                      vendor.address.pincode
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status Stamp */}
          <div className="relative">
            <div className="absolute top-0 right-0 transform rotate-12">
              <div className={`inline-block px-8 py-4 border-4 rounded-lg ${
                payment.direction === 'OUT' 
                  ? 'border-red-500 text-red-500' 
                  : 'border-green-500 text-green-500'
              }`}>
                <span className="text-2xl font-bold opacity-80">
                  {payment.direction === 'OUT' ? 'PAID' : 'RECEIVED'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              This is a computer generated document and requires no signature.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Generated on: {formatDate(new Date())} at {formatTime(new Date())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceiptModal;
