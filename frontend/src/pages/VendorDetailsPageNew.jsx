import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import API from "../services/api";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import useMinDelay from "../hooks/useMinDelay";
import ProfilePicture from "../components/contact/ProfilePicture";
import Skeleton from "../components/common/Skeleton";
import StatTileSkeleton from "../components/common/StatTileSkeleton";
import PaymentsTable from "../components/vendor/PaymentsTable";
import NoteSection from "../components/vendor/NoteSection";
import VendorTasksTable from "../components/vendor/VendorTasksTable";
import VendorMeetingsTable from "../components/vendor/VendorMeetingsTable";
import VendorCalendar from "../components/vendor/VendorCalendar";
import VendorForm from "../components/vendor/VendorForm";
import PageSkeleton from "../components/common/PageSkeleton";
import toast from "react-hot-toast";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Edit2,
  MoreVertical,
  Twitter,
  Linkedin,
  Instagram,
  Eye,
  Receipt,
  CheckSquare,
  Users,
  BriefcaseBusiness,
  Calendar,
  PhoneCall,
  Video,
  FolderOpen,
  Building2,
  FilePlus,
  BadgeCheck
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

/* ─── Tab Configuration ─── */
const tabs = ["Payments", "Notes", "Tasks", "Meetings", "Calendar", "Deals"];

/* ─── Loading Messages ─── */
const loadingMessages = [
  "Fetching vendor details — your supply chain, simplified…",
  "Getting vendor insights ready for review…",
  "One sec — organizing all vendor interactions…",
  "Almost done — preparing your vendor dashboard…",
  "Gathering everything about this trusted partner…",
  "Bringing vendor performance data into view…",
  "Loading vendor profile — because partnerships matter.",
];
const randomMessage =
  loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

/* ─── Financial Summary Icons ─── */
const TotalReceivedIcon = () => (
  <div className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
    <PhoneCall size={18} />
  </div>
);
const TotalPaidIcon = () => (
  <div className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
    <Receipt size={18} />
  </div>
);
const NetBalanceIcon = () => (
  <div className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
    <CheckSquare size={18} />
  </div>
);

/* ─── Reusable UI Components ─── */
const RelationshipGauge = ({ score, label }) => {
  const radius = 60;
  const arcLength = Math.PI * radius;
  const strokeDashoffset = arcLength * (1 - score / 100);
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-semibold text-gray-700 mb-2">Relationship Health</span>
      <div className="relative w-[134px] h-[67px] flex justify-center items-end">
        <svg className="absolute bottom-0 w-[134px] h-[67px] overflow-visible">
          {/* Background Arc */}
          <path
            d="M 7,67 A 60,60 0 0,1 127,67"
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="14"
          />
          {/* Foreground Arc */}
          <path
            d="M 7,67 A 60,60 0 0,1 127,67"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="14"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="flex flex-col items-center z-10 pb-1">
          <span className="text-[20px] font-bold text-blue-600 leading-none">{score}%</span>
          <span className="text-[10px] font-semibold text-gray-900 mt-1">{label}</span>
        </div>
      </div>
    </div>
  );
};

const ActionIconButton = ({ icon: Icon, colorClass, onClick, title }) => (
  <button 
    onClick={onClick}
    title={title}
    className={`w-[34px] h-[34px] rounded-full border border-gray-100 flex items-center justify-center transition-colors hover:bg-gray-50 ${colorClass}`}
  >
    <Icon size={14} strokeWidth={1.5} />
  </button>
);

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR DETAILS PAGE (NEW)
   ═══════════════════════════════════════════════════════════════════════════ */
const VendorDetailsPageNew = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── State ── */
  const [vendor, setVendor] = useState(null);
  const [payments, setPayments] = useState(null);
  const [vendorFieldList, setVendorFieldList] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Tab management (synced to URL)
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState(
    tabs.includes(tabFromUrl) ? tabFromUrl : "Payments"
  );
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { replace: true }
    );
  };

  // Sliding pill indicator
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    const onResize = () => {
      const cur = tabRefs.current[activeTab];
      if (cur) setTabIndicator({ left: cur.offsetLeft, width: cur.offsetWidth });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeTab]);

  // Actions menu
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);

  // Edit form
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    category: "Vendor",
    company: "",
    website: "",
    address: { line1: "", line2: "", city: "", state: "", pincode: "", country: "" },
    avatar: "",
    socialMedia: { twitter: "", linkedin: "", facebook: "", whatsapp: "" },
  });

  // Activity timeline filter
  const [activityFeedFilter, setActivityFeedFilter] = useState("All");

  /* ── Skeleton loading with min-delay ── */
  const showSkeleton = useMinDelay(!dataLoaded, 300);
  useTopLoadingSignal(showSkeleton);

  /* ── Data Fetching ── */
  const fetchVendorDetails = async () => {
    try {
      const resVendor = await API.get(`/vendors/${id}`);
      setVendor(resVendor.data);

      const resPayments = await API.get(`/vendors/${id}/payments`);
      setPayments(resPayments.data);

      try {
        const resFields = await API.get("/vendor-fields/latest");
        const fieldData = resFields.data?.fields || [];
        setVendorFieldList(fieldData);
      } catch (fieldErr) {
        console.error("Failed to load vendor fields template:", fieldErr);
      }
    } catch (err) {
      console.error("Failed to load vendor profile:", err);
      toast.error("Failed to load vendor details.");
    } finally {
      setDataLoaded(true);
    }
  };

  useEffect(() => {
    fetchVendorDetails();
  }, [id]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Helpers ── */
  const hasSocialLink = (platform) =>
    vendor?.socialMedia?.[platform] && vendor.socialMedia[platform].trim() !== "";

  const openSocialLink = (platform) => {
    const urlOrNumber = vendor?.socialMedia?.[platform];
    if (urlOrNumber && urlOrNumber.trim() !== "") {
      if (platform === "whatsapp") {
        const cleanNumber = urlOrNumber.replace(/[^\d+]/g, "");
        window.open(`https://wa.me/${cleanNumber}`, "_blank", "noopener,noreferrer");
      } else {
        window.open(urlOrNumber, "_blank", "noopener,noreferrer");
      }
    }
  };

  const formatAddress = (address) => {
    if (!address) return "";
    if (typeof address === "string") return address;
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state && address.pincode
        ? `${address.state} ${address.pincode}`
        : address.state || address.pincode,
      address.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const handleEdit = () => {
    setForm({
      _id: vendor._id,
      name: vendor.name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      category: vendor.category || "Vendor",
      company: vendor.company || "",
      website: vendor.website || "",
      address: vendor.address || {
        line1: "", line2: "", city: "", state: "", pincode: "", country: "",
      },
      avatar: vendor.avatar || vendor.logo || "",
      socialMedia: {
        twitter: vendor.socialMedia?.twitter || "",
        linkedin: vendor.socialMedia?.linkedin || "",
        facebook: vendor.socialMedia?.facebook || "",
        whatsapp: vendor.socialMedia?.whatsapp || "",
      },
      gstin: vendor.gstin || "",
    });
    const processedFields = {};
    if (vendor.additionalFields) {
      vendor.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalFieldValues(processedFields);
    setShowForm(true);
  };

  /* ── Activity Feed (aggregated from payments/tasks/meetings) ── */
  const activityFeedItems = (() => {
    const items = [];
    if (payments && Array.isArray(payments)) {
      payments.forEach((p) => {
        items.push({
          type: "Payments",
          icon: Receipt,
          iconClass: "bg-green-50 text-green-600",
          title: `Payment ${p.direction === "IN" ? "Received" : "Made"}`,
          subtitle: p.description || p.notes || null,
          date: new Date(p.paymentDate || p.createdAt),
        });
      });
    }
    return items
      .filter((item) => !isNaN(item.date))
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
  })();

  const activityFeedTabs = ["All", "Deals", "Tasks", "Meetings"];
  const filteredActivityFeed =
    activityFeedFilter === "All"
      ? activityFeedItems
      : activityFeedItems.filter((item) => item.type === activityFeedFilter);

  /* ── Financial Summary Calculations ── */
  const totalReceived = payments
    ? payments
        .filter((p) => p.direction === "IN")
        .reduce((sum, p) => sum + (p.amount || 0), 0)
    : 0;
  const totalPaid = payments
    ? payments
        .filter((p) => p.direction === "OUT")
        .reduce((sum, p) => sum + (p.amount || 0), 0)
    : 0;
  const netBalance = vendor?.balance ?? totalReceived - totalPaid;

  const fmtMoney = (n) =>
    `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /* ── Full-page skeleton while data loads ── */
  if (!vendor && showSkeleton) {
    return <PageSkeleton variant="profile" />;
  }

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="min-h-screen bg-white -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 pt-6">
      {/* ── Edit Form Modal ── */}
      {showForm && (
        <VendorForm
          form={form}
          setForm={setForm}
          additionalFieldValues={additionalFieldValues}
          setAdditionalFieldValues={setAdditionalFieldValues}
          vendorFields={vendorFieldList}
          loading={formLoading}
          setLoading={setFormLoading}
          setError={(message) => toast.error(message || "Failed to save vendor")}
          setSuccess={(message) => toast.success(message || "Vendor saved successfully")}
          fetchVendors={fetchVendorDetails}
          onRequestClose={() => setShowForm(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — HEADER (White Background, 3 Columns)
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white px-6 sm:px-8 pt-2 pb-6 border-b border-gray-200">
        <div className="mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative">
          
          {/* LEFT: Vendor Info Stack */}
          <div className="flex items-start gap-4">
            {vendor ? (
              <ProfilePicture
                contact={{ name: vendor.name, avatar: vendor.avatar || vendor.logo }}
                size="w-[56px] h-[56px]"
                textSize="text-xl"
              />
            ) : (
              <div className="w-[56px] h-[56px] rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
            )}
            
            <div className="flex flex-col gap-1 mt-0.5">
              {vendor ? (
                <div className="flex items-center gap-3">
                  <h1 className="text-[22px] font-bold text-gray-900 leading-none">
                    {vendor.name}
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                    Active
                  </span>
                </div>
              ) : (
                <Skeleton width={180} height={28} className="mb-1" />
              )}
              
              {vendor ? (
                <div className="flex flex-col gap-1 mt-1">
                  {vendor.company && (
                    <span className="text-[13px] text-blue-600 font-medium flex items-center gap-2">
                      <Building2 size={14} /> {vendor.company}
                    </span>
                  )}
                  {vendor.email && (
                    <span className="text-[12px] text-gray-600 flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" /> 
                      {vendor.email}
                      <BadgeCheck size={14} className="text-green-500" />
                    </span>
                  )}
                  {vendor.phone && (
                    <span className="text-[12px] text-gray-600 flex items-center gap-2">
                      <Phone size={14} className="text-gray-400" /> {vendor.phone}
                    </span>
                  )}
                  {vendor.address && formatAddress(vendor.address) && (
                    <span className="text-[12px] text-gray-600 flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />{" "}
                      {formatAddress(vendor.address)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Skeleton width={150} height={14} />
                  <Skeleton width={200} height={14} />
                  <Skeleton width={120} height={14} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Action Toolbar + Relationship Health Gauge */}
          <div className="flex flex-col lg:flex-row items-center lg:items-end gap-6 lg:gap-14 w-full lg:w-auto mt-4 lg:mt-0 justify-between lg:justify-end">
            
            {/* Action Toolbar */}
            <div className="flex items-center justify-center gap-3">
              <ActionIconButton icon={PhoneCall} colorClass="text-blue-500" title="Call" />
              <ActionIconButton icon={Mail} colorClass="text-blue-500" title="Email" />
              <ActionIconButton icon={Video} colorClass="text-purple-500" title="Video Meeting" />
              <ActionIconButton icon={FilePlus} colorClass="text-orange-500" title="New Note" />
              <ActionIconButton icon={BriefcaseBusiness} colorClass="text-orange-500" title="Deals" />
              <ActionIconButton 
                icon={Linkedin} 
                colorClass="text-blue-600" 
                title="LinkedIn" 
                onClick={() => openSocialLink("linkedin")}
              />
              
              <div className="relative" ref={actionsMenuRef}>
                <ActionIconButton 
                  icon={MoreVertical} 
                  colorClass="text-gray-500" 
                  title="More Actions"
                  onClick={() => setShowActionsMenu((prev) => !prev)}
                />
                {showActionsMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2">
                    <button
                      onClick={() => {
                        handleEdit();
                        setShowActionsMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <Edit2 size={16} className="text-gray-400" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("Payments");
                        setShowActionsMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <Eye size={16} className="text-gray-400" />
                      View Payments
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Relationship Health Gauge */}
            <div className="hidden sm:flex justify-end">
              <RelationshipGauge score={82} label="Excellent" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-6 sm:px-8 mt-6">
        {/* ═══════════════════════════════════════════════════════════
            SECTION 3 & 5 — TABS & CONTENT
           ═══════════════════════════════════════════════════════════ */}
        {/* TABS */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="relative inline-flex items-center gap-1 h-11 p-1 bg-[#F1F1F5] rounded-full overflow-x-auto">
            <span
              className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-all duration-300 ease-out pointer-events-none"
              style={{ left: tabIndicator.left, width: tabIndicator.width }}
            />
            {tabs.map((tab) => (
              <button
                key={tab}
                ref={(el) => (tabRefs.current[tab] = el)}
                onClick={() => setActiveTab(tab)}
                className={`relative z-10 flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "text-[#0085FF]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div id="tab-actions-portal" className="flex items-center gap-2"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_319px] gap-6">
          
          {/* ── Left Column: Active Tab Content ── */}
          <div className="min-w-0 flex flex-col">
            

            <div className="min-h-[400px]">
            {activeTab === "Payments" && (
              showSkeleton ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton shape="circle" width={32} height={32} />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton width="60%" height={12} />
                        <Skeleton width="30%" height={10} />
                      </div>
                      <Skeleton width={80} height={12} />
                    </div>
                  ))}
                </div>
              ) : (
                <PaymentsTable payments={payments} vendor={vendor} />
              )
            )}

            {activeTab === "Notes" && <NoteSection />}

            {activeTab === "Tasks" && (
              showSkeleton ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                      <Skeleton shape="rounded" width={18} height={18} />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton width="50%" height={12} />
                        <Skeleton width="25%" height={10} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <VendorTasksTable vendorId={id} />
              )
            )}

            {activeTab === "Meetings" && (
              showSkeleton ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                      <Skeleton shape="circle" width={32} height={32} />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton width="50%" height={12} />
                        <Skeleton width="30%" height={10} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <VendorMeetingsTable vendorId={id} />
              )
            )}

            {activeTab === "Calendar" && <VendorCalendar vendorId={id} />}

            {activeTab === "Deals" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BriefcaseBusiness size={40} className="text-gray-300 mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  No Deals Linked
                </h3>
                <p className="text-xs text-gray-400 max-w-xs">
                  Vendor deals feature coming soon. You'll be able to track deals
                  associated with this vendor here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Activity Timeline Sidebar ── */}
          <div className="hidden lg:block">
            <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Activity Timeline
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 mb-4">
                {activityFeedTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivityFeedFilter(tab)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activityFeedFilter === tab
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Feed Items */}
              <div 
                className="space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden" 
                style={{ maxHeight: "340px", scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {showSkeleton ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Skeleton shape="circle" width={28} height={28} className="flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <Skeleton width="75%" height={11} />
                        <Skeleton width="40%" height={10} />
                      </div>
                    </div>
                  ))
                ) : filteredActivityFeed.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No recent activity.
                  </p>
                ) : (
                  filteredActivityFeed.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.iconClass}`}
                      >
                        <item.icon size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-[11px] text-gray-500 truncate">
                            {item.subtitle}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {item.date.toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          •{" "}
                          {item.date.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 6 — FINANCIAL SUMMARY BAR
           ═══════════════════════════════════════════════════════════ */}
        <div className="mt-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Financial Summary
            </h3>
            <button
              onClick={() => setActiveTab("Payments")}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View Payments
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Received */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
              <TotalReceivedIcon />
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500">Total Received</p>
                <p className="text-sm font-semibold text-gray-900">
                  {showSkeleton ? <Skeleton width={80} height={14} /> : fmtMoney(totalReceived)}
                </p>
              </div>
              <span className="ml-auto text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                High
              </span>
            </div>

            {/* Total Paid */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
              <TotalPaidIcon />
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500">Total Paid</p>
                <p className="text-sm font-semibold text-gray-900">
                  {showSkeleton ? <Skeleton width={80} height={14} /> : fmtMoney(totalPaid)}
                </p>
              </div>
              <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                Medium
              </span>
            </div>

            {/* Net Balance */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
              <NetBalanceIcon />
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500">Net Balance</p>
                <p className="text-sm font-semibold text-gray-900">
                  {showSkeleton ? <Skeleton width={80} height={14} /> : fmtMoney(netBalance)}
                </p>
              </div>
              <span
                className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                  netBalance >= 0
                    ? "text-green-600 bg-green-50"
                    : "text-red-600 bg-red-50"
                }`}
              >
                {netBalance >= 0 ? "Receivable" : "You Owe"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailsPageNew;
