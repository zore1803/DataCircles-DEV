// src/components/company/CompanyQuickView.jsx
import React, { useEffect, useState } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Edit2,
  MapPin,
} from "lucide-react";
import CompanyDetails from "./CompanyDetails";
import NoteSection from "./NoteSection";
import CompanyTasksTable from "./CompanyTasksTable";
import CompanyMeetingsTable from "./CompanyMeetingsTable";
import Folder from "./Folder";
import CompanyCalendar from "./CompanyCalendar";
import ProfilePicture from "../contact/ProfilePicture";
import CompanyForm from "./CompanyForm";
import useCompanyStore from "../../store/useCompanyStore";

const tabs = ["Notes", "Tasks", "Meetings", "Folder", "Calendar"];

const CompanyQuickView = ({ companyId, onClose, onEdit }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Notes");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [companyFieldNames, setCompanyFieldNames] = useState([]);

  const { currentCompanyIds } = useCompanyStore();

  const currentIndex = currentCompanyIds.indexOf(companyId);
  const hasPrev = currentIndex > 0;
  const hasNext =
    currentIndex !== -1 && currentIndex < currentCompanyIds.length - 1;

  const goToPrev = () => {
    if (hasPrev) {
      // Instead of navigate → just load new company
      loadCompany(currentCompanyIds[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      loadCompany(currentCompanyIds[currentIndex + 1]);
    }
  };

  const loadCompany = async (id) => {
    setLoading(true);
    try {
      const [resCompany, resFields] = await Promise.all([
        API.get(`/companies/${id}`),
        API.get("/company-fields"),
      ]);

      setCompany(resCompany.data);
      if (resFields.data?.fields) {
        setCompanyFieldNames(resFields.data.fields);
      }

      // Optional: load related data if needed in quick view
      // const resContacts = await API.get("/contacts");
      // setContacts(resContacts.data.filter(c => c.company?._id === id));
      // etc.

      setLoading(false);
    } catch (err) {
      toast.error("Failed to load company details");
      setLoading(false);
      onClose();
    }
  };

  useEffect(() => {
    if (companyId) {
      loadCompany(companyId);
    }
  }, [companyId]);

  if (!company && !loading) return null;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className="fixed inset-0 bg-black/30 lg:hidden z-[9998]"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full lg:w-[45vw] xl:w-[40vw] 2xl:w-[35vw]
          bg-white shadow-2xl z-[9999] transform transition-transform duration-300
          overflow-y-auto
          ${company ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-900 truncate max-w-[280px]">
              {company?.name || "Company Details"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {currentCompanyIds.length > 1 && (
              <>
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev}
                  className={`p-2 rounded-lg ${hasPrev ? "text-gray-700 hover:bg-gray-100" : "text-gray-300 cursor-not-allowed"}`}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className={`p-2 rounded-lg ${hasNext ? "text-gray-700 hover:bg-gray-100" : "text-gray-300 cursor-not-allowed"}`}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 lg:hidden"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <button
              onClick={() => onEdit(company)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Edit2 size={16} />
              Edit
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[70vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading company details...</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Profile Header */}
            <div className="flex items-start gap-5 mb-8">
              <ProfilePicture
                contact={{ name: company.name, avatar: company.profilePicture }}
                size="w-16 h-16"
                textSize="text-2xl"
              />

              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {company.name}
                </h1>
                {company.industry && (
                  <p className="text-sm text-gray-600 mb-2">
                    {company.industry}
                  </p>
                )}
                {company.address && (
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <MapPin size={14} className="text-gray-400" />
                    {company.address}
                  </p>
                )}
              </div>
            </div>

            {/* Main Details */}
            <CompanyDetails
              data={company}
              contacts={contacts}
              isQuickView={true} // You can pass prop to make it more compact if needed
            />

            {/* Tabs */}
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex overflow-x-auto pb-4 gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                {activeTab === "Notes" && <NoteSection companyId={companyId} />}
                {activeTab === "Tasks" && (
                  <CompanyTasksTable
                    companyId={companyId}
                    setTasks={setTasks}
                  />
                )}
                {activeTab === "Meetings" && (
                  <CompanyMeetingsTable
                    companyId={companyId}
                    setMeetings={setMeetings}
                  />
                )}
                {activeTab === "Folder" && <Folder companyId={companyId} />}
                {activeTab === "Calendar" && (
                  <CompanyCalendar companyId={companyId} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Form Overlay */}
      {showEditForm && company && (
        <CompanyForm
          form={{
            _id: company._id,
            name: company.name,
            industry: company.industry,
            address: company.address,
            website: company.website,
            gstin: company.gstin,
            profilePictureUrl: company.profilePicture,
            // ... add socialMedia etc. if needed
          }}
          setForm={() => {}} // handle inside form
          loading={false}
          companyFieldNames={companyFieldNames}
          additionalFields={{}}
          fetchCompanies={() => loadCompany(companyId)} // refresh after save
          onRequestClose={() => setShowEditForm(false)}
        />
      )}
    </>
  );
};

export default CompanyQuickView;
