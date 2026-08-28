import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Building,
  Users,
  CreditCard,
  Layout,
  Briefcase,
  Contact,
  Database,
  ArrowLeft,
  HelpCircle,
  Workflow,
  Mail,
  Settings as SettingsIcon,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Globe,
  ExternalLink,
  ListChecks,
  CalendarClock,
} from "lucide-react";
import KanbanSettings from "../components/settings/KanbanSettings";
import CompanyFieldSettings from "../components/settings/CompanyFieldSettings";
import ContactFieldSettings from "../components/settings/ContactFieldSettings";
import DealFieldSettings from "../components/settings/DealFieldSettings";
import HelpCenter from "../components/settings/HelpCenter";
import VendorFieldSettings from "../components/settings/VendorFieldSettings";
import TaskFieldSettings from "../components/settings/TaskFieldSettings";
import MeetingFieldSettings from "../components/settings/MeetingFieldSettings";
import EmailNotifications from "../components/settings/EmailNotifications";
import logo from "/DataCircles.png";

// Array of cool loading messages relevant for dashboard
const loadingMessages = [
  "Fetching your personalized CRM settings…",
  "Loading configuration modules — almost there!",
  "Preparing your workspace preferences…",
  "Syncing user permissions and settings…",
  "Optimizing your CRM environment…",
  "Just a moment — setting up your controls!",
  "Loading billing, branding, and customization tools…",
  "Bringing your settings dashboard to life…",
  "Fetching admin configurations securely…",
  "DataCircles is tuning your preferences for peak performance.",
];

// Select a random message
const randomMessage =
  loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

const BasicSettings = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      navigate("/login");
      return;
    }

    // Simulate loading settings data
    const loadSettings = async () => {
      try {
        setLoading(true);
        // Simulate API call or data loading
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Determine active section from URL params
        const sectionId = params.section;
        if (sectionId) {
          const selectedItem = settingsItems.find(
            (item) => item.id === sectionId
          );
          if (selectedItem) {
            setActiveSection(selectedItem);
          } else {
            navigate("/settings");
          }
        } else {
          setActiveSection(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [navigate, params.section]);

  const settingsItems = [
    {
      id: "kanban",
      icon: <Layout className="w-5 h-5" />,
      label: "Kanban Settings",
      description: "Configure kanban board layouts",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      hoverBg: "hover:bg-amber-50",
      component: <KanbanSettings />,
      category: "Customization",
    },
    {
      id: "company-fields",
      icon: <Database className="w-5 h-5" />,
      label: "Company Fields",
      description: "Customize company data fields",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      borderColor: "border-cyan-200",
      hoverBg: "hover:bg-cyan-50",
      component: <CompanyFieldSettings />,
      category: "Customization",
    },
    {
      id: "contact-fields",
      icon: <Contact className="w-5 h-5" />,
      label: "Contact Fields",
      description: "Customize contact data fields",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      hoverBg: "hover:bg-indigo-50",
      component: <ContactFieldSettings />,
      category: "Customization",
    },
    {
      id: "deal-fields",
      icon: <Briefcase className="w-5 h-5" />,
      label: "Deal Fields",
      description: "Customize deal and opportunity fields",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      hoverBg: "hover:bg-orange-50",
      component: <DealFieldSettings />,
      category: "Customization",
    },
    {
      id: "vendor-fields",
      icon: <Workflow className="w-5 h-5" />,
      label: "Vendor Fields",
      description: "Customize vendor data fields",
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      borderColor: "border-pink-200",
      hoverBg: "hover:bg-pink-50",
      component: <VendorFieldSettings />,
      category: "Customization",
    },
    {
      id: "task-fields",
      icon: <ListChecks className="w-5 h-5" />,
      label: "Task Fields",
      description: "Customize task data fields",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      hoverBg: "hover:bg-blue-50",
      component: <TaskFieldSettings />,
      category: "Customization",
    },
    {
      id: "meeting-fields",
      icon: <CalendarClock className="w-5 h-5" />,
      label: "Meeting Fields",
      description: "Customize meeting data fields",
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      hoverBg: "hover:bg-violet-50",
      component: <MeetingFieldSettings />,
      category: "Customization",
    },
    {
      id: "email-notifications",
      icon: <Mail className="w-5 h-5" />,
      label: "Email Notifications",
      description: "Configure automatic email triggers",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
      hoverBg: "hover:bg-teal-50",
      component: <EmailNotifications />,
      category: "General",
    },
    {
      id: "help-center",
      icon: <HelpCircle className="w-5 h-5" />,
      label: "Help Center",
      description: "Browse help articles and FAQs",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      borderColor: "border-cyan-200",
      hoverBg: "hover:bg-cyan-50",
      component: <HelpCenter />,
      category: "Support",
    },
  ];

  const handleItemClick = (item) => {
    if (item.id === "help-center") {
      window.open("https://help.datacircles.in/en", "_blank");
    } else {
      navigate(`/settings/${item.id}`);
    }
  };

  const goBack = () => {
    navigate("/settings");
  };

  // Group settings by category
  const groupedSettings = settingsItems.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const categoryOrder = ["General", "Customization", "Support"];

  const categoryIcons = {
    General: <SettingsIcon className="w-5 h-5" />,
    Customization: <Zap className="w-5 h-5" />,
    Support: <HelpCircle className="w-5 h-5" />,
  };

  // Loading State
  if (loading) {
    return (
      <PageSkeleton variant="generic" />
    );
  }

  if (activeSection) {
    // Matches the admin Settings page's fixed toolbar-strip pattern (Settings.jsx)
    // — flat white background, no outer gutters, title strip aligned with the
    // sidebar switcher — instead of the old gray-gradient/breadcrumb-card layout.
    return (
      <div
        className="min-h-screen bg-white"
        style={{
          marginTop: -24,
          marginLeft: -32,
          marginRight: -32,
          boxSizing: "border-box",
        }}
      >
        <div
          className="fixed right-0 h-16 px-4 sm:px-6 lg:px-8 border-b border-[#E1E4EA] bg-white flex items-center top-[54px] lg:top-16"
          style={{
            left: "var(--sidebar-width, 0px)",
            zIndex: 40,
            minHeight: "64px",
            maxHeight: "64px",
            boxSizing: "border-box",
          }}
        >
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="h-6 w-px bg-gray-200 flex-shrink-0" />
            <div className={`p-2 rounded-lg ${activeSection.bgColor} ${activeSection.color} flex-shrink-0`}>
              {activeSection.icon}
            </div>
            <div className="min-w-0">
              <h1 className="m-0 leading-tight font-bold text-base sm:text-lg text-gray-900 truncate">
                {activeSection.label}
              </h1>
              <p className="m-0 leading-tight text-[10px] sm:text-xs text-gray-500 truncate">
                {activeSection.description}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-[118px] lg:pt-[128px] px-4 sm:px-6 lg:px-8 pb-8">
          {activeSection.component}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div>
        {/* Enhanced Page Header */}
        <div className="mb-6">
          <div className="">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Settings
                  </h1>
                  <p className="text-gray-600 text-sm md:text-base mt-2">
                    Customize and configure your CRM system
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  Staff Panel
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings by Category */}
        <div className="space-y-8">
          {categoryOrder.map((category) => {
            const items = groupedSettings[category];
            if (!items || items.length === 0) return null;

            return (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg shadow-md">
                    <div className="text-white">
                      {categoryIcons[category] || (
                        <SettingsIcon className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {category}
                  </h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                </div>

                {/* Settings Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="group relative flex flex-col bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div
                            className={`p-3 rounded-xl ${item.bgColor} ${item.color} shadow-md group-hover:scale-110 transition-transform duration-300`}
                          >
                            {item.icon}
                          </div>
                          {item.badge && (
                            <span
                              className={`px-2.5 py-1 ${
                                item.badgeColor ||
                                "bg-yellow-100 text-yellow-800"
                              } text-xs font-bold rounded-full flex items-center gap-1 shadow-sm`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {item.badge}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Card Footer */}
                      <div
                        className={`mt-auto px-6 py-3 ${item.bgColor} border-t-2 ${item.borderColor} flex items-center justify-between`}
                      >
                        <span className={`text-xs font-semibold ${item.color}`}>
                          Configure
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 ${item.color} transform group-hover:translate-x-1 transition-transform`}
                        />
                      </div>

                      {/* External link indicator for help center */}
                      {item.id === "help-center" && (
                        <div className="absolute top-3 right-3">
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Help Card */}
        <div className="mt-10">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl border-2 border-blue-500 shadow-xl p-8 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full translate-y-48 -translate-x-48"></div>
            </div>

            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">
                  Need Help?
                </h3>
                <p className="text-blue-100 text-sm md:text-base leading-relaxed">
                  Our support team is here to assist you with any issues you may
                  have. Access our comprehensive help center for guides,
                  tutorials, and FAQs.
                </p>
              </div>
              <button
                onClick={() =>
                  window.open("https://help.datacircles.in/en", "_blank")
                }
                className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-lg hover:shadow-xl font-semibold text-sm group"
              >
                <Globe className="w-5 h-5" />
                Visit Help Center
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicSettings;
import PageSkeleton from "../components/common/PageSkeleton";
