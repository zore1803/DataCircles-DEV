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
} from "lucide-react";
import API from "../services/api";
import dataCirclesLogo from "../assets/Datacircles logo.png";
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
  <svg viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0 14.5833V0H7.91646V3.33333H16.0575V14.5833H0ZM1.24979 13.3333H6.66667V11.25H1.24979V13.3333ZM1.24979 10H6.66667V7.91667H1.24979V10ZM1.24979 6.66667H6.66667V4.58333H1.24979V6.66667ZM1.24979 3.33333H6.66667V1.25H1.24979V3.33333ZM7.91646 13.3333H14.8077V4.58333H7.91646V13.3333ZM9.74354 7.91667V6.66667H12.8204V7.91667H9.74354ZM9.74354 11.25V10H12.8204V11.25H9.74354Z" fill="currentColor" />
  </svg>
);

const DealsIcon = (props) => (
  <svg viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8.57765 14.5673C8.65987 14.5673 8.74348 14.5481 8.82848 14.5096C8.91335 14.4711 8.98036 14.4273 9.02953 14.3781L15.6945 7.71313C15.8826 7.52507 16.0242 7.32417 16.1193 7.11042C16.2143 6.89681 16.2618 6.6725 16.2618 6.4375C16.2618 6.19389 16.2143 5.95937 16.1193 5.73396C16.0242 5.5084 15.8826 5.3059 15.6945 5.12646L12.3612 1.79313C12.1817 1.60507 11.9873 1.4675 11.7779 1.38042C11.5686 1.29347 11.3421 1.25 11.0985 1.25C10.8635 1.25 10.6378 1.29347 10.4214 1.38042C10.205 1.4675 10.0055 1.60507 9.82286 1.79313L9.34515 2.27083L10.8868 3.82521C11.0738 4.00368 11.2119 4.20722 11.3012 4.43583C11.3904 4.66444 11.4349 4.9016 11.4349 5.14729C11.4349 5.6559 11.2651 6.08007 10.9254 6.41979C10.5856 6.75951 10.1615 6.92937 9.65286 6.92937C9.40717 6.92937 9.16918 6.88875 8.9389 6.8075C8.70876 6.72639 8.50446 6.5966 8.32598 6.41813L6.74744 4.8525L3.12578 8.47417C3.06272 8.53722 3.01543 8.60778 2.9839 8.68583C2.95237 8.76375 2.93661 8.84389 2.93661 8.92625C2.93661 9.08 2.98897 9.21139 3.09369 9.32042C3.19841 9.42945 3.32765 9.48396 3.4814 9.48396C3.56376 9.48396 3.64737 9.46472 3.73223 9.42625C3.81723 9.38778 3.88432 9.34396 3.93348 9.29479L6.67057 6.55771L7.54869 7.43583L4.82432 10.1729C4.7614 10.236 4.71418 10.3065 4.68265 10.3846C4.65112 10.4625 4.63536 10.5426 4.63536 10.625C4.63536 10.7735 4.68904 10.9014 4.7964 11.0088C4.90376 11.1161 5.03168 11.1698 5.18015 11.1698C5.26251 11.1698 5.34612 11.1506 5.43098 11.1121C5.51598 11.0736 5.583 11.0298 5.63203 10.9806L8.46536 8.16021L9.34369 9.03833L6.52307 11.8717C6.46543 11.9208 6.41953 11.9878 6.38536 12.0727C6.35119 12.1577 6.33411 12.2413 6.33411 12.3235C6.33411 12.4722 6.38779 12.6001 6.49515 12.7075C6.60251 12.8149 6.73043 12.8685 6.8789 12.8685C6.96112 12.8685 7.04126 12.8528 7.11932 12.8212C7.19723 12.7897 7.26772 12.7424 7.33078 12.6794L10.1641 9.85896L11.0424 10.7371L8.20911 13.5704C8.14605 13.6335 8.09876 13.7067 8.06723 13.79C8.03571 13.8733 8.01994 13.9535 8.01994 14.0304C8.01994 14.1842 8.0771 14.3121 8.1914 14.4142C8.30571 14.5163 8.43446 14.5673 8.57765 14.5673ZM8.56473 15.8171C8.09362 15.8171 7.68286 15.6537 7.33244 15.3269C6.98203 14.9999 6.79883 14.5928 6.78286 14.1056C6.31064 14.0735 5.91612 13.9058 5.59932 13.6025C5.28251 13.299 5.11078 12.9005 5.08411 12.4069C4.5905 12.3749 4.19147 12.2024 3.88703 11.8894C3.58244 11.5763 3.41946 11.1826 3.39807 10.7081C2.90237 10.6762 2.49321 10.4965 2.17057 10.169C1.84793 9.84146 1.68661 9.42722 1.68661 8.92625C1.68661 8.68056 1.73335 8.43986 1.82682 8.20417C1.92029 7.96861 2.05626 7.76167 2.23473 7.58333L6.74744 3.08333L9.18828 5.52396C9.2373 5.5816 9.30161 5.62757 9.38119 5.66188C9.46091 5.69604 9.54723 5.71312 9.64015 5.71312C9.79182 5.71312 9.92265 5.66292 10.0327 5.5625C10.1428 5.46208 10.1979 5.33063 10.1979 5.16813C10.1979 5.07521 10.1808 4.98896 10.1466 4.90938C10.1123 4.82979 10.0663 4.76542 10.0087 4.71625L7.08557 1.79313C6.90612 1.60507 6.71036 1.4675 6.49828 1.38042C6.28619 1.29347 6.05835 1.25 5.81473 1.25C5.57973 1.25 5.35675 1.29347 5.14578 1.38042C4.93467 1.4675 4.73515 1.60507 4.54723 1.79313L1.80994 4.54313C1.65828 4.69479 1.53411 4.87403 1.43744 5.08083C1.34078 5.2875 1.2839 5.49826 1.26682 5.71312C1.2496 5.89049 1.25758 6.06597 1.29078 6.23958C1.32383 6.41319 1.38203 6.57639 1.46536 6.72917L0.545568 7.64896C0.357512 7.37757 0.215984 7.07361 0.120984 6.73708C0.0258453 6.40056 -0.0131825 6.05924 0.00390083 5.71312C0.0209842 5.32951 0.107512 4.95903 0.263484 4.60167C0.419456 4.24431 0.637929 3.92514 0.918901 3.64417L3.64807 0.915C3.96015 0.611527 4.29966 0.383194 4.66661 0.23C5.03355 0.0766662 5.41897 0 5.82286 0C6.22661 0 6.61064 0.0766662 6.97494 0.23C7.33939 0.383194 7.67328 0.611527 7.97661 0.915L8.45432 1.3925L8.93182 0.915C9.24376 0.611527 9.58189 0.383194 9.94619 0.23C10.3105 0.0766662 10.6946 0 11.0985 0C11.5024 0 11.8878 0.0766662 12.2547 0.23C12.6217 0.383194 12.9569 0.611527 13.2604 0.915L16.5729 4.2275C16.8762 4.53097 17.1086 4.87632 17.2699 5.26354C17.4312 5.65076 17.5118 6.04632 17.5118 6.45021C17.5118 6.8541 17.4312 7.23819 17.2699 7.6025C17.1086 7.96681 16.8762 8.30062 16.5729 8.60396L9.90765 15.2563C9.7239 15.44 9.51696 15.5794 9.28682 15.6746C9.05654 15.7696 8.81585 15.8171 8.56473 15.8171Z" fill="currentColor" />
  </svg>
);

const ActivityIcon = (props) => (
  <svg viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.50646 15.8333C1.0909 15.8333 0.735903 15.6862 0.441458 15.3919C0.147153 15.0974 0 14.7424 0 14.3269V3.17313C0 2.75757 0.147153 2.40257 0.441458 2.10812C0.735903 1.81382 1.0909 1.66667 1.50646 1.66667H5.21479C5.26715 1.20403 5.4691 0.810625 5.82063 0.486458C6.17201 0.162152 6.59292 0 7.08333 0C7.57903 0 8.00264 0.162152 8.35417 0.486458C8.7057 0.810625 8.90493 1.20403 8.95188 1.66667H12.6602C13.0758 1.66667 13.4308 1.81382 13.7252 2.10812C14.0195 2.40257 14.1667 2.75757 14.1667 3.17313V14.3269C14.1667 14.7424 14.0195 15.0974 13.7252 15.3919C13.4308 15.6862 13.0758 15.8333 12.6602 15.8333H1.50646ZM1.50646 14.5833H12.6602C12.7244 14.5833 12.7831 14.5566 12.8365 14.5031C12.8899 14.4498 12.9167 14.391 12.9167 14.3269V3.17313C12.9167 3.10896 12.8899 3.05021 12.8365 2.99687C12.7831 2.9434 12.7244 2.91667 12.6602 2.91667H1.50646C1.44229 2.91667 1.38354 2.9434 1.33021 2.99687C1.27674 3.05021 1.25 3.10896 1.25 3.17313V14.3269C1.25 14.391 1.27674 14.4498 1.33021 14.5031C1.38354 14.5566 1.44229 14.5833 1.50646 14.5833ZM3.125 12.6121H8.54167V11.3623H3.125V12.6121ZM3.125 9.375H11.0417V8.125H3.125V9.375ZM3.125 6.13771H11.0417V4.88792H3.125V6.13771ZM7.53125 2.19479C7.64931 2.07674 7.70833 1.92743 7.70833 1.74687C7.70833 1.56632 7.64931 1.41701 7.53125 1.29896C7.4132 1.1809 7.26389 1.12187 7.08333 1.12187C6.90278 1.12187 6.75347 1.1809 6.63542 1.29896C6.51736 1.41701 6.45833 1.56632 6.45833 1.74687C6.45833 1.92743 6.51736 2.07674 6.63542 2.19479C6.75347 2.31285 6.90278 2.37187 7.08333 2.37187C7.26389 2.37187 7.4132 2.31285 7.53125 2.19479Z" fill="currentColor" />
  </svg>
);

const InsightsIcon = (props) => (
  <svg viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.50646 15.8333C1.08549 15.8333 0.729167 15.6875 0.4375 15.3958C0.145833 15.1042 0 14.7478 0 14.3269V1.50646C0 1.08549 0.145833 0.729167 0.4375 0.4375C0.729167 0.145833 1.08549 0 1.50646 0H8.125L12.5 4.375V6.67458C12.3001 6.59556 12.096 6.53549 11.8877 6.49437C11.6794 6.45326 11.4668 6.42146 11.25 6.39896V5H7.5V1.25H1.50646C1.44229 1.25 1.38354 1.27674 1.33021 1.33021C1.27674 1.38354 1.25 1.44229 1.25 1.50646V14.3269C1.25 14.391 1.27674 14.4498 1.33021 14.5031C1.38354 14.5566 1.44229 14.5833 1.50646 14.5833H6.42313C6.5866 14.8313 6.76979 15.0601 6.97271 15.27C7.17576 15.48 7.39583 15.6678 7.63292 15.8333H1.50646ZM12.4046 13.2379C12.8314 12.8111 13.0448 12.2874 13.0448 11.6667C13.0448 11.046 12.8314 10.5222 12.4046 10.0954C11.9778 9.66861 11.454 9.45521 10.8333 9.45521C10.2126 9.45521 9.68889 9.66861 9.26208 10.0954C8.83528 10.5222 8.62187 11.046 8.62187 11.6667C8.62187 12.2874 8.83528 12.8111 9.26208 13.2379C9.68889 13.6647 10.2126 13.8781 10.8333 13.8781C11.454 13.8781 11.9778 13.6647 12.4046 13.2379ZM15.0833 16.7869L12.8013 14.5048C12.5203 14.7099 12.2124 14.8651 11.8775 14.9704C11.5425 15.0756 11.1944 15.1281 10.8333 15.1281C9.87181 15.1281 9.05451 14.7916 8.38146 14.1185C7.7084 13.4455 7.37188 12.6282 7.37188 11.6667C7.37188 10.7051 7.7084 9.88785 8.38146 9.21479C9.05451 8.54174 9.87181 8.20521 10.8333 8.20521C11.7949 8.20521 12.6122 8.54174 13.2852 9.21479C13.9583 9.88785 14.2948 10.7051 14.2948 11.6667C14.2948 12.0278 14.2422 12.3758 14.1371 12.7108C14.0318 13.0457 13.8766 13.3536 13.6715 13.6346L15.9535 15.9167L15.0833 16.7869Z" fill="currentColor" />
  </svg>
);

const SettingsIcon = (props) => (
  <svg viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0.815108 12.5014C0.4549 11.8775 0.184533 11.2264 0 10.563C0.810392 10.1495 1.36532 9.30689 1.36532 8.33472C1.36532 7.3633 0.811225 6.52122 0.00183324 6.10739C0.3741 4.76498 1.08103 3.51478 2.08617 2.49289C2.84947 2.98802 3.85668 3.04734 4.69866 2.56122C5.54063 2.0751 5.99287 1.17318 5.94572 0.264586C7.33331 -0.0949472 8.76947 -0.0820806 10.1181 0.266736C10.0718 1.1746 10.524 2.07549 11.3653 2.56122C12.2073 3.04732 13.2145 2.98802 13.9777 2.49294C14.46 2.98444 14.8886 3.54414 15.2489 4.16806C15.6091 4.79197 15.8795 5.44309 16.064 6.10645C15.2536 6.51994 14.6986 7.36255 14.6986 8.33472C14.6986 9.30622 15.2527 10.1482 16.0621 10.5621C15.6899 11.9045 14.983 13.1546 13.9778 14.1766C13.2145 13.6815 12.2073 13.6221 11.3653 14.1082C10.5233 14.5943 10.0711 15.4963 10.1182 16.4049C8.73072 16.7644 7.29456 16.7516 5.94583 16.4027C5.99215 15.4948 5.53997 14.594 4.69866 14.1082C3.85671 13.6221 2.84955 13.6814 2.08626 14.1765C1.60403 13.685 1.17532 13.1253 0.815108 12.5014ZM5.53199 12.6649C6.44147 13.19 7.09464 14.0201 7.40747 14.9728C7.82273 15.0123 8.24072 15.0129 8.65606 14.9741C8.96873 14.021 9.62206 13.1902 10.532 12.6649C11.4419 12.1395 12.4881 11.9891 13.4699 12.1949C13.7111 11.8546 13.9196 11.4922 14.093 11.1129C13.4244 10.3656 13.032 9.38489 13.032 8.33472C13.032 7.28455 13.4244 6.30389 14.093 5.55664C14.0062 5.3683 13.9104 5.18307 13.8055 5.00139C13.7006 4.81971 13.5881 4.64412 13.4683 4.4749C12.487 4.68019 11.4415 4.52967 10.532 4.00459C9.62247 3.47951 8.96939 2.64929 8.65647 1.69668C8.24131 1.65717 7.82323 1.6566 7.40798 1.69532C7.09522 2.64848 6.44189 3.47925 5.53199 4.00459C4.62206 4.52994 3.57593 4.68034 2.59412 4.47458C2.35293 4.81489 2.14442 5.1772 1.97102 5.55653C2.63957 6.30381 3.03199 7.28455 3.03199 8.33472C3.03199 9.38489 2.63958 10.3656 1.97102 11.1128C2.05778 11.3011 2.15359 11.4864 2.25849 11.6681C2.36338 11.8497 2.47589 12.0253 2.59566 12.1946C3.57703 11.9893 4.62254 12.1398 5.53199 12.6649ZM8.03197 10.8347C6.65131 10.8347 5.53199 9.71547 5.53199 8.33472C5.53199 6.95405 6.65131 5.83473 8.03197 5.83473C9.41272 5.83473 10.532 6.95405 10.532 8.33472C10.532 9.71547 9.41272 10.8347 8.03197 10.8347ZM8.03197 9.16805C8.49222 9.16805 8.86531 8.79497 8.86531 8.33472C8.86531 7.87447 8.49222 7.50139 8.03197 7.50139C7.57172 7.50139 7.19864 7.87447 7.19864 8.33472C7.19864 8.79497 7.57172 9.16805 8.03197 9.16805Z" fill="currentColor" />
  </svg>
);

const ProcurementIcon = (props) => (
  <svg viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M15.4677 6.43583V13.0769C15.4677 13.4978 15.3218 13.8542 15.0302 14.1458C14.7385 14.4375 14.3822 14.5833 13.9614 14.5833H2.39078C1.96995 14.5833 1.6137 14.4375 1.32203 14.1458C1.03037 13.8542 0.884534 13.4978 0.884534 13.0769V6.41979C0.548978 6.14424 0.297103 5.7866 0.128909 5.34688C-0.0394243 4.90729 -0.0428965 4.43271 0.118492 3.92312L0.961409 1.16979C1.07252 0.819376 1.26106 0.536806 1.52703 0.322084C1.79315 0.107362 2.11099 0 2.48058 0H13.8556C14.2253 0 14.541 0.10257 14.8027 0.307709C15.0645 0.512848 15.2552 0.794931 15.3747 1.15396L16.2337 3.92312C16.3951 4.43271 16.3916 4.90569 16.2233 5.34208C16.0551 5.77861 15.8032 6.14319 15.4677 6.43583ZM10.0095 5.83333C10.4647 5.83333 10.8068 5.69417 11.036 5.41583C11.2652 5.1375 11.3589 4.83861 11.3172 4.51917L10.8108 1.25H8.80099V4.54167C8.80099 4.89208 8.9196 5.195 9.15683 5.45042C9.39405 5.70569 9.67828 5.83333 10.0095 5.83333ZM6.25953 5.83333C6.64301 5.83333 6.95412 5.70569 7.19287 5.45042C7.43176 5.195 7.5512 4.89208 7.5512 4.54167V1.25H5.54141L5.03516 4.55125C4.99016 4.84722 5.08308 5.13493 5.31391 5.41438C5.54474 5.69368 5.85995 5.83333 6.25953 5.83333ZM2.5512 5.83333C2.85995 5.83333 3.12544 5.72569 3.34766 5.51042C3.56988 5.29514 3.70717 5.02458 3.75953 4.69875L4.24974 1.25H2.48058C2.38974 1.25 2.31766 1.27 2.26433 1.31C2.21085 1.35014 2.17078 1.41028 2.14412 1.49042L1.34266 4.20188C1.23266 4.55979 1.28453 4.92118 1.49828 5.28604C1.7119 5.6509 2.06287 5.83333 2.5512 5.83333ZM13.8012 5.83333C14.252 5.83333 14.5971 5.65625 14.8364 5.30208C15.0757 4.94792 15.1334 4.58118 15.0095 4.20188L14.1664 1.47438C14.1397 1.39424 14.0997 1.33681 14.0464 1.30208C13.9929 1.26736 13.9208 1.25 13.83 1.25H12.1025L12.5927 4.69875C12.645 5.02458 12.7823 5.29514 13.0045 5.51042C13.2268 5.72569 13.4923 5.83333 13.8012 5.83333ZM2.39078 13.3333H13.9614C14.0361 13.3333 14.0975 13.3093 14.1456 13.2612C14.1938 13.2132 14.2179 13.1517 14.2179 13.0769V7.00958C14.127 7.04278 14.0511 7.06333 13.9902 7.07125C13.9293 7.07931 13.8663 7.08333 13.8012 7.08333C13.4262 7.08333 13.0963 7.01549 12.8116 6.87979C12.5269 6.7441 12.2509 6.52667 11.9837 6.2275C11.7498 6.48819 11.4731 6.69604 11.1537 6.85104C10.8343 7.0059 10.47 7.08333 10.0608 7.08333C9.70717 7.08333 9.37384 7.00986 9.06079 6.86292C8.74773 6.71611 8.45287 6.5043 8.1762 6.2275C7.9187 6.5043 7.62704 6.71611 7.3012 6.86292C6.97523 7.00986 6.64509 7.08333 6.31078 7.08333C5.93467 7.08333 5.5821 7.01521 5.25308 6.87896C4.92405 6.74271 4.63453 6.52556 4.38453 6.2275C4.03398 6.57792 3.71099 6.80819 3.41558 6.91833C3.1203 7.02833 2.83217 7.08333 2.5512 7.08333C2.48592 7.08333 2.41856 7.07931 2.34912 7.07125C2.27967 7.06333 2.20808 7.04278 2.13433 7.00958V13.0769C2.13433 13.1517 2.15842 13.2132 2.20662 13.2612C2.25467 13.3093 2.31606 13.3333 2.39078 13.3333Z" fill="currentColor" />
  </svg>
);

const ContactsIcon = (props) => (
  <svg viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4.18833 4.97833C3.61833 4.40847 3.33333 3.72125 3.33333 2.91667C3.33333 2.11222 3.61833 1.425 4.18833 0.854999C4.75833 0.284999 5.44556 0 6.25 0C7.05444 0 7.74167 0.284999 8.31167 0.854999C8.88167 1.425 9.16667 2.11222 9.16667 2.91667C9.16667 3.72125 8.88167 4.40847 8.31167 4.97833C7.74167 5.54833 7.05444 5.83333 6.25 5.83333C5.44556 5.83333 4.75833 5.54833 4.18833 4.97833ZM0 12.1796V10.3269C0 9.91882 0.110833 9.5409 0.3325 9.19312C0.554167 8.84535 0.850417 8.57799 1.22125 8.39104C2.04486 7.98729 2.87576 7.68444 3.71396 7.4825C4.55215 7.28056 5.3975 7.17958 6.25 7.17958C7.1025 7.17958 7.94785 7.28056 8.78604 7.4825C9.62424 7.68444 10.4551 7.98729 11.2787 8.39104C11.6496 8.57799 11.9458 8.84535 12.1675 9.19312C12.3892 9.5409 12.5 9.91882 12.5 10.3269V12.1796H0ZM1.25 10.9296H11.25V10.3269C11.25 10.1581 11.2011 10.0019 11.1033 9.85812C11.0056 9.71451 10.8728 9.59729 10.7052 9.50646C9.98715 9.15285 9.25507 8.88493 8.50896 8.70271C7.76271 8.52063 7.00972 8.42958 6.25 8.42958C5.49028 8.42958 4.73729 8.52063 3.99104 8.70271C3.24493 8.88493 2.51285 9.15285 1.79479 9.50646C1.62715 9.59729 1.49444 9.71451 1.39667 9.85812C1.29889 10.0019 1.25 10.1581 1.25 10.3269V10.9296ZM7.42708 4.09375C7.75347 3.76736 7.91667 3.375 7.91667 2.91667C7.91667 2.45833 7.75347 2.06597 7.42708 1.73958C7.10069 1.41319 6.70833 1.25 6.25 1.25C5.79167 1.25 5.39931 1.41319 5.07292 1.73958C4.74653 2.06597 4.58333 2.45833 4.58333 2.91667C4.58333 3.375 4.74653 3.76736 5.07292 4.09375C5.39931 4.42014 5.79167 4.58333 6.25 4.58333C6.70833 4.58333 7.10069 4.42014 7.42708 4.09375Z" fill="currentColor" />
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
    "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%), #0C4FCD",
  boxShadow: "inset 0px 0px 0px 1.8px rgba(255, 255, 255, 0.25)",
};

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
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
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
    { name: "CRM", isHeader: true },
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
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
    { name: "Accounting", href: "/accounting", icon: Calculator },
    { name: "Sales", icon: BarChart3, isDropdown: true, dropdownType: "sales" },
    {
      name: "Procurement",
      icon: ProcurementIcon,
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

  const renderCompanyLogo = () => (
    <img
      src={dataCirclesLogo}
      alt="DataCircles Logo"
      className="h-8 w-8 rounded-md object-cover flex-shrink-0"
    />
  );

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
          background: primary.white,
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
        <div className="h-16 flex-shrink-0 flex items-center justify-between gap-2 px-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            {/* Product wordmark, not the customer's company — that moved to
                the switcher below. The only logo asset in the repo is the
                icon-only mark, so the name is set alongside it in type.
                Collapsed, just the mark shows. */}
            {renderCompanyLogo()}
            {(isHovered || isMobileOpen) && (
              <span className="font-normal text-lg whitespace-nowrap text-[#0A0A0A] tracking-tight">
                DataCircles
                <sup className="text-[9px] align-super ml-px">®</sup>
              </span>
            )}
          </div>

          {/* Collapses the panel back to the icon rail. Only offered while the
              panel is open — collapsed, the rail has no room for it. */}
          {(isHovered || isMobileOpen) && (
            <button
              type="button"
              onClick={() => {
                setIsHovered(false);
                setIsMobileOpen(false);
              }}
              title="Collapse menu"
              aria-label="Collapse menu"
              className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded hover:opacity-70 transition-opacity"
            >
              {/* The frame, border and glyph all come from the design's SVG. */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="0.5" y="0.5" width="23" height="23" rx="3.5" fill="white" />
                <rect x="0.5" y="0.5" width="23" height="23" rx="3.5" stroke="#E5E5E5" />
                <path
                  d="M7.22388 12.0001L11.3619 16.1382L12.3047 15.1954L9.10949 12.0001L12.3047 8.80487L11.3619 7.86206L7.22388 12.0001ZM10.9905 12.0001L15.1285 16.1382L16.0713 15.1954L12.8761 12.0001L16.0713 8.80487L15.1285 7.86206L10.9905 12.0001Z"
                  fill="#0A0A0A"
                />
              </svg>
            </button>
          )}
        </div>
        {/* Company switcher. Sits in the strip that carries the page toolbar's
            rule across the sidebar, so that line reads as one unbroken border
            and the nav starts below it. Collapsed, only the avatar shows. */}
        <div
          className={`relative h-16 flex-shrink-0 flex flex-col items-start justify-center border-b border-[#ECECEC] bg-white ${isHovered || isMobileOpen ? "p-3" : "px-3"
            }`}
        >
          <button
            type="button"
            onClick={() => setIsCompanyMenuOpen((v) => !v)}
            title={branding?.companyName || "Company"}
            className={`box-border flex flex-row items-center h-10 bg-white border border-[#E5E5E5] rounded-md hover:bg-gray-50 transition-colors ${isHovered || isMobileOpen
              ? "self-stretch gap-2.5 pl-1.5 pr-2.5 py-1.5"
              // Collapsed: a 40px square framing a 32px avatar, per the design.
              : "w-10 justify-center p-1"
              }`}
          >
            <span
              className={`flex flex-row items-center gap-1.5 min-w-0 ${isHovered || isMobileOpen ? "flex-1" : "w-8 h-8"
                }`}
            >
              <span
                className={`flex items-center justify-center flex-shrink-0 rounded text-white text-[14px] font-medium leading-[102%] ${isHovered || isMobileOpen ? "w-7 h-7" : "w-8 h-8"
                  }`}
                style={{ background: "#0085FF" }}
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
              <div className="absolute left-3 right-3 top-full mt-1 z-[9997] bg-white border border-[#E5E5E5] rounded-md shadow-lg py-1">
                <div className="flex items-center gap-1.5 px-2 py-2 bg-[#F5FAFF]">
                  <span
                    className="flex items-center justify-center w-7 h-7 flex-shrink-0 rounded text-white text-[14px] font-medium leading-[102%]"
                    style={{ background: "#0085FF" }}
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
        <nav className="flex-1 min-h-0 overflow-y-auto pt-1 pb-2 bg-white flex flex-col">
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
          className="h-16 flex-shrink-0 flex items-center px-4 border-t border-gray-100 bg-white"
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
    </>
  );
};

export default Navbar;
