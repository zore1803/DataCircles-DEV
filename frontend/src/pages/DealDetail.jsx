import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { formatNumberToIndian } from "../utils/numberFormatter";
import DealForm from "../components/deal/DealForm";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowLeft,
  Building2,
  User,
  Calendar,
  IndianRupeeIcon,
  FileText,
  Download,
  ExternalLink,
  Trash2,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
  X,
  Check,
  ChevronDown,
  Maximize2,
  Minimize2,
  Edit2
} from "lucide-react";

// --- Assuming these components exist or you will map them to your Deal versions ---
import NoteSection from "../components/contact/NoteSection";
// import DealTasksTable from "../components/deal/DealTasksTable";
// import MeetingsTable from "../components/contact/MeetingsTable";
// import DealCalendar from "../components/deal/DealCalendar";
import BasicDetails from "../components/deal/BasicDetails";
import logo from "/DataCircles.png";

const tabsLeft = ["Details", "Invoices"];
const tabsRight = ["Notes", "Tasks", "Meetings", "Calendar"];

// --- Helper Components ---
const StatusBadge = ({ status }) => {
  const statusConfig = {
    open: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: <Clock className="w-3 h-3" /> },
    won: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    lost: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <XCircle className="w-3 h-3" /> },
    pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <AlertCircle className="w-3 h-3" /> },
    default: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", icon: <AlertCircle className="w-3 h-3" /> },
  };
  const config = statusConfig[status?.toLowerCase()] || statusConfig.default;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.bg} ${config.text} ${config.border}`}>
      {config.icon}
      <span className="capitalize">{status}</span>
    </div>
  );
};

const InfoCard = ({ title, value, icon: Icon, action, description }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="bg-blue-50 p-2 rounded-lg">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      {action}
    </div>
    <div className="mb-1">
      <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
    </div>
    {description && <p className="text-xs text-gray-500 truncate">{description}</p>}
  </div>
);

// --- Simplified Invoice Viewer ---
const InvoiceViewer = ({ isOpen, onClose, invoice, onDownload, onSend }) => {
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (isOpen && invoice) fetchPdf();
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [isOpen, invoice]);

  const fetchPdf = async () => {
    try {
      const response = await API.get(`invoices/download/${invoice._id}`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast.error("Failed to load PDF");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] pt-20 p-4">
      <div className="bg-white rounded-xl w-full h-[90vh] max-w-5xl flex flex-col shadow-2xl">
        <div className="flex justify-between items-center px-5 py-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Invoice #{invoice?.invoiceNumber || "NA"}</h2>
              <p className="text-sm text-gray-600">View invoice details</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex gap-2">
              <button onClick={() => onDownload(invoice._id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
              <button onClick={() => onSend(invoice._id)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><Send className="w-4 h-4" /></button>
            </div>
            <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-hidden">
          {pdfUrl ? (
            <iframe src={pdfUrl} width="100%" height="100%" title="Invoice PDF" className="rounded-lg" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-gray-600 font-medium">Loading PDF...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InvoiceRow = ({ invoice, index, onDownload, onView }) => (
  <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-all">
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
        <FileText className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <p className="font-semibold text-gray-900">#{invoice.invoiceNumber}</p>
        <p className="text-sm text-gray-500">
          {new Date(invoice.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-gray-900">₹{formatNumberToIndian(invoice.amount || 0)}</p>
        <StatusBadge status={invoice.status} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onView?.(invoice)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg" title="View invoice"><Eye className="w-4 h-4" /></button>
        <button onClick={() => onDownload(invoice._id)} className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg" title="Download PDF"><Download className="w-4 h-4" /></button>
      </div>
    </div>
  </div>
);

// --- MAIN PAGE COMPONENT ---
function DealDetail() {
  const { dealId } = useParams();
  const navigate = useNavigate();

  const [deal, setDeal] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [dealFieldList, setDealFieldList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Layout States
  const [activeTabLeft, setActiveTabLeft] = useState("Details");
  const [activeTabRight, setActiveTabRight] = useState("Notes");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [form, setForm] = useState({
    title: "",
    amount: "",
    status: "Open",
    company: "",
    contact: "",
  });

  // Invoice viewer state
  const [showViewer, setShowViewer] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Owner States
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [searchOwnerQuery, setSearchOwnerQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);

  const currentUserStr = localStorage.getItem("user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;



  const hasEditPermission = () => {
    if (currentUser?.role === 'admin') return true;
    return currentUser?.permissions?.some((p) => p.name.toLowerCase() === 'deals' && p.permission === 'read-write');
  };

  useEffect(() => {
    const fetchTeamUsers = async () => {
      if (!hasEditPermission()) return;
      try {
        const response = await API.get("/auth/all-user");
        setAvailableUsers(response.data.allUsers || []);
      } catch (error) {
        console.error("Unable to load team list:", error);
      }
    };
    fetchTeamUsers();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [dealRes, invoiceRes, fieldsRes, companiesRes, contactsRes] = await Promise.all([
        API.get(`/deals/${dealId}`),
        API.get("/invoices"),
        API.get("/deal-fields/latest").catch(() => ({ data: { fields: [] } })),
        API.get("/companies").catch(() => ({ data: { companies: [] } })), // Fetch companies
        API.get("/contacts").catch(() => ({ data: { contacts: [] } }))    // Fetch contacts
      ]);
      setDeal(dealRes.data);
      setInvoices(invoiceRes.data.filter((i) => i.deal._id === dealId));
      setDealFieldList(fieldsRes.data?.fields || []);
      
      // Store dropdown data
      setCompanies(companiesRes.data?.companies || companiesRes.data || []);
      setContacts(contactsRes.data?.contacts || contactsRes.data || []);
    } catch (err) {
      setError("Failed to load deal details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dealId]);

  const handleEdit = () => {
    setForm({
      _id: deal._id,
      title: deal.title || "",
      amount: deal.amount || "",
      status: deal.status || "Open",
      company: deal.company?._id || "",
      contact: deal.contact?._id || "",
    });

    const processedFields = {};
    if (deal.additionalFields) {
      deal.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalFieldValues(processedFields);
    setShowForm(true);
  };

  const handleOwnerChange = async (newOwnerId) => {
    if (!hasEditPermission() || !newOwnerId || deal?.user?._id === newOwnerId) {
      setIsOwnerDropdownOpen(false);
      return;
    }
    try {
      await API.put(`/deals/${dealId}`, { user: newOwnerId });
      toast.success("Owner reassigned successfully.");
      setIsOwnerDropdownOpen(false);
      fetchData(); // Refresh gracefully instead of window.reload
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update owner.");
      }
    }
  };

  const downloadPDF = async (id) => {
    try {
      const response = await API.get(`invoices/download/${id}`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Invoice downloaded successfully`);
    } catch (error) {
      toast.error(`Failed to download invoice`);
    }
  };

  const handleSend = async (id) => {
    try {
      const response = await API.get(`invoices/download/${id}`, { responseType: "blob" });
      const file = new File([response.data], `invoice-${id}.pdf`, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Share Invoice", text: "Here is the invoice PDF" });
        toast.success("Shared successfully");
      } else {
        toast.error("Sharing not supported in this browser");
      }
    } catch (error) {
      toast.error("Failed to prepare invoice for sharing");
    }
  };

  const handleDelete = async () => {
    toast((t) => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h4 className="font-semibold text-gray-900">Delete Deal</h4>
        </div>
        <p className="text-sm text-gray-600">Are you sure you want to delete "{deal.title}"? This action cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            try {
              await API.delete(`/deals/${dealId}`);
              toast.success("Deal deleted successfully");
              navigate("/deals");
            } catch (error) {
              if (error.response?.status === 402) {
                toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
              } else {
                toast.error(error.response?.data?.error || "Failed to delete deal");
              }
            }
          }} className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete Deal</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="flex flex-col items-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div><p>Loading Deal...</p></div>
    </div>
  );

  if (error || !deal) return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
      <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
      <p className="text-gray-600 mb-4">{error || "Deal not found"}</p>
      <button onClick={() => navigate("/deals")} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Back to Deals</button>
    </div>
  );

  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Toaster position="top-right" toastOptions={{ style: { zIndex: 99999 } }} />
      {/* 👉 ADD THIS BLOCK HERE */}
      {showForm && (
        <DealForm
          form={form}
          setForm={setForm}
          additionalFieldValues={additionalFieldValues}
          setAdditionalFieldValues={setAdditionalFieldValues}
          dealFields={dealFieldList}
          companies={companies}
          contacts={contacts}
          loading={formLoading}
          setLoading={setFormLoading}
          fetchDeals={fetchData} 
          onRequestClose={() => setShowForm(false)}
        />
      )}

      {/* WE WILL ADD DEAL FORM MODAL HERE IN STEP 3 */}

      <div className="mx-auto">
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-300"
          style={{ gridTemplateColumns: window.innerWidth >= 1024 ? (isExpanded ? "40% 60%" : "60% 40%") : "1fr" }}
        >
          {/* ======================================= */}
          {/* LEFT SIDE - Details & Invoices         */}
          {/* ======================================= */}
          <div className="space-y-0">
            {/* Breadcrumbs */}
            <div className="flex items-center justify-between mb-6">
              <nav className="text-sm text-gray-500 flex items-center gap-2">
                <Link to="/deals" className="text-gray-500 hover:text-blue-600">Deals</Link>
                <span className="text-gray-400">·</span>
                <span className="text-gray-700 truncate max-w-[200px]">{deal.title}</span>
              </nav>
            </div>

            <div className="border-b border-gray-200 mb-4"></div>

            {/* Header Block */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{deal.title}</h1>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-gray-600">₹{formatNumberToIndian(deal.amount || 0)}</p>
                  <StatusBadge status={deal.status} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleEdit} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200" title="Edit Deal">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={handleDelete} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200" title="Delete Deal">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-gray-200 mb-6"></div>

            {/* Left Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-6">
                {tabsLeft.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTabLeft(tab)}
                    className={`pb-3 text-sm font-medium transition-colors ${activeTabLeft === tab ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Left Content */}
            <div className="px-1">

              {/* TAB: DETAILS */}
              {activeTabLeft === "Details" && (
                <BasicDetails
                  deal={deal}
                  dealFieldList={dealFieldList}
                />
              )}

              {/* TAB: INVOICES */}
              {activeTabLeft === "Invoices" && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Linked Invoices</h2>
                        <h6 className="text-sm text-gray-600">
                          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} • Total: ₹{formatNumberToIndian(totalInvoiceAmount)}
                        </h6>
                      </div>
                    </div>
                    {invoices.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                        <TrendingUp className="w-3 h-3" /> Revenue Generated
                      </div>
                    )}
                  </div>

                  {invoices.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
                      <p className="text-gray-600 mb-6">This deal doesn't have any linked invoices. Create an invoice to track payments.</p>
                      <button onClick={() => navigate("/invoices/create", { state: { dealId } })} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                        Create Invoice
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {invoices.map((invoice, index) => (
                        <InvoiceRow key={invoice._id} invoice={invoice} index={index} onDownload={downloadPDF} onView={() => { setSelectedInvoice(invoice); setShowViewer(true); }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ======================================= */}
          {/* RIGHT SIDE - Notes, Tasks, Meetings    */}
          {/* ======================================= */}
          <div className="space-y-0">
            <div className="min-h-[85vh] bg-white border border-gray-200 rounded-lg">
              <nav className="flex items-center border-b border-gray-200 overflow-x-auto">
                <div className="flex flex-1">
                  {tabsRight.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTabRight(tab)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTabRight === tab ? "border-b-2 border-gray-900 text-gray-900 -mb-[1px]" : "text-gray-500 hover:text-gray-900"}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors border-l border-gray-200"
                  title={isExpanded ? "Collapse (60/40)" : "Expand (40/60)"}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </nav>

              <div className="p-6 min-h-[400px]">
                {/* Note: Update these placeholder components with your actual Deal-related components if they differ from contacts */}
                {activeTabRight === "Notes" && <NoteSection dealId={dealId} />}
                {activeTabRight === "Tasks" && <p className="text-gray-500 text-center py-10">Tasks integration coming soon...</p>}
                {activeTabRight === "Meetings" && <p className="text-gray-500 text-center py-10">Meetings integration coming soon...</p>}
                {activeTabRight === "Calendar" && <p className="text-gray-500 text-center py-10">Calendar integration coming soon...</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <InvoiceViewer
        isOpen={showViewer}
        onClose={() => { setShowViewer(false); setSelectedInvoice(null); }}
        invoice={selectedInvoice}
        onDownload={downloadPDF}
        onSend={handleSend}
      />
    </div>
  );
}

export default DealDetail;