import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  ArrowUp,
  ArrowDown,
  Pin,
  PinOff,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const InvoiceNumberIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="24 18 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M29.4724 34.2819L30.3057 30.9486H27.1328L27.4453 29.6986H30.6182L31.4676 26.3011H28.2947L28.6072 25.0511H31.7801L32.6134 21.7178H33.8474L33.0141 25.0511H36.4597L37.293 21.7178H38.527L37.6936 25.0511H40.8666L40.5541 26.3011H37.3811L36.5318 29.6986H39.7047L39.3922 30.9486H36.2193L35.3859 34.2819H34.152L34.9853 30.9486H31.5397L30.7064 34.2819H29.4724ZM31.8522 29.6986H35.2978L36.1472 26.3011H32.7016L31.8522 29.6986Z" fill="#525252" />
  </svg>
);

const DealColumnIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="244 18 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M247.589 35.0833C247.168 35.0833 246.812 34.9375 246.521 34.6458C246.229 34.3542 246.083 33.9978 246.083 33.5769V24.9231C246.083 24.5022 246.229 24.1458 246.521 23.8542C246.812 23.5625 247.168 23.4167 247.589 23.4167H251.083V22.0065C251.083 21.5855 251.229 21.2292 251.521 20.9375C251.812 20.6458 252.168 20.5 252.589 20.5H255.41C255.831 20.5 256.187 20.6458 256.479 20.9375C256.771 21.2292 256.916 21.5855 256.916 22.0065V23.4167H260.41C260.831 23.4167 261.187 23.5625 261.479 23.8542C261.771 24.1458 261.916 24.5022 261.916 24.9231V33.5769C261.916 33.9978 261.771 34.3542 261.479 34.6458C261.187 34.9375 260.831 35.0833 260.41 35.0833H247.589ZM247.589 33.8333H260.41C260.474 33.8333 260.533 33.8066 260.586 33.7531C260.64 33.6998 260.666 33.641 260.666 33.5769V24.9231C260.666 24.859 260.64 24.8002 260.586 24.7469C260.533 24.6934 260.474 24.6667 260.41 24.6667H247.589C247.525 24.6667 247.467 24.6934 247.413 24.7469C247.36 24.8002 247.333 24.859 247.333 24.9231V33.5769C247.333 33.641 247.36 33.6998 247.413 33.7531C247.467 33.8066 247.525 33.8333 247.589 33.8333ZM252.333 23.4167H255.666V22.0065C255.666 21.9423 255.64 21.8835 255.586 21.8302C255.533 21.7767 255.474 21.75 255.41 21.75H252.589C252.525 21.75 252.467 21.7767 252.413 21.8302C252.36 21.8835 252.333 21.9423 252.333 22.0065V23.4167Z" fill="#525252" />
  </svg>
);

const IssueDateIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="473 18 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M477.423 35.9167C477.002 35.9167 476.646 35.7708 476.354 35.4792C476.063 35.1875 475.917 34.8312 475.917 34.4102V23.2565C475.917 22.8355 476.063 22.4792 476.354 22.1875C476.646 21.8958 477.002 21.75 477.423 21.75H478.577V19.9873H479.859V21.75H486.173V19.9873H487.423V21.75H488.577C488.998 21.75 489.354 21.8958 489.646 22.1875C489.938 22.4792 490.084 22.8355 490.084 23.2565V28.6571L488.834 29.9071V26.5898H477.167V34.4102C477.167 34.4744 477.194 34.5331 477.247 34.5865C477.301 34.6399 477.359 34.6667 477.423 34.6667H482.486L483.744 35.9167H477.423ZM477.167 25.3398H488.834V23.2565C488.834 23.1923 488.807 23.1336 488.753 23.0802C488.7 23.0267 488.641 23 488.577 23H477.423C477.359 23 477.301 23.0267 477.247 23.0802C477.194 23.1336 477.167 23.1923 477.167 23.2565V25.3398ZM486.76 36.3333L484.138 33.7196L485.016 32.8415L486.747 34.5721L490.209 31.1106L491.087 32.0017L486.76 36.3333Z" fill="#525252" />
  </svg>
);

const DueDateIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="706 18 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M710.167 25.3398H721.834V23.2565C721.834 23.1923 721.807 23.1336 721.753 23.0802C721.7 23.0267 721.641 23 721.577 23H710.423C710.359 23 710.301 23.0267 710.247 23.0802C710.194 23.1336 710.167 23.1923 710.167 23.2565V25.3398ZM710.423 35.9167C710.002 35.9167 709.646 35.7708 709.354 35.4792C709.063 35.1875 708.917 34.8312 708.917 34.4102V23.2565C708.917 22.8355 709.063 22.4792 709.354 22.1875C709.646 21.8958 710.002 21.75 710.423 21.75H711.577V19.9873H712.859V21.75H719.173V19.9873H720.423V21.75H721.577C721.998 21.75 722.354 21.8958 722.646 22.1875C722.938 22.4792 723.084 22.8355 723.084 23.2565V27.8094C722.884 27.7217 722.68 27.6509 722.471 27.5969C722.263 27.543 722.05 27.5006 721.834 27.4696V26.5898H710.167V34.4102C710.167 34.4744 710.194 34.5331 710.247 34.5865C710.301 34.6399 710.359 34.6667 710.423 34.6667H715.842C715.912 34.8974 715.997 35.1156 716.097 35.3213C716.197 35.527 716.311 35.7254 716.438 35.9167H710.423ZM718.505 35.6554C717.775 34.9257 717.411 34.0406 717.411 33C717.411 31.9595 717.775 31.0743 718.505 30.3446C719.235 29.6149 720.12 29.25 721.161 29.25C722.201 29.25 723.086 29.6149 723.816 30.3446C724.546 31.0743 724.911 31.9595 724.911 33C724.911 34.0406 724.546 34.9257 723.816 35.6554C723.086 36.3852 722.201 36.75 721.161 36.75C720.12 36.75 719.235 36.3852 718.505 35.6554ZM722.548 34.9071L723.068 34.3879L721.529 32.8494V30.5481H720.792V33.1506L722.548 34.9071Z" fill="#525252" />
  </svg>
);

const StatusColumnIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="937 18 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M943.913 35.2935C942.95 34.8779 942.112 34.314 941.399 33.6016C940.687 32.8893 940.122 32.0516 939.707 31.0885C939.291 30.1254 939.083 29.0965 939.083 28.0016C939.083 26.9066 939.291 25.8774 939.706 24.9139C940.122 23.9504 940.686 23.1124 941.398 22.3997C942.111 21.6871 942.948 21.1229 943.911 20.707C944.874 20.2913 945.903 20.0835 946.998 20.0835C948.093 20.0835 949.122 20.2913 950.086 20.7068C951.049 21.1224 951.887 21.6863 952.6 22.3987C953.313 23.1111 953.877 23.9488 954.293 24.9118C954.708 25.8749 954.916 26.9038 954.916 27.9987C954.916 29.0937 954.709 30.1229 954.293 31.0864C953.877 32.0499 953.313 32.8879 952.601 33.6006C951.889 34.3132 951.051 34.8775 950.088 35.2933C949.125 35.709 948.096 35.9168 947.001 35.9168C945.906 35.9168 944.877 35.7091 943.913 35.2935ZM942.277 32.7214L947 28.0002V21.3335C945.139 21.3335 943.562 21.9793 942.271 23.271C940.979 24.5627 940.333 26.1391 940.333 28.0002C940.333 28.8891 940.501 29.7419 940.837 30.5587C941.173 31.3755 941.653 32.0964 942.277 32.7214Z" fill="#525252" />
  </svg>
);

const AmountColumnIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="1120 18 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1131.37 35.0832L1126.04 29.5384V28.16H1128.75C1129.54 28.16 1130.24 27.9071 1130.85 27.4013C1131.46 26.8955 1131.8 26.2189 1131.87 25.3717H1125.21V24.1217H1131.7C1131.49 23.55 1131.12 23.0813 1130.59 22.7155C1130.06 22.3495 1129.45 22.1665 1128.75 22.1665H1125.21V20.9165H1134.79V22.1665H1131.79C1132.09 22.4026 1132.35 22.6903 1132.57 23.0294C1132.79 23.3687 1132.94 23.7328 1133.02 24.1217H1134.79V25.3717H1133.13C1133.07 26.5523 1132.62 27.5205 1131.77 28.2763C1130.92 29.0321 1129.91 29.41 1128.75 29.41H1127.66L1133.1 35.0832H1131.37Z" fill="#525252" />
  </svg>
);

const TotalInvoicedIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 17 19" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0 18.769V0L1.38475 1.23075L2.80775 0L4.23075 1.23075L5.65375 0L7.077 1.23075L8.5 0L9.923 1.23075L11.3462 0L12.7693 1.23075L14.1923 0L15.6152 1.23075L17 0V18.769L15.6152 17.5383L14.1923 18.769L12.7693 17.5383L11.3462 18.769L9.923 17.5383L8.5 18.769L7.077 17.5383L5.65375 18.769L4.23075 17.5383L2.80775 18.769L1.38475 17.5383L0 18.769ZM2.75 13.8268H14.25V12.3268H2.75V13.8268ZM2.75 10.1345H14.25V8.6345H2.75V10.1345ZM2.75 6.44225H14.25V4.94225H2.75V6.44225ZM1.5 16.4845H15.5V2.2845H1.5V16.4845Z" fill="#0085FF" />
  </svg>
);

const AmountCollectedIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 21 23" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2.98075 15.4423V7.94225H4.48075V15.4423H2.98075ZM8.48075 15.4423V7.94225H9.98075V15.4423H8.48075ZM0 5.94225V4.51925L9.23075 0L18.4615 4.51925V5.94225H0ZM3.5615 4.44225H14.9L9.23075 1.69225L3.5615 4.44225ZM0 18.9423V17.4423H11.5787C11.5992 17.7089 11.6282 17.9631 11.6655 18.2048C11.7027 18.4464 11.7552 18.6923 11.823 18.9423H0ZM13.9808 12.202V7.94225H15.4808V11.452L13.9808 12.202ZM17.2307 22.0575C16.1641 21.7935 15.282 21.1823 14.5845 20.224C13.8872 19.2657 13.5385 18.2013 13.5385 17.0308V14.673L17.2307 12.827L20.923 14.673V17.0308C20.923 18.2013 20.5743 19.2657 19.877 20.224C19.1795 21.1823 18.2974 21.7935 17.2307 22.0575ZM16.5058 19.2307L19.7595 15.9923L18.9212 15.1538L16.5058 17.5385L15.5307 16.5635L14.6923 17.4172L16.5058 19.2307Z" fill="#0085FF" />
  </svg>
);

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

const OutstandingAmountIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 17 19" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9.073 15.0153C9.2295 14.8589 9.30775 14.6679 9.30775 14.4423C9.30775 14.2166 9.2295 14.0256 9.073 13.8693C8.91667 13.7129 8.72567 13.6348 8.5 13.6348C8.27433 13.6348 8.08333 13.7129 7.927 13.8693C7.7705 14.0256 7.69225 14.2166 7.69225 14.4423C7.69225 14.6679 7.7705 14.8589 7.927 15.0153C8.08333 15.1718 8.27433 15.25 8.5 15.25C8.72567 15.25 8.91667 15.1718 9.073 15.0153ZM7.75 11.7692H9.25V5.73075H7.75V11.7692ZM1.80775 19C1.30908 19 0.883083 18.8234 0.52975 18.4703C0.176583 18.1169 0 17.6909 0 17.1923V3.80775C0 3.30908 0.176583 2.88308 0.52975 2.52975C0.883083 2.17658 1.30908 2 1.80775 2H6.25775C6.32058 1.44483 6.56292 0.972749 6.98475 0.583749C7.40642 0.194583 7.9115 0 8.5 0C9.09483 0 9.60317 0.194583 10.025 0.583749C10.4468 0.972749 10.6859 1.44483 10.7423 2H15.1923C15.6909 2 16.1169 2.17658 16.4703 2.52975C16.8234 2.88308 17 3.30908 17 3.80775V17.1923C17 17.6909 16.8234 18.1169 16.4703 18.4703C16.1169 18.8234 15.6909 19 15.1923 19H1.80775ZM1.80775 17.5H15.1923C15.2692 17.5 15.3398 17.4679 15.4038 17.4038C15.4679 17.3398 15.5 17.2693 15.5 17.1923V3.80775C15.5 3.73075 15.4679 3.66025 15.4038 3.59625C15.3398 3.53208 15.2692 3.5 15.1923 3.5H1.80775C1.73075 3.5 1.66025 3.53208 1.59625 3.59625C1.53208 3.66025 1.5 3.73075 1.5 3.80775V17.1923C1.5 17.2693 1.53208 17.3398 1.59625 17.4038C1.66025 17.4679 1.73075 17.5 1.80775 17.5ZM9.0375 2.63375C9.17917 2.49208 9.25 2.31292 9.25 2.09625C9.25 1.87958 9.17917 1.70042 9.0375 1.55875C8.89583 1.41708 8.71667 1.34625 8.5 1.34625C8.28333 1.34625 8.10417 1.41708 7.9625 1.55875C7.82083 1.70042 7.75 1.87958 7.75 2.09625C7.75 2.31292 7.82083 2.49208 7.9625 2.63375C8.10417 2.77542 8.28333 2.84625 8.5 2.84625C8.71667 2.84625 8.89583 2.77542 9.0375 2.63375Z" fill="#0085FF" />
  </svg>
);

const OverdueInvoicesIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 22 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4.09625 16.0578V14.5577H5.62875L7.55575 8.09825C7.66992 7.70325 7.8885 7.38942 8.2115 7.15675C8.53467 6.92408 8.89367 6.80775 9.2885 6.80775H12.2115C12.6063 6.80775 12.9653 6.92408 13.2885 7.15675C13.6115 7.38942 13.8301 7.70325 13.9443 8.09825L15.8712 14.5577H17.4038V16.0578H4.09625ZM7.2095 14.5577H14.2905L12.5 8.529C12.4808 8.45833 12.444 8.40383 12.3895 8.3655C12.335 8.327 12.2725 8.30775 12.202 8.30775H9.298C9.2275 8.30775 9.165 8.327 9.1105 8.3655C9.056 8.40383 9.01917 8.45833 9 8.529L7.2095 14.5577ZM10 4.5V0H11.5V4.5H10ZM15.7 6.86925L14.6307 5.8L17.825 2.63075L18.8693 3.675L15.7 6.86925ZM17 11.5V10H21.5V11.5H17ZM5.8 6.86925L2.63075 3.675L3.675 2.63075L6.86925 5.8L5.8 6.86925ZM0 11.5V10H4.5V11.5H0Z" fill="#CD3636" />
  </svg>
);

export default function CompanyInvoicesTab({ invoices, summary, loading, showStats = true }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pinnedColumn, setPinnedColumn] = useState(null);
  const [colWidths, setColWidths] = useState({
    invoiceNumber: 220,
    deal: 241,
    issueDate: 233,
    dueDate: 231,
    status: 183,
    amount: 218,
  });
  const [resizingCol, setResizingCol] = useState(null);
  const resizingRef = React.useRef(null);
  const totalTableWidth = useMemo(
    () => Object.values(colWidths).reduce((sum, w) => sum + w, 0),
    [colWidths],
  );

  const togglePinColumn = (colId) => {
    setPinnedColumn((prev) => (prev === colId ? null : colId));
  };

  const startResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startWidth: colWidths[colId] };
    setResizingCol(colId);

    const onMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const { colId: id, startX, startWidth } = resizingRef.current;
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => ({ ...prev, [id]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      setResizingCol(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;
    const q = searchTerm.toLowerCase();
    return invoices.filter(
      (inv) =>
        (inv.invoiceNumber || "").toLowerCase().includes(q) ||
        (inv.status || "").toLowerCase().includes(q) ||
        (inv.deal?.title || "").toLowerCase().includes(q),
    );
  }, [invoices, searchTerm]);

  const totalInvoiced = summary?.totalAmount || 0;
  const totalCount = summary?.totalInvoices || invoices.length;
  const outstanding = summary?.amountDue || 0;
  const collected = summary?.amountPaid || 0;
  const overdueAmount = summary?.overdueAmount || 0;

  const pendingCount = invoices.filter((inv) => inv.status !== "Paid").length;
  const overdueCount = invoices.filter(
    (inv) =>
      inv.status !== "Paid" && inv.dueDate && new Date(inv.dueDate) < new Date(),
  ).length;
  const collectionRate =
    totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : 0;

  const totalCountFiltered = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCountFiltered / limit));
  const startItem = totalCountFiltered === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCountFiltered);
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (currentPage - delta > 2) rangeWithDots.push(1, "...");
    else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1) rangeWithDots.push("...", totalPages);
    else if (totalPages > 1) rangeWithDots.push(totalPages);
    return rangeWithDots.filter((item, index, arr) => index === 0 || arr[index - 1] !== item);
  };

  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * limit, currentPage * limit),
    [filteredInvoices, currentPage, limit],
  );

  const statusPillStyle = (status) => {
    if (status === "Paid") return { backgroundColor: "rgba(0, 201, 80, 0.1)", color: "#00A63E" };
    if (status === "Overdue") return { backgroundColor: "rgba(232, 34, 34, 0.1)", color: "#E82222" };
    return { backgroundColor: "rgba(0, 133, 255, 0.1)", color: "#0085FF" };
  };

  const kpiTiles = [
    {
      label: "Total Invoiced",
      value: `₹${totalInvoiced.toLocaleString("en-IN")}`,
      icon: TotalInvoicedIcon,
      subtitle: `Over ${totalCount} invoices`,
      subtitleClass: "text-gray-400",
    },
    {
      label: "Outstanding Amount",
      value: `₹${outstanding.toLocaleString("en-IN")}`,
      icon: OutstandingAmountIcon,
      subtitle: `${pendingCount} invoices pending`,
      subtitleClass: "text-red-500",
    },
    {
      label: "Amount Collected",
      value: `₹${collected.toLocaleString("en-IN")}`,
      icon: AmountCollectedIcon,
      subtitle: `${collectionRate}% Collection Rate`,
      subtitleClass: "text-green-600",
      subtitleIcon: ArrowUp,
    },
    {
      label: "Overdue Invoices",
      value: overdueCount,
      icon: OverdueInvoicesIcon,
      subtitle: `₹${overdueAmount.toLocaleString("en-IN")} Overdue`,
      subtitleClass: "text-red-500",
      subtitleIcon: ArrowDown,
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      {showStats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpiTiles.map((tile) => (
              <div
                key={tile.label}
                className="h-[72px] flex items-end gap-3 px-3 py-3 bg-white border border-gray-200 rounded-xl box-border"
              >
                <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <tile.icon size={20} />
                </div>
                <div className="min-w-0 flex-1 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
                    <p className="text-base font-semibold text-gray-900">
                      {tile.value}
                    </p>
                  </div>
                  {tile.subtitle && (
                    <span
                      className={`text-[11px] font-medium flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${tile.subtitleClass}`}
                    >
                      {tile.subtitleIcon && <tile.subtitleIcon size={10} />}
                      {tile.subtitle}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="-mx-6" style={{ marginTop: 24, paddingBottom: 24, borderTop: "1px solid #E1E4EA" }} />
        </>
      )}

      {/* Search + Controls */}
      <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
        <div className="relative flex-1 h-full">
          <Search
            size={20}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice by number, deal, or status..."
            className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
            style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
          />
        </div>
        <button
          className="flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
          style={{ height: "44px", borderColor: "#E1E4EA" }}
        >
          <SlidersIcon size={16} />
          Filter
        </button>
      </div>

      <div
        className="box-border flex flex-col items-start bg-white self-stretch overflow-x-auto"
        style={{ border: "1px solid #E1E4EA", borderRadius: "8px" }}
      >
        <table
          className="text-sm text-left border-collapse"
          style={{ tableLayout: "fixed", width: "100%", minWidth: totalTableWidth, maxWidth: "100%" }}
        >
          <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
            <tr>
              {[
                { id: "invoiceNumber", label: "Invoice Number", width: 220, icon: InvoiceNumberIcon, pinnable: true },
                { id: "deal", label: "Deal", width: 241, icon: DealColumnIcon, pinnable: true },
                { id: "issueDate", label: "Invoice Date", width: 233, icon: IssueDateIcon, pinnable: true },
                { id: "dueDate", label: "Due Date", width: 231, icon: DueDateIcon, pinnable: true },
                { id: "status", label: "Status", width: 183, icon: StatusColumnIcon, pinnable: true },
                { id: "amount", label: "Amount", width: 218, icon: AmountColumnIcon },
              ].map((col) => {
                const isPinned = pinnedColumn === col.id;
                return (
                  <th
                    key={col.id}
                    style={{ width: colWidths[col.id], height: 56, position: "relative" }}
                    className={`px-3 py-2.5 font-medium text-[#525866] text-xs ${col.id === "amount" ? "" : "border-r border-[#E1E4EA]"
                      }`}
                  >
                    {col.pinnable ? (
                      <div
                        className="relative flex items-center justify-start w-full group cursor-pointer select-none"
                        onDoubleClick={() => togglePinColumn(col.id)}
                      >
                        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                          <col.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{col.label}</span>
                        </div>
                        <button
                          onClick={() => togglePinColumn(col.id)}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"
                            }`}
                          title={isPinned ? "Unpin Column" : "Pin Column"}
                        >
                          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
                        {col.icon && <col.icon className="w-4 h-4 flex-shrink-0" />}
                        <span>{col.label}</span>
                      </div>
                    )}

                    <div
                      onMouseDown={(e) => startResize(e, col.id)}
                      className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-10 ${resizingCol === col.id ? "bg-blue-500" : "bg-transparent"
                        }`}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1E4EA] bg-white">
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                  No invoices found.
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((invoice) => {
                const issueDate = invoice.issueDate
                  ? new Date(invoice.issueDate).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                  : "—";
                const dueDate = invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                  : "—";
                return (
                  <tr key={invoice._id} className="hover:bg-gray-50 transition-colors group">
                    <td style={{ height: 54 }} className="px-3 text-left">
                      <Link
                        to={`/invoices?tab=tax`}
                        className="text-[14px] leading-5 font-medium text-[#222530] hover:text-blue-600 truncate block"
                      >
                        {invoice.invoiceNumber || invoice._id}
                      </Link>
                    </td>
                    <td
                      style={{ height: 54 }}
                      className="px-3 text-[14px] leading-5 font-medium text-[#525866] truncate text-left"
                    >
                      {invoice.deal?.title || "-"}
                    </td>
                    <td
                      style={{ height: 54 }}
                      className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left"
                    >
                      {issueDate}
                    </td>
                    <td
                      style={{ height: 54 }}
                      className="px-3 text-[14px] leading-5 font-medium text-[#525866] whitespace-nowrap text-left"
                    >
                      {dueDate}
                    </td>
                    <td style={{ height: 54 }} className="px-3">
                      <div className="flex items-center justify-start">
                        <span
                          style={{ padding: "5px 12px", borderRadius: 53, ...statusPillStyle(invoice.status) }}
                          className="inline-flex items-center justify-center text-xs font-medium whitespace-nowrap"
                        >
                          {invoice.status || "Pending"}
                        </span>
                      </div>
                    </td>
                    <td style={{ height: 54 }} className="px-3">
                      <div className="relative flex items-center justify-start">
                        <span className="text-[14px] leading-5 font-semibold text-[#222530] whitespace-nowrap">
                          ₹{(invoice.amount || 0).toLocaleString("en-IN")}
                        </span>
                        <button
                          className="absolute right-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalCountFiltered > 0 && (
        <div className="w-full bg-white px-4 py-3 flex items-center justify-between sm:px-6">
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
                <span className="font-semibold">{totalCountFiltered}</span> results
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
      )}
    </div>
  );
}
