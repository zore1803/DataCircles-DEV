import React, { useEffect, useState, useMemo, useRef } from "react";
import API from "../services/api";
import { Link } from "react-router-dom";
import logo from "/DataCircles.png";
import {
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Upload,
  Building2,
  MapPin,
  Briefcase,
  Globe,
  Edit2,
  Trash2,
  FileText,
  CheckSquare,
  MoreVertical,
  ChevronDown as ExpandIcon,
  ChevronUp as CollapseIcon,
  Settings,
  FolderPlus,
  Download,
  StickyNote,
  MoreHorizontal,
  SlidersHorizontal,
  Eye,
  Pin,
  PinOff,
  Star,
} from "lucide-react";
import ImportClients from "../components/company/ImportClients";
import Hotlist from "../components/company/Hotlist";
import BulkActions from "../components/BulkActions";
import CompanyForm from "../components/company/CompanyForm";
import ProfilePicture from "../components/contact/ProfilePicture";
import VideoTutorialModal from "../components/VideoTutorialModal";
import ColumnSettingsPanel from "../components/ColumnSettingsPanel";
import { useColumnSettings } from "../hooks/useColumnSettings";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

const CompanyNameIcon = (props) => (
  <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7.91667 10.2083C8.32153 10.2083 8.66583 10.0665 8.94958 9.78292C9.2332 9.49917 9.375 9.15486 9.375 8.75C9.375 8.34514 9.2332 8.00083 8.94958 7.71708C8.66583 7.43347 8.32153 7.29167 7.91667 7.29167C7.51181 7.29167 7.1675 7.43347 6.88375 7.71708C6.60014 8.00083 6.45833 8.34514 6.45833 8.75C6.45833 9.15486 6.60014 9.49917 6.88375 9.78292C7.1675 10.0665 7.51181 10.2083 7.91667 10.2083ZM1.50646 14.5833C1.08549 14.5833 0.729167 14.4375 0.4375 14.1458C0.145833 13.8542 0 13.4978 0 13.0769V4.42313C0 4.00215 0.145833 3.64583 0.4375 3.35417C0.729167 3.0625 1.08549 2.91667 1.50646 2.91667H5V1.50646C5 1.08549 5.14583 0.729167 5.4375 0.4375C5.72917 0.145833 6.08549 0 6.50646 0H9.32687C9.74785 0 10.1042 0.145833 10.3958 0.4375C10.6875 0.729167 10.8333 1.08549 10.8333 1.50646V2.91667H14.3269C14.7478 2.91667 15.1042 3.0625 15.3958 3.35417C15.6875 3.64583 15.8333 4.00215 15.8333 4.42313V13.0769C15.8333 13.4978 15.6875 13.8542 15.3958 14.1458C15.1042 14.4375 14.7478 14.5833 14.3269 14.5833H1.50646ZM1.50646 13.3333H14.3269C14.391 13.3333 14.4498 13.3066 14.5031 13.2531C14.5566 13.1998 14.5833 13.141 14.5833 13.0769V4.42313C14.5833 4.35896 14.5566 4.30021 14.5031 4.24687C14.4498 4.1934 14.391 4.16667 14.3269 4.16667H1.50646C1.44229 4.16667 1.38354 4.1934 1.33021 4.24687C1.27674 4.30021 1.25 4.35896 1.25 4.42313V13.0769C1.25 13.141 1.27674 13.1998 1.33021 13.2531C1.38354 13.3066 1.44229 13.3333 1.50646 13.3333ZM6.25 2.91667H9.58333V1.50646C9.58333 1.44229 9.5566 1.38354 9.50313 1.33021C9.44979 1.27674 9.39104 1.25 9.32687 1.25H6.50646C6.44229 1.25 6.38354 1.27674 6.33021 1.33021C6.27674 1.38354 6.25 1.44229 6.25 1.50646V2.91667Z" fill="#525252" />
  </svg>
);

const CompanyIndustryIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0 15.5127V6.18896L5 4.0625V5.71312L9.16667 4.04646V6.34604H15.8333V15.5127H0ZM1.25 14.2627H14.5833V7.59604H7.91667V5.88771L3.75 7.55437V5.92937L1.25 7.03354V14.2627ZM7.17958 12.4038H8.65375V9.455H7.17958V12.4038ZM3.84625 12.4038H5.32042V9.455H3.84625V12.4038ZM10.5129 12.4038H11.9871V9.455H10.5129V12.4038ZM15.8333 6.34604H12.4519L13.2852 0H15.0481L15.8333 6.34604Z" fill="#525252" />
  </svg>
);

const CompanyLocationIcon = (props) => (
  <svg width="11" height="16" viewBox="0 0 11 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.96479 15.2275C1.0716 14.8237 0.625 14.3019 0.625 13.6619C0.625 13.3659 0.736389 13.0876 0.959167 12.8269C1.18194 12.5662 1.48993 12.3424 1.88313 12.1554L2.86708 13.0481C2.68861 13.1197 2.50104 13.2088 2.30437 13.3156C2.10785 13.4226 1.97326 13.5353 1.90063 13.6538C2.0384 13.9028 2.4484 14.1199 3.13062 14.3052C3.81271 14.4906 4.57472 14.5833 5.41667 14.5833C6.25319 14.5833 7.01604 14.4906 7.70521 14.3052C8.39424 14.1199 8.80771 13.9028 8.94563 13.6538C8.87507 13.5267 8.73271 13.4097 8.51854 13.3029C8.30424 13.1961 8.10097 13.1069 7.90875 13.0352L8.87979 12.1298C9.30604 12.3253 9.63403 12.5535 9.86375 12.8142C10.0935 13.0749 10.2083 13.3574 10.2083 13.6619C10.2083 14.3019 9.76174 14.8237 8.86854 15.2275C7.97535 15.6314 6.82472 15.8333 5.41667 15.8333C4.00861 15.8333 2.85799 15.6314 1.96479 15.2275ZM5.4375 11.7708C6.81778 10.7249 7.85382 9.68882 8.54562 8.66271C9.23743 7.63646 9.58333 6.6175 9.58333 5.60583C9.58333 4.16778 9.13326 3.08229 8.23312 2.34938C7.33299 1.61646 6.39417 1.25 5.41667 1.25C4.44444 1.25 3.50694 1.61646 2.60417 2.34938C1.70139 3.08229 1.25 4.16778 1.25 5.60583C1.25 6.55236 1.5916 7.53313 2.27479 8.54813C2.95799 9.56313 4.01222 10.6374 5.4375 11.7708ZM5.41667 13.3333C3.59722 11.9743 2.23958 10.6543 1.34375 9.37333C0.447917 8.09236 0 6.83653 0 5.60583C0 4.67847 0.16375 3.86597 0.49125 3.16833C0.81875 2.47069 1.24153 1.88653 1.75958 1.41583C2.27778 0.945278 2.85875 0.591666 3.5025 0.355C4.14611 0.118333 4.78417 0 5.41667 0C6.04917 0 6.68722 0.118333 7.33083 0.355C7.97458 0.591666 8.55556 0.945278 9.07375 1.41583C9.59181 1.88653 10.0146 2.47069 10.3421 3.16833C10.6696 3.86597 10.8333 4.67847 10.8333 5.60583C10.8333 6.83653 10.3854 8.09236 9.48958 9.37333C8.59375 10.6543 7.23611 11.9743 5.41667 13.3333ZM5.41667 6.99521C5.83222 6.99521 6.18715 6.84938 6.48146 6.55771C6.7759 6.26604 6.92312 5.90972 6.92312 5.48875C6.92312 5.07319 6.7759 4.71826 6.48146 4.42396C6.18715 4.12951 5.83222 3.98229 5.41667 3.98229C5.00639 3.98229 4.65278 4.12951 4.35583 4.42396C4.05875 4.71826 3.91021 5.07319 3.91021 5.48875C3.91021 5.90972 4.05875 6.26604 4.35583 6.55771C4.65278 6.84938 5.00639 6.99521 5.41667 6.99521Z" fill="#525252" />
  </svg>
);

const CompanyWebsiteIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M15.6667 15.9166L12.9999 13.2499V15.4166H11.7499V11.1249H15.9999V12.3749H13.8332L16.5 15.0416L15.6667 15.9166ZM8 15.6666C6.90556 15.6666 5.87639 15.4588 4.9125 15.0433C3.94861 14.6277 3.11111 14.0637 2.39861 13.3514C1.68639 12.639 1.12222 11.8014 0.706944 10.8383C0.291389 9.87528 0.0833333 8.84618 0.0833333 7.75139C0.0833333 6.65639 0.291389 5.62709 0.706944 4.66375C1.12222 3.70022 1.68639 2.86209 2.39861 2.14958C3.11111 1.43695 3.94861 0.872569 4.9125 0.456805C5.87556 0.041144 6.90444 -0.166672 8 -0.166672C9.09444 -0.166672 10.1236 0.041144 11.0875 0.456805C12.0514 0.872256 12.8889 1.43626 13.6014 2.14875C14.3136 2.86125 14.8778 3.69907 15.2931 4.66222C15.7086 5.62542 15.9167 6.65459 15.9167 7.74972C15.9167 7.99976 15.9047 8.25085 15.8806 8.50305C15.8567 8.75417 15.8222 9.00528 15.7736 9.25639H14.4903C14.5486 9.00528 14.5931 8.75417 14.6222 8.50305C14.6522 8.25207 14.6667 7.99976 14.6667 7.74972C14.6667 7.44695 14.6467 7.14417 14.6069 6.84167C14.5667 6.53889 14.5042 6.23792 14.4181 5.93889H11.3208C11.3736 6.23792 11.4111 6.53889 11.4347 6.84167C11.4583 7.14417 11.4694 7.44695 11.4694 7.74972C11.4694 7.99976 11.4611 8.25085 11.4444 8.50305C11.4272 8.75417 11.4028 9.00528 11.3694 9.25639H10.1194C10.1522 9.00528 10.1778 8.75417 10.1944 8.50305C10.2111 8.25207 10.2194 7.99976 10.2194 7.74972C10.2194 7.44695 10.2078 7.14417 10.1847 6.84167C10.1611 6.53889 10.1236 6.23792 10.0708 5.93889H5.92917C5.87694 6.23792 5.83889 6.53903 5.81583 6.84222C5.79194 7.14542 5.78 7.44861 5.78 7.75181C5.78 8.05499 5.79194 8.35735 5.81583 8.65916C5.83889 8.96097 5.87694 9.26153 5.92917 9.56083H8.99444V10.8108H6.21639C6.40139 11.4663 6.63944 12.0954 6.93167 12.6977C7.22389 13.2999 7.58 13.867 8 14.3989C8.25139 14.3989 8.50194 14.3842 8.75167 14.3549C9.00167 14.3255 9.25222 14.297 9.50333 14.2691V15.5368C9.25222 15.5646 9.00167 15.5931 8.75167 15.6224C8.50194 15.6519 8.25139 15.6666 8 15.6666ZM1.58194 9.56083H4.68C4.62778 9.26153 4.58972 8.96056 4.56583 8.65792C4.54194 8.35513 4.53 8.05194 4.53 7.74833C4.53 7.44528 4.54194 7.14264 4.56583 6.84042C4.58972 6.53792 4.62778 6.23792 4.68 5.93889H1.58194C1.49583 6.23792 1.43333 6.53903 1.39333 6.84222C1.35306 7.14542 1.33306 7.44861 1.33306 7.75181C1.33306 8.05499 1.35306 8.35735 1.39333 8.65916C1.43333 8.96097 1.49583 9.26153 1.58194 9.56083ZM2.10583 4.6889H4.92917C5.07222 4.08417 5.26333 3.49917 5.50278 2.9339C5.74222 2.36862 6.03722 1.82848 6.38667 1.31347C5.45111 1.52068 4.6125 1.91917 3.87028 2.5089C3.12806 3.09862 2.54083 3.82514 2.10583 4.6889ZM6.38667 14.19C6.05167 13.6668 5.76278 13.1213 5.52 12.5535C5.27722 11.9857 5.08083 11.4022 4.93083 10.8031H2.10583C2.54083 11.6609 3.13028 12.3823 3.87417 12.9672C4.61806 13.5522 5.45722 13.9531 6.38667 14.19ZM6.21639 4.6889H9.78028C9.60528 4.03292 9.36722 3.40667 9.06611 2.81014C8.765 2.21361 8.41722 1.64361 8.02278 1.10014C7.6075 1.63194 7.25139 2.19889 6.95444 2.8010C6.65722 3.40292 6.40972 4.03181 6.21639 4.6889ZM11.0708 4.6889H13.8942C13.4592 3.82264 12.8708 3.09472 12.1289 2.50236C11.3867 1.90972 10.5481 1.51264 9.61306 1.31111C9.94806 1.83128 10.2389 2.36917 10.4856 2.9248C10.7325 3.48042 10.9306 4.06153 11.0708 4.6889Z" fill="#525252" />
  </svg>
);

const CompanyGSTINIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M3.125 11.0417H8.541V9.7917H3.125V11.0417ZM3.125 7.7083H10.958V6.4583H3.125V7.7083ZM3.125 4.375H10.958V3.125H3.125V4.375ZM1.506 14.1667C1.085 14.1667 0.729 14.0209 0.4375 13.7292C0.14583 13.4375 0 13.0812 0 12.6603V1.50638C0 1.08543 0.14583 0.72913 0.4375 0.4375C0.729 0.14583 1.085 0 1.506 0H12.66C13.081 0 13.4373 0.14583 13.729 0.4375C14.0207 0.72913 14.1667 1.08543 14.1667 1.50638V12.6603C14.1667 13.0812 14.0207 13.4375 13.729 13.7292C13.4373 14.0209 13.081 14.1667 12.66 14.1667H1.506ZM1.506 12.9167H12.66C12.7241 12.9167 12.7829 12.89 12.8363 12.8365C12.8896 12.7832 12.9163 12.7244 12.9163 12.6603V1.50638C12.9163 1.44221 12.8896 1.38346 12.8363 1.33013C12.7829 1.27665 12.7241 1.24992 12.66 1.24992H1.506C1.44183 1.24992 1.38308 1.27665 1.32975 1.33013C1.27625 1.38346 1.2495 1.44221 1.2495 1.50638V12.6603C1.2495 12.7244 1.27625 12.7832 1.32975 12.8365C1.38308 12.89 1.44183 12.9167 1.506 12.9167Z" fill="#1C1B1F" />
  </svg>
);

const CompanyDocumentSignedIcon = (props) => (
  <svg width="13" height="16" viewBox="0 0 13 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2.87021 11.7227L1.16188 4.6875L6.25 0L11.33 4.6875L9.62187 11.7227H2.87021ZM3.85417 10.4727H8.63792L9.94063 5.11375L6.875 2.28042V4.98562C7.05875 5.09785 7.20618 5.24604 7.31729 5.43021C7.4284 5.61451 7.48396 5.82097 7.48396 6.04958C7.48396 6.38833 7.36299 6.67868 7.12104 6.92063C6.87896 7.16257 6.58861 7.28354 6.25 7.28354C5.90597 7.28354 5.61299 7.16257 5.37104 6.92063C5.1291 6.67868 5.00813 6.38833 5.00813 6.04958C5.00813 5.82097 5.06368 5.61319 5.17479 5.42625C5.2859 5.23931 5.43597 5.09243 5.625 4.98562V2.28042L2.55938 5.11375L3.85417 10.4727ZM0 15.8333L0.42625 14.6073C0.526667 14.3081 0.701389 14.0691 0.950417 13.8902C1.19931 13.7113 1.48028 13.6219 1.79333 13.6219H10.7067C11.0197 13.6219 11.3007 13.7113 11.5496 13.8902C11.7986 14.0691 11.9733 14.3081 12.0737 14.6073L12.5 15.8333H0Z" fill="#525252" />
  </svg>
);

const CompanyLeadSourceIcon = CompanyDocumentSignedIcon;
import { getVideoTutorial } from "../utils/videoTutorials";
import AdvancedFilterPanel from "../components/common/AdvancedFilterPanel";
import useCompanyStore from "../store/useCompanyStore";
import AddToCompanyHotlistModal from "../components/company/AddToCompanyHotlistModal";
import ExportModal from "../components/common/ExportModal";
import { NoteEditor } from "../components/company/NoteSection";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import CompanyQuickView from "../components/company/CompanyQuickView";
import AppToaster from "../components/AppToaster";

function Companies() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    address: "",
    website: "",
    gstin: "",
    documentSigned: false,
    leadSource: "",
    profilePicture: null,
    profilePictureUrl: "",
  });
  const [additionalFields, setAdditionalFields] = useState({});
  const [companyFieldNames, setCompanyFieldNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [industries, setIndustries] = useState([]);
  const [industriesLoading, setIndustriesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHotlist, setShowHotlist] = useState(false);
  const [permission, setPermission] = useState("");
  const [showAddToHotlistModal, setShowAddToHotlistModal] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const [openRowActionsId, setOpenRowActionsId] = useState(null);
  const rowActionsRef = useRef(null);
  const [quickHotlistCompanyId, setQuickHotlistCompanyId] = useState(null);
  const [starredCompanies, setStarredCompanies] = useState(() => {
    const saved = localStorage.getItem("starred_companies");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("starred_companies", JSON.stringify(starredCompanies));
  }, [starredCompanies]);

  const toggleStar = (e, companyId) => {
    e.stopPropagation();
    setStarredCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };
  const location = useLocation();
  const { state } = location;

  const [showBulkNoteModal, setShowBulkNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [taggedContacts, setTaggedContacts] = useState([]);
  const [allContacts, setAllContacts] = useState([]); // Needed for the tagging dropdown

  // Video Tutorial State
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);

  // Column Settings State
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const [quickViewCompanyId, setQuickViewCompanyId] = useState(null);

  // Advanced Filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Bulk selection
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [expandedRows, setExpandedRows] = useState([]);

  const [columnSizing, setColumnSizing] = useState({});

  const [pinnedColumn, setPinnedColumn] = useState(null);

  const togglePinColumn = (colKey) => {
    setPinnedColumn((prev) => (prev === colKey ? null : colKey));
  };

  const {
    searchTerm,
    setSearchTerm,
    filterIndustry,
    setFilterIndustry,
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    sortConfig,
    setSortConfig,
    setCurrentCompanyIds,
  } = useCompanyStore();

  // Define default columns - NOW UPDATES WHEN companyFieldNames CHANGES
  const defaultColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "name",
        label: "Company Name",
        visible: true,
        order: 0,
        required: true,
        defaultVisible: true,
        sortable: true,
        icon: CompanyNameIcon,
      },
      {
        key: "industry",
        label: "Industry",
        visible: true,
        order: 1,
        sortable: true,
        icon: CompanyIndustryIcon,
      },
      {
        key: "address",
        label: "Location",
        visible: true,
        order: 2,
        icon: CompanyLocationIcon,
      },
      {
        key: "website",
        label: "Website",
        visible: true,
        order: 3,
        icon: CompanyWebsiteIcon,
      },
      {
        key: "gstin",
        label: "GSTIN",
        visible: true,
        order: 4,
        sortable: true,
        icon: CompanyGSTINIcon,
      },
      {
        key: "documentSigned",
        label: "Document Signed",
        visible: true,
        order: 5,
        sortable: true,
        icon: CompanyDocumentSignedIcon,
      },
      {
        key: "leadSource",
        label: "Lead Source",
        visible: true,
        order: 6,
        sortable: true,
        icon: CompanyLeadSourceIcon,
      },
    ];

    // Add custom fields ONLY if they exist
    if (companyFieldNames && companyFieldNames.length > 0) {
      const customColumns = companyFieldNames.map((field, index) => ({
        key: field.name || field,
        label: field.name || field,
        visible: false, // Hidden by default - user can show them
        order: baseColumns.length + index,
        isCustomField: true,
        type: field.type || "text",
        options: field.options,
        description: `Custom field: ${field.name || field}`,
      }));

      return [...baseColumns, ...customColumns];
    }

    return baseColumns;
  }, [companyFieldNames]); // Re-run when companyFieldNames changes

  // Use column settings hook
  const { columns, saveColumns, getVisibleColumns } = useColumnSettings(
    "companies",
    defaultColumns,
  );

  const visibleColumns = useMemo(() => getVisibleColumns(), [columns]);

  const columnHelper = createColumnHelper();

  // Sort companies so that starred ones always appear at the top
  const sortedCompanies = companies || [];

  const tableColumns = useMemo(() => {
    const cols = [];

    // 1. Checkbox Column
    if (selectionMode) {
      cols.push(
        columnHelper.display({
          id: "selection",
          size: 60,
          enableResizing: false,
          header: () => (
            <div className="flex justify-center items-center w-full">
              <input
                type="checkbox"
                checked={
                  selectedCompanies.length === companies.length &&
                  companies.length > 0
                }
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="flex justify-center items-center gap-1 w-full">
              <input
                type="checkbox"
                checked={selectedCompanies.includes(row.original._id)}
                onChange={() => handleSelectCompany(row.original._id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          ),
        }),
      );
    }


    // 2. Dynamic Data Columns
    const pinnedFields = visibleColumns.filter((vc) => vc.key === pinnedColumn);
    const unpinnedFields = visibleColumns.filter((vc) => vc.key !== pinnedColumn);

    [...pinnedFields, ...unpinnedFields].forEach((vc) => {
      cols.push(
        columnHelper.accessor((row) => getFieldValue(row, vc.key), {
          id: vc.key,
          size: vc.key === "name" ? 220 : vc.key === "address" ? 250 : 150,
          header: () => {
            const Icon = vc.icon;
            const isSortable = vc.sortable !== false;
            const isPinned = pinnedColumn === vc.key;

            return (
              <div
                className={`flex items-center justify-between w-full group ${isSortable ? "cursor-pointer select-none" : ""
                  }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  togglePinColumn(vc.key);
                }}
              >
                <div
                  className="flex items-center gap-2 flex-1 min-w-0"
                  onClick={() => isSortable && handleSort(vc.key)}
                >
                  {Icon && <Icon className="w-4 h-4 inline flex-shrink-0" />}
                  <span className="truncate" title={vc.label}>
                    {vc.label}
                  </span>

                  {/* Pin Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinColumn(vc.key);
                    }}
                    className={`p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned
                      ? "opacity-100 text-blue-600"
                      : "opacity-0 group-hover:opacity-100 text-gray-400"
                      }`}
                    title={isPinned ? "Unpin Column" : "Pin Column"}
                  >
                    {isPinned ? (
                      <PinOff className="w-3.5 h-3.5" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isSortable && (
                  <div
                    className="flex flex-col ml-1 flex-shrink-0 cursor-pointer"
                    onClick={() => handleSort(vc.key)}
                  >
                    <ChevronUp
                      className={`w-3 h-3 ${sortConfig.key === vc.key && sortConfig.direction === "asc"
                        ? "text-blue-600"
                        : "text-gray-400"
                        }`}
                    />
                    <ChevronDown
                      className={`w-3 h-3 -mt-1 ${sortConfig.key === vc.key && sortConfig.direction === "desc"
                        ? "text-blue-600"
                        : "text-gray-400"
                        }`}
                    />
                  </div>
                )}
              </div>
            );
          },
          cell: ({ row, getValue }) => {
            // ... Keep all your existing cell rendering logic here exactly as it is ...
            const company = row.original;
            const isExpanded = expandedRows.includes(company._id);
            const val = getValue();

            if (vc.key === "name") {
              // ... your existing name cell logic
              return (
                <div className="flex items-center justify-between w-full group relative">
                  <div className="flex items-center min-w-0 flex-1 pr-4">
                    <Link
                      to={`/companies/${company._id}`}
                      className="text-[#0085FF] font-semibold hover:underline truncate transition-all duration-150 ease-out group-hover:text-[#004CFF] min-w-0"
                      title={company.name}
                    >
                      {company.name}
                    </Link>
                    {starredCompanies.includes(company._id) && (
                      <Star className="flex-shrink-0 w-3.5 h-3.5 ml-1.5 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 ease-out pointer-events-none group-hover:pointer-events-auto bg-white/80 backdrop-blur-[2px] rounded-lg">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuickViewCompanyId(company._id);
                      }}
                      className="p-1.5 rounded-md bg-white shadow-sm border border-gray-200 hover:bg-blue-50 text-blue-600 transition-colors"
                      title="Quick view"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(company);
                      }}
                      className="p-1.5 rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Edit Company"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(company._id);
                      }}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Delete Company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }
            if (vc.key === "industry") {
              return <div className="truncate text-sm text-gray-700 capitalize font-medium" title={company.industry}>{company.industry || "—"}</div>;
            }
            if (vc.key === "address") {
              const address = company.address;
              return (
                <div className="flex items-center gap-2 w-full">
                  <div className={`${isExpanded ? "whitespace-normal" : "truncate"} text-sm text-gray-700`} title={address}>
                    {isExpanded ? address || "—" : truncateText(address, 30)}
                  </div>
                  {address && address.length > 30 && (
                    <button onClick={(e) => { e.stopPropagation(); toggleExpandRow(company._id); }} className="text-blue-600 hover:text-blue-700 flex-shrink-0">
                      {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            }
            if (vc.key === "website") {
              return company.website ? (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate block w-full" title={company.website}>{company.website}</a>
              ) : <span className="text-sm text-gray-400">—</span>;
            }
            if (vc.key === "gstin") {
              return <div className="truncate text-sm text-gray-700 font-mono w-full" title={company.gstin}>{company.gstin || "—"}</div>;
            }
            if (vc.key === "documentSigned") {
              return company.documentSigned ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  Accepted
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                  Pending
                </span>
              );
            }
            if (vc.key === "leadSource") {
              const isOpen = openRowActionsId === company._id;
              return (
                <div className="flex items-center justify-between w-full">
                  <span className="truncate text-sm text-gray-700" title={company.leadSource}>{company.leadSource || "—"}</span>
                  <div
                    className="relative flex-shrink-0"
                    ref={isOpen ? rowActionsRef : null}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenRowActionsId(isOpen ? null : company._id);
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {isOpen && (
                      <div className="absolute right-0 top-full z-[100] mt-1 w-[190px] bg-white border border-[#E5E5EC] rounded-xl shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-2 flex flex-col gap-2 animate-in fade-in zoom-in duration-150 origin-top-right pointer-events-auto">
                        <Link
                          to={`/companies/${company._id}`}
                          onClick={() => setOpenRowActionsId(null)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 text-[#1C1B1F]" />
                          View Company
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenRowActionsId(null);
                            handleEdit(company);
                          }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                        >
                          <Edit2 className="w-4 h-4 text-[#1C1B1F]" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenRowActionsId(null);
                            setQuickHotlistCompanyId(company._id);
                          }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                        >
                          <FolderPlus className="w-4 h-4 text-[#1C1B1F]" />
                          Move to a Folder
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenRowActionsId(null);
                            setQuickHotlistCompanyId(company._id);
                          }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                        >
                          <FileText className="w-4 h-4 text-[#1C1B1F]" />
                          Add to Hotlist
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(e, company._id);
                          }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                        >
                          <Star className={`w-4 h-4 ${starredCompanies.includes(company._id) ? "text-yellow-400 fill-yellow-400" : "text-[#1C1B1F]"}`} />
                          {starredCompanies.includes(company._id) ? "Unstar Company" : "Star Company"}
                        </button>
                        <div className="w-full border-t border-[#F1F1F5]" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenRowActionsId(null);
                            handleDelete(company._id);
                          }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-[#CD3636] hover:bg-red-50 whitespace-nowrap"
                        >
                          <Trash2 className="w-4 h-4 text-[#CD3636]" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return <div className="truncate text-sm text-gray-700 w-full" title={String(val)}>{truncateText(String(val), 30)}</div>;
          },
        })
      );
    });

    return cols;
  }, [
    selectionMode,
    visibleColumns,
    selectedCompanies,
    sortedCompanies,
    sortConfig,
    expandedRows,
    pinnedColumn,
    openRowActionsId,
    starredCompanies,
  ]);

  const table = useReactTable({
    data: sortedCompanies,
    columns: tableColumns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const handleDelete = async (companyId) => {
    setCompanyToDelete(companyId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;

    const loadingToast = toast.loading("Deleting company...");

    try {
      setLoading(true);
      await API.delete(`/companies/${companyToDelete}`);
      await fetchCompanies();
      toast.success("Company deleted successfully!", { id: loadingToast });
    } catch (err) {
      let errorMessage = "Failed to delete company";
      if (err.response && err.response.status === 402) {
        errorMessage = err.response.data.message || "An active subscription is required to make changes.";
      } else if (err.response && err.response.status === 403) {
        errorMessage = err.response.data.message || "Access denied";
      }
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setCompanyToDelete(null);
    }
  };

  // Long press handlers
  const handleMouseDown = (companyId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectCompany(companyId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchStart = (companyId) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      handleSelectCompany(companyId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Toggle expanded row
  const toggleExpandRow = (companyId) => {
    setExpandedRows((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  // Truncate text
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "—";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(true);
    setSelectedCompanies([]);
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filterIndustry]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchCompanies();
  }, [pagination.currentPage, pagination.limit, sortConfig]);

  const fetchAllContacts = async () => {
    try {
      const res = await API.get("/contacts");
      setAllContacts(res.data);
    } catch (err) {
      console.error("Failed to load contacts for notes");
    }
  };

  // Separate effect for search/filter to trigger reset + fetch
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchCompanies();
    }
  }, [searchTerm, filterIndustry]);

  // INITIALIZE: Fetch field names first
  useEffect(() => {
    const initialize = async () => {
      await fetchCompanyFieldNames(); // Wait for this to complete
      await fetchUser();
      await fetchIndustries(); // Fetch industries
      await fetchAllContacts();
    };
    initialize();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await API.get("/auth/me");
      const user = res.data;
      const userPerm = user?.user?.permissions?.find(
        (p) => p.name.toLowerCase() === "companies",
      );
      setPermission(userPerm?.permission || "no");
    } catch {
      setPermission("no");
      toast.error("Failed to fetch user permissions");
    }
  };

  const fetchCompanyFieldNames = async () => {
    try {
      const res = await API.get("/company-fields");
      if (res.data) {
        const fields = res.data.fields || [];
        console.log("✅ Fetched custom fields:", fields);
        setCompanyFieldNames(fields);
      }
    } catch (err) {
      console.error("Failed to fetch company fields");
      toast.error("Failed to fetch company fields");
    }
  };

  const fetchIndustries = async () => {
    try {
      setIndustriesLoading(true);

      // Default system industries
      const defaultIndustries = [
        "Information Technology & Services",
        "Finance & Banking",
        "Healthcare & Pharmaceuticals",
        "Education & EdTech",
        "Retail & E-Commerce",
        "Manufacturing",
        "Real Estate",
        "Marketing & Advertising",
        "Travel & Hospitality",
        "Nonprofit / Government / Public Sector",
      ];

      // Fetch custom industries from API
      const res = await API.get("/company-industries");
      let customIndustries = [];

      if (res.data) {
        // Get custom industries (filter out default ones from API)
        const custom = res.data.filter((ind) => !ind.isDefault) || [];
        customIndustries = custom.map((ind) => ind.name);
      }

      // Combine default and custom industries, remove duplicates, and sort
      const allIndustries = [
        ...new Set([...defaultIndustries, ...customIndustries]),
      ].sort();
      setIndustries(allIndustries);
    } catch (err) {
      console.error("Failed to fetch industries", err);
      toast.error("Failed to fetch industries");
    } finally {
      setIndustriesLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      if (filterIndustry) {
        params.append("industry", filterIndustry);
      }

      if (activeFilters && activeFilters.length > 0) {
        params.append("advancedFilters", JSON.stringify(activeFilters));
      }

      const res = await API.get(`/companies/pagination?${params.toString()}`);

      if (res.data.companies && res.data.pagination) {
        setCompanies(res.data.companies);
        setCurrentCompanyIds(res.data.companies.map((c) => c._id));
        setPagination((prev) => ({
          ...prev,
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.totalCount,
          hasNextPage: res.data.pagination.hasNextPage,
          hasPrevPage: res.data.pagination.hasPrevPage,
        }));
      } else {
        setCompanies(res.data || []);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
      if (err.response && err.response.status === 403) {
        toast.error(err.response.data.error || "Access denied");
      } else {
        toast.error("Failed to load companies");
      }
      setCompanies([]);
    } finally {
      setLoading(false);
      setShowImport(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages &&
      newPage !== pagination.currentPage
    ) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      currentPage: 1,
    }));
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // Bulk selection and actions
  const handleSelectAll = () => {
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([]);
      setSelectionMode(true);
    } else {
      setSelectedCompanies(companies.map((c) => c._id));
      setSelectionMode(true);
    }
  };

  const handleSelectCompany = (companyId) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  const handleBulkDeleteCompanies = async (itemIds) => {
    setBulkLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/companies/${id}`)));
      await fetchCompanies();
      setSelectedCompanies([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully deleted ${itemIds.length} companies`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const companyFieldConfig = {
    fields: [
      {
        key: "industry",
        label: "Industry",
        type: "text",
      },
      {
        key: "address",
        label: "Address",
        type: "text",
      },
      {
        key: "website",
        label: "Website",
        type: "text",
      },
      {
        key: "gstin",
        label: "GSTIN",
        type: "text",
      },
      ...companyFieldNames.map((field) => ({
        key: field.name || field,
        label: field.name || field,
        type: field.type || "text",
        isCustomField: true,
        options: field.options,
      })),
    ],
  };

  const handleBulkUpdateCompanies = async ({ field, value, itemIds }) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => {
          let payload = {};
          if (companyFieldNames.some((f) => (f.name || f) === field)) {
            payload.additionalFields = [{ key: field, value }];
          } else {
            payload[field] = value;
          }
          return API.put(`/companies/${id}`, payload);
        }),
      );
      await fetchCompanies();
      setSelectedCompanies([]);
      setShowBulkActions(false);
      setSelectionMode(false);
      toast.success(`Successfully updated ${itemIds.length} companies`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle saving the bulk note
  const handleBulkNoteSave = async () => {
    if (!noteContent.trim() || noteContent === "<p><br></p>") {
      toast.error("Note content is required");
      return;
    }

    setBulkLoading(true);
    const loadingToast = toast.loading(
      `Adding note to ${selectedCompanies.length} companies...`,
    );

    try {
      await API.post("/notes/bulk", {
        title: noteTitle,
        note: noteContent,
        companyIds: selectedCompanies,
        taggedContacts: taggedContacts.map((c) => c.value),
      });

      toast.success("Notes successfully added!", { id: loadingToast });

      // Reset and close
      setNoteTitle("");
      setNoteContent("");
      setTaggedContacts([]);
      setShowBulkNoteModal(false);
      exitSelectionMode(); // Deselect rows
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.", { id: loadingToast });
      } else {
        toast.error(err.response?.data?.error || "Failed to add notes", { id: loadingToast });
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const getUniqueIndustries = () => {
    return industries; // Return the fetched industries
  };

  // Click outside listener for the overflow menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setIsMoreMenuOpen(false);
      }
      if (
        rowActionsRef.current &&
        !rowActionsRef.current.contains(event.target)
      ) {
        setOpenRowActionsId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Separate effect for advanced filters
  useEffect(() => {
    if (pagination.currentPage === 1) {
      fetchCompanies();
    } else {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
  }, [activeFilters]);

  // Get field value from company
  const getFieldValue = (company, columnKey) => {
    // Check if it's a base field
    if (company[columnKey] !== undefined) {
      return company[columnKey];
    }

    // Check additional fields
    const additionalField = company.additionalFields?.find(
      (field) => field.key === columnKey,
    );
    return additionalField?.value || "—";
  };


  // Pagination component
  const PaginationControls = () => {
    const {
      currentPage,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPrevPage,
    } = pagination;

    if (totalCount === 0) return null;

    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalCount);

    const getPageNumbers = () => {
      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push("...", totalPages);
      } else {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots.filter(
        (item, index, arr) => index === 0 || arr[index - 1] !== item,
      );
    };

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevPage}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-700 font-inter">
              Showing <span className="font-semibold">{startItem}</span> to{" "}
              <span className="font-semibold">{endItem}</span> of{" "}
              <span className="font-semibold">{totalCount}</span> results
            </p>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!hasPrevPage}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {totalPages > 0 &&
              getPageNumbers().map((pageNum, index) =>
                pageNum === "..." ? (
                  <span
                    key={`dots-${index}`}
                    className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-500"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(pageNum)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${pageNum === currentPage
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {pageNum}
                  </button>
                ),
              )}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };



  const resetForm = () => {
    setForm({
      name: "",
      industry: "",
      address: "",
      website: "",
      gstin: "",
      documentSigned: false,
      leadSource: "",
      profilePicture: null,
      profilePictureUrl: "",
    });
    setAdditionalFields({});
  };

  const toggleForm = () => {
    if (showForm) {
      resetForm();
    }
    setShowForm(!showForm);
  };

  const handleEdit = (company) => {
    console.log("Editing company:", company); // Debug log
    console.log("Social media:", company.socialMedia); // Debug log

    setForm({
      _id: company._id,
      name: company.name,
      industry: company.industry,
      gstin: company.gstin || "",
      address: company.address || "",
      website: company.website || "",
      documentSigned: company.documentSigned || false,
      leadSource: company.leadSource || "",
      profilePicture: null,
      profilePictureUrl: company.profilePicture || "",
      socialMedia: {
        twitter: company.socialMedia?.twitter || "",
        linkedin: company.socialMedia?.linkedin || "",
        facebook: company.socialMedia?.facebook || "",
      },
    });

    const processedFields = {};
    if (company.additionalFields) {
      company.additionalFields.forEach((field) => {
        processedFields[field.key] = field.value;
      });
    }
    setAdditionalFields(processedFields);
    setShowForm(true);
  };

  return (
    <div className="-mt-6 -mx-4 sm:-mx-6 lg:-mx-8 pt-4">
      <AppToaster />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("companies")?.videoId}
        title={getVideoTutorial("companies")?.title}
      />

      {/* Import Clients Modal */}
      <ImportClients
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        companyFieldNames={companyFieldNames}
        onImportSuccess={() => {
          fetchCompanies();
          toast.success("Companies imported successfully");
        }}
      />

      {/* Column Settings Panel */}
      <ColumnSettingsPanel
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columns={columns}
        onSave={saveColumns}
        moduleName="Companies"
      />

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Are you sure you want to delete this company? This action
                cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <CompanyForm
          form={form}
          setForm={setForm}
          loading={loading}
          setLoading={setLoading}
          companyFieldNames={companyFieldNames}
          additionalFields={additionalFields}
          setAdditionalFields={setAdditionalFields}
          fetchCompanies={fetchCompanies}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
          }}
        />
      )}

      {state?.showAddForm && (
        <CompanyForm
          form={form}
          setForm={setForm}
          loading={loading}
          setLoading={setLoading}
          companyFieldNames={companyFieldNames}
          additionalFields={additionalFields}
          setAdditionalFields={setAdditionalFields}
          fetchCompanies={fetchCompanies}
          onRequestClose={() => {
            resetForm();
            setShowForm(false);
            if (state) state.showAddForm = false;
          }}
        />
      )}

      {/* Selection Mode Banner */}
      {selectionMode && selectedCompanies.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
          {" "}
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-semibold font-inter">
              {selectedCompanies.length} company
              {selectedCompanies.length !== 1 ? "ies" : ""} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {" "}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowBulkNoteModal(true)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <StickyNote className="w-4 h-4 text-emerald-600" />
              Add Note
            </button>
            <button
              onClick={() => setShowAddToHotlistModal(true)}
              className="px-4 py-2 bg-white border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Add to Hotlist
            </button>
            <button
              onClick={() => setShowBulkActions(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Bulk Update
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              disabled={bulkLoading}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={exitSelectionMode}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white overflow-visible border-b border-gray-100">
        {/* Toolbar (Title + Search + Buttons) */}
        <div className="h-14 px-4 border-b border-[#E1E4EA] flex items-center">
          <div className="flex items-center gap-4 w-full">
            <div className="flex-shrink-0 flex flex-col justify-center gap-1.5">
              <h1 className="m-0 leading-tight font-bold text-lg text-gray-900">Companies</h1>
              <p className="m-0 leading-tight text-xs text-gray-500 font-inter">
                Manage your organisation contracts
              </p>
            </div>

            <div className="relative flex-1 flex items-center justify-end">
              <div className="relative w-[416px] max-w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 border border-[#E1E4EA] rounded-full text-sm focus:outline-none focus:border-[#0085FF] transition-colors font-inter bg-white"
                  placeholder="Search companies by name, industry, or location..."
                />
              </div>
            </div>

            {/* Overflow menu: Industry filter, Columns, Import, Video Tutorial */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
                {filterIndustry && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />
                )}
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-3 pb-2 mb-2 border-b border-gray-50">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 px-1">
                      Filter by Industry
                    </p>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto px-1 custom-scrollbar mb-2">
                    <button
                      onClick={() => {
                        setFilterIndustry("");
                        setPagination((p) => ({ ...p, currentPage: 1 }));
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${!filterIndustry ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      All Industries
                      {!filterIndustry && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      )}
                    </button>
                    {getUniqueIndustries().map((i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setFilterIndustry(i);
                          setPagination((p) => ({ ...p, currentPage: 1 }));
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between mt-0.5 ${filterIndustry === i ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                      >
                        {i}
                        {filterIndustry === i && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-50 pt-1">
                    <button
                      onClick={() => {
                        setShowColumnSettings(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      Columns
                    </button>
                    <button
                      onClick={() => {
                        setShowImport(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Upload className="w-4 h-4 text-gray-400" />
                      Import
                    </button>
                    <button
                      onClick={() => {
                        setShowVideoTutorial(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-4 h-4 text-gray-400" />
                      Video Tutorial
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Filters */}
            <button
              onClick={() => setShowAdvancedFilters(true)}
              className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#E1E4EA] text-gray-500 hover:bg-gray-50 transition-colors"
              title="Filters"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.16667 5.83464C4.16667 5.14428 4.72631 4.58464 5.41667 4.58464C6.10702 4.58464 6.66667 5.14428 6.66667 5.83464C6.66667 6.52499 6.10702 7.08464 5.41667 7.08464C4.72631 7.08464 4.16667 6.52499 4.16667 5.83464ZM5.41667 2.91797C3.80583 2.91797 2.5 4.2238 2.5 5.83464C2.5 7.44547 3.80583 8.7513 5.41667 8.7513C7.0275 8.7513 8.33333 7.44547 8.33333 5.83464C8.33333 4.2238 7.0275 2.91797 5.41667 2.91797ZM10 6.66797H16.6667V5.0013H10V6.66797ZM13.3333 14.168C13.3333 13.4776 13.893 12.918 14.5833 12.918C15.2737 12.918 15.8333 13.4776 15.8333 14.168C15.8333 14.8583 15.2737 15.418 14.5833 15.418C13.893 15.418 13.3333 14.8583 13.3333 14.168ZM14.5833 11.2513C12.9725 11.2513 11.6667 12.5571 11.6667 14.168C11.6667 15.7788 12.9725 17.0846 14.5833 17.0846C16.1942 17.0846 17.5 15.7788 17.5 14.168C17.5 12.5571 16.1942 11.2513 14.5833 11.2513ZM3.33333 13.3346V15.0013H10V13.3346H3.33333Z" fill="#1F2937" />
              </svg>
              {activeFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#0085FF] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {activeFilters.length}
                </span>
              )}
            </button>

            {/* Hotlist */}
            <button
              onClick={() => setShowHotlist(!showHotlist)}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition-colors ${showHotlist
                ? "bg-blue-50 ring-4 ring-inset ring-blue-100 text-blue-700"
                : "bg-white ring-4 ring-inset ring-gray-100 text-gray-800 hover:bg-gray-50"
                }`}
            >
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.33333 11.6667H5V3.33333H3.33333V11.6667ZM10 10H11.6667V3.33333H10V10ZM6.66667 7.5H8.33333V3.33333H6.66667V7.5ZM1.66667 15C1.20833 15 0.815972 14.8368 0.489583 14.5104C0.163194 14.184 0 13.7917 0 13.3333V1.66667C0 1.20833 0.163194 0.815972 0.489583 0.489583C0.815972 0.163194 1.20833 0 1.66667 0H13.3333C13.7917 0 14.184 0.163194 14.5104 0.489583C14.8368 0.815972 15 1.20833 15 1.66667V13.3333C15 13.7917 14.8368 14.184 14.5104 14.5104C14.184 14.8368 13.7917 15 13.3333 15H1.66667ZM1.66667 13.3333H13.3333V1.66667H1.66667V13.3333Z" fill="#1F2937" />
              </svg>
              <span className="font-medium">Hotlist</span>
            </button>

            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-[#0085FF] text-white text-sm font-medium rounded-full hover:bg-blue-600 focus:outline-none cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showForm ? "Cancel" : "New Company"}
            </button>
          </div>
        </div>

        {showHotlist ? (
          <Hotlist />
        ) : (
          <div
            className={`relative bg-white overflow-hidden border border-[#E1E4EA] rounded-lg mx-4 mt-6 ${loading ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="overflow-x-auto overflow-y-visible">
              <table
                className="w-full border-collapse text-left"
                style={{
                  minWidth: `${table.getTotalSize()}px`,
                  tableLayout: "fixed",
                }}
              >
                <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const colId = header.column.id;
                        const isSticky = colId === "selection" || colId === pinnedColumn;
                        const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "selection";

                        // Calculate left offset
                        let leftOffset = "auto";
                        if (colId === "selection") leftOffset = 0;
                        if (colId === pinnedColumn) leftOffset = selectionMode ? 60 : 0;

                        return (
                          <th
                            key={header.id}
                            style={{
                              width: header.getSize(),
                              position: isSticky ? "sticky" : "relative",
                              left: leftOffset,
                              zIndex: isSticky ? 20 : 1,
                            }}
                            className={`px-4 py-3 text-sm font-medium text-[#525866] border-r border-[#E1E4EA] hover:bg-gray-100 transition-colors bg-[#F5F7FA] ${isRightMostSticky
                              ? "border-r-2 border-r-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                              : "last:border-r-0"
                              }`}
                          >
                            <div className="truncate w-full">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </div>

                            {header.column.getCanResize() && (
                              <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none z-50 bg-transparent"
                              />
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>

                <tbody className="divide-y divide-[#E1E4EA] bg-white">
                  {loading && companies.length === 0 ? (
                    <tr>
                      <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center">
                        <p>Loading Companies...</p>
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center text-gray-500 font-inter">
                        <p className="font-medium">No companies found</p>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`bg-white hover:bg-blue-50 transition-colors ${selectedCompanies.includes(row.original._id) ? "!bg-blue-50" : ""}`}
                        onMouseDown={() => handleMouseDown(row.original._id)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={() => handleTouchStart(row.original._id)}
                        onTouchEnd={handleTouchEnd}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const colId = cell.column.id;
                          const isSticky = colId === "selection" || colId === pinnedColumn;
                          const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "selection";

                          // Calculate left offset
                          let leftOffset = "auto";
                          if (colId === "selection") leftOffset = 0;
                          if (colId === pinnedColumn) leftOffset = selectionMode ? 60 : 0;

                          return (
                            <td
                              key={cell.id}
                              style={{
                                width: cell.column.getSize(),
                                position: isSticky ? "sticky" : "static",
                                left: leftOffset,
                                zIndex: isSticky ? 10 : 1,
                              }}
                              className={`px-4 py-2 align-middle text-sm text-[#1C1B1F] bg-inherit ${isRightMostSticky
                                ? "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                                : ""
                                }`}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !showHotlist && (
          <div className="mx-4 pb-6">
            <PaginationControls />
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sf">
                Confirm Bulk Delete
              </h3>
              <p className="text-sm text-gray-500 font-inter mb-6">
                Are you sure you want to delete{" "}
                <strong>{selectedCompanies.length}</strong> companies? This
                action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleBulkDeleteCompanies(selectedCompanies);
                    setShowBulkDeleteModal(false);
                  }}
                  disabled={bulkLoading}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center min-w-[120px]"
                >
                  {bulkLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete All"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={companies.filter((c) =>
          selectedCompanies.includes(c._id),
        )}
        onBulkUpdate={handleBulkUpdateCompanies}
        fieldConfig={companyFieldConfig}
        module="companies"
      />

      <AdvancedFilterPanel
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        columns={defaultColumns}
        filters={activeFilters}
        setFilters={setActiveFilters}
        onApply={(newFilters) => setActiveFilters(newFilters)}
        title="Filter Companies"
        subtitle="Find specific accounts quickly"
        emptyStateText="Add a rule to narrow down your company list."
      />

      <AddToCompanyHotlistModal
        isOpen={showAddToHotlistModal}
        onClose={() => setShowAddToHotlistModal(false)}
        selectedCompanyIds={selectedCompanies}
        onComplete={() => {
          setSelectionMode(true);
          setSelectedCompanies([]);
        }}
      />

      <AddToCompanyHotlistModal
        isOpen={!!quickHotlistCompanyId}
        onClose={() => setQuickHotlistCompanyId(null)}
        selectedCompanyIds={quickHotlistCompanyId ? [quickHotlistCompanyId] : []}
        onComplete={() => setQuickHotlistCompanyId(null)}
      />
      {/* Export Selected Companies Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        columns={defaultColumns}
        selectedIds={selectedCompanies} //  Pass the Array of IDs
        exportUrl="/companies/export-selected" // The backend route
        fileName="Exported_Companies.csv"
      />

      {/* Bulk Note Modal */}
      <NoteEditor
        isOpen={showBulkNoteModal}
        onClose={() => setShowBulkNoteModal(false)}
        noteTitle={noteTitle}
        setNoteTitle={setNoteTitle}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        taggedContacts={taggedContacts}
        setTaggedContacts={setTaggedContacts}
        contacts={allContacts} // Pass all contacts for tagging
        onSave={handleBulkNoteSave}
        loading={bulkLoading}
        isEditing={false}
      />

      {quickViewCompanyId && (
        <CompanyQuickView
          companyId={quickViewCompanyId}
          onClose={() => setQuickViewCompanyId(null)}
          onEdit={(company) => {
            handleEdit(company);
            setQuickViewCompanyId(null); // optional: close quick view after opening edit
          }}
        />
      )}
    </div>
  );
}

export default Companies;