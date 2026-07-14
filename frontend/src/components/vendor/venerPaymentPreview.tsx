import React, { useRef, useEffect, useState } from "react";
import API from "../../services/api";

const PaymentPreview = ({ payment, isOpen, onClose }) => {
  const printRef = useRef();
  const [branding, setBranding] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && payment) {
      fetchData();
    }
  }, [isOpen, payment]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch branding details
      const brandingRes = await API.get("/branding");
      setBranding(brandingRes.data);

      // Fetch vendor details if vendor ID exists
      if (payment.vendor?._id) {
        const vendorRes = await API.get(`/vendors/${payment.vendor._id}`);
        setVendor(Array.isArray(vendorRes.data) ? vendorRes.data[0] : vendorRes.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount).toFixed(2);
  };

  const convertNumberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertHundreds(num) {
      let result = '';
      if (num > 99) {
        result += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num > 19) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      }
      if (num > 9) {
        result += teens[num - 10] + ' ';
        return result;
      }
      if (num > 0) {
        result += ones[num] + ' ';
      }
      return result;
    }

    if (num === 0) return 'Zero';
    
    let result = '';
    let crores = Math.floor(num / 10000000);
    let lakhs = Math.floor((num % 10000000) / 100000);
    let thousands = Math.floor((num % 100000) / 1000);
    let hundreds = num % 1000;

    if (crores > 0) {
      result += convertHundreds(crores) + 'Crore ';
    }
    if (lakhs > 0) {
      result += convertHundreds(lakhs) + 'Lakh ';
    }
    if (thousands > 0) {
      result += convertHundreds(thousands) + 'Thousand ';
    }
    if (hundreds > 0) {
      result += convertHundreds(hundreds);
    }

    return result.trim() + ' Rupees Only.';
  };

  // Format vendor address
  const getVendorAddress = () => {
    if (!vendor?.address) return 'Address not available';
    const { line1, line2, city, state, pincode, country } = vendor.address;
    return [line1, line2, city, state, pincode, country].filter(Boolean).join(', ');
  };

  const getDirectionLabel = () => {
    return payment.direction === 'IN' ? 'Payment Received' : 'Payment Made';
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 5mm;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div 
        className="fixed inset-0 min-h-screen bg-black/50 z-[10000] no-print" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[10001] overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            {/* Header with actions */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 no-print">
              <h2 className="text-xl font-semibold text-gray-900">
                Payment Receipt
              </h2> 
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Payment Content */}
            <div ref={printRef} className="print-content px-12 py-8 bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-3"></div>
                    <p className="text-gray-600">Loading details...</p>
                  </div>
                </div>
              ) : (
                <>
                {/* Header Section */}
                  <div className="mb-8 pb-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-900 mb-3">
                          {branding?.companyName || 'Company Name'}
                        </h1>
                        <div className="space-y-1 text-xs text-gray-700 max-w-md leading-relaxed">
                          {branding?.address && <p>{branding.address}</p>}
                          {branding?.mobile && <p>Mobile: {branding.mobile}</p>}
                          {branding?.email && <p>Email: {branding.email}</p>}
                          {branding?.gstin && <p>GSTIN: {branding.gstin}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-1">
                          PAYMENT RECEIPT
                        </div>
                        <div className="text-xs text-gray-600 mb-6">
                          {getDirectionLabel()}
                        </div>
                        <div className="space-y-2.5 text-left">
                          <div className="flex justify-between gap-6">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Receipt No:</span>
                            <span className="text-xs font-bold text-gray-900">{payment._id?.slice(-8).toUpperCase() || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Payment Date:</span>
                            <span className="text-xs font-bold text-gray-900">{formatDate(payment.paymentDate)}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Payment Type:</span>
                            <span className="text-xs font-bold text-gray-900">{payment.paymentType || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Party Details */}
                  <div className="grid grid-cols-2 gap-12 mb-8">
                    <div>
                      <div className="text-xs font-bold text-gray-900 mb-3 uppercase">
                        {payment.direction === 'IN' ? 'Received From' : 'Paid To'}
                      </div>
                      <div className="space-y-1 text-xs text-gray-700 leading-relaxed">
                        <div className="font-bold text-gray-900">{vendor?.name || payment.vendor?.name || 'N/A'}</div>
                        {vendor?.company && <div>{vendor.company}</div>}
                        {vendor?.address && <div>{getVendorAddress()}</div>}
                        {vendor?.phone && <div>Phone: {vendor.phone}</div>}
                        {vendor?.email && <div>Email: {vendor.email}</div>}
                        {vendor?.gstin && <div>GSTIN: {vendor.gstin}</div>}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-900 mb-3 uppercase">Company Details</div>
                      <div className="space-y-1 text-xs text-gray-700 leading-relaxed">
                        <div className="font-bold text-gray-900">{branding?.companyName || 'Your Company'}</div>
                        {branding?.address && <div>{branding.address}</div>}
                        {branding?.mobile && <div>Phone: {branding.mobile}</div>}
                        {branding?.email && <div>Email: {branding.email}</div>}
                        {branding?.gstin && <div>GSTIN: {branding.gstin}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Table */}
                  <div className="mb-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                            <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 px-4 py-3">
                              <div className="font-semibold text-sm text-gray-900">
                                {payment.direction === 'IN' ? 'Payment Received' : 'Payment Made'}
                              </div>
                              {payment.notes && (
                                <div className="text-xs text-gray-600 mt-1">{payment.notes}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                Payment Method: {payment.paymentType || 'N/A'}
                              </div>
                              {payment.reference && (
                                <div className="text-xs text-gray-500">
                                  Reference: {payment.reference}
                                </div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-right">
                              <h6 className={`text-base font-bold font-mono ${
                                payment.direction === 'IN' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {payment.direction === 'IN' ? '+' : '-'} ₹ {formatCurrency(payment.amount)}
                              </h6>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes & Total Section */}
                  <div className="grid grid-cols-2 gap-12 mb-8">
                    {/* Left: Notes */}
                    <div>
                      <div className="text-xs font-bold text-gray-900 mb-2.5">Notes:</div>
                      <div className="text-xs text-gray-600 leading-relaxed">
                        {payment.notes || 'No additional notes'}
                      </div>
                    </div>

                    {/* Right: Total */}
                    <div>
                      <div className="space-y-2">
                        <div className="border-t-2 border-gray-900 pt-2">
                          <div className="flex justify-between items-center py-2">
                            <span className="text-base font-bold text-gray-900">Total Amount:</span>
                            <h6 className={`text-xl font-bold font-mono ${
                              payment.direction === 'IN' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ₹ {formatCurrency(payment.amount)}
                            </h6>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-xs text-gray-600 italic leading-relaxed">
                          <span className="font-semibold">Amount in words:</span> {convertNumberToWords(Math.floor(payment.amount))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer with Signature */}
                  <div className="mt-12 pt-6">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-xs text-gray-600 mb-1.5">Prepared By:</div>
                        <div className="font-semibold text-sm">{branding?.companyName || 'Your Company'}</div>
                      </div>
                      <div className="text-center">
                        <div className="mb-3">
                          {branding?.signatureUrl && (
                            <img 
                              src={branding.signatureUrl} 
                              alt="Signature" 
                              className="max-h-14 mx-auto"
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-600">Authorized Signatory</div>
                        <div className="text-xs font-semibold text-gray-800">{branding?.companyName || ''}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentPreview;
