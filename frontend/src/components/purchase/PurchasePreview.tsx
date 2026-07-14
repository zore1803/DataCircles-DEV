import React, { useRef, useEffect, useState } from "react";
import API from "../../services/api";

const PurchasePreview = ({ purchase, isOpen, onClose }) => {
  console.log(purchase);
  const printRef = useRef();
  const [branding, setBranding] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && purchase) {
      fetchData();
    }
  }, [isOpen, purchase]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch branding details
      const brandingRes = await API.get("/branding");
      setBranding(brandingRes.data);

      // Fetch vendor details if vendor ID exists
      if (purchase.vendor?._id) {
        const vendorRes = await API.get(`/vendors/${purchase.vendor._id}`);
        setVendor(Array.isArray(vendorRes.data) ? vendorRes.data[0] : vendorRes.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !purchase) return null;

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

  const totalItems = purchase.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const subtotal = purchase.subtotal || 0;
  const totalTax = purchase.totalTax || 0;
  const grandTotal = purchase.grandTotal || subtotal + totalTax;

  const halfRate = purchase.gstRate / 2;
  const cgstAmount = purchase.transactionType === 'intra' ? subtotal * (halfRate / 100) : 0;
  const sgstAmount = purchase.transactionType === 'intra' ? subtotal * (halfRate / 100) : 0;
  const igstAmount = purchase.transactionType === 'inter' ? subtotal * (purchase.gstRate / 100) : 0;

  // Format vendor address
  const getVendorAddress = () => {
    if (!vendor?.address) return 'Address not available';
    const { line1, line2, city, state, pincode, country } = vendor.address;
    return [line1, line2, city, state, pincode, country].filter(Boolean).join(', ');
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
        className="fixed inset-0 bg-black/50 z-[10000] no-print"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
            {/* Header with actions */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 no-print">
              <h2 className="text-xl font-semibold text-gray-900">
                Purchase Preview
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

            {/* Purchase Content */}
            <div ref={printRef} className="print-content p-8 bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-3"></div>
                    <p className="text-gray-600">Loading details...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header Section - No border */}
                  <div className="mb-6 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-900 mb-3">
                          {branding?.companyName || 'Company Name'}
                        </h1>
                        <div className="space-y-0.5 text-xs text-gray-700 max-w-md">
                          {branding?.address && (
                            <p>{branding.address}</p>
                          )}
                          {branding?.mobile && (
                            <p>Mobile: {branding.mobile}</p>
                          )}
                          {branding?.email && (
                            <p>Email: {branding.email}</p>
                          )}
                          {branding?.gstin && (
                            <p>GSTIN: {branding.gstin}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-3">
                          PURCHASE
                        </div>
                        {/* Date section */}
                        <div className="space-y-2 text-left">
                          <div className="flex justify-between gap-4">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Purchase Number:</span>
                            <span className="text-xs font-bold text-gray-900">{purchase.purchaseNumber || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Purchase Date:</span>
                            <span className="text-xs font-bold text-gray-900">{formatDate(purchase.purchaseDate)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Due Date:</span>
                            <span className="text-xs font-bold text-gray-900">
                              {formatDate(purchase.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    {/* Bill From */}
                    <div>
                      <div className="text-xs font-bold text-gray-900 mb-2 uppercase">Bill From</div>
                      <div className="space-y-0.5 text-xs text-gray-700">
                        <div className="font-bold text-gray-900">{branding?.companyName || 'Your Company'}</div>
                        {branding?.address && <div>{branding.address}</div>}
                        {branding?.mobile && <div>Phone: {branding.mobile}</div>}
                        {branding?.email && <div>Email: {branding.email}</div>}
                        {branding?.gstin && <div>GSTIN: {branding.gstin}</div>}
                      </div>
                    </div>

                    {/* Bill To */}
                    <div>
                      <div className="text-xs font-bold text-gray-900 mb-2 uppercase">Bill To</div>
                      <div className="space-y-0.5 text-xs text-gray-700">
                        <div className="font-bold text-gray-900">{vendor?.name || purchase.vendor?.name || 'N/A'}</div>
                        {vendor?.company && <div>{vendor.company}</div>}
                        {vendor?.address && <div>{getVendorAddress()}</div>}
                        {vendor?.phone && <div>Phone: {vendor.phone}</div>}
                        {vendor?.email && <div>Email: {vendor.email}</div>}
                        {vendor?.gstin && <div>GSTIN: {vendor.gstin}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">#</th>
                            <th className="border border-gray-300 px-2 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Item Details</th>
                            <th className="border border-gray-300 px-2 py-2 text-center text-[10px] font-bold text-gray-700 uppercase">HSN/SAC</th>
                            <th className="border border-gray-300 px-2 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Rate (₹)</th>
                            <th className="border border-gray-300 px-2 py-2 text-center text-[10px] font-bold text-gray-700 uppercase">Qty</th>
                            <th className="border border-gray-300 px-2 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchase.items?.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-2 py-2 text-center text-xs">{index + 1}</td>
                              <td className="border border-gray-300 px-2 py-2">
                                <div className="font-semibold text-xs text-gray-900">{item.name}</div>
                                {item.sku && <div className="text-[10px] text-gray-600">SKU: {item.sku}</div>}
                                {item.description && <div className="text-[10px] text-gray-600">{item.description}</div>}
                              </td>
                              <td className="border border-gray-300 px-2 py-2 text-center text-xs">
                                {item.itemId?.hsnSac || item.hsnSac || 'N/A'}
                              </td>
                              <td className="border border-gray-300 px-2 py-2 text-right text-xs font-mono">
                                <h6>{formatCurrency(item.unitPrice)}</h6>
                              </td>
                              <td className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold">
                                {item.quantity}
                              </td>
                              <td className="border border-gray-300 px-2 py-2 text-right text-xs font-mono font-semibold">
                                <h6>{formatCurrency(item.total || (item.quantity * item.unitPrice))}</h6>
                              </td>
                            </tr>
                          ))}
                          {/* Total Items Row */}
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan="4" className="border border-gray-300 px-2 py-1.5 text-right text-xs">
                              Total Items: {totalItems}
                            </td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center text-xs">
                              {totalItems}
                            </td>
                            <td className="border border-gray-300 px-2 py-1.5"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Terms & Conditions + Totals Section - Side by Side */}
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    {/* Left: Terms & Conditions */}
                    <div>
                      <div className="text-xs font-bold text-gray-900 mb-2">Terms & Conditions:</div>
                      <ul className="text-[10px] text-gray-600 space-y-1 list-disc list-inside">
                        <li>Payment is due within the specified due date</li>
                        <li>Please make checks payable to {branding?.companyName || 'Company Name'}</li>
                        <li>Late payments may incur additional charges</li>
                      </ul>
                    </div>

                    {/* Right: Totals */}
                    <div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-xs font-semibold text-gray-700">Subtotal:</span>
                          <h6 className="text-xs font-mono text-gray-900">₹ {formatCurrency(subtotal)}</h6>
                        </div>
                        {purchase.gstRate > 0 && (
                          <>
                            {purchase.transactionType === 'intra' ? (
                              <>
                                <div className="flex justify-between items-center py-1.5">
                                  <span className="text-xs text-gray-700">CGST @ {halfRate}%:</span>
                                  <h6 className="text-xs font-mono text-gray-900">₹ {formatCurrency(cgstAmount)}</h6>
                                </div>
                                <div className="flex justify-between items-center py-1.5">
                                  <span className="text-xs text-gray-700">SGST @ {halfRate}%:</span>
                                  <h6 className="text-xs font-mono text-gray-900">₹ {formatCurrency(sgstAmount)}</h6>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between items-center py-1.5">
                                <span className="text-xs text-gray-700">IGST @ {purchase.gstRate}%:</span>
                                <h6 className="text-xs font-mono text-gray-900">₹ {formatCurrency(igstAmount)}</h6>
                              </div>
                            )}
                          </>
                        )}
                        <div className="border-t-2 border-gray-900 pt-1.5 mt-1.5">
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-sm font-bold text-gray-900">Grand Total:</span>
                            <h6 className="text-base font-bold font-mono text-gray-900">₹ {formatCurrency(grandTotal)}</h6>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-[10px] text-gray-600 italic">
                          <span className="font-semibold">Amount in words:</span> {convertNumberToWords(Math.floor(grandTotal))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer with Signature */}
                  <div className="mt-8 pt-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] text-gray-600 mb-1">Prepared By:</div>
                        <div className="font-semibold text-xs">{branding?.companyName || 'Your Company'}</div>
                      </div>
                      <div className="text-center">
                        <div className="mb-2">
                          {branding?.signatureUrl && (
                            <img
                              src={branding.signatureUrl}
                              alt="Signature"
                              className="max-h-12 mx-auto"
                            />
                          )}
                        </div>
                        <div className="text-[10px] text-gray-600">Authorized Signatory</div>
                        <div className="text-[10px] font-semibold text-gray-800">{branding?.companyName || ''}</div>
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

export default PurchasePreview;
