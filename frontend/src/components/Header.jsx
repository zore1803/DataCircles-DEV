// import { useEffect, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import {
//   Search,
//   Plus,
//   X,
//   User,
//   Building,
//   Users,
//   IndianRupeeIcon,
//   CheckCircle,
//   Calendar,
//   Phone,
//   ChevronRight,
//   Sparkles,
//   Clock,
// } from "lucide-react";
// import SearchResults from "./SearchResults";
// import QuickCompanyForm from "./company/QuickCompanyForm";
// import QuickContactForm from "./contact/QuickContactForm";
// import QuickVendorForm from "./vendor/QuickVendorForm";
// import QuickDealForm from "./deal/QuickDealForm";
// import QuickTaskForm from "./Task/QuickTaskForm";
// import QuickCallLogForm from "./contact/QuickCallLogForm";
// import API, { configureAxios } from "../services/api";
// import { useAuth0 } from "@auth0/auth0-react";

// // Shimmer UI Component for Branding
// const BrandingShimmer = () => {
//   return (
//     <div className="flex items-center gap-3">
//       <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse"></div>
//       <div className="h-5 w-24 bg-gray-200 animate-pulse rounded"></div>
//     </div>
//   );
// };

// const Header = () => {
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedQuery, setDebouncedQuery] = useState("");
//   const [isSearchOpen, setIsSearchOpen] = useState(false);
//   const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
//   const [hoveredMeeting, setHoveredMeeting] = useState(false);
//   const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
//   const [showQuickContactForm, setShowQuickContactForm] = useState(false);
//   const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);
//   const [showQuickDealForm, setShowQuickDealForm] = useState(false);
//   const [showQuickTaskForm, setShowQuickTaskForm] = useState(false);
//   const [showQuickCallLogForm, setShowQuickCallLogForm] = useState(false);
//   const [showQuickMeetingForm, setShowQuickMeetingForm] = useState(false);
//   const [meetingType, setMeetingType] = useState("");
//   const [companies, setCompanies] = useState([]);
//   const [contacts, setContacts] = useState([]);
//   const [branding, setBranding] = useState(null);
//   const [isLoadingData, setIsLoadingData] = useState(false);
//   const location = useLocation();
//   const navigate = useNavigate();
//   const { getAccessTokenSilently } = useAuth0();
//   const isSuperAdmin = !!localStorage.getItem("superAdminToken");
//   const [isTrialActive, setIsTrialActive] = useState(false);
//   const [trialEnd, setTrialEnd] = useState(null);
//   const [trialLeftLabel, setTrialLeftLabel] = useState("");
//   const [trialUsed, setTrialUsed] = useState(false);
//   const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

//   const isSuperAdminRoute = location.pathname.startsWith("/super-admin");

//   const getInitials = (name) => {
//     if (!name || !name.trim()) return "?";
//     const words = name.trim().split(" ");
//     if (words.length === 1) {
//       return words[0][0].toUpperCase();
//     } else {
//       return (words[0][0] + words[1][0]).toUpperCase();
//     }
//   };

//   const getRandomColor = (name) => {
//     const colors = [
//       "bg-red-500",
//       "bg-green-500",
//       "bg-blue-500",
//       "bg-yellow-500",
//       "bg-purple-500",
//       "bg-pink-500",
//       "bg-indigo-500",
//       "bg-gray-500",
//     ];
//     if (!name) return colors[0];
//     const charCode = name.charCodeAt(0);
//     return colors[charCode % colors.length];
//   };

//   const renderCompanyLogo = () => {
//     if (branding?.logoUrl) {
//       // If logoUrl is a data URL, blob URL, or full HTTP URL, use it directly; otherwise prefix API URL
//       const src =
//         typeof branding.logoUrl === "string" &&
//         (branding.logoUrl.startsWith("data:") ||
//           branding.logoUrl.startsWith("blob:") ||
//           branding.logoUrl.startsWith("http"))
//           ? branding.logoUrl
//           : `${import.meta.env.VITE_APP_API_URL}${branding.logoUrl}`;

//       return (
//         <img
//           src={src}
//           alt="Company Logo"
//           className="h-9 w-9 rounded-full object-cover flex-shrink-0"
//         />
//       );
//     } else {
//       const src = `/DataCircles.png`;
//       return (
//         <img
//           src={src}
//           alt="Company Logo"
//           className="h-9 w-9 rounded-md object-cover flex-shrink-0 drop-shadow-lg"
//           style={{
//             filter: "invert(100%)",
//           }}
//         />
//       );
//     }
//   };

//   useEffect(() => {
//   if (!isSuperAdmin && !isSuperAdminRoute) {
//     configureAxios(getAccessTokenSilently);
//     const fetchData = async () => {
//       setIsLoadingData(true);
//       try {
//         const [companiesRes, contactsRes, brandingRes, authRes] = await Promise.all([
//           API.get("/companies"),
//           API.get("/contacts"),
//           API.get("/branding"),
//           API.get("/auth/me")
//         ]);
//         setCompanies(companiesRes.data);
//         setContacts(contactsRes.data);
//         setBranding(brandingRes.data);
//         setIsTrialActive(authRes.data.isTrialActive);
//         setTrialEnd(authRes.data.trialEnd);
//         setTrialUsed(authRes.data.trialUsed); // Add this
//         setIsPaymentConfirmed(authRes.data.isPaymentConfirmed); // Add this
//       } catch (err) {
//         console.error("Failed to fetch data:", err);
//       } finally {
//         setIsLoadingData(false);
//       }
//     };
//     fetchData();
//   } else {
//     setBranding({ companyName: "Data Circles Admin", logoUrl: null });
//   }
// }, [isSuperAdmin, isSuperAdminRoute, getAccessTokenSilently]);

// useEffect(() => {
//   // Show badge if trial is active OR trial ended without payment
//   const shouldShowTrialBadge = isTrialActive || (trialUsed && !isPaymentConfirmed);

//   if (!shouldShowTrialBadge || !trialEnd) {
//     setTrialLeftLabel("");
//     return;
//   }

//   const endTime = new Date(trialEnd).getTime();

//   function updateLabel() {
//     const now = Date.now();
//     const diff = endTime - now;

//     if (diff <= 0) {
//       setTrialLeftLabel("Trial ended");
//       return;
//     }

//     // Use Math.ceil for days to round UP (shows 7 days if 6d 23h left)
//     const totalHours = diff / (1000 * 60 * 60);
//     const days = Math.ceil(totalHours / 24);

//     // For the countdown, use floor for precision
//     const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
//     const minutes = Math.floor((diff / (1000 * 60)) % 60);
//     const seconds = Math.floor((diff / 1000) % 60);

//     // Show days if 24+ hours remaining, otherwise show HH:MM:SS
//     if (totalHours >= 24) {
//       setTrialLeftLabel(`Trial ends in ${days} day${days > 1 ? "s" : ""}`);
//     } else {
//       setTrialLeftLabel(
//         `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} left`
//       );
//     }
//   }

//   updateLabel();
//   let interval = null;

//   // Only run interval if trial is still active
//   if (isTrialActive && trialEnd) {
//     interval = setInterval(updateLabel, 1000);
//   }

//   return () => interval && clearInterval(interval);
// }, [isTrialActive, trialEnd, trialUsed, isPaymentConfirmed]);

//   useEffect(() => {
//     if (!isSuperAdminRoute && !isSuperAdmin) {
//       if (isSearchOpen) {
//         handleSearchClose();
//       }
//       if (isAddMenuOpen) {
//         handleAddMenuClose();
//       }
//     }
//   }, [location.pathname, isSuperAdminRoute, isSuperAdmin]);

//   useEffect(() => {
//     if (!isSuperAdminRoute && !isSuperAdmin) {
//       const handler = setTimeout(() => {
//         setDebouncedQuery(searchQuery);
//       }, 300);

//       return () => {
//         clearTimeout(handler);
//       };
//     }
//   }, [searchQuery, isSuperAdminRoute, isSuperAdmin]);

//   const handleSearchFocus = () => setIsSearchOpen(true);
//   const handleSearchChange = (e) => {
//     setSearchQuery(e.target.value);
//     if (e.target.value.length > 0 && !isSearchOpen) setIsSearchOpen(true);
//     if (e.target.value.length === 0) {
//       setIsSearchOpen(false);
//       setDebouncedQuery("");
//     }
//   };
//   const handleSearchClose = () => {
//     setIsSearchOpen(false);
//     setSearchQuery("");
//     setDebouncedQuery("");
//   };

//   const handleGlobalAdd = () => setIsAddMenuOpen(!isAddMenuOpen);
//   const handleAddMenuClose = () => {
//     setIsAddMenuOpen(false);
//     setHoveredMeeting(false);
//   };

//   const fetchFreshData = async () => {
//     setIsLoadingData(true);
//     try {
//       const [companiesRes, contactsRes] = await Promise.all([
//         API.get("/companies"),
//         API.get("/contacts"),
//       ]);
//       setCompanies(companiesRes.data);
//       setContacts(contactsRes.data);
//     } catch (err) {
//       console.error("Failed to fetch data:", err);
//     } finally {
//       setIsLoadingData(false);
//     }
//   };

//   const handleAddItem = async (type) => {
//     setIsAddMenuOpen(false);
//     setHoveredMeeting(false);

//     if (["contact", "deal", "task", "call-log"].includes(type)) {
//       await fetchFreshData();
//     }

//     switch (type) {
//       case "vendor":
//         setShowQuickVendorForm(true);
//         break;
//       case "company":
//         setShowQuickCompanyForm(true);
//         break;
//       case "contact":
//         setShowQuickContactForm(true);
//         break;
//       case "deal":
//         setShowQuickDealForm(true);
//         break;
//       case "task":
//         setShowQuickTaskForm(true);
//         break;
//       case "call-log":
//         setShowQuickCallLogForm(true);
//         break;
//       default:
//         break;
//     }
//   };

//   const handleMeetingType = (type) => {
//     setIsAddMenuOpen(false);
//     setHoveredMeeting(false);
//     setMeetingType(type);
//     setShowQuickMeetingForm(true);
//   };

//   const handleCompanyCreated = (newCompany) => {
//     setCompanies((prev) => [...prev, newCompany]);
//     setShowQuickCompanyForm(false);
//   };

//   const handleContactCreated = (newContact) => {
//     setContacts((prev) => [...prev, newContact]);
//     setShowQuickContactForm(false);
//   };

//   const handleVendorCreated = () => {
//     setShowQuickVendorForm(false);
//   };

//   const handleDealCreated = () => {
//     setShowQuickDealForm(false);
//   };

//   const handleTaskCreated = () => {
//     setShowQuickTaskForm(false);
//   };

//   const handleCallLogCreated = () => {
//     setShowQuickCallLogForm(false);
//   };

//   const handleMeetingCreated = () => {
//     setShowQuickMeetingForm(false);
//     setMeetingType("");
//   };

//   const addRecords = [
//     {
//       id: "company",
//       label: "Company",
//       icon: Building,
//       bgColor: "bg-blue-100",
//       iconColor: "text-blue-600",
//       hoverColor: "hover:bg-blue-50",
//     },
//     {
//       id: "contact",
//       label: "Contact",
//       icon: Users,
//       bgColor: "bg-pink-100",
//       iconColor: "text-pink-600",
//       hoverColor: "hover:bg-pink-50",
//     },
//     {
//       id: "deal",
//       label: "Deal",
//       icon: IndianRupeeIcon,
//       bgColor: "bg-teal-100",
//       iconColor: "text-teal-600",
//       hoverColor: "hover:bg-teal-50",
//     },
//     {
//       id: "vendor",
//       label: "Vendor",
//       icon: User,
//       bgColor: "bg-green-100",
//       iconColor: "text-green-600",
//       hoverColor: "hover:bg-green-50",
//     },
//   ];

//   const addActivities = [
//     {
//       id: "task",
//       label: "Task",
//       icon: CheckCircle,
//       bgColor: "bg-blue-100",
//       iconColor: "text-blue-600",
//       hoverColor: "hover:bg-blue-50",
//     },
//     {
//       id: "call-log",
//       label: "Call Log",
//       icon: Phone,
//       bgColor: "bg-purple-100",
//       iconColor: "text-purple-600",
//       hoverColor: "hover:bg-purple-50",
//     },
//   ];

//   const meetingTypes = [
//     {
//       id: "contact-meeting",
//       label: "Contact Meeting",
//       icon: Users,
//       bgColor: "bg-pink-100",
//       iconColor: "text-pink-600",
//       hoverColor: "hover:bg-pink-50",
//     },
//     {
//       id: "company-meeting",
//       label: "Company Meeting",
//       icon: Building,
//       bgColor: "bg-blue-100",
//       iconColor: "text-blue-600",
//       hoverColor: "hover:bg-blue-50",
//     },
//     {
//       id: "vendor-meeting",
//       label: "Vendor Meeting",
//       icon: User,
//       bgColor: "bg-yellow-100",
//       iconColor: "text-yellow-600",
//       hoverColor: "hover:bg-yellow-50",
//     },
//   ];

//   if (isSuperAdmin || isSuperAdminRoute) {
//     return (
//       <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-[9992] h-16">
//         <div className="flex items-center justify-start h-full px-4 lg:pl-20">
//           {/* Branding Section */}
//           {isLoadingData ? (
//             <BrandingShimmer />
//           ) : (
//             <div
//               className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity duration-200"
//               onClick={() => {
//                 navigate(
//                   isSuperAdmin ? "/super-admin-overview" : "/settings/brand",
//                   {
//                     state: isSuperAdmin ? {} : { activeSection: "brand" },
//                   }
//                 );
//               }}
//             >
//               {renderCompanyLogo()}
//               <div
//                 className="font-semibold text-lg whitespace-nowrap font-sf"
//                 style={{ color: branding?.colors?.secondary }}
//               >
//                 {branding?.companyName || "Data Circles Admin"}
//               </div>
//             </div>
//           )}
//         </div>
//       </header>
//     );
//   }

//   return (
//     <>
//       <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-[9992] h-16">
//         <div className="flex items-center justify-end sm:justify-between h-full px-4 lg:pl-20">
//           {/* Branding Section */}
//           {isLoadingData ? (
//             <BrandingShimmer />
//           ) : (
//             <div
//               className="hidden sm:flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity duration-200 mr-4"
//               onClick={() => {
//                 navigate(
//                   isSuperAdmin ? "/super-admin-overview" : "/settings/brand",
//                   {
//                     state: isSuperAdmin ? {} : { activeSection: "brand" },
//                   }
//                 );
//               }}
//             >
//               {renderCompanyLogo()}
//               <div
//                 className="font-sf font-medium text-lg whitespace-nowrap"
//                 style={{ color: branding?.colors?.secondary }}
//               >
//                 {branding?.companyName || "Company"}
//               </div>
//             </div>
//           )}

//           {/* Search Bar */}
//           <div className="flex items-center gap-4">
//             {/* TRIAL BADGE */}
//             {(isTrialActive || (trialUsed && !isPaymentConfirmed)) && trialLeftLabel && (
//               <div
//                 onClick={() => navigate("/settings/subscription")}
//                 className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 animate-subtle-pulse"
//                 style={{
//                   borderColor: trialLeftLabel.includes("ended") ? "#ef4444" :
//                               trialLeftLabel.includes("day") && parseInt(trialLeftLabel) <= 2 ? "#f59e0b" : "#3b82f6",
//                   backgroundColor: trialLeftLabel.includes("ended") ? "#fef2f2" :
//                                   trialLeftLabel.includes("day") && parseInt(trialLeftLabel) <= 2 ? "#fffbeb" : "#eff6ff",
//                 }}
//               >
//                 <Clock
//                   className="h-4 w-4 animate-spin-slow"
//                   style={{
//                     color: trialLeftLabel.includes("ended") ? "#ef4444" :
//                           trialLeftLabel.includes("day") && parseInt(trialLeftLabel) <= 2 ? "#f59e0b" : "#3b82f6"
//                   }}
//                 />
//                 <span
//                   className="text-sm font-medium"
//                   style={{
//                     color: trialLeftLabel.includes("ended") ? "#ef4444" :
//                           trialLeftLabel.includes("day") && parseInt(trialLeftLabel) <= 2 ? "#f59e0b" : "#3b82f6"
//                   }}
//                 >
//                   {trialLeftLabel}
//                 </span>
//                 <ChevronRight className="h-3.5 w-3.5 opacity-50 transition-transform duration-300 group-hover:translate-x-1" />
//               </div>
//             )}

//             <div className="md:flex-1 w-[260px] md:w-[400px] max-w-md">
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-8 sm:left-0 pl-3 flex items-center pointer-events-none">
//                   <Search className="h-4 w-4 text-gray-400" />
//                 </div>
//                 <input
//                   type="text"
//                   placeholder="Search companies, contacts, deals..."
//                   value={searchQuery}
//                   onChange={handleSearchChange}
//                   onFocus={handleSearchFocus}
//                   className="w-[90%] sm:w-full ml-8 sm:ml-0 pl-10 pr-4 py-2 border font-sf font-medium border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-500"
//                 />
//               </div>
//             </div>

//             {/* Global Add Button */}
//             <div>
//               <div className="relative group">
//                 <button
//                   onClick={handleGlobalAdd}
//                   className="font-sf flex items-center justify-center w-10 h-10 btn-primary rounded-lg transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
//                 >
//                   {isAddMenuOpen ? (
//                     <X className="h-5 w-5" />
//                   ) : (
//                     <Plus className="h-5 w-5" />
//                   )}
//                 </button>

//                 {!isAddMenuOpen && (
//                   <span className="absolute right-[50px] top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-4 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
//                     Add Records or Activities
//                   </span>
//                 )}

//                 {isAddMenuOpen && (
//                   <>
//                     <div
//                       className="fixed inset-0 z-[9999]"
//                       onClick={handleAddMenuClose}
//                     />
//                     <div className="absolute right-[-35px] lg:right-0 top-[45px] mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-[10000] py-4 transition-all duration-300 ease-in-out">
//                       <div className="px-4 mb-4">
//                         <h3 className="text-sm font-semibold text-gray-700 mb-3">
//                           Add Records
//                         </h3>
//                         <div className="grid grid-cols-2 gap-2">
//                           {addRecords.map((item) => {
//                             const Icon = item.icon;
//                             return (
//                               <button
//                                 key={item.id}
//                                 onClick={() => handleAddItem(item.id)}
//                                 className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${item.bgColor} ${item.hoverColor} cursor-pointer transform hover:scale-105`}
//                               >
//                                 <div
//                                   className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center mr-3`}
//                                 >
//                                   <Icon
//                                     className={`w-4 h-4 ${item.iconColor}`}
//                                   />
//                                 </div>
//                                 <span className="text-sm font-medium text-gray-700">
//                                   {item.label}
//                                 </span>
//                               </button>
//                             );
//                           })}
//                         </div>
//                       </div>

//                       <div className="border-t border-gray-200 my-4" />

//                       <div className="px-4">
//                         <h3 className="text-sm font-semibold text-gray-700 mb-3">
//                           Add Activities
//                         </h3>
//                         <div className="space-y-1">
//                           {addActivities.map((item) => {
//                             const Icon = item.icon;
//                             return (
//                               <div key={item.id} className="relative">
//                                 <button
//                                   onClick={() =>
//                                     item.id !== "meeting" &&
//                                     handleAddItem(item.id)
//                                   }
//                                   onMouseEnter={() =>
//                                     item.id === "meeting" &&
//                                     setHoveredMeeting(true)
//                                   }
//                                   onMouseLeave={() =>
//                                     item.id === "meeting" &&
//                                     setHoveredMeeting(false)
//                                   }
//                                   className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${item.bgColor} ${item.hoverColor} cursor-pointer transform hover:scale-105`}
//                                 >
//                                   <div className="flex items-center">
//                                     <div
//                                       className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center mr-3`}
//                                     >
//                                       <Icon
//                                         className={`w-4 h-4 ${item.iconColor}`}
//                                       />
//                                     </div>
//                                     <span className="text-sm font-medium text-gray-700">
//                                       {item.label}
//                                     </span>
//                                   </div>
//                                   {item.id === "meeting" && (
//                                     <ChevronRight className="w-4 h-4 text-gray-400" />
//                                   )}
//                                 </button>

//                                 {item.id === "meeting" && hoveredMeeting && (
//                                   <div
//                                     className="absolute left-[50px] top-[60px] ml-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[10001] transition-all duration-300 ease-in-out"
//                                     onMouseEnter={() => setHoveredMeeting(true)}
//                                     onMouseLeave={() =>
//                                       setHoveredMeeting(false)
//                                     }
//                                   >
//                                     <div className="px-2">
//                                       <h4 className="text-xs font-semibold text-gray-500 mb-2 px-3">
//                                         Meeting Type
//                                       </h4>
//                                       {meetingTypes.map((meetingType) => {
//                                         const MeetingIcon = meetingType.icon;
//                                         return (
//                                           <button
//                                             key={meetingType.id}
//                                             onClick={() =>
//                                               handleMeetingType(meetingType.id)
//                                             }
//                                             className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${meetingType.bgColor} ${meetingType.hoverColor} cursor-pointer transform hover:scale-105`}
//                                           >
//                                             <div
//                                               className={`w-7 h-7 rounded-lg ${meetingType.bgColor} flex items-center justify-center mr-3`}
//                                             >
//                                               <MeetingIcon
//                                                 className={`w-3.5 h-3.5 ${meetingType.iconColor}`}
//                                               />
//                                             </div>
//                                             <span className="text-sm font-medium text-gray-700">
//                                               {meetingType.label}
//                                             </span>
//                                           </button>
//                                         );
//                                       })}
//                                     </div>
//                                   </div>
//                                 )}
//                               </div>
//                             );
//                           })}
//                         </div>
//                       </div>
//                     </div>
//                   </>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </header>

//       {!isSuperAdmin && !isSuperAdminRoute && (
//         <>
//           {showQuickCompanyForm && (
//             <QuickCompanyForm
//               onCompanyCreated={handleCompanyCreated}
//               onRequestClose={() => setShowQuickCompanyForm(false)}
//             />
//           )}
//           {showQuickContactForm && (
//             <QuickContactForm
//               companies={companies}
//               onContactCreated={handleContactCreated}
//               onRequestClose={() => setShowQuickContactForm(false)}
//             />
//           )}
//           {showQuickVendorForm && (
//             <QuickVendorForm
//               onVendorCreated={handleVendorCreated}
//               onRequestClose={() => setShowQuickVendorForm(false)}
//             />
//           )}
//           {showQuickDealForm && (
//             <QuickDealForm
//               companies={companies}
//               contacts={contacts}
//               onDealCreated={handleDealCreated}
//               onRequestClose={() => setShowQuickDealForm(false)}
//             />
//           )}
//           {showQuickTaskForm && (
//             <QuickTaskForm
//               companies={companies}
//               contacts={contacts}
//               onTaskCreated={handleTaskCreated}
//               onRequestClose={() => setShowQuickTaskForm(false)}
//             />
//           )}
//           {showQuickCallLogForm && (
//             <QuickCallLogForm
//               contacts={contacts}
//               onCallLogCreated={handleCallLogCreated}
//               onRequestClose={() => setShowQuickCallLogForm(false)}
//             />
//           )}
//         </>
//       )}

//       <SearchResults
//         isOpen={
//           isSearchOpen &&
//           debouncedQuery.length > 0 &&
//           !isSuperAdmin &&
//           !isSuperAdminRoute
//         }
//         onClose={handleSearchClose}
//         searchQuery={debouncedQuery}
//       />
//     </>
//   );
// };

// export default Header;

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  X,
  User,
  Building,
  Users,
  IndianRupeeIcon,
  CheckCircle,
  Calendar,
  Phone,
  ChevronRight,
  Sparkles,
  Clock,
  HelpCircle,
  Bell,
} from "lucide-react";
import SearchResults from "./SearchResults";
import QuickCompanyForm from "./company/QuickCompanyForm";
import QuickContactForm from "./contact/QuickContactForm";
import QuickVendorForm from "./vendor/QuickVendorForm";
import QuickDealForm from "./deal/QuickDealForm";
import QuickTaskForm from "./Task/QuickTaskForm";
import QuickCallLogForm from "./contact/QuickCallLogForm";
import API, { configureAxios } from "../services/api";
import { useAuth0 } from "@auth0/auth0-react";

// Shimmer UI Component for Branding
const BrandingShimmer = () => {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse"></div>
      <div className="h-5 w-24 bg-gray-200 animate-pulse rounded"></div>
    </div>
  );
};

const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [hoveredMeeting, setHoveredMeeting] = useState(false);
  const [showQuickCompanyForm, setShowQuickCompanyForm] = useState(false);
  const [showQuickContactForm, setShowQuickContactForm] = useState(false);
  const [showQuickVendorForm, setShowQuickVendorForm] = useState(false);
  const [showQuickDealForm, setShowQuickDealForm] = useState(false);
  const [showQuickTaskForm, setShowQuickTaskForm] = useState(false);
  const [showQuickCallLogForm, setShowQuickCallLogForm] = useState(false);
  const [showQuickMeetingForm, setShowQuickMeetingForm] = useState(false);
  const [meetingType, setMeetingType] = useState("");
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [branding, setBranding] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialEnd, setTrialEnd] = useState(null);
  const [trialLeftLabel, setTrialLeftLabel] = useState("");
  const [trialUsed, setTrialUsed] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [appStatus, setAppStatus] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);
  const [subscriptionLabel, setSubscriptionLabel] = useState("");

  const isSuperAdminRoute = location.pathname.startsWith("/super-admin");

  const getInitials = (name) => {
    if (!name || !name.trim()) return "?";
    const words = name.trim().split(" ");
    if (words.length === 1) {
      return words[0][0].toUpperCase();
    } else {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
  };

  const getRandomColor = (name) => {
    const colors = [
      "bg-red-500",
      "bg-green-500",
      "bg-blue-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-gray-500",
    ];
    if (!name) return colors[0];
    const charCode = name.charCodeAt(0);
    return colors[charCode % colors.length];
  };

  const renderCompanyLogo = () => {
    if (branding?.logoUrl) {
      // If logoUrl is a data URL, blob URL, or full HTTP URL, use it directly; otherwise prefix API URL
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
          className="h-9 w-9 rounded-full object-cover flex-shrink-0"
        />
      );
    } else {
      const src = `/DataCircles.png`;
      return (
        <img
          src={src}
          alt="Company Logo"
          className="h-9 w-9 rounded-md object-cover flex-shrink-0 drop-shadow-lg"
          style={{
            filter: "invert(100%)",
          }}
        />
      );
    }
  };

  useEffect(() => {
    if (!isSuperAdmin && !isSuperAdminRoute) {
      configureAxios(getAccessTokenSilently);
      const fetchData = async () => {
        setIsLoadingData(true);
        try {
          const [companiesRes, contactsRes, brandingRes, authRes] =
            await Promise.all([
              API.get("/companies"),
              API.get("/contacts"),
              API.get("/branding"),
              API.get("/auth/me"),
            ]);
          setCompanies(companiesRes.data);
          setContacts(contactsRes.data);
          setBranding(brandingRes.data);
          setIsTrialActive(authRes.data.isTrialActive);
          setTrialEnd(authRes.data.trialEnd);
          setTrialUsed(authRes.data.trialUsed);
          setIsPaymentConfirmed(authRes.data.isPaymentConfirmed);
          setAppStatus(authRes.data.appStatus);
          setCurrentPeriodEnd(authRes.data.currentPeriodEnd);
        } catch (err) {
          console.error("Failed to fetch data:", err);
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchData();
    } else {
      setBranding({ companyName: "Data Circles Admin", logoUrl: null });
    }
  }, [isSuperAdmin, isSuperAdminRoute, getAccessTokenSilently]);

  useEffect(() => {
    // Show badge if trial is active OR trial ended without payment
    const shouldShowTrialBadge =
      isTrialActive || (trialUsed && !isPaymentConfirmed);

    if (!shouldShowTrialBadge || !trialEnd) {
      setTrialLeftLabel("");
      return;
    }

    const endTime = new Date(trialEnd).getTime();

    function updateLabel() {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTrialLeftLabel("Trial ended");
        return;
      }

      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      if (days >= 1) {
        setTrialLeftLabel(`Trial ends in ${days} day${days > 1 ? "s" : ""}`);
      } else {
        setTrialLeftLabel(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0",
          )}:${String(seconds).padStart(2, "0")} left`,
        );
      }
    }

    updateLabel();
    let interval = null;

    // Only run interval if trial is still active
    if (isTrialActive && trialEnd) {
      interval = setInterval(updateLabel, 1000);
    }

    return () => interval && clearInterval(interval);
  }, [isTrialActive, trialEnd, trialUsed, isPaymentConfirmed]);

  useEffect(() => {
    // Show billing period countdown for active paid subscribers only
    if (!currentPeriodEnd || isTrialActive || !isPaymentConfirmed) {
      setSubscriptionLabel("");
      return;
    }
    const diff = new Date(currentPeriodEnd).getTime() - Date.now();
    if (diff <= 0) { setSubscriptionLabel(""); return; }
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    setSubscriptionLabel(`${days} day${days !== 1 ? "s" : ""} left in plan`);
  }, [currentPeriodEnd, isTrialActive, isPaymentConfirmed]);

  useEffect(() => {
    if (!isSuperAdminRoute && !isSuperAdmin) {
      if (isSearchOpen) {
        handleSearchClose();
      }
      if (isAddMenuOpen) {
        handleAddMenuClose();
      }
    }
  }, [location.pathname, isSuperAdminRoute, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdminRoute && !isSuperAdmin) {
      const handler = setTimeout(() => {
        setDebouncedQuery(searchQuery);
      }, 300);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [searchQuery, isSuperAdminRoute, isSuperAdmin]);

  const handleSearchFocus = () => setIsSearchOpen(true);
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 0 && !isSearchOpen) setIsSearchOpen(true);
    if (e.target.value.length === 0) {
      setIsSearchOpen(false);
      setDebouncedQuery("");
    }
  };
  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setDebouncedQuery("");
  };

  const handleGlobalAdd = () => setIsAddMenuOpen(!isAddMenuOpen);
  const handleAddMenuClose = () => {
    setIsAddMenuOpen(false);
    setHoveredMeeting(false);
  };

  const fetchFreshData = async () => {
    setIsLoadingData(true);
    try {
      const [companiesRes, contactsRes] = await Promise.all([
        API.get("/companies"),
        API.get("/contacts"),
      ]);
      setCompanies(companiesRes.data);
      setContacts(contactsRes.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAddItem = async (type) => {
    setIsAddMenuOpen(false);
    setHoveredMeeting(false);

    if (["contact", "deal", "task", "call-log"].includes(type)) {
      await fetchFreshData();
    }

    switch (type) {
      case "vendor":
        setShowQuickVendorForm(true);
        break;
      case "company":
        setShowQuickCompanyForm(true);
        break;
      case "contact":
        setShowQuickContactForm(true);
        break;
      case "deal":
        setShowQuickDealForm(true);
        break;
      case "task":
        setShowQuickTaskForm(true);
        break;
      case "call-log":
        setShowQuickCallLogForm(true);
        break;
      default:
        break;
    }
  };

  const handleMeetingType = (type) => {
    setIsAddMenuOpen(false);
    setHoveredMeeting(false);
    setMeetingType(type);
    setShowQuickMeetingForm(true);
  };

  const handleCompanyCreated = (newCompany) => {
    setCompanies((prev) => [...prev, newCompany]);
    setShowQuickCompanyForm(false);
  };

  const handleContactCreated = (newContact) => {
    setContacts((prev) => [...prev, newContact]);
    setShowQuickContactForm(false);
  };

  const handleVendorCreated = () => {
    setShowQuickVendorForm(false);
  };

  const handleDealCreated = () => {
    setShowQuickDealForm(false);
  };

  const handleTaskCreated = () => {
    setShowQuickTaskForm(false);
  };

  const handleCallLogCreated = () => {
    setShowQuickCallLogForm(false);
  };

  const handleMeetingCreated = () => {
    setShowQuickMeetingForm(false);
    setMeetingType("");
  };

  const addRecords = [
    {
      id: "company",
      label: "Company",
      icon: Building,
    },
    {
      id: "contact",
      label: "Contact",
      icon: User,
    },
    {
      id: "deal",
      label: "Deal",
      icon: IndianRupeeIcon,
    },
    {
      id: "vendor",
      label: "Vendor",
      icon: User,
    },
  ];

  const addActivities = [
    {
      id: "task",
      label: "Task",
      icon: CheckCircle,
    },
    {
      id: "call-log",
      label: "Call Log",
      icon: Phone,
    },
  ];

  const meetingTypes = [
    {
      id: "contact-meeting",
      label: "Contact Meeting",
      icon: Users,
      bgColor: "bg-pink-100",
      iconColor: "text-pink-600",
      hoverColor: "hover:bg-pink-50",
    },
    {
      id: "company-meeting",
      label: "Company Meeting",
      icon: Building,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      hoverColor: "hover:bg-blue-50",
    },
    {
      id: "vendor-meeting",
      label: "Vendor Meeting",
      icon: User,
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
      hoverColor: "hover:bg-yellow-50",
    },
  ];

  const isSelected = (id) => {
    switch (id) {
      case "company": return showQuickCompanyForm;
      case "contact": return showQuickContactForm;
      case "deal": return showQuickDealForm;
      case "vendor": return showQuickVendorForm;
      case "task": return showQuickTaskForm;
      case "call-log": return showQuickCallLogForm;
      default: return false;
    }
  };

  if (isSuperAdmin || isSuperAdminRoute) {
    return (
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-[9992] h-16">
        <div className="flex items-center justify-start h-full px-4 lg:pl-10">
          {/* Branding Section */}
          {isLoadingData ? (
            <BrandingShimmer />
          ) : (
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity duration-200"
              onClick={() => {
                navigate(
                  isSuperAdmin ? "/super-admin-overview" : "/settings/brand",
                  {
                    state: isSuperAdmin ? {} : { activeSection: "brand" },
                  },
                );
              }}
            >
              {renderCompanyLogo()}
              <div
                className="font-semibold text-lg whitespace-nowrap font-sf"
                style={{ color: branding?.colors?.secondary }}
              >
                {branding?.companyName || "Data Circles Admin"}
              </div>
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className="fixed top-0 right-0 bg-white border-b border-gray-200 shadow-sm z-[9992] h-16 flex items-center justify-between px-4 lg:px-6 transition-all duration-300 ease-in-out"
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        {/* Left Section: Page Title */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        </div>

        {/* Right Section: Promo Buttons, Search & Actions */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Promo Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <button className="w-[145px] h-[39px] flex items-center justify-center bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Book Free Demo
            </button>

            {(() => {
              const label = trialLeftLabel || subscriptionLabel;
              if (!label) return null;
              const isEnded = label.includes("ended");
              const isUrgent = !isEnded && (
                (label.includes("day") && parseInt(label) <= 2) ||
                (subscriptionLabel && parseInt(subscriptionLabel) <= 3)
              );
              const color = isEnded ? "#ef4444" : isUrgent ? "#f59e0b" : "#3b82f6";
              const bg = isEnded ? "#fef2f2" : isUrgent ? "#fffbeb" : "#eff6ff";
              const buttonText = isPaymentConfirmed ? "Manage" : "Upgrade Now";
              return (
                <div
                  className="w-[257px] h-[39px] flex items-center gap-2 p-1 rounded-md pr-2 border"
                  style={{ borderColor: color, backgroundColor: bg }}
                >
                  <div className="flex flex-col items-start leading-tight flex-1 pl-1">
                    <span className="text-xs font-semibold" style={{ color }}>
                      {label}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate("/settings/subscription")}
                    className="px-3 py-1 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                    style={{ backgroundColor: color }}
                  >
                    {buttonText}
                    <span className="text-[10px]">↑</span>
                  </button>
                </div>
              );
            })()}
          </div>
          {/* Search */}
          <div className="relative hidden lg:block w-[326px] h-[36px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Companies, Deals, Contacts"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              className="w-full h-full pl-9 pr-4 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-sans"
            />
          </div>

          <button className="text-gray-500 hover:text-gray-700 p-1">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button className="text-gray-500 hover:text-gray-700 p-1">
            <Bell className="w-5 h-5" />
          </button>

          {/* New Button (Global Add) */}
          <div className="relative group">
            <button
              onClick={handleGlobalAdd}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              New
            </button>

            {/* Redesigned Global Add Menu */}
            {isAddMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[9999] cursor-default"
                  onClick={handleAddMenuClose}
                />
                <div className="absolute right-0 top-12 w-[214px] h-[410px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[10000] py-4 flex flex-col transition-all duration-300 ease-in-out">
                  {/* Content Area */}
                  <div className="flex-1 px-4">
                    {/* Add Records Section */}
                    <div className="mb-2">
                      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                        Add Records
                      </h3>
                      <div className="space-y-0.5">
                        {addRecords.map((item) => {
                          const active = isSelected(item.id);
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleAddItem(item.id)}
                              className={`w-full flex items-center p-2 rounded-xl transition-all group ${active
                                ? "bg-gradient-to-r from-[#D0E0FF] to-white"
                                : "hover:bg-[#F2F2F7]"
                                }`}
                            >
                              <div className="w-8 h-8 flex items-center justify-center mr-2">
                                <item.icon className="w-5 h-5 text-black" strokeWidth={1.5} />
                              </div>
                              <span className="text-base font-bold text-gray-900 transition-all">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-gray-50 my-3" />

                    {/* Add Activities Section */}
                    <div className="mb-4">
                      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                        Add Activities
                      </h3>
                      <div className="space-y-0.5">
                        {addActivities.map((item) => {
                          const active = isSelected(item.id);
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleAddItem(item.id)}
                              className={`w-full flex items-center p-2 rounded-xl transition-all group ${active
                                ? "bg-gradient-to-r from-[#D0E0FF] to-white"
                                : "hover:bg-[#F2F2F7]"
                                }`}
                            >
                              <div className="w-8 h-8 flex items-center justify-center mr-2">
                                <item.icon className="w-5 h-5 text-black" strokeWidth={1.5} />
                              </div>
                              <span className="text-base font-bold text-gray-900 transition-all">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 border-t border-gray-50 pt-3 flex-shrink-0">
                    <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors group">
                      <HelpCircle className="w-4 h-4" />
                      <span className="text-[10px] font-medium leading-tight">Learn about & records & activities</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {!isSuperAdmin && !isSuperAdminRoute && (
        <>
          {showQuickCompanyForm && (
            <QuickCompanyForm
              onCompanyCreated={handleCompanyCreated}
              onRequestClose={() => setShowQuickCompanyForm(false)}
            />
          )}
          {showQuickContactForm && (
            <QuickContactForm
              companies={companies}
              onContactCreated={handleContactCreated}
              onRequestClose={() => setShowQuickContactForm(false)}
            />
          )}
          {showQuickVendorForm && (
            <QuickVendorForm
              onVendorCreated={handleVendorCreated}
              onRequestClose={() => setShowQuickVendorForm(false)}
            />
          )}
          {showQuickDealForm && (
            <QuickDealForm
              companies={companies}
              contacts={contacts}
              onDealCreated={handleDealCreated}
              onRequestClose={() => setShowQuickDealForm(false)}
            />
          )}
          {showQuickTaskForm && (
            <QuickTaskForm
              companies={companies}
              contacts={contacts}
              onTaskCreated={handleTaskCreated}
              onRequestClose={() => setShowQuickTaskForm(false)}
            />
          )}
          {showQuickCallLogForm && (
            <QuickCallLogForm
              contacts={contacts}
              onCallLogCreated={handleCallLogCreated}
              onRequestClose={() => setShowQuickCallLogForm(false)}
            />
          )}
        </>
      )}

      <SearchResults
        isOpen={
          isSearchOpen &&
          debouncedQuery.length > 0 &&
          !isSuperAdmin &&
          !isSuperAdminRoute
        }
        onClose={handleSearchClose}
        searchQuery={debouncedQuery}
      />
    </>
  );
};

export default Header;
