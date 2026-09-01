import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NAV_RESET_EVENT } from "../hooks/useNavReset";
import useSearchOverlayOpen from "../hooks/useSearchOverlayOpen";


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
  Warehouse,
  BarChart3,
  Settings,
  LogOut,
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
  Calculator,
  Crown,
  Pin,
  PinOff,
} from "lucide-react";
import API from "../services/api";
import DashboardIcon from "./common/DashboardIcon";
/*
 * Clicking the nav entry for the page you're already on is a no-op as far as
 * the router is concerned — the path doesn't change, so nothing re-renders and
 * any panel or drawer layered over the page stays open. Announce it instead so
 * those pages can drop back to their base view.
 *
 * Only an exact match is intercepted: from a sub-route like /companies/123 the
 * click still needs to navigate up to /companies.
 */
const handleSamePageNav = (e, href) => {
  if (typeof window === "undefined" || window.location.pathname !== href) return;
  e.preventDefault();
  window.dispatchEvent(new CustomEvent(NAV_RESET_EVENT, { detail: { path: href } }));
};


const CompaniesIcon = (props) => (
  <svg viewBox="-1.11 -2.11 22.22 22.22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H8C8.55 0 9.02083 0.195833 9.4125 0.5875C9.80417 0.979167 10 1.45 10 2V4H18C18.55 4 19.0208 4.19583 19.4125 4.5875C19.8042 4.97917 20 5.45 20 6V16C20 16.55 19.8042 17.0208 19.4125 17.4125C19.0208 17.8042 18.55 18 18 18H2ZM2 16H8V14H2V16ZM2 12H8V10H2V12ZM2 8H8V6H2V8ZM2 4H8V2H2V4ZM10 16H18V6H10V16ZM13 10C12.7167 10 12.4792 9.90417 12.2875 9.7125C12.0958 9.52083 12 9.28333 12 9C12 8.71667 12.0958 8.47917 12.2875 8.2875C12.4792 8.09583 12.7167 8 13 8H15C15.2833 8 15.5208 8.09583 15.7125 8.2875C15.9042 8.47917 16 8.71667 16 9C16 9.28333 15.9042 9.52083 15.7125 9.7125C15.5208 9.90417 15.2833 10 15 10H13ZM13 14C12.7167 14 12.4792 13.9042 12.2875 13.7125C12.0958 13.5208 12 13.2833 12 13C12 12.7167 12.0958 12.4792 12.2875 12.2875C12.4792 12.0958 12.7167 12 13 12H15C15.2833 12 15.5208 12.0958 15.7125 12.2875C15.9042 12.4792 16 12.7167 16 13C16 13.2833 15.9042 13.5208 15.7125 13.7125C15.5208 13.9042 15.2833 14 15 14H13Z" fill="currentColor" />
  </svg>
);
const DealsIcon = (props) => (
  // The artwork runs edge-to-edge in its own 18x16 box, so at the shared
  // `w-5 h-5` it rendered wider and heavier than the other CRM glyphs, which
  // all carry some slack inside their viewBox. Padding the viewBox scales the
  // handshake down to match them without touching the path.
  <svg viewBox="-0.97 -1.82 19.46 19.46" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8.57765 14.5673C8.65987 14.5673 8.74348 14.5481 8.82848 14.5096C8.91335 14.4711 8.98036 14.4273 9.02953 14.3781L15.6945 7.71313C15.8826 7.52507 16.0242 7.32417 16.1193 7.11042C16.2143 6.89681 16.2618 6.6725 16.2618 6.4375C16.2618 6.19389 16.2143 5.95937 16.1193 5.73396C16.0242 5.5084 15.8826 5.3059 15.6945 5.12646L12.3612 1.79313C12.1817 1.60507 11.9873 1.4675 11.7779 1.38042C11.5686 1.29347 11.3421 1.25 11.0985 1.25C10.8635 1.25 10.6378 1.29347 10.4214 1.38042C10.205 1.4675 10.0055 1.60507 9.82286 1.79313L9.34515 2.27083L10.8868 3.82521C11.0738 4.00368 11.2119 4.20722 11.3012 4.43583C11.3904 4.66444 11.4349 4.9016 11.4349 5.14729C11.4349 5.6559 11.2651 6.08007 10.9254 6.41979C10.5856 6.75951 10.1615 6.92937 9.65286 6.92937C9.40717 6.92937 9.16918 6.88875 8.9389 6.8075C8.70876 6.72639 8.50446 6.5966 8.32598 6.41813L6.74744 4.8525L3.12578 8.47417C3.06272 8.53722 3.01543 8.60778 2.9839 8.68583C2.95237 8.76375 2.93661 8.84389 2.93661 8.92625C2.93661 9.08 2.98897 9.21139 3.09369 9.32042C3.19841 9.42945 3.32765 9.48396 3.4814 9.48396C3.56376 9.48396 3.64737 9.46472 3.73223 9.42625C3.81723 9.38778 3.88432 9.34396 3.93348 9.29479L6.67057 6.55771L7.54869 7.43583L4.82432 10.1729C4.7614 10.236 4.71418 10.3065 4.68265 10.3846C4.65112 10.4625 4.63536 10.5426 4.63536 10.625C4.63536 10.7735 4.68904 10.9014 4.7964 11.0088C4.90376 11.1161 5.03168 11.1698 5.18015 11.1698C5.26251 11.1698 5.34612 11.1506 5.43098 11.1121C5.51598 11.0736 5.583 11.0298 5.63203 10.9806L8.46536 8.16021L9.34369 9.03833L6.52307 11.8717C6.46543 11.9208 6.41953 11.9878 6.38536 12.0727C6.35119 12.1577 6.33411 12.2413 6.33411 12.3235C6.33411 12.4722 6.38779 12.6001 6.49515 12.7075C6.60251 12.8149 6.73043 12.8685 6.8789 12.8685C6.96112 12.8685 7.04126 12.8528 7.11932 12.8212C7.19723 12.7897 7.26772 12.7424 7.33078 12.6794L10.1641 9.85896L11.0424 10.7371L8.20911 13.5704C8.14605 13.6335 8.09876 13.7067 8.06723 13.79C8.03571 13.8733 8.01994 13.9535 8.01994 14.0304C8.01994 14.1842 8.0771 14.3121 8.1914 14.4142C8.30571 14.5163 8.43446 14.5673 8.57765 14.5673ZM8.56473 15.8171C8.09362 15.8171 7.68286 15.6537 7.33244 15.3269C6.98203 14.9999 6.79883 14.5928 6.78286 14.1056C6.31064 14.0735 5.91612 13.9058 5.59932 13.6025C5.28251 13.299 5.11078 12.9005 5.08411 12.4069C4.5905 12.3749 4.19147 12.2024 3.88703 11.8894C3.58244 11.5763 3.41946 11.1826 3.39807 10.7081C2.90237 10.6762 2.49321 10.4965 2.17057 10.169C1.84793 9.84146 1.68661 9.42722 1.68661 8.92625C1.68661 8.68056 1.73335 8.43986 1.82682 8.20417C1.92029 7.96861 2.05626 7.76167 2.23473 7.58333L6.74744 3.08333L9.18828 5.52396C9.2373 5.5816 9.30161 5.62757 9.38119 5.66188C9.46091 5.69604 9.54723 5.71312 9.64015 5.71312C9.79182 5.71312 9.92265 5.66292 10.0327 5.5625C10.1428 5.46208 10.1979 5.33063 10.1979 5.16813C10.1979 5.07521 10.1808 4.98896 10.1466 4.90938C10.1123 4.82979 10.0663 4.76542 10.0087 4.71625L7.08557 1.79313C6.90612 1.60507 6.71036 1.4675 6.49828 1.38042C6.28619 1.29347 6.05835 1.25 5.81473 1.25C5.57973 1.25 5.35675 1.29347 5.14578 1.38042C4.93467 1.4675 4.73515 1.60507 4.54723 1.79313L1.80994 4.54313C1.65828 4.69479 1.53411 4.87403 1.43744 5.08083C1.34078 5.2875 1.2839 5.49826 1.26682 5.71312C1.2496 5.89049 1.25758 6.06597 1.29078 6.23958C1.32383 6.41319 1.38203 6.57639 1.46536 6.72917L0.545568 7.64896C0.357512 7.37757 0.215984 7.07361 0.120984 6.73708C0.0258453 6.40056 -0.0131825 6.05924 0.00390083 5.71312C0.0209842 5.32951 0.107512 4.95903 0.263484 4.60167C0.419456 4.24431 0.637929 3.92514 0.918901 3.64417L3.64807 0.915C3.96015 0.611527 4.29966 0.383194 4.66661 0.23C5.03355 0.0766662 5.41897 0 5.82286 0C6.22661 0 6.61064 0.0766662 6.97494 0.23C7.33939 0.383194 7.67328 0.611527 7.97661 0.915L8.45432 1.3925L8.93182 0.915C9.24376 0.611527 9.58189 0.383194 9.94619 0.23C10.3105 0.0766662 10.6946 0 11.0985 0C11.5024 0 11.8878 0.0766662 12.2547 0.23C12.6217 0.383194 12.9569 0.611527 13.2604 0.915L16.5729 4.2275C16.8762 4.53097 17.1086 4.87632 17.2699 5.26354C17.4312 5.65076 17.5118 6.04632 17.5118 6.45021C17.5118 6.8541 17.4312 7.23819 17.2699 7.6025C17.1086 7.96681 16.8762 8.30062 16.5729 8.60396L9.90765 15.2563C9.7239 15.44 9.51696 15.5794 9.28682 15.6746C9.05654 15.7696 8.81585 15.8171 8.56473 15.8171Z" fill="currentColor" />
  </svg>
);

const ActivityIcon = (props) => (
  <svg viewBox="-2.11 -1.11 22.22 22.22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 20C1.45 20 0.979167 19.8042 0.5875 19.4125C0.195833 19.0208 0 18.55 0 18V4C0 3.45 0.195833 2.97917 0.5875 2.5875C0.979167 2.19583 1.45 2 2 2H3V1C3 0.716667 3.09583 0.479167 3.2875 0.2875C3.47917 0.0958333 3.71667 0 4 0C4.28333 0 4.52083 0.0958333 4.7125 0.2875C4.90417 0.479167 5 0.716667 5 1V2H13V1C13 0.716667 13.0958 0.479167 13.2875 0.2875C13.4792 0.0958333 13.7167 0 14 0C14.2833 0 14.5208 0.0958333 14.7125 0.2875C14.9042 0.479167 15 0.716667 15 1V2H16C16.55 2 17.0208 2.19583 17.4125 2.5875C17.8042 2.97917 18 3.45 18 4V18C18 18.55 17.8042 19.0208 17.4125 19.4125C17.0208 19.8042 16.55 20 16 20H2ZM2 18H16V8H2V18ZM2 6H16V4H2V6ZM5 12C4.71667 12 4.47917 11.9042 4.2875 11.7125C4.09583 11.5208 4 11.2833 4 11C4 10.7167 4.09583 10.4792 4.2875 10.2875C4.47917 10.0958 4.71667 10 5 10H13C13.2833 10 13.5208 10.0958 13.7125 10.2875C13.9042 10.4792 14 10.7167 14 11C14 11.2833 13.9042 11.5208 13.7125 11.7125C13.5208 11.9042 13.2833 12 13 12H5ZM5 16C4.71667 16 4.47917 15.9042 4.2875 15.7125C4.09583 15.5208 4 15.2833 4 15C4 14.7167 4.09583 14.4792 4.2875 14.2875C4.47917 14.0958 4.71667 14 5 14H10C10.2833 14 10.5208 14.0958 10.7125 14.2875C10.9042 14.4792 11 14.7167 11 15C11 15.2833 10.9042 15.5208 10.7125 15.7125C10.5208 15.9042 10.2833 16 10 16H5Z" fill="currentColor" />
  </svg>
);
const InsightsIcon = (props) => (
  <svg viewBox="-1.35 -0.93 18.65 18.65" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.50646 15.8333C1.08549 15.8333 0.729167 15.6875 0.4375 15.3958C0.145833 15.1042 0 14.7478 0 14.3269V1.50646C0 1.08549 0.145833 0.729167 0.4375 0.4375C0.729167 0.145833 1.08549 0 1.50646 0H8.125L12.5 4.375V6.67458C12.3001 6.59556 12.096 6.53549 11.8877 6.49437C11.6794 6.45326 11.4668 6.42146 11.25 6.39896V5H7.5V1.25H1.50646C1.44229 1.25 1.38354 1.27674 1.33021 1.33021C1.27674 1.38354 1.25 1.44229 1.25 1.50646V14.3269C1.25 14.391 1.27674 14.4498 1.33021 14.5031C1.38354 14.5566 1.44229 14.5833 1.50646 14.5833H6.42313C6.5866 14.8313 6.76979 15.0601 6.97271 15.27C7.17576 15.48 7.39583 15.6678 7.63292 15.8333H1.50646ZM12.4046 13.2379C12.8314 12.8111 13.0448 12.2874 13.0448 11.6667C13.0448 11.046 12.8314 10.5222 12.4046 10.0954C11.9778 9.66861 11.454 9.45521 10.8333 9.45521C10.2126 9.45521 9.68889 9.66861 9.26208 10.0954C8.83528 10.5222 8.62187 11.046 8.62187 11.6667C8.62187 12.2874 8.83528 12.8111 9.26208 13.2379C9.68889 13.6647 10.2126 13.8781 10.8333 13.8781C11.454 13.8781 11.9778 13.6647 12.4046 13.2379ZM15.0833 16.7869L12.8013 14.5048C12.5203 14.7099 12.2124 14.8651 11.8775 14.9704C11.5425 15.0756 11.1944 15.1281 10.8333 15.1281C9.87181 15.1281 9.05451 14.7916 8.38146 14.1185C7.7084 13.4455 7.37188 12.6282 7.37188 11.6667C7.37188 10.7051 7.7084 9.88785 8.38146 9.21479C9.05451 8.54174 9.87181 8.20521 10.8333 8.20521C11.7949 8.20521 12.6122 8.54174 13.2852 9.21479C13.9583 9.88785 14.2948 10.7051 14.2948 11.6667C14.2948 12.0278 14.2422 12.3758 14.1371 12.7108C14.0318 13.0457 13.8766 13.3536 13.6715 13.6346L15.9535 15.9167L15.0833 16.7869Z" fill="currentColor" />
  </svg>
);

const SettingsIcon = (props) => (
  <svg viewBox="-1.23 -0.93 18.52 18.52" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0.815108 12.5014C0.4549 11.8775 0.184533 11.2264 0 10.563C0.810392 10.1495 1.36532 9.30689 1.36532 8.33472C1.36532 7.3633 0.811225 6.52122 0.00183324 6.10739C0.3741 4.76498 1.08103 3.51478 2.08617 2.49289C2.84947 2.98802 3.85668 3.04734 4.69866 2.56122C5.54063 2.0751 5.99287 1.17318 5.94572 0.264586C7.33331 -0.0949472 8.76947 -0.0820806 10.1181 0.266736C10.0718 1.1746 10.524 2.07549 11.3653 2.56122C12.2073 3.04732 13.2145 2.98802 13.9777 2.49294C14.46 2.98444 14.8886 3.54414 15.2489 4.16806C15.6091 4.79197 15.8795 5.44309 16.064 6.10645C15.2536 6.51994 14.6986 7.36255 14.6986 8.33472C14.6986 9.30622 15.2527 10.1482 16.0621 10.5621C15.6899 11.9045 14.983 13.1546 13.9778 14.1766C13.2145 13.6815 12.2073 13.6221 11.3653 14.1082C10.5233 14.5943 10.0711 15.4963 10.1182 16.4049C8.73072 16.7644 7.29456 16.7516 5.94583 16.4027C5.99215 15.4948 5.53997 14.594 4.69866 14.1082C3.85671 13.6221 2.84955 13.6814 2.08626 14.1765C1.60403 13.685 1.17532 13.1253 0.815108 12.5014ZM5.53199 12.6649C6.44147 13.19 7.09464 14.0201 7.40747 14.9728C7.82273 15.0123 8.24072 15.0129 8.65606 14.9741C8.96873 14.021 9.62206 13.1902 10.532 12.6649C11.4419 12.1395 12.4881 11.9891 13.4699 12.1949C13.7111 11.8546 13.9196 11.4922 14.093 11.1129C13.4244 10.3656 13.032 9.38489 13.032 8.33472C13.032 7.28455 13.4244 6.30389 14.093 5.55664C14.0062 5.3683 13.9104 5.18307 13.8055 5.00139C13.7006 4.81971 13.5881 4.64412 13.4683 4.4749C12.487 4.68019 11.4415 4.52967 10.532 4.00459C9.62247 3.47951 8.96939 2.64929 8.65647 1.69668C8.24131 1.65717 7.82323 1.6566 7.40798 1.69532C7.09522 2.64848 6.44189 3.47925 5.53199 4.00459C4.62206 4.52994 3.57593 4.68034 2.59412 4.47458C2.35293 4.81489 2.14442 5.1772 1.97102 5.55653C2.63957 6.30381 3.03199 7.28455 3.03199 8.33472C3.03199 9.38489 2.63958 10.3656 1.97102 11.1128C2.05778 11.3011 2.15359 11.4864 2.25849 11.6681C2.36338 11.8497 2.47589 12.0253 2.59566 12.1946C3.57703 11.9893 4.62254 12.1398 5.53199 12.6649ZM8.03197 10.8347C6.65131 10.8347 5.53199 9.71547 5.53199 8.33472C5.53199 6.95405 6.65131 5.83473 8.03197 5.83473C9.41272 5.83473 10.532 6.95405 10.532 8.33472C10.532 9.71547 9.41272 10.8347 8.03197 10.8347ZM8.03197 9.16805C8.49222 9.16805 8.86531 8.79497 8.86531 8.33472C8.86531 7.87447 8.49222 7.50139 8.03197 7.50139C7.57172 7.50139 7.19864 7.87447 7.19864 8.33472C7.19864 8.79497 7.57172 9.16805 8.03197 9.16805Z" fill="currentColor" />
  </svg>
);

const ProcurementIcon = (props) => (
  <svg viewBox="-1.23 -4.28 24.57 24.57" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4.125 15.125C3.54167 14.5417 3.25 13.8333 3.25 13H1.975C1.69167 13 1.45417 12.9042 1.2625 12.7125C1.07083 12.5208 0.975 12.2833 0.975 12C0.975 11.7167 1.07083 11.4792 1.2625 11.2875C1.45417 11.0958 1.69167 11 1.975 11H4.025C4.30833 10.6833 4.64167 10.4375 5.025 10.2625C5.40833 10.0875 5.81667 10 6.25 10C6.68333 10 7.09167 10.0875 7.475 10.2625C7.85833 10.4375 8.19167 10.6833 8.475 11H12.65L14.75 2H5C4.71667 2 4.47917 1.90417 4.2875 1.7125C4.09583 1.52083 4 1.28333 4 1C4 0.716667 4.09583 0.479167 4.2875 0.2875C4.47917 0.0958333 4.71667 0 5 0H16C16.3333 0 16.6 0.125 16.8 0.375C17 0.625 17.0583 0.908333 16.975 1.225L16.325 4H18.25C18.5667 4 18.8667 4.07083 19.15 4.2125C19.4333 4.35417 19.6667 4.55 19.85 4.8L21.725 7.275C21.9083 7.50833 22.025 7.7625 22.075 8.0375C22.125 8.3125 22.125 8.59167 22.075 8.875L21.4 12.2C21.35 12.4333 21.2333 12.625 21.05 12.775C20.8667 12.925 20.6583 13 20.425 13H19.25C19.25 13.8333 18.9583 14.5417 18.375 15.125C17.7917 15.7083 17.0833 16 16.25 16C15.4167 16 14.7083 15.7083 14.125 15.125C13.5417 14.5417 13.25 13.8333 13.25 13H9.25C9.25 13.8333 8.95833 14.5417 8.375 15.125C7.79167 15.7083 7.08333 16 6.25 16C5.41667 16 4.70833 15.7083 4.125 15.125ZM15.175 9H20L20.1 8.475L18.25 6H15.875L15.175 9ZM12.7 10.825L12.8625 10.1C12.9708 9.61667 13.1083 9.025 13.275 8.325C13.325 8.10833 13.375 7.90833 13.425 7.725C13.475 7.54167 13.5167 7.35833 13.55 7.175L13.7125 6.45C13.8208 5.96667 13.9583 5.375 14.125 4.675C14.2917 3.975 14.4292 3.38333 14.5375 2.9L14.7 2.175L14.75 2L12.65 11L12.7 10.825ZM1 9.325C0.716667 9.325 0.479167 9.22917 0.2875 9.0375C0.0958333 8.84583 0 8.60833 0 8.325C0 8.04167 0.0958333 7.80417 0.2875 7.6125C0.479167 7.42083 0.716667 7.325 1 7.325H4.5C4.78333 7.325 5.02083 7.42083 5.2125 7.6125C5.40417 7.80417 5.5 8.04167 5.5 8.325C5.5 8.60833 5.40417 8.84583 5.2125 9.0375C5.02083 9.22917 4.78333 9.325 4.5 9.325H1ZM3 5.675C2.71667 5.675 2.47917 5.57917 2.2875 5.3875C2.09583 5.19583 2 4.95833 2 4.675C2 4.39167 2.09583 4.15417 2.2875 3.9625C2.47917 3.77083 2.71667 3.675 3 3.675H7.5C7.78333 3.675 8.02083 3.77083 8.2125 3.9625C8.40417 4.15417 8.5 4.39167 8.5 4.675C8.5 4.95833 8.40417 5.19583 8.2125 5.3875C8.02083 5.57917 7.78333 5.675 7.5 5.675H3ZM6.25 14C6.53333 14 6.77083 13.9042 6.9625 13.7125C7.15417 13.5208 7.25 13.2833 7.25 13C7.25 12.7167 7.15417 12.4792 6.9625 12.2875C6.77083 12.0958 6.53333 12 6.25 12C5.96667 12 5.72917 12.0958 5.5375 12.2875C5.34583 12.4792 5.25 12.7167 5.25 13C5.25 13.2833 5.34583 13.5208 5.5375 13.7125C5.72917 13.9042 5.96667 14 6.25 14ZM16.25 14C16.5333 14 16.7708 13.9042 16.9625 13.7125C17.1542 13.5208 17.25 13.2833 17.25 13C17.25 12.7167 17.1542 12.4792 16.9625 12.2875C16.7708 12.0958 16.5333 12 16.25 12C15.9667 12 15.7292 12.0958 15.5375 12.2875C15.3458 12.4792 15.25 12.7167 15.25 13C15.25 13.2833 15.3458 13.5208 15.5375 13.7125C15.7292 13.9042 15.9667 14 16.25 14Z" fill="currentColor" />
  </svg>
);
const AccountingIcon = (props) => (
  <svg viewBox="-4.00 -1.00 20.00 20.00" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7.425 17.7L1.275 11.3C1.19167 11.2167 1.125 11.1125 1.075 10.9875C1.025 10.8625 1 10.7333 1 10.6V10C1 9.71667 1.09583 9.47917 1.2875 9.2875C1.47917 9.09583 1.71667 9 2 9H4.5C5.38333 9 6.14583 8.7125 6.7875 8.1375C7.42917 7.5625 7.81667 6.85 7.95 6H1C0.716667 6 0.479167 5.90417 0.2875 5.7125C0.0958333 5.52083 0 5.28333 0 5C0 4.71667 0.0958333 4.47917 0.2875 4.2875C0.479167 4.09583 0.716667 4 1 4H7.65C7.36667 3.41667 6.94583 2.9375 6.3875 2.5625C5.82917 2.1875 5.2 2 4.5 2H1C0.716667 2 0.479167 1.90417 0.2875 1.7125C0.0958333 1.52083 0 1.28333 0 1C0 0.716667 0.0958333 0.479167 0.2875 0.2875C0.479167 0.0958333 0.716667 0 1 0H11C11.2833 0 11.5208 0.0958333 11.7125 0.2875C11.9042 0.479167 12 0.716667 12 1C12 1.28333 11.9042 1.52083 11.7125 1.7125C11.5208 1.90417 11.2833 2 11 2H8.75C8.98333 2.28333 9.19167 2.59167 9.375 2.925C9.55833 3.25833 9.7 3.61667 9.8 4H11C11.2833 4 11.5208 4.09583 11.7125 4.2875C11.9042 4.47917 12 4.71667 12 5C12 5.28333 11.9042 5.52083 11.7125 5.7125C11.5208 5.90417 11.2833 6 11 6H9.975C9.84167 7.41667 9.25833 8.60417 8.225 9.5625C7.19167 10.5208 5.95 11 4.5 11H3.775L8.875 16.3C9.175 16.6167 9.2375 16.9792 9.0625 17.3875C8.8875 17.7958 8.58333 18 8.15 18C8.01667 18 7.8875 17.975 7.7625 17.925C7.6375 17.875 7.525 17.8 7.425 17.7Z" fill="currentColor" />
  </svg>
);

const VendorsIcon = (props) => (
  <svg viewBox="-1.06 -1.56 21.11 21.11" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 16V2V6.475V6V16ZM5 10H8.525C8.80833 10 9.04583 9.90417 9.2375 9.7125C9.42917 9.52083 9.525 9.28333 9.525 9C9.525 8.71667 9.42917 8.47917 9.2375 8.2875C9.04583 8.09583 8.80833 8 8.525 8H5C4.71667 8 4.47917 8.09583 4.2875 8.2875C4.09583 8.47917 4 8.71667 4 9C4 9.28333 4.09583 9.52083 4.2875 9.7125C4.47917 9.90417 4.71667 10 5 10ZM5 14H8.525C8.80833 14 9.04583 13.9042 9.2375 13.7125C9.42917 13.5208 9.525 13.2833 9.525 13C9.525 12.7167 9.42917 12.4792 9.2375 12.2875C9.04583 12.0958 8.80833 12 8.525 12H5C4.71667 12 4.47917 12.0958 4.2875 12.2875C4.09583 12.4792 4 12.7167 4 13C4 13.2833 4.09583 13.5208 4.2875 13.7125C4.47917 13.9042 4.71667 14 5 14ZM5 6H13C13.2833 6 13.5208 5.90417 13.7125 5.7125C13.9042 5.52083 14 5.28333 14 5C14 4.71667 13.9042 4.47917 13.7125 4.2875C13.5208 4.09583 13.2833 4 13 4H5C4.71667 4 4.47917 4.09583 4.2875 4.2875C4.09583 4.47917 4 4.71667 4 5C4 5.28333 4.09583 5.52083 4.2875 5.7125C4.47917 5.90417 4.71667 6 5 6ZM2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16C16.55 0 17.0208 0.195833 17.4125 0.5875C17.8042 0.979167 18 1.45 18 2V6.45C18 6.73333 17.9042 6.97083 17.7125 7.1625C17.5208 7.35417 17.2833 7.45 17 7.45C16.7167 7.45 16.4792 7.35417 16.2875 7.1625C16.0958 6.97083 16 6.73333 16 6.45V2H2V16H6C6.28333 16 6.52083 16.0958 6.7125 16.2875C6.90417 16.4792 7 16.7167 7 17C7 17.2833 6.90417 17.5208 6.7125 17.7125C6.52083 17.9042 6.28333 18 6 18H2ZM12.225 12.275C11.7417 11.7917 11.5 11.2 11.5 10.5C11.5 9.8 11.7417 9.20833 12.225 8.725C12.7083 8.24167 13.3 8 14 8C14.7 8 15.2917 8.24167 15.775 8.725C16.2583 9.20833 16.5 9.8 16.5 10.5C16.5 11.2 16.2583 11.7917 15.775 12.275C15.2917 12.7583 14.7 13 14 13C13.3 13 12.7083 12.7583 12.225 12.275ZM14 14C14.65 14 15.2958 14.0625 15.9375 14.1875C16.5792 14.3125 17.2 14.5 17.8 14.75C18.1833 14.9 18.4792 15.1458 18.6875 15.4875C18.8958 15.8292 19 16.2 19 16.6V17C19 17.2833 18.9042 17.5208 18.7125 17.7125C18.5208 17.9042 18.2833 18 18 18H10C9.71667 18 9.47917 17.9042 9.2875 17.7125C9.09583 17.5208 9 17.2833 9 17V16.6C9 16.2 9.10417 15.8292 9.3125 15.4875C9.52083 15.1458 9.81667 14.9 10.2 14.75C10.8 14.5 11.4208 14.3125 12.0625 14.1875C12.7042 14.0625 13.35 14 14 14Z" fill="currentColor" />
  </svg>
);

const SalesIcon = (props) => (
  <svg viewBox="-1.12 -1.11 22.22 22.22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4.5875 19.4125C4.19583 19.0208 4 18.55 4 18C4 17.45 4.19583 16.9792 4.5875 16.5875C4.97917 16.1958 5.45 16 6 16C6.55 16 7.02083 16.1958 7.4125 16.5875C7.80417 16.9792 8 17.45 8 18C8 18.55 7.80417 19.0208 7.4125 19.4125C7.02083 19.8042 6.55 20 6 20C5.45 20 4.97917 19.8042 4.5875 19.4125ZM14.5875 19.4125C14.1958 19.0208 14 18.55 14 18C14 17.45 14.1958 16.9792 14.5875 16.5875C14.9792 16.1958 15.45 16 16 16C16.55 16 17.0208 16.1958 17.4125 16.5875C17.8042 16.9792 18 17.45 18 18C18 18.55 17.8042 19.0208 17.4125 19.4125C17.0208 19.8042 16.55 20 16 20C15.45 20 14.9792 19.8042 14.5875 19.4125ZM5.15 4L7.55 9H14.55L17.3 4H5.15ZM4.2 2H18.95C19.3333 2 19.625 2.17083 19.825 2.5125C20.025 2.85417 20.0333 3.2 19.85 3.55L16.3 9.95C16.1167 10.2833 15.8708 10.5417 15.5625 10.725C15.2542 10.9083 14.9167 11 14.55 11H7.1L6 13H17C17.2833 13 17.5208 13.0958 17.7125 13.2875C17.9042 13.4792 18 13.7167 18 14C18 14.2833 17.9042 14.5208 17.7125 14.7125C17.5208 14.9042 17.2833 15 17 15H6C5.25 15 4.68333 14.6708 4.3 14.0125C3.91667 13.3542 3.9 12.7 4.25 12.05L5.6 9.6L2 2H1C0.716667 2 0.479167 1.90417 0.2875 1.7125C0.0958333 1.52083 0 1.28333 0 1C0 0.716667 0.0958333 0.479167 0.2875 0.2875C0.479167 0.0958333 0.716667 0 1 0H2.625C2.80833 0 2.98333 0.05 3.15 0.15C3.31667 0.25 3.44167 0.391667 3.525 0.575L4.2 2Z" fill="currentColor" />
  </svg>
);

const PaymentsIcon = (props) => (
  <svg viewBox="-1.11 -4.11 22.22 22.22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 14C1.45 14 0.979167 13.8042 0.5875 13.4125C0.195833 13.0208 0 12.55 0 12V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H18C18.55 0 19.0208 0.195833 19.4125 0.5875C19.8042 0.979167 20 1.45 20 2V12C20 12.55 19.8042 13.0208 19.4125 13.4125C19.0208 13.8042 18.55 14 18 14H2ZM2 12H18V2H2V12ZM15.5 9.5H13.75C13.5333 9.5 13.3542 9.57083 13.2125 9.7125C13.0708 9.85417 13 10.0333 13 10.25C13 10.4667 13.0708 10.6458 13.2125 10.7875C13.3542 10.9292 13.5333 11 13.75 11H16C16.2833 11 16.5208 10.9042 16.7125 10.7125C16.9042 10.5208 17 10.2833 17 10V7.75C17 7.53333 16.9292 7.35417 16.7875 7.2125C16.6458 7.07083 16.4667 7 16.25 7C16.0333 7 15.8542 7.07083 15.7125 7.2125C15.5708 7.35417 15.5 7.53333 15.5 7.75V9.5ZM10 10C10.8333 10 11.5417 9.70833 12.125 9.125C12.7083 8.54167 13 7.83333 13 7C13 6.16667 12.7083 5.45833 12.125 4.875C11.5417 4.29167 10.8333 4 10 4C9.16667 4 8.45833 4.29167 7.875 4.875C7.29167 5.45833 7 6.16667 7 7C7 7.83333 7.29167 8.54167 7.875 9.125C8.45833 9.70833 9.16667 10 10 10ZM4.5 4.5H6.25C6.46667 4.5 6.64583 4.42917 6.7875 4.2875C6.92917 4.14583 7 3.96667 7 3.75C7 3.53333 6.92917 3.35417 6.7875 3.2125C6.64583 3.07083 6.46667 3 6.25 3H4C3.71667 3 3.47917 3.09583 3.2875 3.2875C3.09583 3.47917 3 3.71667 3 4V6.25C3 6.46667 3.07083 6.64583 3.2125 6.7875C3.35417 6.92917 3.53333 7 3.75 7C3.96667 7 4.14583 6.92917 4.2875 6.7875C4.42917 6.64583 4.5 6.46667 4.5 6.25V4.5Z" fill="currentColor" />
  </svg>
);

const ProductsIcon = (props) => (
  <svg viewBox="-1.11 -2.11 22.22 22.22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 5H10.45H10H10.35H2ZM2.4 3H15.6L14.75 2H3.25L2.4 3ZM7 9.75L9 8.75L11 9.75V5H7V9.75ZM2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V3.525C0 3.29167 0.0375 3.06667 0.1125 2.85C0.1875 2.63333 0.3 2.43333 0.45 2.25L1.7 0.725C1.88333 0.491667 2.1125 0.3125 2.3875 0.1875C2.6625 0.0625 2.95 0 3.25 0H14.75C15.05 0 15.3375 0.0625 15.6125 0.1875C15.8875 0.3125 16.1167 0.491667 16.3 0.725L17.55 2.25C17.7 2.43333 17.8125 2.63333 17.8875 2.85C17.9625 3.06667 18 3.29167 18 3.525V7.425C18 7.70833 17.9042 7.94583 17.7125 8.1375C17.5208 8.32917 17.2833 8.425 17 8.425C16.7167 8.425 16.4792 8.32917 16.2875 8.1375C16.0958 7.94583 16 7.70833 16 7.425V5H13V8.825C12.4167 9.15833 11.9083 9.57083 11.475 10.0625C11.0417 10.5542 10.7 11.1083 10.45 11.725L9 11L6.45 12.275C6.11667 12.4417 5.79167 12.4292 5.475 12.2375C5.15833 12.0458 5 11.7583 5 11.375V5H2V16H9.775C10.0583 16 10.2958 16.0958 10.4875 16.2875C10.6792 16.4792 10.775 16.7167 10.775 17C10.775 17.2667 10.6792 17.5 10.4875 17.7C10.2958 17.9 10.0583 18 9.775 18H2ZM15.2875 17.7125C15.0958 17.5208 15 17.2833 15 17V15H13C12.7167 15 12.4792 14.9042 12.2875 14.7125C12.0958 14.5208 12 14.2833 12 14C12 13.7167 12.0958 13.4792 12.2875 13.2875C12.4792 13.0958 12.7167 13 13 13H15V11C15 10.7167 15.0958 10.4792 15.2875 10.2875C15.4792 10.0958 15.7167 10 16 10C16.2833 10 16.5208 10.0958 16.7125 10.2875C16.9042 10.4792 17 10.7167 17 11V13H19C19.2833 13 19.5208 13.0958 19.7125 13.2875C19.9042 13.4792 20 13.7167 20 14C20 14.2833 19.9042 14.5208 19.7125 14.7125C19.5208 14.9042 19.2833 15 19 15H17V17C17 17.2833 16.9042 17.5208 16.7125 17.7125C16.5208 17.9042 16.2833 18 16 18C15.7167 18 15.4792 17.9042 15.2875 17.7125ZM2 5H10.45H10H10.35H2Z" fill="currentColor" />
  </svg>
);

const ContactsIcon = (props) => (
  <svg viewBox="-0.89 -0.89 17.78 17.78" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M5.175 6.825C4.39167 6.04167 4 5.1 4 4C4 2.9 4.39167 1.95833 5.175 1.175C5.95833 0.391667 6.9 0 8 0C9.1 0 10.0417 0.391667 10.825 1.175C11.6083 1.95833 12 2.9 12 4C12 5.1 11.6083 6.04167 10.825 6.825C10.0417 7.60833 9.1 8 8 8C6.9 8 5.95833 7.60833 5.175 6.825ZM0 14V13.2C0 12.6333 0.145833 12.1125 0.4375 11.6375C0.729167 11.1625 1.11667 10.8 1.6 10.55C2.63333 10.0333 3.68333 9.64583 4.75 9.3875C5.81667 9.12917 6.9 9 8 9C9.1 9 10.1833 9.12917 11.25 9.3875C12.3167 9.64583 13.3667 10.0333 14.4 10.55C14.8833 10.8 15.2708 11.1625 15.5625 11.6375C15.8542 12.1125 16 12.6333 16 13.2V14C16 14.55 15.8042 15.0208 15.4125 15.4125C15.0208 15.8042 14.55 16 14 16H2C1.45 16 0.979167 15.8042 0.5875 15.4125C0.195833 15.0208 0 14.55 0 14ZM2 14H14V13.2C14 13.0167 13.9542 12.85 13.8625 12.7C13.7708 12.55 13.65 12.4333 13.5 12.35C12.6 11.9 11.6917 11.5625 10.775 11.3375C9.85833 11.1125 8.93333 11 8 11C7.06667 11 6.14167 11.1125 5.225 11.3375C4.30833 11.5625 3.4 11.9 2.5 12.35C2.35 12.4333 2.22917 12.55 2.1375 12.7C2.04583 12.85 2 13.0167 2 13.2V14ZM9.4125 5.4125C9.80417 5.02083 10 4.55 10 4C10 3.45 9.80417 2.97917 9.4125 2.5875C9.02083 2.19583 8.55 2 8 2C7.45 2 6.97917 2.19583 6.5875 2.5875C6.19583 2.97917 6 3.45 6 4C6 4.55 6.19583 5.02083 6.5875 5.4125C6.97917 5.80417 7.45 6 8 6C8.55 6 9.02083 5.80417 9.4125 5.4125Z" fill="currentColor" />
  </svg>
);
/*
 * Shared pill treatment for the sidebar's two call-to-action buttons.
 *
 * The gradient is a white sheen layered over the brand blue, and the inset
 * shadow fakes an inner highlight ring — neither is expressible as a Tailwind
 * utility, so they stay inline while the box model lives in the class.
 */
const CTA_PILL =
  "box-border flex flex-row justify-center items-center rounded-full border border-[#0C4FCD] text-white transition-opacity hover:opacity-90";

const CTA_PILL_STYLE = {
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%), var(--btn-primary)",
  boxShadow: "inset 0px 0px 0px 1.8px rgba(255, 255, 255, 0.25)",
};

// Shared chrome background for the sidebar + header, which are one continuous
// surface. The live value is the --chrome-bg variable, derived below from the
// organization's Brand Settings button colour; the literal here is only the
// fallback for the moment before branding loads (and for logged-out shells).
const CHROME_BG = "var(--chrome-bg, #EBEDFF)";

// The chrome is a wash of the brand colour, not the brand colour itself: at
// full saturation a picked hue makes an unreadable sidebar. This mixes the hex
// toward white so any colour lands at the same pale weight the design expects.
const CHROME_TINT_STRENGTH = 0.92;

// Used until an organization picks its own colour in Brand Settings.
const DEFAULT_BRAND_COLOR = "#031CFC";

const toChromeTint = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const mix = (channel) =>
    Math.round(channel + (255 - channel) * CHROME_TINT_STRENGTH);
  return `rgb(${mix((int >> 16) & 255)}, ${mix((int >> 8) & 255)}, ${mix(int & 255)})`;
};

// Cuts the quarter-disc out of the corner patch: opaque (chrome) outside the
// 16px radius, fully transparent inside it, so whatever the page paints under
// the corner shows through instead of a hardcoded page colour.
const CORNER_MASK =
  "radial-gradient(circle 16px at 16.5px 16.5px, transparent 0 16px, #000 16px)";

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
  const isSearchOverlayOpen = useSearchOverlayOpen();
  const [profile, setProfile] = useState("");
  const [kanbanName, setKanbanName] = useState("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(
    () => localStorage.getItem("sidebarPinned") === "true"
  );
  const [isHovered, setIsHovered] = useState(() => isPinned);
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
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");

  // Keeps --sidebar-width in sync with the sidebar's own rendered width so
  // that content using the var (the <main> margin, and the many fixed-position
  // toolbars/headers across pages) shifts in step with the hover expand/collapse
  // instead of staying pinned at the collapsed 64px and letting the expanded
  // 240px panel overlay the page.
  useEffect(() => {
    const applyWidth = () => {
      const isExpanded = isHovered || isPinned;
      if (window.innerWidth >= 1024) {
        document.documentElement.style.setProperty(
          "--sidebar-width",
          isExpanded ? "240px" : "64px"
        );
      } else {
        document.documentElement.style.setProperty("--sidebar-width", "0px");
      }
      // List/table content stays edge-to-edge against the sidebar in every
      // state (collapsed or expanded/pinned) — no gutter.
      document.documentElement.style.setProperty("--content-inset", "0px");
    };
    applyWidth();
    window.addEventListener("resize", applyWidth);
    return () => window.removeEventListener("resize", applyWidth);
  }, [isHovered, isPinned]);

  useEffect(() => {
    const toggle = () => setIsMobileOpen((prev) => !prev);
    window.addEventListener("toggle-mobile-sidebar", toggle);
    return () => window.removeEventListener("toggle-mobile-sidebar", toggle);
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
    // Brand Settings fires this on save so the chrome retints immediately.
    const refetch = () => fetchBranding();
    window.addEventListener("branding-updated", refetch);
    return () => window.removeEventListener("branding-updated", refetch);
  }, []);

  // Chrome tint follows the org's Brand Settings button colour. Set on <html>
  // rather than passed down as a prop because the header, and the per-page
  // fixed toolbars, need it too - same pattern as --sidebar-width above.
  useEffect(() => {
    // DEFAULT_BRAND_COLOR when the org hasn't picked one - removing the
    // property here would drop the chrome back to whatever the stylesheet
    // says, and a new org would see untinted chrome until it set a colour.
    const tint = toChromeTint(branding?.colors?.primary) || toChromeTint(DEFAULT_BRAND_COLOR);
    document.documentElement.style.setProperty("--chrome-bg", tint);
  }, [branding?.colors?.primary]);

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
    { name: "CRM", isHeader: true },
    { name: "Dashboard", href: "/", icon: DashboardIcon },
    { name: "Companies", href: "/companies", icon: CompaniesIcon },
    { name: "Contacts", href: "/contacts", icon: ContactsIcon },
    { name: "Deals", href: "/deals", icon: DealsIcon },
    {
      name: "Activity",
      icon: ActivityIcon,
      isDropdown: true,
      dropdownType: "activity",
    },
    { name: "Accounts", isHeader: true },
    { name: "Accounting", href: "/accounting", icon: AccountingIcon },
    { name: "Vendors", href: "/vendors", icon: VendorsIcon },
    { name: "Sales", icon: SalesIcon, isDropdown: true, dropdownType: "sales" },
    {
      name: "Procurement",
      icon: ProcurementIcon,
      isDropdown: true,
      dropdownType: "procurement",
    },
    {
      name: "Payments",
      icon: PaymentsIcon,
      isDropdown: true,
      dropdownType: "payments",
    },
    { name: "Products and Services", href: "/products", icon: ProductsIcon },
    { name: "Inventory", href: "/inventory", icon: Warehouse },
    { name: "System", isHeader: true },
    { name: "Insights", href: "/insights", icon: InsightsIcon },
    { name: "Settings", href: "/settings", icon: SettingsIcon },
  ];

  const activityChildren = [
    { name: "Tasks and Meetings", href: "/tasks" },
    { name: "Calendar", href: "/calender" },
  ];

  const salesChildren = [
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

  /*
   * One geometry for every nav row — plain links and dropdown triggers alike.
   * They used to carry their own padding (p-2.5 vs pl-4) which put their icons
   * in different columns; sharing this keeps them on a single vertical line.
   *
   * Collapsed it's a fixed 40x40 centred box: the row is a block-level flex
   * item, so without an explicit width it stretches to the rail and
   * `rounded-full` renders an oval rather than a circle.
   */
  const navRowBase =
    "flex items-center text-sm rounded-full transition-all duration-300 overflow-y-hidden";
  const navRowLayout =
    isHovered || isMobileOpen
      ? "w-full gap-2 pl-4 pr-3 py-2.5"
      : "w-10 h-10 justify-center mx-auto";

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
        className={`${navRowBase} ${navRowLayout} ${isChildActive(children)
            ? "bg-white border border-[#E5E5E5] text-[#0085FF] font-medium"
            : "border border-transparent text-gray-900 hover:bg-gray-100"
          }`}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${isChildActive(children) ? "text-[#0085FF]" : "text-gray-900"
            }`}
        />
        {(isHovered || isMobileOpen) && (
          <span className="whitespace-nowrap">{item.name}</span>
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
                  onClick={(e) => {
                    handleSamePageNav(e, child.href);
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
      {/* Mobile overlay: tap outside the sidebar to close it */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-[9994]"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`animate-slideInLeft fixed top-0 left-0 bottom-0 overflow-y-auto overflow-x-hidden border-r border-[#E1E4EA] z-[9995] flex flex-col transition-all duration-300 ease-in-out lg:w-auto ${isMobileOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full lg:translate-x-0"
          } ${isSearchOverlayOpen ? "pointer-events-none" : ""}`}
        style={{
          background: CHROME_BG,
          // Dims in step with the overlay's own backdrop instead of relying
          // on that backdrop to visually cover this element — the two are
          // unrelated fixed-position layers, and z-index alone wasn't
          // reliably painting the backdrop above a sibling fixed element.
          // Matches the backdrop's exact tint: the overlay is bg-black/40, and
          // black at 40% over any colour equals 0.6 * colour, i.e. the same as
          // brightness(0.6) — so the sidebar darkens identically to the page
          // instead of just fading toward the (white) body behind it.
          //
          // The sidebar's own className carries `transition-all duration-300`
          // (for the hover expand/collapse width and the mobile slide-in),
          // and "all" also catches filter — so without an override here the
          // dim faded in over 300ms instead of snapping on with the backdrop.
          // Re-declaring transition for just the properties that actually
          // need animating excludes filter, which then has no transition at
          // all and changes instantly.
          filter: isSearchOverlayOpen ? "brightness(0.6)" : "none",
          transition: "width 300ms ease-in-out, transform 300ms ease-in-out",
          width:
            window.innerWidth >= 1024
              ? (isHovered || isPinned ? "240px" : "64px")
              : undefined,
        }}
        onMouseEnter={() => {
          if (window.innerWidth >= 1024) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (window.innerWidth >= 1024 && !isPinned) {
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
        <div style={{ background: CHROME_BG }} className={`relative -mr-px h-16 flex-shrink-0 flex items-center justify-between gap-2 ${isHovered || isMobileOpen ? "px-4" : "px-2"}`}>
          {/* Company switcher — moved here in place of the old logo mark.
              id is a measurement anchor: pages with a `position: fixed`
              header strip (e.g. VendorDetailsPageNew.jsx) read this
              element's real bottom edge at runtime to line their own
              border up with it, instead of hardcoding a top offset. */}
          <div id="sidebar-switcher-anchor" className="relative flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setIsCompanyMenuOpen((v) => !v)}
              title={branding?.companyName || "Company"}
              // min-w-0 so the company name truncates instead of pushing the pin
              // and collapse buttons out past the panel's right edge - at
              // 280px the natural width happened to fit, at 240px it doesn't.
              className={`box-border flex flex-row items-center min-w-0 bg-white border border-[#E5E5E5] rounded-md hover:bg-gray-50 transition-colors ${isHovered || isMobileOpen
                ? "h-10 self-stretch gap-2.5 pl-1.5 pr-2.5 py-1.5 flex-1"
                // Collapsed: a 40px square framing a 32px avatar, per the
                // design. No padding, so justify-center splits the 38px of
                // inner width (40 less the 1px borders) evenly around the
                // avatar; any padding here squeezes it off-centre.
                : "w-10 h-10 justify-center p-0 mx-auto"
                }`}
            >
              <span
                className={`flex flex-row items-center gap-1.5 min-w-0 ${isHovered || isMobileOpen ? "flex-1" : "w-8 h-8"
                  }`}
              >
                <span
                  className={`flex items-center justify-center flex-shrink-0 rounded text-white text-[14px] font-medium leading-[102%] ${isHovered || isMobileOpen ? "w-7 h-7" : "w-8 h-8"
                    }`}
                  style={{ background: "var(--btn-primary)" }}
                >
                  {getInitials(branding?.companyName)}
                </span>
                {(isHovered || isMobileOpen) && (
                  <span className="text-[14px] font-medium leading-[120%] text-[#0A0A0A] truncate">
                    {branding?.companyName || "Company"}
                  </span>
                )}
              </span>
              {(isHovered || isMobileOpen) && (
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#0A0A0A]" />
              )}
            </button>

            {/* There's no multi-organization API yet, so the menu shows the
                current workspace and a way to edit it rather than inventing
                companies to switch between. Anchored to the switcher button
                itself (top-full), not the strip around it, so it always opens
                flush below the button regardless of the strip's height. */}
            {isCompanyMenuOpen && (isHovered || isMobileOpen) && (
              <>
                <div
                  className="fixed inset-0 z-[9996]"
                  onClick={() => setIsCompanyMenuOpen(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1 z-[9997] bg-white border border-[#E5E5E5] rounded-md shadow-lg py-1">
                  <div className="flex items-center gap-1.5 px-2 py-2 bg-[#F5FAFF]">
                    <span
                      className="flex items-center justify-center w-7 h-7 flex-shrink-0 rounded text-white text-[14px] font-medium leading-[102%]"
                      style={{ background: "var(--btn-primary)" }}
                    >
                      {getInitials(branding?.companyName)}
                    </span>
                    <span className="text-[14px] font-medium text-[#0A0A0A] truncate">
                      {branding?.companyName || "Company"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompanyMenuOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#525866] hover:bg-gray-50"
                  >
                    Company settings
                  </button>
                </div>
              </>
            )}
          </div>

          {(isHovered || isMobileOpen) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Pins the panel open so it no longer collapses on mouse-leave.
                  Desktop-only — mobile already opens/closes via the hamburger. */}
              <button
                type="button"
                onClick={() => {
                  setIsPinned((prev) => {
                    const next = !prev;
                    localStorage.setItem("sidebarPinned", String(next));
                    return next;
                  });
                }}
                title={isPinned ? "Unpin menu" : "Pin menu open"}
                aria-label={isPinned ? "Unpin menu" : "Pin menu open"}
                className={`hidden lg:flex items-center justify-center w-6 h-6 rounded hover:opacity-70 transition-opacity ${
                  isPinned ? "text-[#0085FF]" : "text-[#0A0A0A]"
                }`}
              >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>

            </div>
          )}
        </div>
        <nav style={{ background: CHROME_BG }} className="flex-1 min-h-0 overflow-y-auto pt-1 pb-2 flex flex-col">
          {/* Fixed spacing instead of justify-evenly: with every module shown
              the items were squeezed together to fit the viewport. They now
              keep a consistent gap and the nav scrolls when they don't fit. */}
          <ul
            className={`flex flex-col px-2 text-black ${isHovered || isMobileOpen ? "gap-1" : "gap-2.5"
              }`}
          >
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
                    className={`flex-shrink-0 transition-all duration-300 cursor-pointer ${isHovered || isMobileOpen
                      // Sits a touch left of the item rows below it (which are
                      // indented with pl-4) so the label reads as the section's
                      // outer edge and the rows read as nested inside it,
                      // rather than both lining up flush and looking like one
                      // flat list.
                      // Sits left of the rows below it (which indent to pl-4)
                      // so the label reads as the section's outer edge and the
                      // rows read as nested inside it.
                      ? "py-2 mt-4 mb-2 px-2 first:mt-0"
                      // Collapsed: the header is dropped from the layout entirely,
                      // so the icons stay evenly spaced across group boundaries.
                      : "hidden"
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
                    {(isHovered || isMobileOpen) && (
                      <span className="block text-sm text-left text-[#5B5A64] font-bold uppercase tracking-wider">
                        {item.name}
                      </span>
                    )}
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
                      onClick={(e) => {
                        handleSamePageNav(e, item.href);
                        setIsMobileOpen(false);
                        setSalesOpen(false);
                        setProcurementOpen(false);
                        setPaymentsOpen(false);
                        setActivityOpen(false);
                      }}
                      className={`${navRowBase} ${navRowLayout} ${isCurrentPath(item.href)
                          ? "bg-white border border-[#E5E5E5] text-[#0085FF] font-medium"
                          : "border border-transparent text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 ${isCurrentPath(item.href) ? "text-[#0085FF]" : "text-gray-900"
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

          {/* Book a Call + Upgrade card. Expanded only: the collapsed rail is
              64px, so there's nothing sensible to show there. Widths match the
              nav rows above (full width inside the same px-2 gutter) rather
              than a fixed 204px, so the card lines up with the sidebar edges. */}
          {(isHovered || isMobileOpen) && (
            <div className="flex-shrink-0 flex flex-col items-start gap-3.5 px-2 pt-8 pb-2">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className={`${CTA_PILL} w-full h-[42px] px-6 gap-2`}
                style={CTA_PILL_STYLE}
              >
                <span className="text-[12px] font-normal leading-5 text-center text-white whitespace-nowrap">
                  Book a Call
                </span>
              </button>

              <div className="box-border flex flex-col items-start p-4 gap-3.5 w-full bg-[#F2F5F8] border border-[#E1E4EA] rounded-[14px]">
                <div className="flex flex-col items-start gap-1.5 self-stretch">
                  <span className="text-[16px] font-semibold leading-[120%] text-[#181B25]">
                    Upgrade Pro! 👑
                  </span>
                  <span className="text-[14px] font-normal leading-[120%] tracking-[-0.5px] text-[#525866]">
                    Upgrade your account to unlock all benefits.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    navigate("/settings/subscription");
                  }}
                  className={`${CTA_PILL} self-stretch h-[42px] px-6 gap-1.5`}
                  style={CTA_PILL_STYLE}
                >
                  <Crown className="w-5 h-5 flex-shrink-0 text-white" />
                  <span className="text-[14px] font-normal leading-5 text-center text-white whitespace-nowrap">
                    Upgrade Plan
                  </span>
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Profile + Logout */}
        <div
          style={{ background: CHROME_BG }}
          className="h-16 flex-shrink-0 flex items-center px-4 border-t border-[#E1E4EA]"
        >
          <div
            className={`flex items-center gap-3 cursor-pointer p-2 rounded transition-all duration-300 w-full ${isHovered || isMobileOpen ? "" : "lg:justify-center"
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
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {isSuperAdmin ? "Super Admin" : user?.name || "User"}
              </span>
              <span className="text-xs text-gray-600 whitespace-nowrap">
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
              title="Logout"
            >
              <LogOut size={18} color="#ff0000" />
            </button>
          </div>
        </div>
      </div>

      {/*
        Concave corner joining the sidebar to the header.

        The sidebar and the header are one continuous CHROME_BG surface; where
        the content area begins, their two borders used to meet at a hard right
        angle. Three pieces make that a curve:

        1. A 1px CHROME_BG strip hiding the sidebar's right border above the
           header's bottom line, so the logo block and the header read as one
           panel rather than two.
        2. A CHROME_BG square on the junction, masked to a quarter-disc: the
           radial-gradient mask paints chrome everywhere *outside* the arc -
           erasing the last 16px of both borders, which the arc replaces - and
           leaves everything inside it fully transparent. Transparent, not a
           content-coloured fill: the surface under this corner isn't always
           white (the Companies list shows a tinted bulk-action strip there),
           and a white patch showed up as a notch over it.
        3. The arc itself, drawn with a box-shadow so nothing but the rounded
           outline paints - a bordered box would render its square outer
           corner alongside the curve.

        Desktop only: the mobile header is a different height and the sidebar
        is an overlay there.
      */}
      <div
        aria-hidden="true"
        className="hidden lg:block fixed z-[9996] pointer-events-none"
        style={{
          left: "calc(var(--sidebar-width, 64px) - 1px)",
          top: "0px",
          width: "1px",
          height: "64px",
          background: CHROME_BG,
          // Dim in step with the sidebar, which darkens itself while the
          // search overlay is open. These are separate fixed elements, so
          // without this they stayed light and showed as a notch at the corner.
          filter: isSearchOverlayOpen ? "brightness(0.6)" : "none",
          transition: "left 300ms ease-in-out",
        }}
      />
      <div
        aria-hidden="true"
        className="hidden lg:block fixed z-[9996] pointer-events-none"
        style={{
          left: "calc(var(--sidebar-width, 64px) - 1px)",
          top: "63px",
          width: "19px",
          height: "19px",
          background: CHROME_BG,
          WebkitMaskImage: CORNER_MASK,
          maskImage: CORNER_MASK,
          filter: isSearchOverlayOpen ? "brightness(0.6)" : "none",
          transition: "left 300ms ease-in-out",
        }}
      />
      {/* The arc and the two straight borders are now one continuous stroke.
          Previously the arc was a separate box-shadow whose ends merely
          abutted the sidebar/header borders — at any zoom the joins showed as
          a detached corner. This path runs 2.5px INTO each border (the L
          segments) so the lines overlap rather than meet, and every endpoint
          sits on the same 0.5px centreline the 1px borders occupy. */}
      <svg
        aria-hidden="true"
        className="hidden lg:block fixed z-[9996] pointer-events-none"
        width="19"
        height="19"
        viewBox="0 0 19 19"
        fill="none"
        style={{
          left: "calc(var(--sidebar-width, 64px) - 1px)",
          top: "63px",
          filter: isSearchOverlayOpen ? "brightness(0.6)" : "none",
          transition: "left 300ms ease-in-out",
        }}
      >
        <path
          d="M0.5 19 L0.5 16.5 A16 16 0 0 1 16.5 0.5 L19 0.5"
          stroke="#E1E4EA"
          strokeWidth="1"
        />
      </svg>
    </>
  );
};

export default Navbar;
