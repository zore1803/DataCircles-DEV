import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import VendorForm from "../components/vendor/VendorForm";
import BasicDetails from "../components/vendor/BasicDetails";
import PaymentsTable from "../components/vendor/PaymentsTable";
import NoteSection from "../components/vendor/NoteSection";
import VendorCalendar from "../components/vendor/VendorCalendar";
import VendorMeetingsTable from "../components/vendor/VendorMeetingsTable";
import VendorTasksTable from "../components/vendor/VendorTasksTable";
import ProfilePicture from "../components/contact/ProfilePicture";
import logo from "/DataCircles.png";
import { Mail, Phone, MapPin, Globe, Maximize2, Minimize2, Twitter, Linkedin, Facebook, Edit2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
const tabsLeft = ["Details", "Payments"];
const tabsRight = ["Notes", "Tasks", "Meetings", "Calendar"];

// Array of cool loading messages
const loadingMessages = [
  "Fetching vendor details — your supply chain, simplified…",
  "Getting vendor insights ready for review…",
  "One sec — organizing all vendor interactions…",
  "Almost done — preparing your vendor dashboard…",
  "Gathering everything about this trusted partner…",
  "Bringing vendor performance data into view…",
  "Loading vendor profile — because partnerships matter."
];

// Select a random message
const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

const VendorDetailsPage = () => {
  const { id } = useParams(); // vendor ID
  const [vendor, setVendor] = useState(null);
  const [payments, setPayments] = useState(null);
  const [vendorFieldList, setVendorFieldList] = useState([]);
  const [activeTabLeft, setActiveTabLeft] = useState("Details");
  const [activeTabRight, setActiveTabRight] = useState("Notes");
  const [isExpanded, setIsExpanded] = useState(false);

  // Form State
  const [showForm, setShowForm] = useState(false);
  // Add this right below your form state
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    category: "Vendor",
    company: "",
    website: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "",
    },
    avatar: "",
    socialMedia: {
      twitter: "",
      linkedin: "",
      facebook: "",
      whatsapp: "",
    },
  });

  // Extracted fetch function so the form can trigger a refresh
  const fetchVendorDetails = async () => {
    try {
      const resVendor = await API.get(`/vendors/${id}`);
      setVendor(resVendor.data);

      const resPayments = await API.get(`/vendors/${id}/payments`);
      setPayments(resPayments.data);

      // 👉 NEW: Fetch vendor custom fields schema
      try {
        const resFields = await API.get("/vendor-fields/latest"); // <-- Verify this endpoint matches your backend route
        const fieldData = resFields.data?.fields || [];
        setVendorFieldList(fieldData);
      } catch (fieldErr) {
        console.error("Failed to load vendor fields template:", fieldErr);
        // We don't want to break the whole page if just the custom fields fail
      }

    } catch (err) {
      console.error("Failed to load vendor profile:", err);
      toast.error("Failed to load vendor details.");
    }
  };

  useEffect(() => {
    fetchVendorDetails();
  }, [id]);

  // handleEdit logic
  // handleEdit logic
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
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "",
      },
      avatar: vendor.avatar || vendor.logo || "",
      socialMedia: {
        twitter: vendor.socialMedia?.twitter || "",
        linkedin: vendor.socialMedia?.linkedin || "",
        facebook: vendor.socialMedia?.facebook || "",
        whatsapp: vendor.socialMedia?.whatsapp || "",
      },
      gstin: vendor.gstin || "", // Make sure to include GSTIN if you have it
    });

    // 👉 NEW: Extract and format existing custom fields for the form
    const processedFields = {};
    if (vendor.additionalFields) {
      vendor.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalFieldValues(processedFields);

    setShowForm(true);
  };

  // Helper function to check if social media link exists
  const hasSocialLink = (platform) => {
    return vendor?.socialMedia?.[platform] && vendor.socialMedia[platform].trim() !== '';
  };

  // Helper function to open social media link
  const openSocialLink = (platform) => {
    const urlOrNumber = vendor?.socialMedia?.[platform];
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

  // Helper function to format address
  const formatAddress = (address) => {
    if (!address) return "";

    if (typeof address === 'string') {
      return address;
    }

    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state && address.pincode ? `${address.state} ${address.pincode}` : address.state || address.pincode,
      address.country
    ].filter(Boolean);

    return parts.join(', ');
  };

  if (!vendor) {
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
        <VendorForm
          form={form}
          setForm={setForm}
          // 👉 NEW: Pass the states for typing
          additionalFieldValues={additionalFieldValues}
          setAdditionalFieldValues={setAdditionalFieldValues}
          // 👉 FIXED: Map your state to the exact prop name the form expects
          vendorFields={vendorFieldList}
          loading={formLoading}
          setLoading={setFormLoading}
          setError={(message) =>
            toast.error(message || "Failed to save vendor")
          }
          setSuccess={(message) =>
            toast.success(message || "Vendor saved successfully")
          }
          fetchVendors={fetchVendorDetails}
          onRequestClose={() => setShowForm(false)}
        />
      )}
      <div className="mx-auto">
        {/* Two Column Grid - Dynamic 60/40 or 40/60 split */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-300"
          style={{
            gridTemplateColumns: window.innerWidth >= 1024
              ? (isExpanded ? '40% 60%' : '60% 40%')
              : '1fr'
          }}
        >

          {/* LEFT SIDE - Vendor Details & Payments */}
          <div className="space-y-0">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
              <Link to="/vendors" className="text-gray-500 hover:text-blue-600">
                Vendors
              </Link>
              <span className="text-gray-400">·</span>
              <span className="text-gray-700">{vendor.category || "Vendor"}</span>
            </nav>

            {/* Separator */}
            <div className="border-b border-gray-200 mb-4"></div>

            {/* Header Section */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                {/* Profile Picture */}
                <ProfilePicture
                  contact={{
                    name: vendor.name,
                    avatar: vendor.avatar || vendor.logo,
                  }}
                  size="w-16 h-16"
                  textSize="text-2xl"
                />

                {/* Vendor Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {vendor.name}
                  </h1>
                  {vendor.company && (
                    <p className="text-sm text-gray-600 mt-1">{vendor.company}</p>
                  )}

                  {/* Vendor Details */}
                  <div className="flex flex-col gap-1 mt-3">
                    {vendor.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} className="text-gray-400" />
                        <span>{vendor.email}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} className="text-gray-400" />
                        <span>{vendor.phone}</span>
                      </div>
                    )}
                    {vendor.website && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Globe size={14} className="text-gray-400" />
                        <a
                          href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {vendor.website}
                        </a>
                      </div>
                    )}
                    {vendor.address && formatAddress(vendor.address) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={14} className="text-gray-400" />
                        <span>{formatAddress(vendor.address)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Social Media Icons & Edit */}
              <div className="flex items-center gap-1">
                {/* Edit Button */}
                <button
                  onClick={handleEdit}
                  className="flex items-center p-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors border border-blue-200"
                  title="Edit Vendor"
                >
                  <Edit2 size={14} />
                </button>

                {/* Twitter/X */}
                <button
                  disabled={!hasSocialLink('twitter')}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink('twitter') ? "text-blue-400 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink('twitter')}
                  title="X (Twitter)"
                >
                  <Twitter size={16} />
                </button>

                {/* LinkedIn */}
                <button
                  disabled={!hasSocialLink('linkedin')}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink('linkedin') ? "text-blue-600 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink('linkedin')}
                  title="LinkedIn"
                >
                  <Linkedin size={16} />
                </button>

                {/* Facebook */}
                <button
                  disabled={!hasSocialLink('facebook')}
                  className={`
                    p-1.5 rounded-full border bg-white transition-colors
                    ${hasSocialLink('facebook') ? "text-blue-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}
                  `}
                  onClick={() => openSocialLink('facebook')}
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

            {/* Left Tabs - Simple style */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-6">
                {tabsLeft.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTabLeft(tab)}
                    className={`pb-3 text-sm font-medium transition-colors ${activeTabLeft === tab
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Left Content - No background box */}
            <div className="px-1">
              {activeTabLeft === "Details" && (
                <BasicDetails
                  vendor={vendor}
                  payments={payments}
                  vendorFieldList={vendorFieldList} // 👉 NEW PROP
                />
              )}
              {activeTabLeft === "Payments" && (
                <PaymentsTable payments={payments} vendor={vendor} />
              )}
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
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTabRight === tab
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
                {activeTabRight === "Tasks" && <VendorTasksTable vendorId={id} />}
                {activeTabRight === "Meetings" && <VendorMeetingsTable vendorId={id} />}
                {activeTabRight === "Calendar" && <VendorCalendar vendorId={id} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailsPage;
