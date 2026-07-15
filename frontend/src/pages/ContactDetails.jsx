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
} from "lucide-react";
import ContactForm from "../components/contact/ContactForm";
import toast from "react-hot-toast";
import useContactStore from "../store/useContactStore";
import MergeContactModal from "../components/contact/MergeContactModal";
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

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {showForm && (
        <ContactForm
          form={form}
          setForm={setForm}
          additionalValues={additionalValues}
          setAdditionalValues={setAdditionalValues}
          contactFieldList={contactFieldList}
          companies={allCompanies}
          loading={formLoading}
          setLoading={setFormLoading}
          setError={(message) =>
            toast.error(message || "Failed to save contact")
          }
          setSuccess={(message) =>
            toast.success(message || "Contact saved successfully")
          }
          fetchContacts={fetchContactDetails} // Refreshes the specific contact after saving!
          onRequestClose={() => setShowForm(false)}
        />
      )}

      <div className="mx-auto">
        {/* Two Column Grid - Dynamic 60/40 or 40/60 split */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-300"
          style={{
            gridTemplateColumns:
              window.innerWidth >= 1024
                ? isExpanded
                  ? "40% 60%"
                  : "60% 40%"
                : "1fr",
          }}
        >
          {/* LEFT SIDE - Contact Details & Call Logs */}
          <div className="space-y-0">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between mb-6">
              <nav className="text-sm text-gray-500 flex items-center gap-2">
                <Link
                  to="/contacts"
                  className="text-gray-500 hover:text-blue-600"
                >
                  Contacts
                </Link>
                <span className="text-gray-400">·</span>
                <span className="text-gray-700">
                  {contact.jobTitle || "Contact"}
                </span>
              </nav>

              {/* Prev / Next Buttons */}
              {currentContactIds.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPrev}
                    disabled={!hasPrev}
                    className={`p-1.5 rounded-lg border flex items-center gap-1 text-sm transition-colors ${
                      hasPrev
                        ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    onClick={goToNext}
                    disabled={!hasNext}
                    className={`p-1.5 rounded-lg border flex items-center gap-1 text-sm transition-colors ${
                      hasNext
                        ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="border-b border-gray-200 mb-4"></div>

            {/* Header Section */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                {/* Profile Picture */}
                <ProfilePicture
                  contact={contact}
                  size="w-16 h-16"
                  textSize="text-2xl"
                />

                {/* Contact Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {contact.name}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {contact.jobTitle}
                  </p>

                  {/* Contact Details */}
                  <div className="flex flex-col gap-1 mt-3">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} className="text-gray-400" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} className="text-gray-400" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    {company && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building2 size={14} className="text-gray-400" />
                        <Link
                          to={`/companies/${company._id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {company.name}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Social Media Icons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleEdit}
                  className="flex items-center p-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors border border-blue-200"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="flex items-center p-1.5 bg-orange-50 text-orange-700 rounded-full hover:bg-orange-100 border border-orange-200 text-sm font-medium transition-colors mr-1"
                  title="Merge Duplicate Contact"
                >
                  <CopyPlus size={16} />
                </button>
                {/* Twitter/X */}
                <button
                  disabled={!hasSocialLink("twitter")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("twitter") ? "text-blue-400 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink("twitter")}
                  title="X (Twitter)"
                >
                  <Twitter size={16} />
                </button>

                {/* LinkedIn */}
                <button
                  disabled={!hasSocialLink("linkedin")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("linkedin") ? "text-blue-600 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink("linkedin")}
                  title="LinkedIn"
                >
                  <Linkedin size={16} />
                </button>

                {/* Facebook */}
                <button
                  disabled={!hasSocialLink("facebook")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("facebook") ? "text-blue-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink("facebook")}
                  title="Facebook"
                >
                  <Facebook size={16} />
                </button>

                {/* WhatsApp */}
                <button
                  disabled={!hasSocialLink("whatsapp")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("whatsapp") ? "text-green-600 hover:bg-green-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink("whatsapp")}
                  title="WhatsApp"
                >
                  <FaWhatsapp size={16} />
                </button>
              </div>
            </div>

            {/* Separator */}
            <div className="border-b border-gray-200 mb-6"></div>

            {/* Left Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-6">
                {tabsLeft.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTabLeft(tab)}
                    className={`pb-3 text-sm font-medium transition-colors ${
                      activeTabLeft === tab
                        ? "border-b-2 border-gray-900 text-gray-900"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Left Content */}
            <div className="px-1">
              {activeTabLeft === "Details" && (
                <BasicDetails
                  contact={contact}
                  company={company}
                  deals={deals}
                  contactFieldList={contactFieldList}
                  onContactUpdate={handleContactUpdate}
                  onDealCreated={handleDealCreated}
                />
              )}
              {activeTabLeft === "Call Logs" && <CallLogs contactId={id} />}
            </div>
          </div>

          {/* RIGHT SIDE - Other Components */}
          <div className="space-y-0">
            {/* Right Tabs */}
            <div className="min-h-[85vh] bg-white border border-gray-200 rounded-lg">
              <nav className="flex items-center border-b border-gray-200 overflow-x-auto">
                <div className="flex flex-1">
                  {tabsRight.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTabRight(tab)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                        activeTabRight === tab
                          ? "border-b-2 border-gray-900 text-gray-900 -mb-[1px]"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors border-l border-gray-200"
                  title={isExpanded ? "Collapse (60/40)" : "Expand (40/60)"}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </nav>

              {/* Right Content */}
              <div className="p-6 min-h-[400px]">
                {activeTabRight === "Notes" && <NoteSection />}
                {activeTabRight === "Tasks" && (
                  <ContactTasksTable contactId={id} />
                )}
                {activeTabRight === "Meetings" && (
                  <MeetingsTable contactId={id} />
                )}
                {activeTabRight === "Calendar" && <Calendar contactId={id} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MergeContactModal
        primaryContact={contact}
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onSuccess={() => {
          fetchContactDetails();
        }}
      />
    </div>
  );
};

export default ContactDetailsPage;
