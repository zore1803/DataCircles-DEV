import { useEffect, useState } from "react";
import {
  Download,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Receipt,
  DollarSign,
  Smartphone,
  Wallet,
  Building2,
  RefreshCw,
  AlertCircle,
  IndianRupee,
  IndianRupeeIcon,
  ReceiptIndianRupee,
} from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import BillingTimeline from "./BillingTimeline";
import { GST_RATE } from "../../utils/pricingSnapshot";

// `embedded`: rendered inside the Billing Center, which already shows its own
// Timeline section — hide the tab switcher and force the Payments view so
// the Timeline isn't shown twice on one page.
const BillingHistory = ({ embedded = false } = {}) => {
  const [activeTab, setActiveTab] = useState(embedded ? "payments" : "timeline");
  // Rarely-needed history, collapsed by default when embedded in the Billing
  // Center so the page leads with "what am I paying" rather than a full
  // transaction log. Standalone route keeps both open, as before.
  const [paymentsOpen, setPaymentsOpen] = useState(!embedded);
  const [invoicesOpen, setInvoicesOpen] = useState(!embedded);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const orgId = storedUser?.organization;

      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/api/super-admin/organizations/${orgId}/payments`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      console.log(response.data);
      setPayments(response.data.payments || []);
    } catch (error) {
      console.error("Failed to fetch payment history:", error);
    } finally {
      setLoading(false);
    }
  };

  // Updated to match your schema statuses: created, authorized, captured, refunded, failed
  const getStatusConfig = (status) => {
    const configs = {
      captured: {
        label: "Successful",
        icon: <CheckCircle className="w-4 h-4" />,
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        borderColor: "border-green-200",
      },
      authorized: {
        label: "Successful",
        icon: <Clock className="w-4 h-4" />,
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-200",
      },
      created: {
        label: "Pending",
        icon: <Clock className="w-4 h-4" />,
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-700",
        borderColor: "border-yellow-200",
      },
      refunded: {
        label: "Refunded",
        icon: <RefreshCw className="w-4 h-4" />,
        bgColor: "bg-purple-50",
        textColor: "text-purple-700",
        borderColor: "border-purple-200",
      },
      failed: {
        label: "Failed",
        icon: <XCircle className="w-4 h-4" />,
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
      },
    };
    return configs[status] || configs.created;
  };

  // Payment method icons based on common Indian payment methods
  const getPaymentMethodIcon = (method) => {
    const icons = {
      card: <CreditCard className="w-4 h-4 text-gray-400" />,
      netbanking: <Building2 className="w-4 h-4 text-gray-400" />,
      wallet: <Wallet className="w-4 h-4 text-gray-400" />,
      upi: <Smartphone className="w-4 h-4 text-gray-400" />,
    };
    return icons[method?.toLowerCase()] || <CreditCard className="w-4 h-4 text-gray-400" />;
  };

  // Human-readable payment purpose labels
  const getPaymentForLabel = (paymentFor) => {
    const labels = {
      subscription: "Subscription Renewal",
      upgrade: "Plan Upgrade",
      additional_users: "Additional Users",
      initial: "Initial Subscription",
      upgrade_proration: "Upgrade (Prorated)",
      seat_addition: "Additional Seats",
    };
    return labels[paymentFor] || paymentFor || "Subscription Payment";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatAmount = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const handleDownloadInvoice = (payment) => {
  const doc = new jsPDF();
  const storedUser = JSON.parse(localStorage.getItem("user"));
  
  // Define color palette - professional and subtle
  const primaryColor = [51, 51, 51];
  const accentColor = [37, 99, 235];
  const lightGray = [245, 245, 245];
  const mediumGray = [156, 163, 175];

  // Helper function to format currency
  const formatCurrency = (amount, currency = "INR") => {
    const value = (amount).toFixed(2);
    return `${currency} ${value}`;
  };

  // Load and add logo
  const loadImageAndGeneratePDF = () => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Handle CORS if needed
    
    // For Vite/React - access from public folder
    img.src = "/imagee.png"; // or "/images/DataCircles.png" if in images subfolder
    
    img.onload = function() {
      // ----- HEADER SECTION WITH LOGO -----
      // Add logo (adjust dimensions as needed)
      const logoWidth = 60;
      const logoHeight = 16;
      doc.addImage(img, 'PNG', 20, 19, logoWidth, logoHeight);

      // Company name next to logo
    //   doc.setFontSize(11);
    //   doc.setTextColor(...primaryColor);
    //   doc.setFont("helvetica", "bold");
    //   doc.text("DataCircles CRM", 50, 20);
      
    //   doc.setFontSize(9);
    //   doc.setFont("helvetica", "normal");
    //   doc.setTextColor(...mediumGray);
    //   doc.text("Mumbai, India", 50, 26);

      // Invoice title - right aligned
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...accentColor);
      doc.text("INVOICE", 190, 30, { align: "right" });

      // Thin separator line
      doc.setDrawColor(...mediumGray);
      doc.setLineWidth(0.5);
      doc.line(20, 40, 190, 40);

      // ----- INVOICE DETAILS SECTION -----
      const detailsStartY = 50;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      
      // Left side - Bill To
      doc.setTextColor(...mediumGray);
      doc.text("BILL TO", 20, detailsStartY);
      
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(storedUser?.name || "Customer", 20, detailsStartY + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mediumGray);
      doc.text(storedUser?.email || "", 20, detailsStartY + 12);

      // Right side - Invoice Info
      const rightColX = 120;
      doc.setFontSize(9);
      doc.setTextColor(...mediumGray);
      
      doc.text("Invoice Number:", rightColX, detailsStartY);
      doc.text("Invoice Date:", rightColX, detailsStartY + 6);
      doc.text("Payment Status:", rightColX, detailsStartY + 12);
      
      if (payment.razorpayOrderId) {
        doc.text("Order ID:", rightColX, detailsStartY + 18);
      }

      // Right side values
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "normal");
      
      const invoiceNum = payment.razorpayPaymentId || payment._id;
      doc.text(invoiceNum.substring(0, 25), 190, detailsStartY, { align: "right" });
      doc.text(formatDate(payment.createdAt), 190, detailsStartY + 6, { align: "right" });
      
      // Status with color coding
      const statusUpper = payment.status.toUpperCase();
      if (payment.status === 'captured') {
        doc.setTextColor(34, 197, 94);
      } else if (payment.status === 'refunded') {
        doc.setTextColor(168, 85, 247);
      }
      doc.setFont("helvetica", "bold");
      doc.text(statusUpper, 190, detailsStartY + 12, { align: "right" });
      
      if (payment.razorpayOrderId) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...primaryColor);
        doc.text(payment.razorpayOrderId.substring(0, 20), 190, detailsStartY + 18, { align: "right" });
      }

      // ----- ITEMS TABLE -----
      const tableStartY = payment.razorpayOrderId ? 80 : 74;
      
      autoTable(doc, {
        startY: tableStartY,
        head: [["Description", "Payment Method", "Amount"]],
        body: [
          [
            getPaymentForLabel(payment.paymentFor),
            (payment.method || "Online").toUpperCase(),
            formatCurrency(payment.amount, payment.currency),
          ],
        ],
        theme: "plain",
        headStyles: {
          fillColor: lightGray,
          textColor: primaryColor,
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: { top: 5, right: 8, bottom: 5, left: 8 },
          lineWidth: 0,
        },
        bodyStyles: {
          textColor: primaryColor,
          fontSize: 9,
          cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 50 },
          2: { halign: "right", fontStyle: "bold" },
        },
        styles: {
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
        },
        margin: { left: 20, right: 20 },
      });

      // ----- TOTAL SECTION -----
      const finalY = doc.lastAutoTable.finalY + 10;
      
      doc.setFillColor(...lightGray);
      doc.rect(110, finalY - 5, 80, 15, "F");
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text("Total Amount:", 115, finalY + 3);
      
      doc.setFontSize(12);
      doc.setTextColor(...accentColor);
      doc.text(formatCurrency(payment.amount, payment.currency), 185, finalY + 3, { 
        align: "right" 
      });

      // ----- TRANSACTION DETAILS -----
      if (payment.razorpayPaymentId || payment.razorpayOrderId) {
        const metaStartY = finalY + 25;
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...mediumGray);
        doc.text("TRANSACTION DETAILS", 20, metaStartY);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        
        if (payment.razorpayPaymentId) {
          doc.text(`Payment ID: ${payment.razorpayPaymentId}`, 20, metaStartY + 5);
        }
        if (payment.razorpayOrderId) {
          doc.text(`Order ID: ${payment.razorpayOrderId}`, 20, metaStartY + 10);
        }
      }

      // ----- FOOTER -----
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...mediumGray);
      doc.text("Thank you for your business!", 105, 275, { align: "center" });
      
      doc.setDrawColor(...mediumGray);
      doc.setLineWidth(0.3);
      doc.line(20, 280, 190, 280);

      // ----- SAVE PDF -----
      const fileName = `Invoice_${payment.razorpayPaymentId?.substring(0, 10) || payment._id}_${new Date(payment.createdAt).getFullYear()}.pdf`;
      doc.save(fileName);
    };

    // Error handling if image fails to load
    img.onerror = function() {
      console.error("Failed to load logo image");
      // Generate PDF without logo
      generatePDFWithoutLogo();
    };
  };

  // Fallback function if logo doesn't load
  const generatePDFWithoutLogo = () => {
    // Original code without logo (same as previous implementation)
    // Company name with subtle styling
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("DataCircles CRM", 20, 20);
    
    // ... rest of the code
  };

  // Start the process
  loadImageAndGeneratePDF();
};


  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.razorpayPaymentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.razorpayOrderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.paymentFor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPaymentForLabel(payment.paymentFor).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    if(statusFilter === "captured") {
      return matchesSearch && (payment.status === "captured" || payment.status === "authorized");
    }
    return matchesSearch && matchesStatus;
  });

  // Calculate total spent from captured payments only
  const calculateTotalSpent = () => {
    return payments
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + p.amount, 0);
  };

  // Calculate stats
  const stats = {
    total: payments.length,
    captured: payments.filter((p) => p.status === "captured").length,
    authorized: payments.filter((p) => p.status === "authorized").length,
    failed: payments.filter((p) => p.status === "failed").length,
    refunded: payments.filter((p) => p.status === "refunded").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading billing history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "space-y-6"}>
      {/* Summary Cards — the big stat tiles duplicate what the collapsible
          section headers already say ("Payment History (N)"), so skip them
          when embedded in the Billing Center; keep them on the standalone
          /settings/billing-history-style route where there's no sidebar hero
          already showing "what am I paying." */}
      {!embedded && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-blue-600 rounded-lg shadow-md">
              <ReceiptIndianRupee className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-blue-700 font-semibold mb-1">Total Payments</p>
          <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-green-600 rounded-lg shadow-md">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-green-700 font-semibold mb-1">Total Spent</p>
          <h6 className="text-3xl font-bold text-green-900">
            {formatAmount(calculateTotalSpent())}
          </h6>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-emerald-600 rounded-lg shadow-md">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-emerald-700 font-semibold mb-1">Successful</p>
          <p className="text-3xl font-bold text-emerald-900">{stats.captured + stats.authorized}</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-red-600 rounded-lg shadow-md">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-red-700 font-semibold mb-1">Failed</p>
          <p className="text-3xl font-bold text-amber-900">{stats.failed}</p>
        </div>
      </div>
      )}

      {/* Info Alert for Authorized Payments */}
      {/* {stats.authorized > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                Authorized Payments Pending
              </h4>
              <p className="text-sm text-blue-700">
                You have {stats.authorized} payment(s) in authorized state. These will be
                auto-captured within 3 days or you can manually capture them.
              </p>
            </div>
          </div>
        </div>
      )} */}

      {/* Tab switcher — hidden when embedded in the Billing Center, which
          already has its own Timeline section above this one. */}
      {!embedded && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { id: "timeline", label: "Timeline" },
            { id: "payments", label: "Payments" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "timeline" && <BillingTimeline />}

      {activeTab === "payments" && (
      <>
      {embedded && (
        <button
          onClick={() => setPaymentsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-900">Payment History <span className="text-gray-400 font-normal">({payments.length})</span></span>
          {paymentsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
      )}
      {(!embedded || paymentsOpen) && (
      <>
      {/* Filters and Search */}
      <div className={embedded ? "px-5 pt-1 pb-4" : "bg-white rounded-xl border-2 border-gray-200 p-5 shadow-sm"}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by transaction ID, order ID, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all bg-white font-medium"
            >
              <Filter className="w-4 h-4" />
              <span>
                {statusFilter === "all"
                  ? "All Status"
                  : getStatusConfig(statusFilter).label}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-10">
                {["all", "captured", "created", "failed"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowFilterDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      {status === "all" ? "All Status" : getStatusConfig(status).label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className={embedded ? "border-t border-gray-100 overflow-hidden" : "bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden"}>
        {filteredPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No payment history found
            </h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters or search terms"
                : "Your payment history will appear here once you make a transaction"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map((payment, index) => {
                  const statusConfig = getStatusConfig(payment.status);
                  return (
                    <tr
                      key={payment._id || index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(payment.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="font-mono text-xs text-gray-700 block">
                            {payment.razorpayPaymentId?.substring(0, 25) || "N/A"}
                          </span>
                          {payment.razorpayOrderId && (
                            <span className="font-mono text-xs text-gray-500 block">
                              Order: {payment.razorpayOrderId.substring(0, 20)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 font-medium">
                          {getPaymentForLabel(payment.paymentFor)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.method)}
                          <span className="text-sm text-gray-700 capitalize">
                            {payment.method || "Online"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const base = Math.round(payment.amount / (1 + GST_RATE));
                          const gst = payment.amount - base;
                          return (
                            <div>
                              <h6 className="text-sm font-bold text-gray-900">
                                {formatAmount(payment.amount, payment.currency)}
                              </h6>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Base {formatAmount(base)} + GST {formatAmount(gst)}
                              </p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                        >
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Invoices — its own section, independently collapsible from Payment
          History above. Same `payments` fetch, different lens: "what did I
          pay for, and where's the paperwork" vs. the raw transaction log. */}
      {payments.some((p) => p.status === "captured" || p.status === "authorized") && (
        <>
        {embedded && (
          <button
            onClick={() => setInvoicesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-sm font-semibold text-gray-900">
              Invoices <span className="text-gray-400 font-normal">({payments.filter((p) => p.status === "captured" || p.status === "authorized").length})</span>
            </span>
            {invoicesOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
        )}
        {(!embedded || invoicesOpen) && (
        <div className={embedded ? "px-5 pt-1 pb-4" : "bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5"}>
          {!embedded && <h3 className="text-sm font-bold text-gray-900 mb-3">Invoices</h3>}
          <div className="divide-y divide-gray-100">
            {payments
              .filter((p) => p.status === "captured" || p.status === "authorized")
              .map((payment, index) => (
                <div key={payment._id || index} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <ReceiptIndianRupee className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDate(payment.createdAt)}</p>
                      <p className="text-xs text-gray-500">{getPaymentForLabel(payment.paymentFor)} · {formatAmount(payment.amount, payment.currency)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadInvoice(payment)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all text-xs font-medium border border-blue-200 hover:border-blue-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              ))}
          </div>
        </div>
        )}
        </>
      )}
      </>
      )}
    </div>
  );
};

export default BillingHistory;
