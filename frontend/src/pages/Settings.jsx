import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
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
  Crown,
  Settings as SettingsIcon,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Bell,
  Globe,
  ExternalLink,
  Receipt,
  Gift,
  FileText,
} from "lucide-react";
import BankDetails from "../components/settings/BankDetails";
import BrandSettings from "../components/settings/BrandSettings";
import AddUser from "../components/settings/AddUser";
import KanbanSettings from "../components/settings/KanbanSettings";
import CompanyFieldSettings from "../components/settings/CompanyFieldSettings";
import ContactFieldSettings from "../components/settings/ContactFieldSettings";
import DealFieldSettings from "../components/settings/DealFieldSettings";
import HelpCenter from "../components/settings/HelpCenter";
import VendorFieldSettings from "../components/settings/VendorFieldSettings";
import FormsList from "../components/settings/FormsList";
import EmailNotifications from "../components/settings/EmailNotifications";
import SubscriptionPlans from "../components/settings/SubscriptionPlans";
import BasicSettings from "./BasicSettings";
import logo from "/DataCircles.png";
import BillingCenter from "../components/settings/BillingCenter";
import Referrals from "../components/settings/Referrals";
import UserManagement from "./UserManagement";

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

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      id: "billing",
      icon: <Receipt className="w-5 h-5" />,
      label: "Billing",
      description: "Your subscription, timeline, invoices & payments in one place",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      hoverBg: "hover:bg-yellow-50",
      component: <BillingCenter />,
      category: "Billing",
      badge: "Premium",
      badgeColor: "bg-yellow-100 text-yellow-800",
    },
    {
      id: "subscription",
      icon: <Crown className="w-5 h-5" />,
      label: "Manage Subscription",
      description: "Change plan, add-ons, or billing cycle",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      hoverBg: "hover:bg-yellow-50",
      component: <SubscriptionPlans />,
      category: "Billing",
    },
    {
      id: "referrals",
      icon: <Gift className="w-5 h-5" />,
      label: "Referrals",
      description: "Invite others and track your referral rewards",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      hoverBg: "hover:bg-purple-50",
      component: <Referrals />,
      category: "Billing",
    },
    {
      id: "users",
      icon: <Users className="w-5 h-5" />,
      label: "User Management",
      description: "Manage user accounts and permissions",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      hoverBg: "hover:bg-green-50",
      component: <UserManagement />,
      category: "General",
    },
    {
      id: "brand",
      icon: <Building className="w-5 h-5" />,
      label: "Brand Settings",
      description: "Configure brand and account settings",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      hoverBg: "hover:bg-blue-50",
      component: <BrandSettings />,
      category: "General",
    },
    {
      id: "bank",
      icon: <CreditCard className="w-5 h-5" />,
      label: "Bank Details",
      description: "Manage banking and payment information",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      hoverBg: "hover:bg-purple-50",
      component: <BankDetails />,
      category: "Billing",
    },
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
      id: "forms",
      icon: <FileText className="w-5 h-5" />,
      label: "Forms",
      description: "Build lead-capture forms and review submissions",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      hoverBg: "hover:bg-emerald-50",
      component: <FormsList />,
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
      category: "General",
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

  const storedUser = JSON.parse(localStorage.getItem("user"));
  if (storedUser?.role == "staff") {
    return <BasicSettings />;
  }

  // Group settings by category
  const groupedSettings = settingsItems.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const categoryOrder = [
    "Billing",
    "General",
    "Team",
    "Customization",
    "Automation",
    "Support",
  ];

  const categoryIcons = {
    Billing: <CreditCard className="w-5 h-5" />,
    General: <SettingsIcon className="w-5 h-5" />,
    Team: <Users className="w-5 h-5" />,
    Customization: <Zap className="w-5 h-5" />,
    Automation: <Workflow className="w-5 h-5" />,
    Support: <HelpCircle className="w-5 h-5" />,
  };

  // Loading State
  if (loading) {
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
          <p className="mt-3 text-gray-600 font-medium">{randomMessage}</p>
        </div>
      </div>
    );
  }

  if (activeSection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div>
          {/* Enhanced Header with back button */}
          <div className="mb-8">
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Back to Settings</span>
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <SettingsIcon className="w-4 h-4" />
              <a
                href="/settings"
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Settings
              </a>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 font-semibold">
                {activeSection.label}
              </span>
            </div>

            {/* Active Section Header */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`p-4 rounded-xl ${activeSection.bgColor} ${activeSection.color} shadow-md`}
                >
                  {activeSection.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                      {activeSection.label}
                    </h2>
                    {activeSection.badge && (
                      <span
                        className={`px-3 py-1 ${
                          activeSection.badgeColor ||
                          "bg-yellow-100 text-yellow-800"
                        } text-xs font-bold rounded-full flex items-center gap-1 shadow-sm`}
                      >
                        <Sparkles className="w-3 h-3" />
                        {activeSection.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm md:text-base">
                    {activeSection.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Component Content */}
          <div className="mt-6">{activeSection.component}</div>
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
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  Admin Panel
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

export default Settings;
