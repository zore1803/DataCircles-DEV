import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import CompanyDetails from "../components/company/CompanyDetails";
import Folder from "../components/company/Folder";
import NoteSection from "../components/company/NoteSection";
import CompanyCalendar from "../components/company/CompanyCalendar";
import CompanyTasksTable from "../components/company/CompanyTasksTable";
import CompanyMeetingsTable from "../components/company/CompanyMeetingsTable";
import ProfilePicture from "../components/contact/ProfilePicture";
import toast from "react-hot-toast";
import logo from "/DataCircles.png";
import {
  MapPin,
  Twitter,
  Linkedin,
  Facebook,
  Maximize2,
  Minimize2,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Building2,
  CopyPlus,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import CompanyForm from "../components/company/CompanyForm";
import useCompanyStore from "../store/useCompanyStore";
import SubsidiaryModal from "../components/company/SubsidiaryModal";
import MergeCompanyModal from "../components/company/MergeCompanyModal";

const tabsRight = [
  "Notes",
  "Tasks",
  "Meetings",
  "Folder",
  "Calendar"
];

// Array of cool loading messages
const loadingMessages = [
  "Getting to know your client a little better…",
  "Pulling up everything about this company — hang tight!",
  "Gathering insights and recent updates for you…",
  "Almost there — just connecting the dots…",
  "Loading client vibes and business details…",
  "One sec — organizing everything about this client…",
  "Crunching data to give you the full picture…",
  "Bringing this company's story onto your screen…",
  "Building your client view — good things take a moment."
];

// Select a random message
const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

const CompanyProfilePage = () => {
  const { id } = useParams(); // company ID
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("Notes");
  const [isExpanded, setIsExpanded] = useState(false);

  const { currentCompanyIds } = useCompanyStore();
  const [showSubsidiaryModal, setShowSubsidiaryModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [companyFieldNames, setCompanyFieldNames] = useState([]);
  const [additionalFields, setAdditionalFields] = useState({});
  const [form, setForm] = useState({
    name: "",
    industry: "",
    address: "",
    website: "",
    gstin: "",
    profilePicture: null,
    profilePictureUrl: "",
  });

  const currentIndex = currentCompanyIds.indexOf(id);
  const hasPrev = currentIndex > 0;
  const hasNext =
    currentIndex !== -1 && currentIndex < currentCompanyIds.length - 1;

  const goToPrev = () => {
    if (hasPrev) navigate(`/companies/${currentCompanyIds[currentIndex - 1]}`);
  };

  const goToNext = () => {
    if (hasNext) navigate(`/companies/${currentCompanyIds[currentIndex + 1]}`);
  };

  // SEPARATED FETCH FUNCTION SO WE CAN REFRESH AFTER EDITING
  const fetchCompanyDetails = async () => {
    try {
      const resCompany = await API.get(`/companies/${id}`);
      setCompany(resCompany.data);
    } catch (err) {
      console.error("Failed to load company profile:", err);
      toast.error("Failed to load company profile.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchCompanyDetails();
        const resSubsidiaries = await API.get(`/companies/${id}/subsidiaries`);
        const subsidiaryIds = resSubsidiaries.data.map((sub) => sub._id);
        const resContacts = await API.get("/contacts");
        const resDeals = await API.get("/deals");
        const resMeetings = await API.get("/meetings", { params: { companyId: id } });
        const resTasks = await API.get(`/tasks/company/${id}`);
        const resFields = await API.get("/company-fields");

        setContacts(
          resContacts.data.filter(
            (c) =>
              c.company?._id === id || subsidiaryIds.includes(c.company?._id),
          ),
        );
        setDeals(resDeals.data.filter((d) => d.company?._id === id));
        setMeetings(resMeetings.data.meetings);
        setTasks(resTasks.data || []);
        if (resFields.data) {
          setCompanyFieldNames(resFields.data.fields || []);
        }
      } catch (err) {
        console.error("Failed to load company profile:", err);
        toast.error("Failed to load company profile.");
      }
    };

    fetchData();
  }, [id]);

  const handleEdit = () => {
    setForm({
      _id: company._id,
      name: company.name,
      industry: company.industry,
      gstin: company.gstin || "",
      address: company.address || "",
      website: company.website || "",
      profilePicture: null,
      profilePictureUrl: company.profilePicture || "",
      socialMedia: {
        twitter: company.socialMedia?.twitter || "",
        linkedin: company.socialMedia?.linkedin || "",
        facebook: company.socialMedia?.facebook || "",
        whatsapp: company.socialMedia?.whatsapp || "",
      },
    });

    const processedFields = {};
    if (company.additionalFields) {
      company.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalFields(processedFields);
    setShowForm(true);
  };

  // Helper function to check if social media link exists
  const hasSocialLink = (platform) => {
    return company?.socialMedia?.[platform] && company.socialMedia[platform].trim() !== '';
  };

  // Helper function to open social media link
  const openSocialLink = (platform) => {
    const urlOrNumber = company?.socialMedia?.[platform];
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

  if (!company) {
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
        <CompanyForm
          form={form}
          setForm={setForm}
          loading={formLoading}
          setLoading={setFormLoading}
          companyFieldNames={companyFieldNames}
          additionalFields={additionalFields}
          setAdditionalFields={setAdditionalFields}
          fetchCompanies={fetchCompanyDetails} // Refreshes the specific company after saving!
          onRequestClose={() => setShowForm(false)}
          setError={(msg) => toast.error(typeof msg === 'string' ? msg : "An error occurred")}
          setSuccess={(msg) => toast.success(msg)}
        />
      )}

      <div className="mx-auto">
        {/* Two Column Grid - Dynamic ratio using inline style */}
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
          {/* LEFT SIDE - Company Details */}
          <div className="space-y-0">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between mb-6">
              <nav className="text-sm text-gray-500 flex items-center gap-2">
                <Link
                  to="/companies"
                  className="text-gray-500 hover:text-blue-600"
                >
                  Companies
                </Link>
                <span className="text-gray-400">·</span>
                <span className="text-gray-700">
                  {company.industry || "Business"}
                </span>
              </nav>

              {/* Prev / Next Buttons */}
              {currentCompanyIds.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPrev}
                    disabled={!hasPrev}
                    className={`p-1.5 rounded-lg border flex items-center gap-1 text-sm transition-colors ${hasPrev
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
                    className={`p-1.5 rounded-lg border flex items-center gap-1 text-sm transition-colors ${hasNext
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
              {/* LEFT: Logo + Name + Address */}
              <div className="flex items-start gap-4">
                {/* Logo using ProfilePicture component */}
                <ProfilePicture
                  contact={{
                    name: company.name,
                    avatar: company.profilePicture,
                  }}
                  size="w-14 h-14"
                  textSize="text-xl"
                />

                {/* Title + Address */}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {company.name}
                  </h1>
                  {company.address && (
                    <p className="text-sm text-gray-600 mt-1">
                      {company.address}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: Social Icons */}
              <div className="flex items-center gap-1">
                <button
                  title="Add Subsidary"
                  onClick={() => setShowSubsidiaryModal(true)}
                  className="flex items-center gap-2 p-1.5 bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 border border-indigo-200 text-sm font-medium transition-colors"
                >
                  <Building2 size={16} />
                </button>
                <button
                  title="Edit"
                  onClick={handleEdit}
                  className="flex items-center p-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors border border-blue-200"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="flex items-center gap-2 p-1.5 bg-orange-50 text-orange-700 rounded-full hover:bg-orange-100 border border-orange-200 text-sm font-medium transition-colors mr-1"
                  title="Merge Duplicate Company"
                >
                  <CopyPlus size={16} />
                </button>
                {/* Twitter/X */}
                <button
                  disabled={!hasSocialLink("twitter")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("twitter")
                      ? "text-blue-400 hover:bg-blue-50 border-gray-200 cursor-pointer"
                      : "text-gray-300 cursor-not-allowed border-gray-200"
                    }
                  `}
                  onClick={() => openSocialLink("twitter")}
                  title={
                    hasSocialLink("twitter")
                      ? "View Twitter/X profile"
                      : "No Twitter/X link available"
                  }
                >
                  <Twitter size={16} />
                </button>

                {/* LinkedIn */}
                <button
                  disabled={!hasSocialLink("linkedin")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("linkedin")
                      ? "text-blue-600 hover:bg-blue-50 border-gray-200 cursor-pointer"
                      : "text-gray-300 cursor-not-allowed border-gray-200"
                    }
                  `}
                  onClick={() => openSocialLink("linkedin")}
                  title={
                    hasSocialLink("linkedin")
                      ? "View LinkedIn profile"
                      : "No LinkedIn link available"
                  }
                >
                  <Linkedin size={16} />
                </button>

                {/* Facebook */}
                <button
                  disabled={!hasSocialLink("facebook")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("facebook")
                      ? "text-blue-700 hover:bg-blue-50 border-gray-200 cursor-pointer"
                      : "text-gray-300 cursor-not-allowed border-gray-200"
                    }
                  `}
                  onClick={() => openSocialLink("facebook")}
                  title={
                    hasSocialLink("facebook")
                      ? "View Facebook page"
                      : "No Facebook link available"
                  }
                >
                  <Facebook size={16} />
                </button>

                {/* WhatsApp */}
                <button
                  disabled={!hasSocialLink("whatsapp")}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink("whatsapp")
                      ? "text-green-600 hover:bg-green-50 border-green-200 cursor-pointer"
                      : "text-gray-300 cursor-not-allowed border-gray-200"
                    }
                  `}
                  onClick={() => openSocialLink("whatsapp")}
                  title={
                    hasSocialLink("whatsapp")
                      ? "Chat on WhatsApp"
                      : "No WhatsApp number available"
                  }
                >
                  <FaWhatsapp size={16} />
                </button>
              </div>
            </div>

            {/* Location */}
            {company.location && (
              <div className="flex items-center gap-2 text-gray-600 mb-6">
                <MapPin size={16} className="text-gray-400" />
                <span className="text-xs">{company.location}</span>
              </div>
            )}

            {/* Separator */}
            <div className="border-b border-gray-200 mb-6"></div>

            {/* Company Details Content */}
            <div className="px-1">
              <CompanyDetails
                data={company}
                contacts={contacts}
                deals={deals}
                setContacts={setContacts}
                setDeals={setDeals}
                isExpanded={isExpanded}
              />
            </div>
          </div>

          {/* RIGHT SIDE - Tabs Section */}
          <div className="space-y-0">
            {/* Tabs Header */}
            <div className="min-h-[85vh] bg-white border border-gray-200 rounded-lg">
              <nav className="flex items-center border-b border-gray-200 overflow-x-auto">
                <div className="flex flex-1">
                  {tabsRight.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === tab
                        ? "border-b-2 border-blue-600 text-blue-600 -mb-[1px]"
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

              {/* Tab Content */}
              <div className="p-6 min-h-[400px]">
                {activeTab === "Notes" && <NoteSection />}
                {activeTab === "Tasks" && (
                  <CompanyTasksTable companyId={id} setTasks={setTasks} />
                )}
                {activeTab === "Meetings" && (
                  <CompanyMeetingsTable
                    companyId={id}
                    setMeetings={setMeetings}
                  />
                )}
                {activeTab === "Folder" && <Folder />}
                {activeTab === "Calendar" && <CompanyCalendar companyId={id} />}
              </div>
            </div>
          </div>
        </div>
      </div>
      <SubsidiaryModal
        companyId={id}
        isOpen={showSubsidiaryModal}
        onClose={() => setShowSubsidiaryModal(false)}
        onSuccess={() => {
          fetchCompanyDetails();
        }}
      />
      <MergeCompanyModal
        primaryCompany={company}
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onSuccess={() => {
          fetchCompanyDetails();
        }}
      />
    </div>
  );
};

export default CompanyProfilePage;