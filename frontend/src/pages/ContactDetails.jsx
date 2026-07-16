import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import BasicDetails from "../components/contact/BasicDetails";
import NoteSection from "../components/contact/NoteSection";
import CallLogs from "../components/contact/CallLogs";
import Calendar from "../components/contact/Calender";
import MeetingsTable from "../components/contact/MeetingsTable";
import ContactTasksTable from "../components/contact/ContactTasksTable";
import ProfilePicture from "../components/contact/ProfilePicture";
import logo from "/DataCircles.png";
import {
  Mail,
  Phone,
  Building2,
  Maximize2,
  Minimize2,
  Twitter,
  Linkedin,
  Facebook,
  Edit2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  CopyPlus,
  Trash2,
  Plus,
  Video,
  CalendarClock,
  MapPin,
  Target,
} from "lucide-react";
import ContactForm from "../components/contact/ContactForm";
import toast from "react-hot-toast";
import useContactStore from "../store/useContactStore";
import MergeContactModal from "../components/contact/MergeContactModal";
import { formatNumberToIndian } from "../utils/numberFormatter";

const CorporateFareIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 21V3h10v4h10v14H2zm2-2h2v-2H4v2zm0-4h2v-2H4v2zm0-4h2V9H4v2zm0-4h2V5H4v2zm4 12h2v-2H8v2zm0-4h2v-2H8v2zm0-4h2V9H8v2zm0-4h2V5H8v2zm4 12h8V9h-8v2h2v2h-2v2h2v2h-2v2zm4-8h2v2h-2v-2zm0 4h2v2h-2v-2z" />
  </svg>
);

const tabsLeft = ["Details", "Call Logs"];
const tabsRight = ["Notes", "Tasks", "Meetings", "Calendar"];
import { FaWhatsapp } from "react-icons/fa";
// Array of cool loading messages
const loadingMessages = [
  "Pulling up your contact's full story…",
  "Fetching phone, email, and every little detail…",
  "Getting those connections ready for you…",
  "Just a sec — organizing this contact's info…",
  "Bringing your contact into focus…",
  "Loading notes, interactions, and insights…",
  "Piecing together everything about this person…",
  "Almost there — preparing your contact view…",
  "Syncing communication history and details…",
  "Loading contact data — precision meets connection."
];

// Select a random message
const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

const ContactDetailsPage = () => {
  const { id } = useParams(); // contact ID
  const [contact, setContact] = useState(null);
  const [company, setCompany] = useState(null);
  const [deals, setDeals] = useState([]); // Changed from null to []
  const [activeTabLeft, setActiveTabLeft] = useState("Details");
  const [activeTabRight, setActiveTabRight] = useState("Notes");
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const { currentContactIds } = useContactStore();

  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [contactFieldList, setContactFieldList] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]); // Needed for the dropdown in the edit form
  const [additionalValues, setAdditionalValues] = useState({});
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    lifecycleStage: "Lead",
    stageStatus: "New",
    company: "",
    avatar: "",
    socialMedia: {
      twitter: "",
      linkedin: "",
      facebook: "",
    },
  });

  const currentIndex = currentContactIds.indexOf(id);
  const hasPrev = currentIndex > 0;
  const hasNext =
    currentIndex !== -1 && currentIndex < currentContactIds.length - 1;

  const goToPrev = () => {
    if (hasPrev) navigate(`/contacts/${currentContactIds[currentIndex - 1]}`);
  };

  const goToNext = () => {
    if (hasNext) navigate(`/contacts/${currentContactIds[currentIndex + 1]}`);
  };

  const fetchContactDetails = async () => {
    try {
      const resContact = await API.get(`/contacts/${id}`);
      setContact(resContact.data);

      if (resContact.data.company) {
        const resCompany = await API.get(
          `/companies/${resContact.data.company._id}`,
        );
        setCompany(resCompany.data);
      }
    } catch (err) {
      console.error("Failed to load contact profile:", err);
      toast.error("Failed to load contact profile.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchContactDetails();
      try {
        const resContact = await API.get(`/contacts/${id}`);
        setContact(resContact.data);

        if (resContact.data.company) {
          const resCompany = await API.get(`/companies/${resContact?.data?.company._id}`);
          setCompany(resCompany.data);
        }
        const resDeals = await API.get(`/deals/`);

        const resCompanies = await API.get("/companies");
        setAllCompanies(resCompanies.data.companies || resCompanies.data);

        const filterDeals = resDeals.data.filter((deal) => deal?.contact?._id == id);
        setDeals(filterDeals);

        // 👉 FIXED: Use /latest to get the Organization's master template, not just the user's
        const resFields = await API.get("/contact-fields/latest");
        const fieldData = resFields.data?.fields || [];
        setContactFieldList(fieldData);
      } catch (err) {
        console.error("Failed to load contact profile:", err);
      }
    };

    fetchData();
  }, [id]);

  const handleEdit = () => {
    setForm({
      _id: contact._id,
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      lifecycleStage: contact.lifecycleStage || "Lead",
      stageStatus: contact.stageStatus || "New",
      company: contact.company?._id || "",
      avatar: contact.avatar || "",
      socialMedia: {
        twitter: contact.socialMedia?.twitter || "",
        linkedin: contact.socialMedia?.linkedin || "",
        facebook: contact.socialMedia?.facebook || "",
      },
    });

    const processedFields = {};
    if (contact.additionalFields) {
      contact.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalValues(processedFields);
    setShowForm(true);
  };

  // Handle contact updates from child components
  const handleContactUpdate = (updatedContact) => {
    setContact(updatedContact);
  };

  // Handle deal creation - ADD THIS FUNCTION
  const handleDealCreated = (newDeal) => {
    setDeals(prev => [newDeal, ...prev]);
    toast.success("Deal created successfully!");
  };

  // Helper function to check if social media link exists
  const hasSocialLink = (platform) => {
    return contact?.socialMedia?.[platform] && contact.socialMedia[platform].trim() !== '';
  };

  // Helper function to open social media link
  // Helper function to open social media link
  const openSocialLink = (platform) => {
    const urlOrNumber = contact?.socialMedia?.[platform];
    if (urlOrNumber && urlOrNumber.trim() !== '') {
      if (platform === 'whatsapp') {
        // Strip out non-numeric characters (except '+') for the WhatsApp API
        const cleanNumber = urlOrNumber.replace(/[^\d+]/g, '');
        window.open(`https://wa.me/${cleanNumber}`, '_blank', 'noopener,noreferrer');
      } else {
        window.open(urlOrNumber, '_blank', 'noopener,noreferrer');
      }
    }
  };

  if (!contact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <img
            src={logo}
            alt="Loading..."
            className="animate-spin-smooth drop-shadow-lg"
            style={{
              width: "48px",
              height: "48px",
              animationDuration: "1.8s",
              filter: "invert(100%)",
            }}
          />
          <p className="mt-3 text-gray-600 font-medium">
            {randomMessage}
          </p>
        </div>
      </div>
    );
  }

  const handleDeleteContact = async () => {
    if (!window.confirm("Are you sure you want to delete this contact? This action cannot be undone.")) {
      return;
    }
    try {
      await API.delete(`/contacts/${id}`);
      toast.success("Contact deleted successfully");
      navigate("/contacts");
    } catch (err) {
      console.error("Failed to delete contact:", err);
      toast.error(err.response?.data?.error || "Failed to delete contact");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] -mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
      <div
        className="box-border flex items-center justify-between bg-white border-b border-[#E1E4EA]"
        style={{ padding: "12px 24px", height: "72px" }}
      >
        <div className="flex items-center" style={{ gap: "12px" }}>
          <button
            onClick={() => navigate("/contacts")}
            className="flex items-center justify-center bg-white border border-[#E5E5E5] rounded flex-shrink-0"
            style={{ width: "24px", height: "24px", padding: 0, boxSizing: "border-box" }}
            title="Back to Contacts"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 4.13806L4.13805 8.27613L5.08085 7.33333L1.88561 4.13806L5.08085 0.942807L4.13805 0L0 4.13806ZM3.76659 4.13806L7.90465 8.27613L8.84745 7.33333L5.65219 4.13806L8.84745 0.942807L7.90465 0L3.76659 4.13806Z" fill="#0A0A0A" />
            </svg>
          </button>
          <span
            style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "16px", lineHeight: "120%", letterSpacing: "-0.5px", color: "#0E121B" }}
          >
            {contact.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 bg-white rounded-full flex-shrink-0"
            style={{ width: "75px", minHeight: "32px", padding: 0, boxSizing: "border-box", border: "1px solid rgba(31, 41, 55, 0.3)" }}
          >
            <svg width="14" height="15" viewBox="0 0 17 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <path d="M0 17.58V15.08H16.6667V17.58H0ZM3.33333 11.2579H4.36375L11.2804 4.35396L10.7565 3.82208L10.2373 3.31083L3.33333 10.2275V11.2579ZM2.08333 12.5079V9.69542L11.4248 0.366876C11.5455 0.246182 11.6825 0.154862 11.8358 0.0929171C11.989 0.0309727 12.1485 0 12.3142 0C12.48 0 12.6406 0.0309727 12.7958 0.0929171C12.9511 0.154862 13.0934 0.250487 13.2227 0.379793L14.2244 1.39417C14.3537 1.51486 14.4472 1.65313 14.5048 1.80896C14.5624 1.96465 14.5913 2.12563 14.5913 2.29188C14.5913 2.44771 14.562 2.60264 14.5035 2.75667C14.4451 2.91083 14.352 3.05174 14.2244 3.17938L4.89583 12.5079H2.08333ZM11.2804 4.35396L10.7565 3.82208L10.2373 3.31083L11.2804 4.35396Z" fill="#1C1B1F" />
            </svg>
            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "20px", color: "#1F2937", whiteSpace: "nowrap" }}>
              Edit
            </span>
          </button>
          <button
            onClick={handleDeleteContact}
            className="flex items-center justify-center gap-2 rounded-full flex-shrink-0"
            style={{ width: "139px", minHeight: "32px", padding: 0, boxSizing: "border-box", background: "rgba(232, 34, 34, 0.1)", border: "1px solid rgba(232, 34, 34, 0.3)" }}
          >
            <Trash2 className="w-3.5 h-3.5 text-[#E82222] flex-shrink-0" />
            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "20px", color: "#E82222", whiteSpace: "nowrap" }}>
              Delete Contact
            </span>
          </button>
        </div>
      </div>

      <div
        className="box-border flex flex-row items-start bg-white"
        style={{
          padding: "18px 24px",
          gap: "18px",
          height: "216px",
          borderRight: "1px solid #F1F1F5",
          boxShadow: "0px 38px 23px rgba(0, 0, 0, 0.01), 0px 17px 17px rgba(0, 0, 0, 0.02), 0px 4px 9px rgba(0, 0, 0, 0.02)",
        }}
      >
        <div
          className="flex flex-col items-start"
          style={{ width: "345px", height: "175px", gap: "17px" }}
        >
          <div className="flex items-center gap-3">
            <ProfilePicture contact={contact} />
            <span
              style={{ fontFamily: "Inter", fontWeight: 700, fontSize: "20px", lineHeight: "120%", color: "#0E121B" }}
            >
              {contact.name}
            </span>
          </div>

          <div
            className="box-border flex flex-row items-center justify-between rounded-[10px]"
            style={{
              width: "345px",
              height: "67px",
              padding: "16px",
              gap: "10px",
              border: "1px solid #E5E5EC",
              background: "linear-gradient(94.22deg, rgba(255, 255, 255, 0) -7.06%, rgba(179, 204, 255, 0.2) 101.14%), #FFFFFF",
            }}
          >
            <div className="flex flex-col justify-center" style={{ gap: "2px" }}>
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "15px", letterSpacing: "-0.02em", color: "rgba(82, 88, 102, 0.8)" }}>
                Recent Deal Created
              </span>
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "22px", lineHeight: "150%", letterSpacing: "-0.03em", color: "#0E121B" }}>
                {deals.length > 0 ? `₹${formatNumberToIndian(deals[0].amount || 0)}` : "—"}
              </span>
            </div>
            {deals.length > 0 && (
              <Link
                to={`/deals/${deals[0]._id}`}
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "15px", letterSpacing: "-0.02em", color: "#0085FF", flexShrink: 0 }}
              >
                View
              </Link>
            )}
          </div>

          <div className="flex items-center" style={{ gap: "8px", width: "254px", height: "32px" }}>
            <button
              className="flex items-center justify-center gap-1.5 rounded-full flex-shrink-0"
              style={{ width: "174px", height: "32px", padding: 0, boxSizing: "border-box", background: "#0085FF" }}
            >
              <Plus className="w-4 h-4 text-white flex-shrink-0" />
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "20px", color: "#FFFFFF", whiteSpace: "nowrap" }}>
                Create New Deal
              </span>
            </button>
            <button
              className="flex items-center justify-center rounded-full bg-white flex-shrink-0"
              style={{ width: "32px", height: "32px", padding: 0, boxSizing: "border-box", border: "1px solid rgba(31, 41, 55, 0.3)" }}
              title="Schedule Video Call"
            >
              <Video className="w-4 h-4 text-[#525252]" />
            </button>
            <button
              className="flex items-center justify-center rounded-full bg-white flex-shrink-0"
              style={{ width: "32px", height: "32px", padding: 0, boxSizing: "border-box", border: "1px solid rgba(31, 41, 55, 0.3)" }}
              title="Schedule Meeting"
            >
              <CalendarClock className="w-4 h-4 text-[#525252]" />
            </button>
          </div>
        </div>

        <div
          className="box-border flex-shrink-0 flex flex-col items-start"
          style={{ width: "642px", height: "198px", borderRadius: "10px" }}
        >
          <div
            className="flex flex-col items-start"
            style={{ width: "641.5px", height: "175px", gap: "8px" }}
          >
            <div
              className="flex flex-row justify-center items-center self-stretch"
              style={{ padding: "8px 0", gap: "16px", height: "33px", borderRadius: "8px" }}
            >
              <div className="flex items-center flex-1" style={{ gap: "8px", height: "17px" }}>
                <span style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 500, fontSize: "14px", lineHeight: "120%", color: "#0A0A0A" }}>
                  Contact Details
                </span>
              </div>
            </div>

            <div style={{ width: "641.5px", height: "1px", background: "rgba(31, 41, 55, 0.2)" }} />

            <div className="relative" style={{ width: "641.5px", height: "148px" }}>
              {[
                { icon: Mail, label: "Email", value: contact.email, left: 0, top: 0 },
                { icon: Phone, label: "Phone", value: contact.phone, left: 216.5, top: 0 },
                { icon: CorporateFareIcon, label: "Company", value: company?.name, left: 433, top: 0 },
                { icon: MapPin, label: "Location", value: contact.address, left: 0, top: 52 },
                { icon: Target, label: "Status", value: contact.stageStatus, left: 216.5, top: 52 },
              ].map(({ icon: Icon, label, value, left, top }) => (
                <div
                  key={label}
                  className="absolute flex flex-row justify-center items-center"
                  style={{ width: "208.5px", height: "44px", left: `${left}px`, top: `${top}px`, padding: "8px", gap: "16px", borderRadius: "8px" }}
                >
                  <div className="flex items-center flex-1" style={{ gap: "8px", height: "28px" }}>
                    <Icon className="w-5 h-5 text-[#525252] flex-shrink-0" />
                    <div className="flex flex-col justify-center items-start" style={{ gap: "2px" }}>
                      <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "10px", lineHeight: "120%", color: "rgba(107, 114, 128, 0.5)" }}>
                        {label}
                      </span>
                      <span className="truncate" style={{ fontFamily: "Inter", fontWeight: 500, fontSize: "12px", lineHeight: "120%", color: "#525252" }}>
                        {value || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col items-start flex-shrink-0"
          style={{ width: "254px", height: "126px", gap: "18px" }}
        >
          <div className="flex flex-col items-start" style={{ width: "254px", height: "94px", gap: "8px" }}>
            <div
              className="flex flex-row justify-center items-center self-stretch"
              style={{ padding: "8px 0", gap: "16px", height: "33px", borderRadius: "8px" }}
            >
              <div className="flex items-center flex-1" style={{ gap: "8px", height: "17px" }}>
                <span style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontWeight: 500, fontSize: "14px", lineHeight: "120%", color: "#0A0A0A" }}>
                  Associated Contacts
                </span>
              </div>
            </div>

            <div style={{ width: "254px", height: "1px", background: "rgba(31, 41, 55, 0.2)" }} />

            <div className="flex flex-col items-start self-stretch" style={{ height: "44px" }}>
              <div
                className="flex flex-row items-center self-stretch"
                style={{ padding: "8px", gap: "16px", height: "44px", borderRadius: "8px" }}
              >
                <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: "12px", color: "rgba(107, 114, 128, 0.8)" }}>
                  No associated contacts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsPage;
