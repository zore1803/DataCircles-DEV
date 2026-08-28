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

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import dataCirclesLogo from "../assets/Datacircles logo.png";
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
  Timer,
  HelpCircle,
  LayoutDashboard,
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

import SearchIcon from "./common/SearchIcon";
import NotificationBell from "./NotificationBell";
import { DIM_CHROME_EVENT } from "../hooks/useSearchOverlayOpen";
// Shimmer UI Component for Branding
const BrandingShimmer = () => {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse"></div>
      <div className="h-5 w-24 bg-gray-200 animate-pulse rounded"></div>
    </div>
  );
};

const CRMIcon = ({ size = 20, style }) => (
  <svg width={size} height={size} viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M6.25 0L12.5 4.69542V14.0704H0V4.69542L6.25 0ZM7.8725 8.61063C8.31861 8.16521 8.54167 7.62438 8.54167 6.98813C8.54167 6.35174 8.31896 5.81056 7.87354 5.36458C7.42812 4.91847 6.88729 4.69542 6.25104 4.69542C5.61465 4.69542 5.07347 4.91813 4.6275 5.36354C4.18139 5.80896 3.95833 6.34979 3.95833 6.98604C3.95833 7.62243 4.18104 8.16361 4.62646 8.60958C5.07188 9.05569 5.61271 9.27875 6.24896 9.27875C6.88535 9.27875 7.42653 9.05604 7.8725 8.61063ZM5.51208 7.725C5.30958 7.52264 5.20833 7.27667 5.20833 6.98708C5.20833 6.6975 5.30958 6.45153 5.51208 6.24917C5.71444 6.04667 5.96042 5.94542 6.25 5.94542C6.53958 5.94542 6.78556 6.04667 6.98792 6.24917C7.19042 6.45153 7.29167 6.6975 7.29167 6.98708C7.29167 7.27667 7.19042 7.52264 6.98792 7.725C6.78556 7.9275 6.53958 8.02875 6.25 8.02875C5.96042 8.02875 5.71444 7.9275 5.51208 7.725ZM6.22854 11.7788C5.58799 11.7788 4.96479 11.8669 4.35896 12.0431C3.75313 12.2194 3.18049 12.4785 2.64104 12.8204H9.81896C9.28479 12.4785 8.71299 12.2194 8.10354 12.0431C7.49424 11.8669 6.86924 11.7788 6.22854 11.7788ZM1.25 5.32042V12.2756C1.96153 11.7126 2.74007 11.2806 3.58562 10.9798C4.43104 10.6791 5.31118 10.5288 6.22604 10.5288C7.15021 10.5288 8.03938 10.6778 8.89354 10.9758C9.74757 11.2739 10.5331 11.7044 11.25 12.2675V5.32042L6.25 1.57042L1.25 5.32042Z" fill={style?.color || "#1C1B1F"} />
  </svg>
);

const InvoicesIcon = ({ size = 20, style }) => (
  <svg width={size} height={size} viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M0 15.6408V0L1.15396 1.02562L2.33979 0L3.52563 1.02562L4.71146 0L5.8975 1.02562L7.08333 0L8.26917 1.02562L9.45521 0L10.641 1.02562L11.8269 0L13.0127 1.02562L14.1667 0V15.6408L13.0127 14.6152L11.8269 15.6408L10.641 14.6152L9.45521 15.6408L8.26917 14.6152L7.08333 15.6408L5.8975 14.6152L4.71146 15.6408L3.52563 14.6152L2.33979 15.6408L1.15396 14.6152L0 15.6408ZM2.29167 11.5223H11.875V10.2723H2.29167V11.5223ZM2.29167 8.44542H11.875V7.19542H2.29167V8.44542ZM2.29167 5.36854H11.875V4.11854H2.29167V5.36854ZM1.25 13.7371H12.9167V1.90375H1.25V13.7371Z" fill={style?.color || "#1C1B1F"} />
  </svg>
);

// Company glyph for the global Add menu. Sized via className (w-4 h-4) and
// coloured via currentColor so utility classes like text-black apply.
const CompanyAddIcon = ({ className, style }) => (
  <svg viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M0 14.5833V0H7.91646V3.33333H16.0575V10.1281H14.8077V4.58333H7.91646V6.66667H9.74354V7.91667H7.91646V10H9.74354V11.25H7.91646V13.3333H11.5704V14.5833H0ZM1.24979 13.3333H3.33333V11.25H1.24979V13.3333ZM1.24979 10H3.33333V7.91667H1.24979V10ZM1.24979 6.66667H3.33333V4.58333H1.24979V6.66667ZM1.24979 3.33333H3.33333V1.25H1.24979V3.33333ZM4.58312 13.3333H6.66667V11.25H4.58312V13.3333ZM4.58312 10H6.66667V7.91667H4.58312V10ZM4.58312 6.66667H6.66667V4.58333H4.58312V6.66667ZM4.58312 3.33333H6.66667V1.25H4.58312V3.33333ZM14.8077 16.25V14.5833H13.141V13.3333H14.8077V11.6667H16.0575V13.3333H17.7242V14.5833H16.0575V16.25H14.8077ZM11.5704 7.91667V6.66667H12.8204V7.91667H11.5704ZM11.5704 11.25V10H12.8204V11.25H11.5704Z" fill="currentColor" />
  </svg>
);

// Contact glyph for the global Add menu.
const ContactAddIcon = ({ className, style }) => (
  <svg viewBox="0 0 18 13" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M13.8542 7.54812V5.04813H11.3542V3.79813H13.8542V1.29812H15.1042V3.79813H17.6042V5.04813H15.1042V7.54812H13.8542ZM4.18833 4.97833C3.61833 4.40847 3.33333 3.72125 3.33333 2.91667C3.33333 2.11222 3.61833 1.425 4.18833 0.854999C4.75833 0.284999 5.44556 0 6.25 0C7.05444 0 7.74167 0.284999 8.31167 0.854999C8.88167 1.425 9.16667 2.11222 9.16667 2.91667C9.16667 3.72125 8.88167 4.40847 8.31167 4.97833C7.74167 5.54833 7.05444 5.83333 6.25 5.83333C5.44556 5.83333 4.75833 5.54833 4.18833 4.97833ZM0 12.1796V10.3269C0 9.91882 0.110833 9.5409 0.3325 9.19312C0.554167 8.84535 0.850417 8.57799 1.22125 8.39104C2.04486 7.98729 2.87576 7.68444 3.71396 7.4825C4.55215 7.28056 5.3975 7.17958 6.25 7.17958C7.1025 7.17958 7.94785 7.28056 8.78604 7.4825C9.62424 7.68444 10.4551 7.98729 11.2787 8.39104C11.6496 8.57799 11.9458 8.84535 12.1675 9.19312C12.3892 9.5409 12.5 9.91882 12.5 10.3269V12.1796H0ZM1.25 10.9296H11.25V10.3269C11.25 10.1581 11.2011 10.0019 11.1033 9.85812C11.0056 9.71451 10.8728 9.59729 10.7052 9.50646C9.98715 9.15285 9.25507 8.88493 8.50896 8.70271C7.76271 8.52063 7.00972 8.42958 6.25 8.42958C5.49028 8.42958 4.73729 8.52063 3.99104 8.70271C3.24493 8.88493 2.51285 9.15285 1.79479 9.50646C1.62715 9.59729 1.49444 9.71451 1.39667 9.85812C1.29889 10.0019 1.25 10.1581 1.25 10.3269V10.9296ZM7.42708 4.09375C7.75347 3.76736 7.91667 3.375 7.91667 2.91667C7.91667 2.45833 7.75347 2.06597 7.42708 1.73958C7.10069 1.41319 6.70833 1.25 6.25 1.25C5.79167 1.25 5.39931 1.41319 5.07292 1.73958C4.74653 2.06597 4.58333 2.45833 4.58333 2.91667C4.58333 3.375 4.74653 3.76736 5.07292 4.09375C5.39931 4.42014 5.79167 4.58333 6.25 4.58333C6.70833 4.58333 7.10069 4.42014 7.42708 4.09375Z" fill="currentColor" />
  </svg>
);

// Deal glyph for the global Add menu.
const DealAddIcon = ({ className, style }) => (
  <svg viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M1.50646 14.5833C1.08549 14.5833 0.729167 14.4375 0.4375 14.1458C0.145833 13.8542 0 13.4978 0 13.0769V4.42313C0 4.00215 0.145833 3.64583 0.4375 3.35417C0.729167 3.0625 1.08549 2.91667 1.50646 2.91667H5V1.50646C5 1.08549 5.14583 0.729167 5.4375 0.4375C5.72917 0.145833 6.08549 0 6.50646 0H9.32687C9.74785 0 10.1042 0.145833 10.3958 0.4375C10.6875 0.729167 10.8333 1.08549 10.8333 1.50646V2.91667H14.3269C14.7478 2.91667 15.1042 3.0625 15.3958 3.35417C15.6875 3.64583 15.8333 4.00215 15.8333 4.42313V13.0769C15.8333 13.4978 15.6875 13.8542 15.3958 14.1458C15.1042 14.4375 14.7478 14.5833 14.3269 14.5833H1.50646ZM1.50646 13.3333H14.3269C14.391 13.3333 14.4498 13.3066 14.5031 13.2531C14.5566 13.1998 14.5833 13.141 14.5833 13.0769V4.42313C14.5833 4.35896 14.5566 4.30021 14.5031 4.24687C14.4498 4.1934 14.391 4.16667 14.3269 4.16667H1.50646C1.44229 4.16667 1.38354 4.1934 1.33021 4.24687C1.27674 4.30021 1.25 4.35896 1.25 4.42313V13.0769C1.25 13.141 1.27674 13.1998 1.33021 13.2531C1.38354 13.3066 1.44229 13.3333 1.50646 13.3333ZM6.25 2.91667H9.58333V1.50646C9.58333 1.44229 9.5566 1.38354 9.50313 1.33021C9.44979 1.27674 9.39104 1.25 9.32687 1.25H6.50646C6.44229 1.25 6.38354 1.27674 6.33021 1.33021C6.27674 1.38354 6.25 1.44229 6.25 1.50646V2.91667Z" fill="currentColor" />
  </svg>
);

// Vendor glyph for the global Add menu.
const VendorAddIcon = ({ className, style }) => (
  <svg viewBox="0 0 13 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M6.25 9.39104C6.65486 9.39104 6.99917 9.24924 7.28292 8.96562C7.56653 8.68188 7.70833 8.33757 7.70833 7.93271C7.70833 7.52785 7.56653 7.18354 7.28292 6.89979C6.99917 6.61618 6.65486 6.47438 6.25 6.47438C5.84514 6.47438 5.50083 6.61618 5.21708 6.89979C4.93347 7.18354 4.79167 7.52785 4.79167 7.93271C4.79167 8.33757 4.93347 8.68188 5.21708 8.96562C5.50083 9.24924 5.84514 9.39104 6.25 9.39104ZM3.125 12.4679H9.375V12.165C9.375 11.869 9.29542 11.6062 9.13625 11.3767C8.97708 11.1469 8.7591 10.9706 8.48229 10.8477C8.13729 10.7003 7.77917 10.5863 7.40792 10.5056C7.03667 10.4249 6.65069 10.3846 6.25 10.3846C5.84931 10.3846 5.46333 10.4249 5.09208 10.5056C4.72083 10.5863 4.36271 10.7003 4.01771 10.8477C3.7409 10.9706 3.52292 11.1469 3.36375 11.3767C3.20458 11.6062 3.125 11.869 3.125 12.165V12.4679ZM10.9935 15.8333H1.50646C1.08549 15.8333 0.729167 15.6875 0.4375 15.3958C0.145833 15.1042 0 14.7478 0 14.3269V1.50646C0 1.08549 0.145833 0.729167 0.4375 0.4375C0.729167 0.145833 1.08549 0 1.50646 0H7.74042L12.5 4.75958V14.3269C12.5 14.7478 12.3542 15.1042 12.0625 15.3958C11.7708 15.6875 11.4145 15.8333 10.9935 15.8333ZM10.9935 14.5833C11.0577 14.5833 11.1165 14.5566 11.1698 14.5031C11.2233 14.4498 11.25 14.391 11.25 14.3269V5.29167L7.20833 1.25H1.50646C1.44229 1.25 1.38354 1.27674 1.33021 1.33021C1.27674 1.38354 1.25 1.44229 1.25 1.50646V14.3269C1.25 14.391 1.27674 14.4498 1.33021 14.5031C1.38354 14.5566 1.44229 14.5833 1.50646 14.5833H10.9935Z" fill="currentColor" />
  </svg>
);

// Task glyph for the global Add menu.
const TaskAddIcon = ({ className, style }) => (
  <svg viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M11.4583 16.1377V13.6377H8.95833V12.3877H11.4583V9.88771H12.7083V12.3877H15.2083V13.6377H12.7083V16.1377H11.4583ZM1.50646 14.2627C1.08549 14.2627 0.729167 14.1169 0.4375 13.8252C0.145833 13.5335 0 13.1772 0 12.7563V3.26917C0 2.84819 0.145833 2.49187 0.4375 2.20021C0.729167 1.90854 1.08549 1.76271 1.50646 1.76271H2.66021V0H3.94229V1.76271H8.58979V0H9.83979V1.76271H10.9935C11.4145 1.76271 11.7708 1.90854 12.0625 2.20021C12.3542 2.49187 12.5 2.84819 12.5 3.26917V8.19229C12.2917 8.1666 12.0833 8.15375 11.875 8.15375C11.6667 8.15375 11.4583 8.1666 11.25 8.19229V6.6025H1.25V12.7563C1.25 12.8204 1.27674 12.8792 1.33021 12.9325C1.38354 12.986 1.44229 13.0127 1.50646 13.0127H7.20354C7.20354 13.221 7.21639 13.4294 7.24208 13.6377C7.26764 13.846 7.31458 14.0544 7.38292 14.2627H1.50646ZM1.25 5.3525H11.25V3.26917C11.25 3.205 11.2233 3.14625 11.1698 3.09292C11.1165 3.03944 11.0577 3.01271 10.9935 3.01271H1.50646C1.44229 3.01271 1.38354 3.03944 1.33021 3.09292C1.27674 3.14625 1.25 3.205 1.25 3.26917V5.3525Z" fill="currentColor" />
  </svg>
);

// Call Log glyph for the global Add menu.
const CallLogAddIcon = ({ className, style }) => (
  <svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
    <path d="M12.9487 7.06729C12.9007 5.46896 12.3187 4.11188 11.2027 2.99604C10.0867 1.88007 8.72965 1.29806 7.13146 1.25V0C8.10368 0.0213889 9.01389 0.220625 9.86208 0.597708C10.7104 0.974931 11.4514 1.48028 12.085 2.11375C12.7185 2.74736 13.2238 3.48826 13.6008 4.33646C13.9781 5.18479 14.1774 6.09507 14.1987 7.06729H12.9487ZM9.61542 7.06729C9.56736 6.39951 9.30826 5.82924 8.83813 5.35646C8.36799 4.88382 7.7991 4.62611 7.13146 4.58333V3.33333C8.14535 3.37611 9.0091 3.75563 9.72271 4.47188C10.4365 5.18826 10.8174 6.0534 10.8654 7.06729H9.61542ZM13.2835 14.375C11.7131 14.375 10.1354 14.0099 8.55042 13.2796C6.96556 12.5493 5.50806 11.5192 4.17792 10.1892C2.85319 8.85903 1.82569 7.40278 1.09542 5.82042C0.365139 4.23819 0 2.66188 0 1.09146C0 0.841459 0.0833333 0.631736 0.25 0.462292C0.416667 0.292986 0.625 0.208333 0.875 0.208333H3.59292C3.80333 0.208333 3.98896 0.277014 4.14979 0.414375C4.31063 0.551598 4.41292 0.72118 4.45667 0.923125L4.93438 3.375C4.96743 3.6025 4.96049 3.79799 4.91354 3.96146C4.86646 4.12493 4.78201 4.26222 4.66021 4.37333L2.73562 6.24687C3.04535 6.8141 3.39924 7.35069 3.79729 7.85667C4.19521 8.3625 4.62604 8.84562 5.08979 9.30604C5.54701 9.7634 6.03312 10.1881 6.54812 10.5802C7.06312 10.9723 7.61924 11.3372 8.21646 11.6748L10.0865 9.78854C10.2169 9.65285 10.3748 9.55771 10.5602 9.50313C10.7455 9.44868 10.9381 9.43535 11.1379 9.46313L13.4519 9.93437C13.6623 9.98993 13.834 10.0973 13.9671 10.2565C14.1001 10.4156 14.1667 10.5962 14.1667 10.7981V13.5C14.1667 13.75 14.082 13.9583 13.9127 14.125C13.7433 14.2917 13.5335 14.375 13.2835 14.375ZM2.14417 5.06417L3.63146 3.64104C3.65812 3.61965 3.67549 3.59028 3.68354 3.55292C3.6916 3.51556 3.69028 3.48083 3.67958 3.44875L3.31729 1.58646C3.3066 1.54382 3.28792 1.51181 3.26125 1.49042C3.23458 1.46903 3.19986 1.45833 3.15708 1.45833H1.375C1.34292 1.45833 1.31618 1.46903 1.29479 1.49042C1.27354 1.51181 1.26292 1.53854 1.26292 1.57063C1.30556 2.14007 1.39875 2.71854 1.5425 3.30604C1.68611 3.89368 1.88667 4.47972 2.14417 5.06417ZM9.39417 12.266C9.94653 12.5235 10.5226 12.7204 11.1225 12.8567C11.7225 12.9928 12.2831 13.0737 12.8044 13.0994C12.8365 13.0994 12.8632 13.0887 12.8846 13.0673C12.906 13.0459 12.9167 13.0192 12.9167 12.9871V11.234C12.9167 11.1912 12.906 11.1565 12.8846 11.1298C12.8632 11.1031 12.8312 11.0844 12.7885 11.0738L11.0385 10.7179C11.0065 10.7072 10.9784 10.7059 10.9544 10.714C10.9303 10.722 10.9049 10.7394 10.8781 10.766L9.39417 12.266Z" fill="currentColor" />
  </svg>
);

const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // The search bar slides from its normal navbar slot to the centre and opens
  // an attached results panel. searchOrigin captures where it started (via
  // getBoundingClientRect on the real slot, so it's exact for any screen
  // width) so the overlay can begin exactly on top of it and only then
  // transition to centred — a real slide, not a teleport.
  const searchSlotRef = useRef(null);
  const mobileSearchSlotRef = useRef(null);
  const [searchOrigin, setSearchOrigin] = useState(null);
  const [searchCentered, setSearchCentered] = useState(false);
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
  const { getAccessTokenSilently, user } = useAuth0();
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
  const [dynamicCrumbName, setDynamicCrumbName] = useState("");

  useEffect(() => {
    const companyMatch = location.pathname.match(/^\/companies\/([^/]+)$/);
    const contactMatch = location.pathname.match(/^\/contacts\/([^/]+)$/);
    const vendorMatch = location.pathname.match(/^\/vendors\/([^/]+)$/);
    const match = companyMatch || contactMatch || vendorMatch;
    if (!match) {
      setDynamicCrumbName("");
      return;
    }
    const entityId = match[1];
    const isContact = !!contactMatch;
    const isVendor = !!vendorMatch;
    // Vendors have no preloaded list in this header (unlike companies/
    // contacts), so they always fall through to the fetch below.
    const list = isContact ? contacts : isVendor ? [] : companies;
    const endpoint = isContact ? "contacts" : isVendor ? "vendors" : "companies";
    const cached = list.find((c) => c._id === entityId);
    if (cached) {
      setDynamicCrumbName(cached.name);
      return;
    }
    let cancelled = false;
    API.get(`/${endpoint}/${entityId}`)
      .then((res) => {
        if (!cancelled) setDynamicCrumbName(res.data?.name || "");
      })
      .catch(() => {
        if (!cancelled) setDynamicCrumbName("");
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, companies, contacts]);

  const ROUTE_LABELS = {
    "/": "Dashboard",
    "/companies": "Companies",
    "/deals": "Deals",
    "/contacts": "Contacts",
    "/vendors": "Vendors",
    "/products": "Products and Services",
    "/insights": "Insights",
    "/settings": "Settings",
    "/tasks": "Tasks and Meetings",
    "/calender": "Calendar",
    "/invoices": "Invoices",
    "/sales-return": "Sales Return",
    "/sales-subscription": "Subscription",
    "/e-invoicing": "E-Invoicing",
    "/purchase": "Purchases",
    "/purchase-order": "Purchase Orders",
    "/purchase-return": "Purchase Return",
    "/payments-timeline": "Timeline",
    "/journals": "Journals",
    "/expenses": "Expenses",
    "/indirect-income": "Indirect Income",
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === "/" || path === "") return [{ label: "Dashboard", path: "/" }];
    const firstSegment = "/" + path.split("/").filter(Boolean)[0];
    const label = ROUTE_LABELS[firstSegment] || firstSegment.slice(1);
    const crumbs = [{ label, path: firstSegment }];
    if (dynamicCrumbName) crumbs.push({ label: dynamicCrumbName, path });
    return crumbs;
  };

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
        setTrialLeftLabel(`${days} Day${days > 1 ? "s" : ""} Left!`);
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
    setSubscriptionLabel(`${days} Day${days !== 1 ? "s" : ""} Left!`);
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

  // Desktop and mobile each have their own search field in different spots
  // in the layout (only one is ever actually visible at a given width), so
  // the slide needs to originate from whichever one was actually clicked.
  // Dispatched right here, synchronously with the state change that opens/
  // closes the overlay, rather than from a useEffect keyed on isSearchOpen.
  // An effect only runs after Header's own render commits, and the sidebar's
  // useSearchOverlayOpen() hook then needs a further render to react to the
  // event — two extra cycles the backdrop (which paints in this same render)
  // doesn't wait for, so the sidebar/footer dim visibly lagged behind it.
  // Firing from the handler collapses that gap to effectively nothing.
  const dispatchDimChrome = (open) => {
    window.dispatchEvent(new CustomEvent(DIM_CHROME_EVENT, { detail: { open } }));
  };

  const openSearchOverlay = (fromRef) => {
    const ref = fromRef || searchSlotRef;
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setSearchOrigin({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
    setSearchCentered(false);
    setIsSearchOpen(true);
    dispatchDimChrome(true);
  };
  const handleSearchFocus = (fromRef) => openSearchOverlay(fromRef);
  const handleSearchChange = (e, fromRef) => {
    setSearchQuery(e.target.value);
    if (!isSearchOpen) openSearchOverlay(fromRef);
    // Backspacing to empty clears results but stays open on "Start typing to
    // search" — it shouldn't slide back to the navbar on its own. Only an
    // explicit close (X, backdrop click, Escape) does that.
    if (e.target.value.length === 0) setDebouncedQuery("");
  };
  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchCentered(false);
    setSearchQuery("");
    setDebouncedQuery("");
    dispatchDimChrome(false);
  };

  // Trigger the slide a tick after mount, once the overlay has painted at its
  // origin position — flipping searchCentered then lets the transition
  // classes below animate left/width/top to the centred target.
  useEffect(() => {
    if (!isSearchOpen || !searchOrigin) return;
    const id = requestAnimationFrame(() => setSearchCentered(true));
    return () => cancelAnimationFrame(id);
  }, [isSearchOpen, searchOrigin]);

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

  const handleAddItem = (type) => {
    setIsAddMenuOpen(false);
    setHoveredMeeting(false);

    // Open the form immediately for a snappy response.
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

    // Load the company/contact dropdown data in the background — the form
    // renders instantly and its selects populate once these resolve, instead
    // of the whole panel waiting on two network calls before appearing.
    if (["contact", "deal", "task", "call-log"].includes(type)) {
      fetchFreshData();
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
      icon: CompanyAddIcon,
    },
    {
      id: "contact",
      label: "Contact",
      icon: ContactAddIcon,
    },
    {
      id: "deal",
      label: "Deal",
      icon: DealAddIcon,
    },
    {
      id: "vendor",
      label: "Vendor",
      icon: VendorAddIcon,
    },
  ];

  const addActivities = [
    {
      id: "task",
      label: "Task",
      icon: TaskAddIcon,
    },
    {
      id: "call-log",
      label: "Call Log",
      icon: CallLogAddIcon,
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
        className="hidden lg:flex fixed top-0 right-0 bg-white border-b border-gray-200 z-[9992] h-16 items-center justify-between px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out"
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        <img
          src="/DC Logo Export.png"
          alt="DataCircles"
          className="h-9 w-auto object-contain"
        />

        {/* Right Section: Promo Buttons, Search & Actions */}
        <div className="flex items-center gap-2 lg:gap-4 ml-auto">
          {/* Promo Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {(() => {
              const label = trialLeftLabel || subscriptionLabel;
              if (!label) return null;
              const isEnded = label.includes("ended");
              const isUrgent = !isEnded && (
                (/day/i.test(label) && parseInt(label) <= 2) ||
                (subscriptionLabel && parseInt(subscriptionLabel) <= 3)
              );
              // The pill itself is neutral; urgency is carried by the label's
              // colour so the design stays intact when time is running out.
              const labelColor = isEnded
                ? "#ef4444"
                : isUrgent
                  ? "#B54708"
                  : "#525866";
              // Always "Upgrade Plan" — the subscription screen it opens covers
              // both upgrading and managing an existing plan.
              const buttonText = "Upgrade Plan";
              return (
                // 240px is the design width, but the label is dynamic ("7 Days
                // Left!" vs "26809 days left in plan"), so it's a minimum the
                // pill grows past rather than a cap that clips the text.
                <div className="box-border flex flex-row items-center justify-between gap-4 min-w-[240px] h-[42px] p-[10px] border border-[#E1E4EA] rounded-[96px]">
                  <div className="flex flex-row items-center gap-1 min-w-0">
                    <Timer className="w-5 h-5 flex-shrink-0 text-[#525866]" />
                    <span
                      className="flex items-center h-5 font-inter text-[14px] font-normal leading-[120%] tracking-[-0.5px] whitespace-nowrap"
                      style={{ color: labelColor }}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate("/settings/subscription")}
                      className="box-border flex flex-row items-center justify-center gap-2 h-8 px-3 flex-shrink-0 rounded-full border border-[#0C4FCD] text-white font-inter text-[12px] leading-5 text-center whitespace-nowrap transition-opacity hover:opacity-90"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%), var(--btn-primary)",
                        boxShadow:
                          "inset 0px 0px 0px 1.8px rgba(255, 255, 255, 0.25)",
                      }}
                    >
                      {buttonText}
                    </button>
                    {!isLoadingData && (
                      <button
                        className="box-border flex flex-row items-center justify-center gap-2 h-8 px-3 flex-shrink-0 rounded-full border border-[#0C4FCD] text-white font-inter text-[12px] leading-5 text-center whitespace-nowrap transition-opacity hover:opacity-90"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%), var(--btn-primary)",
                          boxShadow:
                            "inset 0px 0px 0px 1.8px rgba(255, 255, 255, 0.25)",
                        }}
                      >
                        Book a Call
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Search — the slot below reserves the layout space (so nothing
              else in the navbar jumps) but is only ever visible when the
              overlay isn't open; the overlay is what's actually interactive
              once search is active. */}
          <div
            ref={searchSlotRef}
            className={`relative hidden lg:block w-[326px] h-[42px] transition-opacity duration-150 ${isSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            <SearchIcon className="absolute left-4 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866]" />
            <input
              type="text"
              placeholder="Search Companies, Deals, Contacts"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => handleSearchFocus()}
              className="w-full h-full pl-11 pr-4 bg-white border border-gray-200 rounded-full text-sm text-gray-700 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-sans"
            />
          </div>

          {isSearchOpen && searchOrigin && (
            <>
              {/* Plain opaque dim — no blur. Sidebar/pagination dim themselves
                  independently via DIM_CHROME_EVENT; this is just the tint,
                  and also doubles as the click-outside-to-close target. */}
              <div
                className="fixed inset-0 z-[9998] bg-black/40"
                onClick={handleSearchClose}
              />
              {/* Starts pinned exactly over the real search slot (searchOrigin,
                  captured via getBoundingClientRect) and, once searchCentered
                  flips a tick later, transitions left/width/top to the centred
                  target — a real slide from where it was, not a jump-cut.
                  z-index above the backdrop (9998) — and above the sidebar
                  (9995) and the pagination bar (9992), which otherwise sat in
                  front of the backdrop and stayed sharp/undimmed. */}
              <div
                className="fixed z-[9999] transition-all duration-300 ease-out"
                style={
                  searchCentered
                    ? { top: 10, left: "50%", width: 760, transform: "translateX(-50%)" }
                    : { top: searchOrigin.top, left: searchOrigin.left, width: searchOrigin.width, transform: "translateX(0)" }
                }
              >
                <div className="relative">
                  <SearchIcon className="absolute left-4 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866] z-10" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search Companies, Deals, Contacts"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full h-[42px] pl-11 pr-11 bg-white border border-gray-200 rounded-full text-sm text-gray-700 placeholder:text-gray-500 outline-none ring-2 ring-blue-500 border-transparent font-sans shadow-lg"
                  />
                  {/* Clears the typed text only — the overlay itself stays
                      open (back to the collapsed "start typing" category
                      rows), same as backspacing it out by hand. Closing the
                      whole panel is still backdrop-click / Escape. */}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                      className="absolute right-3.5 -translate-y-1/2 top-1/2 z-10 flex items-center justify-center w-5 h-5 rounded-full text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {/* Attached results panel, docked directly under the bar. Sized
                    to its content (up to two-thirds of the viewport) rather
                    than always claiming a fixed height — a couple of matches
                    no longer leave a tall mostly-empty box underneath them.
                    This element does the scrolling itself (overflow-y-auto
                    with a real maxHeight) — SearchResults' own wrapper used to
                    be `h-full`, but percentage heights don't resolve against a
                    maxHeight-only ancestor, so it silently stopped scrolling
                    and results past the fold were just clipped instead. */}
                {/* Solid the instant it's mounted — no opacity fade. It used to
                    fade in with the bar's slide, but that meant it spent its
                    first ~200ms as a half-transparent grey wash with the page
                    content showing through, not a crisp white panel. */}
                <div
                  className="mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-y-auto"
                  style={{ maxHeight: "66vh" }}
                >
                  <SearchResults
                    variant="panel"
                    isOpen={isSearchOpen}
                    onClose={handleSearchClose}
                    searchQuery={debouncedQuery}
                  />
                </div>
              </div>
            </>
          )}

          <NotificationBell variant="desktop" />

          {/* New Button (Global Add) */}
          <div className="relative group">
            <button
              onClick={handleGlobalAdd}
              title="New"
              className="flex items-center justify-center w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full ring-4 ring-blue-200 transition-colors"
            >
              {isAddMenuOpen ? (
                <X className="w-4 h-4" strokeWidth={3} />
              ) : (
                <Plus className="w-4 h-4" strokeWidth={3} />
              )}
            </button>

            {/* Redesigned Global Add Menu */}
            {isAddMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[9999] cursor-default"
                  onClick={handleAddMenuClose}
                />
                <div className="absolute right-0 top-12 w-[160px] bg-white rounded-xl shadow-2xl border border-gray-100 z-[10000] py-2 flex flex-col transition-all duration-300 ease-in-out">
                  {/* Content Area */}
                  <div className="flex-1 px-2">
                    {/* Add Records Section */}
                    <div className="mb-1">
                      <div className="space-y-0.5">
                        {addRecords.map((item) => {
                          const active = isSelected(item.id);
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleAddItem(item.id)}
                              className={`w-full flex items-center p-1 rounded-lg transition-all group ${active
                                ? "bg-gradient-to-r from-[#D0E0FF] to-white"
                                : "hover:bg-[#F2F2F7]"
                                }`}
                            >
                              <div className="w-5 h-5 flex items-center justify-center mr-2.5 flex-shrink-0">
                                <item.icon className="w-[18px] h-[18px] text-black" />
                              </div>
                              <span className="text-sm font-medium text-gray-900 transition-all">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 my-1.5" />

                    {/* Add Activities Section */}
                    <div className="mb-1">
                      <div className="space-y-0.5">
                        {addActivities.map((item) => {
                          const active = isSelected(item.id);
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleAddItem(item.id)}
                              className={`w-full flex items-center p-1 rounded-lg transition-all group ${active
                                ? "bg-gradient-to-r from-[#D0E0FF] to-white"
                                : "hover:bg-[#F2F2F7]"
                                }`}
                            >
                              <div className="w-5 h-5 flex items-center justify-center mr-2.5 flex-shrink-0">
                                <item.icon className="w-[18px] h-[18px] text-black" />
                              </div>
                              <span className="text-sm font-medium text-gray-900 transition-all">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>

        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-[9992] bg-[#FAFAFA] h-[54px] flex items-center border-b border-[#ECECEC]">
        <div className="w-full max-w-[440px] mx-auto flex items-center justify-between px-4 py-2 gap-3 h-full">
          {/* Logo — opens the sidebar on mobile */}
          <img
            src={dataCirclesLogo}
            alt="Logo"
            className="w-9 h-9 rounded-md object-cover flex-shrink-0 cursor-pointer"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"))
            }
          />

          {/* Right cluster */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Search pill */}
            <div
              ref={mobileSearchSlotRef}
              className={`flex items-center gap-2 px-2.5 h-8 border border-[#E1E4EA] rounded-full flex-1 min-w-0 max-w-[172px] transition-opacity duration-150 ${isSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              <SearchIcon className="text-[#525866] flex-shrink-0 w-5 h-5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e, mobileSearchSlotRef)}
                onFocus={() => handleSearchFocus(mobileSearchSlotRef)}
                className="bg-transparent outline-none text-sm text-[#525866] placeholder:text-[#525866] w-full min-w-0"
              />
            </div>

            {/* Notification bell */}
            <NotificationBell variant="mobile" />

            {/* Add button */}
            <div className="relative flex-shrink-0">
              <button
                onClick={handleGlobalAdd}
                title="New"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0085FF] border border-[#0085FF]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%), #0085FF",
                  boxShadow: "inset 0px 0px 0px 1.8px rgba(255,255,255,0.25)",
                }}
              >
                {isAddMenuOpen ? (
                  <X className="w-4 h-4 text-white" />
                ) : (
                  <Plus className="w-4 h-4 text-white" />
                )}
              </button>

              {isAddMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[9999] cursor-default"
                    onClick={handleAddMenuClose}
                  />
                  <div className="absolute right-0 top-10 w-[min(150px,calc(100vw-32px))] max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 z-[10000] py-2.5 flex flex-col transition-all duration-300 ease-in-out">
                    <div className="flex-1 px-2.5">
                      <div className="mb-1.5">
                        <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1.5">
                          Add Records
                        </h3>
                        <div className="space-y-0">
                          {addRecords.map((item) => {
                            const active = isSelected(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAddItem(item.id)}
                                className={`w-full flex items-center p-1.5 rounded-lg transition-all group ${active
                                  ? "bg-gradient-to-r from-[#D0E0FF] to-white"
                                  : "hover:bg-[#F2F2F7]"
                                  }`}
                              >
                                <div className="w-6 h-6 flex items-center justify-center mr-1.5">
                                  <item.icon className="w-4 h-4 text-black" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium text-gray-900 transition-all truncate">
                                  {item.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-t border-gray-50 my-1.5" />

                      <div className="mb-1.5">
                        <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1.5">
                          Add Activities
                        </h3>
                        <div className="space-y-0">
                          {addActivities.map((item) => {
                            const active = isSelected(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAddItem(item.id)}
                                className={`w-full flex items-center p-1.5 rounded-lg transition-all group ${active
                                  ? "bg-gradient-to-r from-[#D0E0FF] to-white"
                                  : "hover:bg-[#F2F2F7]"
                                  }`}
                              >
                                <div className="w-6 h-6 flex items-center justify-center mr-1.5">
                                  <item.icon className="w-4 h-4 text-black" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium text-gray-900 transition-all truncate">
                                  {item.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Avatar */}
            <div className="flex items-center justify-center w-10 h-10 p-1 bg-white border border-[#E5E5E5] rounded-full flex-shrink-0">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-medium text-sm ${getRandomColor(user?.name)}`}
                title={user?.name || ""}
              >
                {getInitials(user?.name)}
              </div>
            </div>
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

    </>
  );
};

export default Header;
