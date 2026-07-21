import React, { useState, useEffect } from "react";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import API, { configureAxios } from "./services/api";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Contacts from "./pages/Contacts";
import Deals from "./pages/Deals";
import Invoices from "./pages/Invoices";
import Proforma from "./pages/PerformaInvoice";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import UserManagement from "./pages/UserManagement";
import PrivateRoute from "./components/PrivateRoute";
import SuperAdminPrivateRoute from "./components/SuperAdminPrivateRoute";
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import DealDetail from "./pages/DealDetail";
import FormDetailPage from "./pages/FormDetailPage";
import FormBuilderPage from "./pages/FormBuilderPage";
import PublicFormPage from "./pages/PublicFormPage";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Invoices1 from "./pages/Invoices1";
import ContactDetailsPage from "./pages/ContactDetails";
import Insights from "./pages/Insights";
import VendorDetailsPage from "./pages/VendorDetailsPage";
import VendorsHub from "./pages/VendorsHub";
import AllTasks from "./pages/AllTasks";
import AllMeetings from "./pages/AllMeetings";
import PurchaseOrderPage from "./pages/PurchaseOrderPage";
import PurchasePage from "./pages/PurchasePage";
import ProductsServices from "./pages/ProductsServices";
import { SubscriptionProvider, useSubscription } from "./contexts/SubscriptionContext";
import { Megaphone, X } from "lucide-react";
import PaymentSuccess from "./pages/PaymentSuccess";
import SubscriptionPlans from "./components/settings/SubscriptionPlans";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import Overview from "./pages/Overview";
import Tenants from "./pages/Tenants";
import Users from "./pages/Users";
import Billing from "./pages/Billing";
import Analytics from "./pages/Analytics";
import Support from "./pages/Support";
import TenantDetails from "./pages/TenantDetails";
import ContactSupport from "./pages/ContactSupport";
import BillingDetail from "./pages/BillingDetail";
import AdminCalendar from "./pages/Calender";
import Onboarding from "./pages/Onboarding";
import PlanManagement from "./pages/PlanManagement";
import PromotionsAndRewards from "./pages/PromotionsAndRewards";
import SalesReturn from "./pages/SalesReturn";
import SalesSubscription from "./pages/SalesSubscription";
import EInvoicing from "./pages/EInvoicing";
import PurchaseReturn from "./pages/PurchaseReturn";
import PaymentsTimeline from "./pages/PaymentsTimeline";
import Journals from "./pages/Journals";
import Expenses from "./pages/Expenses";
import IndirectIncome from "./pages/IndirectIncome";

function ChecklistModal({ showChecklist, setShowChecklist }) {
  const location = useLocation();

  useEffect(() => {
    setShowChecklist(false);
  }, [location.pathname, setShowChecklist]);

  const checklistItems = [
    {
      text: "Update your profile",
      done: true,
      link: "/profile",
      time: "5 min",
    },
    {
      text: "Add your first contact",
      done: false,
      link: "/contacts",
      time: "10 min",
    },
    {
      text: "Add your first company",
      done: false,
      link: "/companies",
      time: "15 min",
    },
    {
      text: "Create a task or meeting",
      done: false,
      link: "/tasks",
      time: "10 min",
    },
    {
      text: "Explore reports or dashboards",
      done: false,
      link: "/insights",
      time: "5 min",
    },
  ];

  const completedItems = checklistItems.filter((item) => item.done).length;
  const progress = ((completedItems / checklistItems.length) * 100).toFixed(0);

  if (!showChecklist) return null;

  return (
    <div className="fixed bottom-24 right-6 h-[500px] overflow-y-scroll w-80 bg-white rounded-2xl shadow-2xl z-50 border border-gray-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Hello! Saiganesh</h2>
            </div>
          </div>
          <button
            onClick={() => setShowChecklist(false)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="text-blue-100 text-sm mb-4 flex items-center">
          Here's a Quick Checklist to get you started
          <span className="ml-1">🤗</span>
        </p>
        <div className="mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-blue-100">Progress</span>
            <span className="text-xs text-white font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-blue-800 bg-opacity-30 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-4">
          {checklistItems.map((item, index) => (
            <div key={index} className="flex items-start group">
              <div className="flex flex-col items-center mr-4">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                    item.done
                      ? "bg-green-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}
                >
                  {item.done ? "✓" : index + 1}
                </div>
                {index < checklistItems.length - 1 && (
                  <div className="w-px h-8 bg-gray-200 mt-2" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={item.link}
                  className={`text-sm font-medium transition-colors duration-200 hover:text-blue-600 block ${
                    item.done ? "text-gray-500 line-through" : "text-gray-900"
                  }`}
                >
                  {item.text}
                </Link>
                <span className="text-xs text-gray-400 mt-1 block">
                  {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowChecklist(false)}
          className="mt-6 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium px-4 py-3 rounded-xl transition-colors duration-200 text-sm border border-gray-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [showChecklist, setShowChecklist] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Referral code capture moved to main.jsx (runs before React mounts / any
  // redirect) — an App useEffect ran too late, after PrivateRoute's redirect
  // had already stripped the ?ref query string. See main.jsx.
  const isPhoneAuthenticated = !!localStorage.getItem("token");
  const isSuperAdminAuthenticated = !!localStorage.getItem("superAdminToken");
  const userIsAuthenticated =
    isAuthenticated || isPhoneAuthenticated || isSuperAdminAuthenticated;
  const { adminNotice, dismissAdminNotice } = useSubscription();

  // Define routes where navbar and header should be hidden
  const authRoutes = [
    "/login",
    "/super-admin/login",
    "/forgot-password",
    "/reset-password",
    "/onboarding",
  ];
  const shouldHideNavigation = authRoutes.some(
    (route) => location.pathname === route || location.pathname === `${route}/`,
  );

  const checklistItems = [
    {
      text: "Update your profile",
      done: true,
      link: "/profile",
      time: "5 min",
    },
    {
      text: "Add your first contact",
      done: false,
      link: "/contacts",
      time: "10 min",
    },
    {
      text: "Add your first company",
      done: false,
      link: "/companies",
      time: "15 min",
    },
    {
      text: "Create a task or meeting",
      done: false,
      link: "/tasks",
      time: "10 min",
    },
    {
      text: "Explore reports or dashboards",
      done: false,
      link: "/insights",
      time: "5 min",
    },
  ];

  const progress = (
    (checklistItems.filter((item) => item.done).length /
      checklistItems.length) *
    100
  ).toFixed(0);
  const incompleteCount = checklistItems.filter((item) => !item.done).length;

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (userIsAuthenticated) {
        try {
          // Configure Axios with the appropriate token
          if (isAuthenticated) {
            configureAxios(getAccessTokenSilently);
          } else if (isPhoneAuthenticated) {
            configureAxios(() =>
              Promise.resolve(localStorage.getItem("token")),
            );
          } else if (isSuperAdminAuthenticated) {
            configureAxios(() =>
              Promise.resolve(localStorage.getItem("superAdminToken")),
            );
          }

          // Call /auth/me to check if the user has completed setup
          const res = await API.get("/auth/me");
          if (res.status === 200) {
            // Assuming the API returns a user object with a property indicating setup completion
            // Adjust this based on your actual API response
            setIsSetupComplete(true);
          }
        } catch (err) {
          const errorData = err.response?.data;
          if (
            errorData?.error === "EMAIL_REQUIRED" ||
            errorData?.error === "REGISTRATION_REQUIRED"
          ) {
            setIsSetupComplete(false); // Setup is not complete
          } else {
            console.error("Error checking setup status:", errorData);
            setIsSetupComplete(false);
          }
        }
      } else {
        setIsSetupComplete(false);
      }
    };

    checkSetupStatus();
  }, [
    userIsAuthenticated,
    isAuthenticated,
    isPhoneAuthenticated,
    isSuperAdminAuthenticated,
    getAccessTokenSilently,
  ]);

  // Scale the whole desktop layout to the viewport instead of letting fixed
  // pixel widths (built for a ~1440px design) reflow/crop on other screen
  // sizes. CSS `zoom` (not `transform: scale`) is used deliberately: it keeps
  // position:fixed/portaled elements (headers, modals, dropdown menus)
  // aligned automatically, since it behaves like the browser's native zoom
  // rather than creating a new containing block.
  useEffect(() => {
    const DESIGN_WIDTH = 1440;
    const MIN_ZOOM = 0.6;
    const MAX_ZOOM = 1.3;

    const applyZoom = () => {
      if (window.innerWidth < 1024) {
        document.documentElement.style.zoom = "";
        return;
      }
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, window.innerWidth / DESIGN_WIDTH),
      );
      document.documentElement.style.zoom = zoom;
    };

    applyZoom();
    window.addEventListener("resize", applyZoom);
    return () => window.removeEventListener("resize", applyZoom);
  }, []);

  // Handle history cleanup on mount to prevent back button access
  useEffect(() => {
    const isLoggedOut = !userIsAuthenticated;
    const isOnAuthPage = ["/login", "/super-admin/login"].includes(
      location.pathname,
    );

    if (isLoggedOut && isOnAuthPage) {
      // Clear browser history to prevent back button from showing protected pages
      window.history.replaceState(null, "", window.location.href);
      window.history.pushState(null, "", window.location.href);
    }
  }, [userIsAuthenticated, location.pathname]);

  return (
    <Router>
      <div className="min-h-screen bg-white relative">
        {userIsAuthenticated && adminNotice && !shouldHideNavigation && (
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between gap-3 relative z-[100010]">
            <div className="flex items-center gap-2 text-sm">
              <Megaphone className="w-4 h-4 flex-shrink-0" />
              <span>{adminNotice.message}</span>
            </div>
            <button
              onClick={dismissAdminNotice}
              className="p-1 hover:bg-white/10 rounded flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {userIsAuthenticated &&
          (isSetupComplete || isSuperAdminAuthenticated) &&
          !shouldHideNavigation && <Header />}
        {userIsAuthenticated &&
          (isSetupComplete || isSuperAdminAuthenticated) &&
          !shouldHideNavigation && <Navbar />}
        <main
          className={`transition-all duration-300 ease-in-out py-6 px-4 sm:px-6 lg:px-8 ${
            userIsAuthenticated && !shouldHideNavigation ? "pt-20 lg:ml-16" : ""
          }`}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/super-admin/login" element={<SuperAdminLogin />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <PrivateRoute>
                  <Onboarding />
                </PrivateRoute>
              }
            />
            <Route
              path="/companies"
              element={
                <PrivateRoute>
                  <Companies />
                </PrivateRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <PrivateRoute>
                  <Contacts />
                </PrivateRoute>
              }
            />
            <Route path="/f/:slug" element={<PublicFormPage />} />
            <Route
              path="/deals"
              element={
                <PrivateRoute>
                  <Deals />
                </PrivateRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <PrivateRoute>
                  <Invoices1 />
                </PrivateRoute>
              }
            />
            <Route
              path="/sales-return"
              element={
                <PrivateRoute>
                  <SalesReturn />
                </PrivateRoute>
              }
            />
            <Route
              path="/sales-subscription"
              element={
                <PrivateRoute>
                  <SalesSubscription />
                </PrivateRoute>
              }
            />
            <Route
              path="/e-invoicing"
              element={
                <PrivateRoute>
                  <EInvoicing />
                </PrivateRoute>
              }
            />
            <Route
              path="/performa-invoices"
              element={
                <PrivateRoute>
                  <Proforma />
                </PrivateRoute>
              }
            />
            <Route
              path="/insights"
              element={
                <PrivateRoute>
                  <Insights />
                </PrivateRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <PrivateRoute>
                  <Tasks />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PrivateRoute>
                  <UserManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/companies/:id"
              element={
                <PrivateRoute>
                  <CompanyProfilePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/deals/:dealId"
              element={
                <PrivateRoute>
                  <DealDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/forms/:id"
              element={
                <PrivateRoute>
                  <FormDetailPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/forms/:id/builder"
              element={
                <PrivateRoute>
                  <FormBuilderPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/:section?"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/invoices1"
              element={
                <PrivateRoute>
                  <Invoices1 />
                </PrivateRoute>
              }
            />
            <Route
              path="/contacts/:id"
              element={
                <PrivateRoute>
                  <ContactDetailsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/vendors"
              element={
                <PrivateRoute>
                  <VendorsHub />
                </PrivateRoute>
              }
            />
            <Route
              path="/vendors/:id"
              element={
                <PrivateRoute>
                  <VendorDetailsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/all-tasks"
              element={
                <PrivateRoute>
                  <AllTasks />
                </PrivateRoute>
              }
            />
            <Route
              path="/all-meetings"
              element={
                <PrivateRoute>
                  <AllMeetings />
                </PrivateRoute>
              }
            />
            <Route
              path="/purchase-order"
              element={
                <PrivateRoute>
                  <PurchaseOrderPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/purchase"
              element={
                <PrivateRoute>
                  <PurchasePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/purchase-return"
              element={
                <PrivateRoute>
                  <PurchaseReturn />
                </PrivateRoute>
              }
            />
            <Route
              path="/payments-timeline"
              element={
                <PrivateRoute>
                  <PaymentsTimeline />
                </PrivateRoute>
              }
            />
            <Route
              path="/journals"
              element={
                <PrivateRoute>
                  <Journals />
                </PrivateRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <PrivateRoute>
                  <Expenses />
                </PrivateRoute>
              }
            />
            <Route
              path="/indirect-income"
              element={
                <PrivateRoute>
                  <IndirectIncome />
                </PrivateRoute>
              }
            />
            <Route
              path="/products"
              element={
                <PrivateRoute>
                  <ProductsServices />
                </PrivateRoute>
              }
            />
            <Route
              path="/calender"
              element={
                <PrivateRoute>
                  <AdminCalendar />
                </PrivateRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <PrivateRoute>
                  <SubscriptionPlans />
                </PrivateRoute>
              }
            />
            <Route
              path="/subscription/payment-success"
              element={<PaymentSuccess />}
            />
            <Route
              path="/super-admin-overview"
              element={
                <SuperAdminPrivateRoute>
                  <Overview />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/organizations"
              element={
                <SuperAdminPrivateRoute>
                  <Tenants />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/users"
              element={
                <SuperAdminPrivateRoute>
                  <Users />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/billing"
              element={
                <SuperAdminPrivateRoute>
                  <Billing />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/billing/:id"
              element={
                <SuperAdminPrivateRoute>
                  <BillingDetail />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/analytics"
              element={
                <SuperAdminPrivateRoute>
                  <Analytics />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/support"
              element={
                <SuperAdminPrivateRoute>
                  <Support />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/organizations/:id"
              element={
                <SuperAdminPrivateRoute>
                  <TenantDetails />
                </SuperAdminPrivateRoute>
              }
            />
            <Route path="/super-admin/supporrt" element={<ContactSupport />} />
            <Route
              path="/super-admin/plans"
              element={
                <SuperAdminPrivateRoute>
                  <PlanManagement />
                </SuperAdminPrivateRoute>
              }
            />
            <Route
              path="/super-admin/coupons"
              element={
                <SuperAdminPrivateRoute>
                  <PromotionsAndRewards />
                </SuperAdminPrivateRoute>
              }
            />
          </Routes>
        </main>
        <ChecklistModal
          showChecklist={showChecklist}
          setShowChecklist={setShowChecklist}
        />
      </div>
    </Router>
  );
}

function AppWrapper() {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_APP_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_APP_AUTH0_AUDIENCE,
        scope: "openid profile email offline_access",
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <SubscriptionProvider>
        <App />
      </SubscriptionProvider>
    </Auth0Provider>
  );
}

export default AppWrapper;
