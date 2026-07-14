// components/vendor/PaymentReceipt.jsx
import React, { useRef } from "react";
import { X, Printer, Download } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas-pro"; // Changed to html2canvas-pro
import jsPDF from "jspdf";

const PaymentReceipt = ({ payment, onClose, companyDetails }) => {
  const receiptRef = useRef(null);

  // Print handler - Updated API
  const handlePrint = useReactToPrint({
    contentRef: receiptRef, // Changed from content function
    documentTitle: `Receipt-${payment._id}`,
    onBeforePrint: () => console.log("Preparing to print..."),
    onAfterPrint: () => console.log("Print complete"),
  });

  // PDF Download handler with error handling
  const handleDownloadPDF = async () => {
    try {
      const element = receiptRef.current;
      if (!element) {
        console.error("Receipt element not found");
        return;
      }

      // Generate canvas with html2canvas-pro
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Receipt-${payment._id}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100002] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header Actions */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-800">
            Payment Receipt
          </h2>
          <div className="flex items-center gap-2">
            {/* <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button> */}
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-8">
          <div
            ref={receiptRef}
            className="bg-white border-2 border-gray-300 p-12 max-w-3xl mx-auto"
            style={{ fontFamily: "Times New Roman, serif" }}
          >
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {companyDetails?.name || "Your Company Name"}
                  </h1>
                  <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
                    {companyDetails?.address || "Company Address"}
                    <br />
                    {companyDetails?.city && `${companyDetails.city}, `}
                    {companyDetails?.state && `${companyDetails.state} - `}
                    {companyDetails?.pincode || ""}
                  </p>
                  {companyDetails?.phone && (
                    <p className="text-sm text-gray-600 mt-1">
                      Phone: {companyDetails.phone}
                    </p>
                  )}
                  {companyDetails?.email && (
                    <p className="text-sm text-gray-600">
                      Email: {companyDetails.email}
                    </p>
                  )}
                  {companyDetails?.gstin && (
                    <p className="text-sm text-gray-600 font-semibold mt-2">
                      GSTIN: {companyDetails.gstin}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="bg-gray-900 text-white px-6 py-3 mb-4">
                    <p className="text-lg font-bold">PAYMENT RECEIPT</p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Receipt No:</span>{" "}
                    {payment._id?.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Date:</span>{" "}
                    {formatDate(payment.createdAt || payment.paymentDate)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Time:</span>{" "}
                    {formatTime(payment.createdAt || payment.paymentDate)}
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Details */}
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {payment.direction === "IN" ? "Received From" : "Paid To"}
              </p>
              <div className="bg-gray-50 border border-gray-200 p-4">
                <p className="text-base font-bold text-gray-900 mb-1">
                  {payment.vendor?.name || "N/A"}
                </p>
                {payment.vendor?.address && (
                  <p className="text-sm text-gray-600">
                    {payment.vendor.address}
                  </p>
                )}
                {payment.vendor?.phone && (
                  <p className="text-sm text-gray-600 mt-1">
                    Phone: {payment.vendor.phone}
                  </p>
                )}
                {payment.vendor?.email && (
                  <p className="text-sm text-gray-600">
                    Email: {payment.vendor.email}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Details Table */}
            <div className="mb-8">
              <table className="w-full border-collapse border-2 border-gray-800">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-800 px-4 py-3 text-left text-sm font-bold text-gray-900">
                      Description
                    </th>
                    <th className="border border-gray-800 px-4 py-3 text-right text-sm font-bold text-gray-900">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-800 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {payment.direction === "IN"
                          ? "Payment Received"
                          : "Payment Made"}
                      </p>
                      <p className="text-xs text-gray-600">
                        Payment Type: {payment.paymentType || "N/A"}
                      </p>
                      <p className="text-xs text-gray-600">
                        Payment Date: {formatDate(payment.paymentDate)}
                      </p>
                      {payment.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          Note: {payment.description}
                        </p>
                      )}
                    </td>
                    <td className="border border-gray-800 px-4 py-3 text-right">
                      <p className="text-base font-bold text-gray-900">
                        ₹{payment.amount?.toFixed(2) || "0.00"}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Amount */}
            <div className="border-t-2 border-gray-800 pt-4 mb-8">
              <div className="flex justify-between items-center">
                <p className="text-base font-bold text-gray-900">
                  TOTAL AMOUNT
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{payment.amount?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>

            {/* Amount in Words */}
            <div className="mb-8 bg-gray-50 border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Amount in Words
              </p>
              <p className="text-sm font-medium text-gray-900">
                {numberToWords(payment.amount)} Rupees Only
              </p>
            </div>

            {/* Payment Method & Reference */}
            {(payment.paymentType || payment.referenceNumber) && (
              <div className="mb-8">
                <div className="grid grid-cols-2 gap-4">
                  {payment.paymentType && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Payment Method
                      </p>
                      <p className="text-sm text-gray-900">
                        {payment.paymentType}
                      </p>
                    </div>
                  )}
                  {payment.referenceNumber && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Reference Number
                      </p>
                      <p className="text-sm text-gray-900">
                        {payment.referenceNumber}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-300 pt-6 mt-8">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500 mb-4">
                    This is a computer-generated receipt and does not require a
                    signature.
                  </p>
                  <p className="text-xs text-gray-500">
                    For any queries, please contact us at{" "}
                    {companyDetails?.email || "your-email@company.com"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Authorized Signature
                  </p>
                  <div className="border-b border-gray-800 w-48 mb-1"></div>
                  <p className="text-xs text-gray-600">
                    {companyDetails?.name || "Company Name"}
                  </p>
                </div>
              </div>
            </div>

            {/* Terms */}
            {companyDetails?.terms && (
              <div className="mt-6 border-t border-gray-300 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Terms & Conditions
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {companyDetails.terms}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to convert numbers to words
const numberToWords = (num) => {
  if (!num || num === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const convertTwoDigit = (n) => {
    if (n < 10) return ones[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };

  const convertThreeDigit = (n) => {
    if (n === 0) return "";
    if (n < 100) return convertTwoDigit(n);
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " and " + convertTwoDigit(n % 100) : "")
    );
  };

  // Changed from const to let
  let integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = "";

  if (integerPart >= 10000000) {
    result += convertThreeDigit(Math.floor(integerPart / 10000000)) + " Crore ";
    integerPart %= 10000000;
  }
  if (integerPart >= 100000) {
    result += convertTwoDigit(Math.floor(integerPart / 100000)) + " Lakh ";
    integerPart %= 100000;
  }
  if (integerPart >= 1000) {
    result += convertTwoDigit(Math.floor(integerPart / 1000)) + " Thousand ";
    integerPart %= 1000;
  }
  if (integerPart > 0) {
    result += convertThreeDigit(integerPart);
  }

  if (decimalPart > 0) {
    result += " and " + convertTwoDigit(decimalPart) + " Paise";
  }

  return result.trim();
};


export default PaymentReceipt;
