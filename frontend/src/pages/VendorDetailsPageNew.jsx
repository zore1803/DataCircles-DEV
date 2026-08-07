import React, { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import API from "../services/api";
import { useTopLoadingSignal } from "../components/common/TopLoadingBar";
import useMinDelay from "../hooks/useMinDelay";
import ProfilePicture from "../components/contact/ProfilePicture";
import Skeleton from "../components/common/Skeleton";
import StatTileSkeleton from "../components/common/StatTileSkeleton";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
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
  EyeOff,
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
const tabs = ["Payments", "Notes", "Tasks", "Meetings", "Calendar"];

/* ─── Financial Summary Icons ─── */
const TotalReceivedIcon = () => (
  <div className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
    <PhoneCall size={16} />
  </div>
);
const TotalPaidIcon = () => (
  <div className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
    <Receipt size={16} />
  </div>
);
const NetBalanceIcon = () => (
  <div className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
    <CheckSquare size={16} />
  </div>
);

/* ─── Reusable UI Components ─── */
/* Shared placeholder for every tab's table body. Renders a real <table> so the
   column widths/borders line up edge-to-edge with the tables it stands in for,
   and reuses the common TableSkeletonRows rather than hand-rolling rows. */
export const TabTableSkeleton = () => (
  <div className="bg-white border border-[#E1E4EA] rounded-lg overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1E4EA]">
      <Skeleton width={160} height={14} />
      <div className="flex items-center gap-2">
        <Skeleton width={110} height={32} />
        <Skeleton width={110} height={32} />
      </div>
    </div>
    <table className="w-full border-separate border-spacing-0 text-left">
      <thead className="bg-[#F5F7FA]">
        <tr>
          <th style={{ width: 44 }} className="px-4 py-3 border-b border-r border-[#E1E4EA]">
            <Skeleton width={16} height={16} />
          </th>
          {[190, 150, 150, 150, 130].map((w, i) => (
            <th
              key={i}
              style={{ width: w }}
              className="px-4 py-3 border-b border-r border-[#E1E4EA] last:border-r-0"
            >
              <Skeleton width="70%" height={12} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white">
        <TableSkeletonRows
          numRows={8}
          columns={[190, 150, 150, 150, 130]}
          hasCheckbox
          checkboxWidth={44}
        />
      </tbody>
    </table>
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#E1E4EA]">
      <Skeleton width={180} height={13} />
      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={32} height={32} shape="circle" />
        ))}
      </div>
    </div>
  </div>
);

const RelationshipGauge = ({ score, label, radius = 58, stroke = 13 }) => {
  // Geometry is derived from the radius so the arc, the box and the stroke stay
  // in proportion at any size. The gauge now owns its own full-height column
  // in the header (see the SECTION 1 grid below), so it can afford to be
  // larger than when it had to share a row with the action icons.
  const width = radius * 2 + stroke;
  const height = radius + stroke / 2;
  const startX = stroke / 2;
  const endX = width - stroke / 2;
  const arcLength = Math.PI * radius;
  const strokeDashoffset = arcLength * (1 - score / 100);
  const arcPath = `M ${startX},${height} A ${radius},${radius} 0 0,1 ${endX},${height}`;
  // Font sizes scale with radius so a bigger gauge (full-height header column)
  // reads proportionally larger instead of looking like a small gauge in a
  // huge empty box.
  const scale = radius / 58;

  return (
    <div className="flex flex-col items-center">
      <span
        className="font-semibold text-gray-700 mb-2"
        style={{ fontSize: 13 * scale }}
      >
        Relationship Health
      </span>
      <div
        className="relative flex justify-center items-end"
        style={{ width, height }}
      >
        <svg
          className="absolute bottom-0 overflow-visible"
          style={{ width, height }}
        >
          {/* Background Arc */}
          <path d={arcPath} fill="none" stroke="#e0f2fe" strokeWidth={stroke} strokeLinecap="round" />
          {/* Foreground Arc */}
          <path
            d={arcPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="flex flex-col items-center z-10 pb-0.5">
          <span
            className="font-bold text-blue-600 leading-none"
            style={{ fontSize: 24 * scale }}
          >
            {score}%
          </span>
          <span
            className="font-semibold text-gray-900 mt-1"
            style={{ fontSize: 11 * scale }}
          >
            {label}
          </span>
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
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [vendorFieldList, setVendorFieldList] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

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
  const [showKPI, setShowKPI] = useState(true);

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

  /* ── Data Fetching ──
     The timeline aggregates payments + tasks + meetings + notes, so all four
     are fetched here. Payments/tasks/meetings/notes are fetched with
     allSettled and each defaults to [] on failure (logged to console) — one
     failing feed source degrades that category instead of blanking the whole
     page. Only the core vendor fetch is fatal — if that fails, loadError is
     set so the page can show a clear "couldn't load" state instead of
     silently rendering with vendor=null. */
  const fetchVendorDetails = async () => {
    setLoadError(null);
    try {
      const resVendor = await API.get(`/vendors/${id}`);
      setVendor(resVendor.data);
    } catch (err) {
      console.error("Failed to load vendor profile:", err.response?.status, err.response?.data || err.message);
      setLoadError(err.response?.status === 404 ? "not_found" : "error");
      setDataLoaded(true);
      return;
    }

    const [paymentsRes, tasksRes, meetingsRes, notesRes] = await Promise.allSettled([
      API.get(`/vendors/${id}/payments`),
      API.get(`/tasks/vendor/${id}`),
      API.get("/meetings", { params: { vendorId: id } }),
      API.get(`/vendor-notes/vendor/${id}`),
    ]);

    if (paymentsRes.status === "fulfilled") {
      setPayments(paymentsRes.value.data);
    } else {
      console.error("Failed to load vendor payments:", paymentsRes.reason?.response?.status, paymentsRes.reason?.message);
      setPayments([]);
    }
    if (tasksRes.status === "rejected") {
      console.error("Failed to load vendor tasks:", tasksRes.reason?.response?.status, tasksRes.reason?.message);
    }
    setTasks(tasksRes.status === "fulfilled" ? tasksRes.value.data || [] : []);
    if (meetingsRes.status === "rejected") {
      console.error("Failed to load vendor meetings:", meetingsRes.reason?.response?.status, meetingsRes.reason?.message);
    }
    setMeetings(
      meetingsRes.status === "fulfilled"
        ? meetingsRes.value.data?.meetings || meetingsRes.value.data || []
        : []
    );
    if (notesRes.status === "rejected") {
      console.error("Failed to load vendor notes:", notesRes.reason?.response?.status, notesRes.reason?.message);
    }
    setNotes(notesRes.status === "fulfilled" ? notesRes.value.data || [] : []);

    try {
      const resFields = await API.get("/vendor-fields/latest");
      const fieldData = resFields.data?.fields || [];
      setVendorFieldList(fieldData);
    } catch (fieldErr) {
      console.error("Failed to load vendor fields template:", fieldErr);
    }

    setDataLoaded(true);
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

  /* ── Activity Feed (aggregated from payments/tasks/meetings/notes) ──
     Each source maps to its own date field: payments use paymentDate, tasks
     dueDate, meetings scheduledAt, notes createdAt. */
  const activityFeedItems = useMemo(() => {
    const items = [];

    if (Array.isArray(payments)) {
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

    if (Array.isArray(tasks)) {
      tasks.forEach((t) => {
        items.push({
          type: "Tasks",
          icon: CheckSquare,
          iconClass: "bg-blue-50 text-blue-600",
          title: t.title || "Task",
          subtitle: t.status || t.description || null,
          date: new Date(t.dueDate || t.selectedDate || t.createdAt),
        });
      });
    }

    if (Array.isArray(meetings)) {
      meetings.forEach((m) => {
        items.push({
          type: "Meetings",
          icon: Video,
          iconClass: "bg-purple-50 text-purple-600",
          title: m.title || "Meeting",
          subtitle: m.status || m.meetingType || null,
          date: new Date(m.scheduledAt || m.createdAt),
        });
      });
    }

    if (Array.isArray(notes)) {
      notes.forEach((n) => {
        items.push({
          type: "Notes",
          icon: FilePlus,
          iconClass: "bg-orange-50 text-orange-600",
          title: n.title || "Untitled Note",
          subtitle: String(n.note || "").replace(/<[^>]*>/g, "").trim() || null,
          date: new Date(n.createdAt),
        });
      });
    }

    return items
      .filter((item) => !isNaN(item.date))
      .sort((a, b) => b.date - a.date)
      // Feed is capped for render cost, not for the viewport — the container
      // shows ~4-5 and scrolls, so keep enough behind it to be worth scrolling.
      .slice(0, 25);
  }, [payments, tasks, meetings, notes]);

  // "Deals" dropped — vendor deals aren't a feature yet, so the filter can
  // never match anything. Notes added since the feed now carries them.
  const activityFeedTabs = ["All", "Payments", "Tasks", "Meetings", "Notes"];
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

  /* ── Vendor fetch failed (404 / network / server error) — show a clear
     terminal state instead of silently rendering a half-empty page with
     vendor=null. The actual status/body is logged to console by
     fetchVendorDetails for diagnosis. ── */
  if (!vendor && loadError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <FolderOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {loadError === "not_found" ? "Vendor not found" : "Couldn't load this vendor"}
        </h2>
        <p className="text-sm text-gray-500 max-w-sm">
          {loadError === "not_found"
            ? "This vendor doesn't exist or may have been removed."
            : "Something went wrong while loading this vendor. Check the console for details, or try again."}
        </p>
        <button
          onClick={fetchVendorDetails}
          className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
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
          SECTION 1 — HEADER CARD
          Grid, not a stacked flex: the gauge column is a single grid
          item spanning the full card height (grid rows stretch to the
          tallest sibling by default), so it fills the whole right side
          instead of sharing a row with the action icons. The left
          column stacks info+icons on top and the KPI strip below it —
          only that column gets the horizontal divider, so it never
          cuts across the gauge. Padding kept tight so this card plus
          the tab bar below never forces the page to scroll before the
          table is visible.
         ═══════════════════════════════════════════════════════════ */}
      <div className="px-6 sm:px-8 pt-1">
      <div className="bg-white border border-[#DCEBFC] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_260px]">

        {/* LEFT COLUMN: info row (top) + KPI strip (bottom) */}
        <div className="flex flex-col min-w-0">
          {/* Info row */}
          <div className="flex items-start justify-between gap-4 py-4 pl-5 sm:pl-6 pr-4">
            <div className="flex items-start gap-4 min-w-0">
              {/* Gated on showSkeleton, not just `vendor` — the vendor fetch
                  resolves well before payments/tasks/meetings/notes do, so
                  gating on `vendor` alone made the header pop in with real
                  data while the KPI strip/table/timeline below it were still
                  skeletons. Everything below now flips from skeleton to real
                  content in the same render, like CompanyProfilePage.jsx. */}
              {!showSkeleton && vendor ? (
                <ProfilePicture
                  contact={{ name: vendor.name, avatar: vendor.avatar || vendor.logo }}
                  size="w-[56px] h-[56px]"
                  textSize="text-xl"
                />
              ) : (
                <div className="w-[56px] h-[56px] rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
              )}

              <div className="flex flex-col gap-1 mt-0.5 min-w-0">
                {!showSkeleton && vendor ? (
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

                {!showSkeleton && vendor ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {/* Stacked contact block: one row per field (Company, Email, Phone, Address). */}
                    {vendor.company && (
                      <span className="text-[13px] text-blue-600 font-medium flex items-center gap-2">
                        <Building2 size={14} /> {vendor.company}
                      </span>
                    )}
                    {vendor.email && (
                      <span className="text-[12px] text-gray-600 flex items-center gap-2">
                        <Mail size={14} className="text-gray-400 flex-shrink-0" />
                        {vendor.email}
                        <BadgeCheck size={14} className="text-green-500 flex-shrink-0" />
                      </span>
                    )}
                    {vendor.phone && (
                      <span className="text-[12px] text-gray-600 flex items-center gap-2">
                        <Phone size={14} className="text-gray-400 flex-shrink-0" />
                        {vendor.phone}
                      </span>
                    )}
                    {vendor.address && formatAddress(vendor.address) && (
                      <span className="text-[12px] text-gray-600 flex items-center gap-2">
                        <MapPin size={14} className="text-gray-400 flex-shrink-0" />{" "}
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

            {/* Action Toolbar — moved up next to vendor info now that the
                gauge owns the whole right column. */}
            <div className="flex items-start justify-center gap-2 sm:gap-3 flex-shrink-0">
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
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2">
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
                        setShowKPI((prev) => !prev);
                        setShowActionsMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 text-left"
                    >
                      {showKPI ? (
                        <EyeOff size={16} className="text-gray-400" />
                      ) : (
                        <Eye size={16} className="text-gray-400" />
                      )}
                      {showKPI ? "Hide Financial Summary" : "Show Financial Summary"}
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
          </div>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 2 — FINANCIAL SUMMARY KPI STRIP
              Toggleable via the ⋮ menu's "Hide/Show Financial Summary".
             ═══════════════════════════════════════════════════════════ */}
          {showKPI && (
            <div className="px-5 py-3.5 mt-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Total Received",
                    value: totalReceived,
                    Icon: TotalReceivedIcon,
                    badge: "High",
                    badgeClass: "text-green-600 bg-green-50",
                  },
                  {
                    label: "Total Paid",
                    value: totalPaid,
                    Icon: TotalPaidIcon,
                    badge: "Medium",
                    badgeClass: "text-orange-600 bg-orange-50",
                  },
                  {
                    label: "Net Balance",
                    value: netBalance,
                    Icon: NetBalanceIcon,
                    badge: netBalance >= 0 ? "Receivable" : "You Owe",
                    badgeClass:
                      netBalance >= 0
                        ? "text-green-600 bg-green-50"
                        : "text-red-600 bg-red-50",
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="h-[56px] flex items-center gap-2.5 px-3 bg-white border border-gray-200 rounded-xl min-w-0"
                  >
                    <kpi.Icon />
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-500 truncate">{kpi.label}</p>
                      {/* <div>, not <p>: Skeleton renders a <div>, which is invalid
                          inside a <p> and triggers a DOM-nesting warning. */}
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {showSkeleton ? (
                          <Skeleton width={80} height={14} />
                        ) : (
                          fmtMoney(kpi.value)
                        )}
                      </div>
                    </div>
                    <span
                      className={`ml-auto flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${kpi.badgeClass}`}
                    >
                      {kpi.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Relationship Health Gauge — spans the full card
            height (a single grid item stretches to match the left
            column's height by default) and gets its own tinted
            background so it reads as the highlighted focal point. */}
        <div className="hidden sm:flex flex-col items-center justify-center bg-gradient-to-b from-[#EAF4FF] to-[#F6FAFF] py-6 px-6">
          {showSkeleton ? (
            <div className="flex flex-col items-center gap-3">
              <Skeleton width={130} height={13} />
              <Skeleton width={152} height={76} shape="rect" className="rounded-t-full" />
            </div>
          ) : (
            <RelationshipGauge score={82} label="Excellent" radius={76} stroke={16} />
          )}
        </div>
      </div>
      </div>

      <div className="mx-auto px-6 sm:px-8 mt-3">
        {/* ═══════════════════════════════════════════════════════════
            SECTION 3 & 5 — TABS & CONTENT
           ═══════════════════════════════════════════════════════════ */}
        {/* TABS */}
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
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
                className={`relative z-10 flex items-center justify-center h-9 px-3 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
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

        {/* Sidebar trimmed 272px -> 240px and the gap 6 -> 4, handing ~95px
            back to the table column so its right-most columns (Amount /
            Actions) fit without horizontal scrolling. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
          
          {/* ── Left Column: Active Tab Content ── */}
          <div className="min-w-0 flex flex-col">
            

            <div className="min-h-[400px]">
            {/* One shared, edge-to-edge table skeleton for every tab (built from
                the common TableSkeletonRows) instead of a different hand-rolled
                placeholder per tab, so all four resolve identically off the
                single useMinDelay(300) flag. The tab bar itself is never
                skeletoned — it's navigation, not data. */}
            {showSkeleton ? (
              <TabTableSkeleton />
            ) : (
              <>
                {activeTab === "Payments" && (
                  <PaymentsTable payments={payments} vendor={vendor} />
                )}
                {activeTab === "Notes" && <NoteSection />}
                {activeTab === "Tasks" && <VendorTasksTable vendorId={id} />}
                {activeTab === "Meetings" && <VendorMeetingsTable vendorId={id} />}
                {activeTab === "Calendar" && <VendorCalendar vendorId={id} />}
              </>
            )}
          </div>
        </div>

        {/* ── Right Column: Activity Timeline Sidebar ── */}
          <div className="hidden lg:block">
            <div className="bg-white border border-gray-200 rounded-xl p-3 sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Activity Timeline
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 mb-4 flex-wrap">
                {activityFeedTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivityFeedFilter(tab)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
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
              {/* ~4-5 rows visible, the rest scrolls. Each feed row is roughly
                  56px, so 250px lands just past the 4th and hints there is
                  more below rather than cutting off flush. */}
              <div
                className="space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden"
                style={{ maxHeight: "250px", scrollbarWidth: "none", msOverflowStyle: "none" }}
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

      </div>
    </div>
  );
};

export default VendorDetailsPageNew;
