import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building,
  BriefcaseBusiness,
  Users,
  FileText,
  CheckSquare,
  Truck,
  ClipboardList,
  ShoppingCart,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Wallet,
  Calendar,
  ChevronDown,
  ChevronRight,
  Package,
  Zap,
  ListChecks,
  ChartColumnIncreasing,
  CreditCard,
  Tag,
} from "lucide-react";
import API from "../services/api";

const ContactsIcon = (props) => (
  <svg viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4.18833 4.97833C3.61833 4.40847 3.33333 3.72125 3.33333 2.91667C3.33333 2.11222 3.61833 1.425 4.18833 0.854999C4.75833 0.284999 5.44556 0 6.25 0C7.05444 0 7.74167 0.284999 8.31167 0.854999C8.88167 1.425 9.16667 2.11222 9.16667 2.91667C9.16667 3.72125 8.88167 4.40847 8.31167 4.97833C7.74167 5.54833 7.05444 5.83333 6.25 5.83333C5.44556 5.83333 4.75833 5.54833 4.18833 4.97833ZM0 12.1796V10.3269C0 9.91882 0.110833 9.5409 0.3325 9.19312C0.554167 8.84535 0.850417 8.57799 1.22125 8.39104C2.04486 7.98729 2.87576 7.68444 3.71396 7.4825C4.55215 7.28056 5.3975 7.17958 6.25 7.17958C7.1025 7.17958 7.94785 7.28056 8.78604 7.4825C9.62424 7.68444 10.4551 7.98729 11.2787 8.39104C11.6496 8.57799 11.9458 8.84535 12.1675 9.19312C12.3892 9.5409 12.5 9.91882 12.5 10.3269V12.1796H0ZM1.25 10.9296H11.25V10.3269C11.25 10.1581 11.2011 10.0019 11.1033 9.85812C11.0056 9.71451 10.8728 9.59729 10.7052 9.50646C9.98715 9.15285 9.25507 8.88493 8.50896 8.70271C7.76271 8.52063 7.00972 8.42958 6.25 8.42958C5.49028 8.42958 4.73729 8.52063 3.99104 8.70271C3.24493 8.88493 2.51285 9.15285 1.79479 9.50646C1.62715 9.59729 1.49444 9.71451 1.39667 9.85812C1.29889 10.0019 1.25 10.1581 1.25 10.3269V10.9296ZM7.42708 4.09375C7.75347 3.76736 7.91667 3.375 7.91667 2.91667C7.91667 2.45833 7.75347 2.06597 7.42708 1.73958C7.10069 1.41319 6.70833 1.25 6.25 1.25C5.79167 1.25 5.39931 1.41319 5.07292 1.73958C4.74653 2.06597 4.58333 2.45833 4.58333 2.91667C4.58333 3.375 4.74653 3.76736 5.07292 4.09375C5.39931 4.42014 5.79167 4.58333 6.25 4.58333C6.70833 4.58333 7.10069 4.42014 7.42708 4.09375Z" fill="currentColor" />
  </svg>
);

const primary = {
  darknavy: "#16153C",
  indigo: "#3C38BD",
  lightindigo: "#7E7AE8",
  black: "#000000",
  pitchblack: "#0A0A0A",
  white: "#FFFFFF",
};

const secondary = {
  blue: "#0033FF",
  deepblue: "#112C71",
  mutedindigo: "#585BEB",
  violet: "#904BFF",
  classicblue: "#274BA3",
};

const Navbar = () => {
  const [profile, setProfile] = useState("");
  const [kanbanName, setKanbanName] = useState("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [procurementOpen, setProcurementOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [hoveredChildIndex, setHoveredChildIndex] = useState(null);
  const [hoveredProcurementIndex, setHoveredProcurementIndex] = useState(null);
  const [hoveredPaymentsIndex, setHoveredPaymentsIndex] = useState(null);
  const [hoveredActivityIndex, setHoveredActivityIndex] = useState(null);
  const [branding, setBranding] = useState(null);
  const [isLoadingBranding, setIsLoadingBranding] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      document.documentElement.style.setProperty(
        "--sidebar-width",
        "64px"
      );
    } else {
      document.documentElement.style.setProperty("--sidebar-width", "0px");
    }
  }, []);

  const fetchBranding = async () => {
    setIsLoadingBranding(true);
    try {
      const res = await API.get("/branding");
      setBranding(res.data);
    } catch (err) {
      console.error("Failed to fetch branding:", err);
    } finally {
      setIsLoadingBranding(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const getInitials = (name) => {
    if (!name || !name.trim()) return "?";
    const words = name.trim().split(" ");
    return words.length === 1
      ? words[0][0].toUpperCase()
      : (words[0][0] + words[1][0]).toUpperCase();
  };

  const getRandomColor = (name) => {
    const colors = [
      primary.indigo,
      secondary.violet,
      secondary.classicblue,
      secondary.blue,
      primary.lightindigo,
      primary.darknavy,
    ];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Companies", href: "/companies", icon: Building },
    { name: "Deals", href: "/deals", icon: BriefcaseBusiness },
    { name: "Contacts", href: "/contacts", icon: ContactsIcon },
    {
      name: "Activity",
      icon: ListChecks,
      isDropdown: true,
      dropdownType: "activity",
    },
    { name: "Accounts", isHeader: true },
    { name: "Sales", icon: BarChart3, isDropdown: true, dropdownType: "sales" },
    {
      name: "Procurement",
      icon: Package,
      isDropdown: true,
      dropdownType: "procurement",
    },
    { name: "Vendors", href: "/vendors", icon: Truck },
    {
      name: "Payments",
      icon: Wallet,
      isDropdown: true,
      dropdownType: "payments",
    },
    { name: "Products and Services", href: "/products", icon: Boxes },
    { name: "Others", isHeader: true },
    { name: "Insights", href: "/insights", icon: ChartColumnIncreasing },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const activityChildren = [
    { name: "Tasks and Meetings", href: "/tasks" },
    { name: "Calendar", href: "/calender" },
  ];

  const salesChildren = [
    { name: "Quote", href: "/invoices?tab=quotation" },
    { name: "Invoices", href: "/invoices?tab=tax" },
    { name: "Proforma Invoice", href: "/invoices?tab=performa" },
    { name: "Delivery Challan", href: "/invoices?tab=deliveryChallan" },
    { name: "Sales Return", href: "/sales-return" },
    { name: "Subscription", href: "/sales-subscription" },
    { name: "E-Invoicing", href: "/e-invoicing" },
  ];

  const procurementChildren = [
    { name: "Purchases", href: "/purchase" },
    { name: "Purchase Orders", href: "/purchase-order" },
    { name: "Purchase Return", href: "/purchase-return" },
  ];

  const paymentsChildren = [
    { name: "Timeline", href: "/payments-timeline" },
    { name: "Journals", href: "/journals" },
    { name: "Expenses", href: "/expenses" },
    { name: "Indirect Income", href: "/indirect-income" },
  ];

  const superAdminNavigation = [
    {
      name: "Overview",
      href: "/super-admin-overview",
      icon: LayoutDashboard,
    },
    {
      name: "Organizations",
      href: "/super-admin/organizations",
      icon: Building,
    },
    { name: "Users", href: "/super-admin/users", icon: Users },
    { name: "Billing", href: "/super-admin/billing", icon: FileText },
    { name: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
    { name: "Support", href: "/super-admin/support", icon: Settings },
    { name: "Plans", href: "/super-admin/plans", icon: CreditCard },
    { name: "Promotions & Rewards", href: "/super-admin/coupons", icon: Tag },
  ];

  useEffect(() => {
    setSalesOpen(false);
    setProcurementOpen(false);
    setPaymentsOpen(false);
    setActivityOpen(false);
  }, []);

  const isCurrentPath = (href) => {
    if (location.pathname === href) return true;
    return (
      (href === "/companies" && location.pathname.startsWith("/companies/")) ||
      (href === "/contacts" && location.pathname.startsWith("/contacts/")) ||
      (href === "/deals" && location.pathname.startsWith("/deals/")) ||
      (href === "/vendors" && location.pathname.startsWith("/vendors/")) ||
      (href === "/settings" && location.pathname.startsWith("/settings"))
    );
  };

  const isChildActive = (children) =>
    children.some((child) => {
      const childPath = child.href.split("?")[0];
      return (
        location.pathname === childPath ||
        location.pathname.startsWith(`${childPath}/`)
      );
    });

  const handleLogout = () => {
    const savedPins = localStorage.getItem("pinned_companies");
    // Preserve a captured referral code across logout — a user logged into an
    // old account who clicks a referral link and then logs out to register a
    // fresh org would otherwise lose the code to localStorage.clear() before
    // registration can use it. See main.jsx (capture) / Login.jsx (consume).
    const savedReferralCode = localStorage.getItem("referralCode");

    localStorage.clear();

    if (savedPins) {
    localStorage.setItem("pinned_companies", savedPins);
  }
    if (savedReferralCode) {
      localStorage.setItem("referralCode", savedReferralCode);
    }
    window.location.href = "/login";
  };

  useEffect(() => {
    getProfile();
  }, []);

  const getProfile = async () => {
    const res = await API.get("/auth/profile");
    setProfile(res.data);
  };

  const renderCompanyLogo = () => {
    if (branding?.logoUrl) {
      const src =
        typeof branding.logoUrl === "string" &&
          (branding.logoUrl.startsWith("data:") ||
            branding.logoUrl.startsWith("blob:") ||
            branding.logoUrl.startsWith("http"))
          ? branding.logoUrl
          : `${import.meta.env.VITE_APP_API_URL}${branding.logoUrl}`;

      return (
        <img
          src={src}
          alt="Company Logo"
          className="h-8 w-8 rounded-full object-cover flex-shrink-0"
        />
      );
    } else {
      const src = `/DataCircles.png`;
      return (
        <img
          src={src}
          alt="Company Logo"
          className="h-8 w-8 rounded-md object-cover flex-shrink-0"
          style={{ filter: "invert(100%)" }}
        />
      );
    }
  };

  const renderProfileImage = () => {
    if (profile && !isSuperAdmin) {
      const src =
        typeof profile == "string" &&
          (profile.startsWith("data:") || profile.startsWith("blob:"))
          ? profile
          : `${import.meta.env.VITE_APP_API_URL}${profile}`;
      return (
        <img
          src={profile}
          alt="User Profile"
          className="h-7 w-7 rounded-full object-cover flex-shrink-0 border border-white"
        />
      );
    } else {
      const userName = isSuperAdmin
        ? "Super Admin"
        : user?.name || user?.email || "User";
      const initials = getInitials(userName);
      const color = getRandomColor(userName);
      return (
        <div
          className="h-8 w-8 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: color }}
        >
          {initials}
        </div>
      );
    }
  };

  const renderDropdown = (
    item,
    isOpen,
    setIsOpen,
    children,
    hoveredIndex,
    setHoveredIndex,
  ) => (
    <li
      key={item.name}
      className="group relative flex-shrink-0 text-black"
      onMouseEnter={() => {
        if (window.innerWidth >= 1024) {
          setIsOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (window.innerWidth >= 1024) {
          setIsOpen(false);
          setHoveredIndex(null);
        }
      }}
      onClick={() => {
        if (window.innerWidth < 1024 || !isHovered) {
          setIsHovered(true);
        }
        setIsOpen(!isOpen);
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-3 py-3 text-sm rounded-xl transition-all duration-300 ease-in-out"
        style={{ color: primary.white }}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${isChildActive(children) ? "text-blue-600" : "text-gray-900"
            }`}
        />
        {(isHovered || isMobileOpen) && (
          <span className="whitespace-nowrap text-black">{item.name}</span>
        )}
        {(isHovered || isMobileOpen) && (
          <ChevronRight
            size={16}
            className="ml-auto transition-transform duration-300 ease-in-out"
            style={{
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        )}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight:
            isOpen && (isHovered || isMobileOpen)
              ? `${children.length * 44}px`
              : "0px",
          opacity: isOpen && (isHovered || isMobileOpen) ? 1 : 0,
        }}
      >
        <div className="relative ml-8 mt-1">
          <svg
            className="absolute left-[-16px] top-0 pointer-events-none overflow-visible"
            style={{
              width: "20px",
              height: `${children.length * 44}px`,
            }}
          >
            {children.map((child, idx) => {
              const y = idx * 44 + 16;
              const isHoveredOrAbove =
                hoveredIndex !== null && idx <= hoveredIndex;

              return (
                <g key={child.name}>
                  {idx === 0 && (
                    <line
                      x1="4"
                      y1="0"
                      x2="4"
                      y2={y - 6}
                      stroke={
                        isHoveredOrAbove
                          ? "rgba(126, 122, 232, 0.5)"
                          : "#808080"
                      }
                      strokeWidth="1.5"
                      className="transition-all duration-300 ease-in-out"
                    />
                  )}
                  {idx > 0 && (
                    <line
                      x1="4"
                      y1={(idx - 1) * 44 + 22}
                      x2="4"
                      y2={y - 6}
                      stroke={
                        isHoveredOrAbove
                          ? "rgba(126, 122, 232, 0.5)"
                          : "#808080"
                      }
                      strokeWidth="1.5"
                      className="transition-all duration-300 ease-in-out"
                    />
                  )}
                  <path
                    d={`M 4 ${y - 6} Q 4 ${y}, 10 ${y} L 16 ${y}`}
                    stroke={
                      isHoveredOrAbove ? "rgba(126, 122, 232, 0.5)" : "#808080"
                    }
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    className="transition-all duration-300 ease-in-out"
                  />
                </g>
              );
            })}
          </svg>

          <ul className="space-y-1">
            {children.map((child, idx) => (
              <li
                key={child.name}
                className="relative"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <Link
                  to={child.href}
                  onClick={() => {
                    setIsMobileOpen(false);
                    setIsOpen(false);
                    setHoveredIndex(null);
                  }}
                  className="block px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 rounded-lg "
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="fixed top-20 left-2 z-[10000] lg:hidden p-2 rounded-md bg-white transition-transform duration-300"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-screen border-r border-gray-200 z-[9995] flex flex-col transition-all duration-300 ease-in-out lg:w-auto ${isMobileOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full lg:translate-x-0"
          }`}
        style={{
          background: primary.white,
          width:
            window.innerWidth >= 1024
              ? (isHovered ? "280px" : "64px")
              : undefined,
        }}
        onMouseEnter={() => {
          if (window.innerWidth >= 1024) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (window.innerWidth >= 1024) {
            setIsHovered(false);
            setSalesOpen(false);
            setProcurementOpen(false);
            setPaymentsOpen(false);
            setActivityOpen(false);
            setHoveredChildIndex(null);
            setHoveredProcurementIndex(null);
            setHoveredPaymentsIndex(null);
            setHoveredActivityIndex(null);
          }
        }}
      >
        <div className="h-16 flex items-center px-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            {renderCompanyLogo()}
            {(isHovered || isMobileOpen) && (
              <span className="font-bold text-lg whitespace-nowrap text-gray-900 overflow-hidden">
                {branding?.companyName || "Company"}
              </span>
            )}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto pt-3 pb-2 bg-white flex flex-col">
          <ul className="flex-1 flex flex-col justify-evenly px-2  text-black">
            {(isSuperAdmin ? superAdminNavigation : navigation).map(
              (item, index) =>
                item.separator ? (
                  <li
                    key={`sep-${index}`}
                    className="flex-shrink-0 text-black "
                  >
                    <hr className="my-2 border-black-600/40" />
                  </li>
                ) : item.isHeader ? (
                  <li
                    key={item.name}
                    className={`flex-shrink-0 py-2 mt-4 mb-2 transition-all duration-300 cursor-pointer ${isHovered || isMobileOpen ? "px-3" : "px-0"
                      }`}
                    onClick={() => {
                      if (!isHovered && window.innerWidth >= 1024) {
                        setIsHovered(true);
                      } else if (isHovered && window.innerWidth >= 1024) {
                        // Optional: allow collapsing on header click if already expanded
                        // setIsHovered(false);
                      }
                    }}
                  >
                    <span
                      className={`block text-[#5B5A64] font-bold uppercase tracking-wider transition-all duration-300 ${isHovered || isMobileOpen
                        ? "text-[11px] text-left px-2"
                        : "text-[7.5px] text-center px-0"
                        }`}
                    >
                      {item.name}
                    </span>
                  </li>
                ) : item.isDropdown ? (
                  item.dropdownType === "sales" ? (
                    renderDropdown(
                      item,
                      salesOpen,
                      setSalesOpen,
                      salesChildren,
                      hoveredChildIndex,
                      setHoveredChildIndex,
                    )
                  ) : item.dropdownType === "procurement" ? (
                    renderDropdown(
                      item,
                      procurementOpen,
                      setProcurementOpen,
                      procurementChildren,
                      hoveredProcurementIndex,
                      setHoveredProcurementIndex,
                    )
                  ) : item.dropdownType === "payments" ? (
                    renderDropdown(
                      item,
                      paymentsOpen,
                      setPaymentsOpen,
                      paymentsChildren,
                      hoveredPaymentsIndex,
                      setHoveredPaymentsIndex,
                    )
                  ) : (
                    renderDropdown(
                      item,
                      activityOpen,
                      setActivityOpen,
                      activityChildren,
                      hoveredActivityIndex,
                      setHoveredActivityIndex,
                    )
                  )
                ) : (
                  <li
                    key={item.name}
                    className="group relative flex-shrink-0 text-black"
                  >
                    <Link
                      to={item.href}
                      onClick={() => {
                        setIsMobileOpen(false);
                        setSalesOpen(false);
                        setProcurementOpen(false);
                        setPaymentsOpen(false);
                        setActivityOpen(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-3 text-sm rounded-2xl transition-all overflow-y-hidden duration-300 text-black
                      ${isCurrentPath(item.href)
                          ? "bg-gray-200 text-black font-medium"
                          : "text-gray-900 hover:bg-gray-100"
                        }
                    `}
                    /* style={{
                      background: isCurrentPath(item.href)
                        ? `linear-gradient(190deg, ${primary.lightindigo} 0%, ${secondary.blue} 50%, ${primary.lightindigo} 100%)`
                        : "none",
  
                      border: isCurrentPath(item.href)
                        ? `1px solid ${primary.lightindigo}`
                        : "none",
                    }} */
                    >
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 ${isCurrentPath(item.href) ? "text-blue-600" : "text-gray-900"
                          }`}
                      />
                      <span
                        className={`whitespace-nowrap transition-opacity duration-300 ${isHovered || isMobileOpen
                          ? "opacity-100"
                          : "opacity-0 lg:hidden"
                          }`}
                      >
                        {item.name}
                      </span>
                    </Link>
                  </li>
                ),
            )}
          </ul>
        </nav>

        {/* Profile + Logout */}
        <div
          className="sticky bottom-0 w-full py-3 bg-white border-t border-gray-200"
          style={{
            /*  background: "#16153C", */
            borderTop: `1px solid rgba(126, 122, 232, 0.5)`,
          }}
        >
          <div className="px-2">
            <div
              className={`flex items-center gap-3 cursor-pointer p-2 rounded transition-all duration-300 ${isHovered || isMobileOpen ? "" : "lg:flex-col lg:justify-center"
                }`}
              onClick={() => {
                navigate(isSuperAdmin ? "/super-admin-overview" : "/profile");
                setIsMobileOpen(false);
              }}
            >
              {renderProfileImage()}

              <div
                className={`flex flex-col transition-opacity duration-300 ${isHovered || isMobileOpen
                  ? "opacity-100"
                  : "opacity-0 lg:hidden"
                  }`}
              >
                <span className="text-sm font-medium text-gray-900">
                  {isSuperAdmin ? "Super Admin" : user?.name || "User"}
                </span>
                <span className="text-xs text-gray-600">
                  {isSuperAdmin ? "Administrator" : user?.role || "Partner"}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className={`transition-all duration-300 p-2 rounded-lg flex-shrink-0 hover:bg-gray-200 ${isHovered || isMobileOpen
                  ? "ml-auto opacity-100"
                  : "opacity-0 lg:hidden"
                  }`}
                /* style={{
                  background:
                    isHovered || isMobileOpen
                      ? secondary.violet
                      : "transparent",
                }} */
                title="Logout"
              >
                <LogOut size={18} color="#ff0000" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
