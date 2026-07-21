import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import API from "../../services/api";
import folderIconImg from "../../assets/Folder-icon.png";
import pdfIconImg from "../../assets/pdf-icon.png";
import { useParams } from "react-router-dom";
import toast from 'react-hot-toast';
import {
  Folder as FolderIcon,
  File,
  ChevronRight,
  ChevronLeft,
  Upload,
  Trash2,
  Download,
  Search,
  Filter,
  X,
  Link as LinkIcon,
  ExternalLink,
  List,
  LayoutGrid,
  Maximize2,
  Save,
  UserCog,
  MoreVertical,
} from "lucide-react";
import AppToaster from "../AppToaster";

const AttachFileIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size * 1.6} viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M9.71146 10.9535C9.71146 12.3072 9.24055 13.4588 8.29875 14.4085C7.35708 15.3584 6.21208 15.8333 4.86375 15.8333C3.51014 15.8333 2.36111 15.3584 1.41667 14.4085C0.472222 13.4588 0 12.3072 0 10.9535V3.46146C0 2.49993 0.333889 1.68264 1.00167 1.00958C1.66931 0.336528 2.48389 0 3.44542 0C4.40694 0 5.2216 0.336528 5.88938 1.00958C6.55715 1.68264 6.89104 2.49993 6.89104 3.46146V10.5529C6.89104 11.1169 6.69417 11.5985 6.30042 11.9975C5.90681 12.3965 5.42792 12.596 4.86375 12.596C4.29972 12.596 3.81819 12.3979 3.41917 12.0017C3.02014 11.6053 2.82063 11.1224 2.82063 10.5529V3.23729H4.07042V10.5529C4.07042 10.7763 4.14549 10.9643 4.29563 11.1171C4.44576 11.2699 4.6325 11.3463 4.85583 11.3463C5.07903 11.3463 5.2657 11.2699 5.41583 11.1171C5.56597 10.9643 5.64104 10.7763 5.64104 10.5529V3.45354C5.63243 2.83813 5.41819 2.31701 4.99833 1.89021C4.57847 1.4634 4.06083 1.25 3.44542 1.25C2.83014 1.25 2.31042 1.46472 1.88625 1.89417C1.46208 2.32375 1.25 2.84618 1.25 3.46146V10.9535C1.24139 11.961 1.58965 12.8178 2.29479 13.524C2.99993 14.2302 3.85625 14.5833 4.86375 14.5833C5.85736 14.5833 6.70111 14.2302 7.395 13.524C8.08889 12.8178 8.44438 11.961 8.46146 10.9535V3.23729H9.71146V10.9535Z"
      fill="currentColor"
    />
  </svg>
);

const FileSizeIcon = ({ size = 18, ...props }) => (
  <svg width={size} height={size * (13 / 18)} viewBox="0 0 18 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M4.16667 12.5C3.015 12.5 2.03264 12.1005 1.21958 11.3015C0.406528 10.5024 0 9.5259 0 8.37187C0 7.3366 0.333056 6.42604 0.999167 5.64021C1.66528 4.85438 2.49139 4.38882 3.4775 4.24354C3.74458 2.99785 4.37097 1.97917 5.35667 1.1875C6.34222 0.395833 7.47333 0 8.75 0C10.2589 0 11.5389 0.525555 12.59 1.57667C13.6411 2.62778 14.1667 3.90778 14.1667 5.41667V5.83333H14.4231C15.3013 5.90167 16.0337 6.25479 16.6202 6.89271C17.2067 7.53049 17.5 8.28847 17.5 9.16667C17.5 10.0961 17.1795 10.884 16.5385 11.5304C15.8974 12.1768 15.1122 12.5 14.1827 12.5H9.63146C9.21049 12.5 8.85417 12.3542 8.5625 12.0625C8.27083 11.7708 8.125 11.4145 8.125 10.9935V6.42937L6.58333 7.94542L5.70521 7.07542L8.75 4.03042L11.7948 7.07542L10.9167 7.94542L9.375 6.42937V10.9935C9.375 11.0577 9.40174 11.1165 9.45521 11.1698C9.50854 11.2233 9.56729 11.25 9.63146 11.25H14.1667C14.75 11.25 15.2431 11.0486 15.6458 10.6458C16.0486 10.2431 16.25 9.75 16.25 9.16667C16.25 8.58333 16.0486 8.09028 15.6458 7.6875C15.2431 7.28472 14.75 7.08333 14.1667 7.08333H12.9167V5.41667C12.9167 4.26389 12.5104 3.28125 11.6979 2.46875C10.8854 1.65625 9.90278 1.25 8.75 1.25C7.59722 1.25 6.61458 1.65625 5.80208 2.46875C4.98958 3.28125 4.58333 4.26389 4.58333 5.41667H4.15063C3.36104 5.41667 2.68021 5.70139 2.10812 6.27083C1.53604 6.84028 1.25 7.52778 1.25 8.33333C1.25 9.13889 1.53472 9.82639 2.10417 10.3958C2.67361 10.9653 3.36111 11.25 4.16667 11.25H6.25V12.5H4.16667Z"
      fill="currentColor"
    />
  </svg>
);

const OpenFileIcon = ({ size = 19, ...props }) => (
  <svg width={size} height={size * (15 / 19)} viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M9.01555 0C13.509 0 17.2473 3.23313 18.031 7.5C17.2473 11.7668 13.509 15 9.01555 15C4.52207 15 0.783758 11.7668 0 7.5C0.783758 3.23313 4.52207 0 9.01555 0ZM9.01555 13.3333C12.5452 13.3333 15.5655 10.8767 16.33 7.5C15.5655 4.12336 12.5452 1.66667 9.01555 1.66667C5.4858 1.66667 2.46548 4.12336 1.70095 7.5C2.46548 10.8767 5.4858 13.3333 9.01555 13.3333ZM9.01555 11.25C6.94445 11.25 5.26552 9.57108 5.26552 7.5C5.26552 5.42893 6.94445 3.75 9.01555 3.75C11.0866 3.75 12.7655 5.42893 12.7655 7.5C12.7655 9.57108 11.0866 11.25 9.01555 11.25ZM9.01555 9.58333C10.1661 9.58333 11.0989 8.65058 11.0989 7.5C11.0989 6.34942 10.1661 5.41667 9.01555 5.41667C7.86497 5.41667 6.93218 6.34942 6.93218 7.5C6.93218 8.65058 7.86497 9.58333 9.01555 9.58333Z"
      fill="currentColor"
    />
  </svg>
);

const DeleteFileIcon = ({ size = 17, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M12.5 3.33333H16.6667V5H15V15.8333C15 16.2936 14.6269 16.6667 14.1667 16.6667H2.5C2.03977 16.6667 1.66667 16.2936 1.66667 15.8333V5H0V3.33333H4.16667V0.833333C4.16667 0.3731 4.53977 0 5 0H11.6667C12.1269 0 12.5 0.3731 12.5 0.833333V3.33333ZM13.3333 5H3.33333V15H13.3333V5ZM5.83333 7.5H7.5V12.5H5.83333V7.5ZM9.16667 7.5H10.8333V12.5H9.16667V7.5ZM5.83333 1.66667V3.33333H10.8333V1.66667H5.83333Z"
      fill="currentColor"
    />
  </svg>
);

const GridFolderIcon = ({ size = 100, ...props }) => (
  <img src={folderIconImg} alt="" width={size} height={size} style={{ objectFit: "contain" }} {...props} />
);

const UpdatedByIcon = ({ size = 15, ...props }) => (
  <svg width={size} height={size * (14 / 15)} viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M0 12.1796V10.3269C0 9.91882 0.110833 9.5409 0.3325 9.19312C0.554167 8.84535 0.850417 8.57799 1.22125 8.39104C2.04486 7.98729 2.87576 7.68444 3.71396 7.4825C4.55215 7.28056 5.3975 7.17958 6.25 7.17958C6.69444 7.17958 7.13597 7.20681 7.57458 7.26125C8.01306 7.31569 8.45292 7.39903 8.89417 7.51125L7.85104 8.56729C7.57729 8.52799 7.31042 8.49521 7.05042 8.46896C6.79042 8.44271 6.52361 8.42958 6.25 8.42958C5.49028 8.42958 4.73729 8.52062 3.99104 8.70271C3.24493 8.88493 2.51285 9.15285 1.79479 9.50646C1.62715 9.59729 1.49444 9.71451 1.39667 9.85812C1.29889 10.0019 1.25 10.1581 1.25 10.3269V10.9296H6.18583V12.1796H0ZM8.01292 13.1731V10.9712L12.5369 6.46792C12.6405 6.36431 12.7524 6.29139 12.8725 6.24917C12.9926 6.20708 13.1128 6.18604 13.2329 6.18604C13.3639 6.18604 13.4906 6.21056 13.6131 6.25958C13.7356 6.30875 13.8469 6.3825 13.9471 6.48083L14.7179 7.25958C14.8076 7.36333 14.8771 7.47556 14.9263 7.59625C14.9754 7.71694 15 7.83764 15 7.95833C15 8.07903 14.9776 8.20187 14.9327 8.32687C14.8878 8.45187 14.8163 8.56618 14.7179 8.66979L10.2148 13.1731H8.01292ZM9.00646 12.1796H9.79813L12.5031 9.46146L12.1202 9.06562L11.7323 8.67479L9.00646 11.3879V12.1796ZM12.1202 9.06562L11.7323 8.67479L12.5031 9.46146L12.1202 9.06562ZM4.18833 4.97833C3.61833 4.40847 3.33333 3.72125 3.33333 2.91667C3.33333 2.11222 3.61833 1.425 4.18833 0.854999C4.75833 0.284999 5.44556 0 6.25 0C7.05444 0 7.74167 0.284999 8.31167 0.854999C8.88167 1.425 9.16667 2.11222 9.16667 2.91667C9.16667 3.72125 8.88167 4.40847 8.31167 4.97833C7.74167 5.54833 7.05444 5.83333 6.25 5.83333C5.44556 5.83333 4.75833 5.54833 4.18833 4.97833ZM7.42708 4.09375C7.75347 3.76736 7.91667 3.375 7.91667 2.91667C7.91667 2.45833 7.75347 2.06597 7.42708 1.73958C7.10069 1.41319 6.70833 1.25 6.25 1.25C5.79167 1.25 5.39931 1.41319 5.07292 1.73958C4.74653 2.06597 4.58333 2.45833 4.58333 2.91667C4.58333 3.375 4.74653 3.76736 5.07292 4.09375C5.39931 4.42014 5.79167 4.58333 6.25 4.58333C6.70833 4.58333 7.10069 4.42014 7.42708 4.09375Z"
      fill="currentColor"
    />
  </svg>
);

const LastUpdateIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M1.50646 15.9294C1.08549 15.9294 0.729167 15.7835 0.4375 15.4919C0.145833 15.2002 0 14.8439 0 14.4229V3.26917C0 2.84819 0.145833 2.49187 0.4375 2.20021C0.729167 1.90854 1.08549 1.76271 1.50646 1.76271H2.66021V0H3.94229V1.76271H10.2565V0H11.5065V1.76271H12.6602C13.0812 1.76271 13.4375 1.90854 13.7292 2.20021C14.0208 2.49187 14.1667 2.84819 14.1667 3.26917V7.43583H12.9167V6.6025H1.25V14.4229C1.25 14.4871 1.27674 14.5458 1.33021 14.5992C1.38354 14.6526 1.44229 14.6794 1.50646 14.6794H7.01917V15.9294H1.50646ZM1.25 5.3525H12.9167V3.26917C12.9167 3.205 12.8899 3.14625 12.8365 3.09292C12.7831 3.03944 12.7244 3.01271 12.6602 3.01271H1.50646C1.44229 3.01271 1.38354 3.03944 1.33021 3.09292C1.27674 3.14625 1.25 3.205 1.25 3.26917V5.3525ZM8.84625 15.9294V13.7275L13.3702 9.22417C13.4738 9.12055 13.586 9.04764 13.7067 9.00542C13.8274 8.96333 13.9481 8.94229 14.069 8.94229C14.1981 8.94229 14.3244 8.9668 14.4479 9.01583C14.5712 9.065 14.6821 9.13875 14.7804 9.23708L15.5513 10.0158C15.641 10.1196 15.7104 10.2318 15.7596 10.3525C15.8088 10.4732 15.8333 10.5939 15.8333 10.7146C15.8333 10.8353 15.8109 10.9581 15.766 11.0831C15.7212 11.2081 15.6496 11.3224 15.5513 11.426L11.0481 15.9294H8.84625ZM9.83979 14.9358H10.6315L13.3365 12.2177L12.9535 11.8219L12.5656 11.431L9.83979 14.1442V14.9358ZM12.9535 11.8219L12.5656 11.431L13.3365 12.2177L12.9535 11.8219Z"
      fill="currentColor"
    />
  </svg>
);

const CreatedDateIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size * (17 / 16)} viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M11.4583 16.1377V13.6377H8.95833V12.3877H11.4583V9.88771H12.7083V12.3877H15.2083V13.6377H12.7083V16.1377H11.4583ZM1.50646 14.2627C1.08549 14.2627 0.729167 14.1169 0.4375 13.8252C0.145833 13.5335 0 13.1772 0 12.7563V3.26917C0 2.84819 0.145833 2.49187 0.4375 2.20021C0.729167 1.90854 1.08549 1.76271 1.50646 1.76271H2.66021V0H3.94229V1.76271H8.58979V0H9.83979V1.76271H10.9935C11.4145 1.76271 11.7708 1.90854 12.0625 2.20021C12.3542 2.49187 12.5 2.84819 12.5 3.26917V8.19229C12.2917 8.1666 12.0833 8.15375 11.875 8.15375C11.6667 8.15375 11.4583 8.1666 11.25 8.19229V6.6025H1.25V12.7563C1.25 12.8204 1.27674 12.8792 1.33021 12.9325C1.38354 12.986 1.44229 13.0127 1.50646 13.0127H7.20354C7.20354 13.221 7.21639 13.4294 7.24208 13.6377C7.26764 13.846 7.31458 14.0544 7.38292 14.2627H1.50646ZM1.25 5.3525H11.25V3.26917C11.25 3.205 11.2233 3.14625 11.1698 3.09292C11.1165 3.03944 11.0577 3.01271 10.9935 3.01271H1.50646C1.44229 3.01271 1.38354 3.03944 1.33021 3.09292C1.27674 3.14625 1.25 3.205 1.25 3.26917V5.3525Z"
      fill="currentColor"
    />
  </svg>
);

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

const DeleteWarningIcon = ({ size = 48, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="48" height="48" rx="10" fill="#FFEBEC" />
    <path d="M29 18H34V20H32V33C32 33.5523 31.5523 34 31 34H17C16.4477 34 16 33.5523 16 33V20H14V18H19V15C19 14.4477 19.4477 14 20 14H28C28.5523 14 29 14.4477 29 15V18ZM30 20H18V32H30V20ZM21 23H23V29H21V23ZM25 23H27V29H25V23ZM21 16V18H27V16H21Z" fill="#CD3636" />
  </svg>
);

const MiniFileIcon = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M27.5 16.667V27.4947C27.5 27.9587 27.1293 28.3337 26.6722 28.3337H13.3278C12.8708 28.3337 12.5 27.9637 12.5 27.5072V12.4935C12.5 12.0464 12.8739 11.667 13.3352 11.667H22.4973L27.5 16.667ZM25.8333 17.5003H21.6667V13.3337H14.1667V26.667H25.8333V17.5003ZM16.6667 15.8337H19.1667V17.5003H16.6667V15.8337ZM16.6667 19.167H23.3333V20.8337H16.6667V19.167ZM16.6667 22.5003H23.3333V24.167H16.6667V22.5003Z"
      fill="#5C5D5C"
    />
  </svg>
);

const CheckboxIcon = ({ size = 16, checked = false, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M4 0.75H12C13.7949 0.75 15.25 2.20507 15.25 4V12C15.25 13.7949 13.7949 15.25 12 15.25H4C2.20507 15.25 0.75 13.7949 0.75 12V4C0.75 2.20507 2.20507 0.75 4 0.75Z"
      fill={checked ? "#0085FF" : "white"}
      stroke={checked ? "#0085FF" : "#EBEBEB"}
      strokeWidth="1.5"
    />
    {checked && (
      <path d="M4.5 8.2L6.9 10.6L11.5 5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    )}
  </svg>
);

const MiniOpenFolderIcon = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12.4993 27.5C12.0391 27.5 11.666 27.1269 11.666 26.6667V13.3333C11.666 12.8731 12.0391 12.5 12.4993 12.5H18.6778L20.3445 14.1667H26.666C27.1263 14.1667 27.4993 14.5398 27.4993 15V17.5H25.8327V15.8333H19.6542L17.9875 14.1667H13.3327V24.165L14.5827 19.1667H28.7493L26.8238 26.8687C26.7311 27.2397 26.3978 27.5 26.0153 27.5H12.4993ZM26.6147 20.8333H15.884L14.634 25.8333H25.3647L26.6147 20.8333Z" fill="#0085FF" />
  </svg>
);

const ConfirmModal = ({ title, description, confirmLabel, extra, requireCheck, onCancel, onConfirm }) => {
  const [checked, setChecked] = useState(false);
  const disabled = requireCheck && !checked;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex flex-col items-start bg-white"
        style={{
          boxSizing: "border-box",
          width: 400,
          height: 366,
          border: "1px solid #EBEBEB",
          borderRadius: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex flex-col items-center self-stretch"
          style={{ boxSizing: "border-box", width: 400, height: 294, padding: 20, gap: 16 }}
        >
          <DeleteWarningIcon size={48} />
          <div
            className="flex flex-col items-center self-stretch"
            style={{ boxSizing: "border-box", width: 360, gap: 8 }}
          >
            <p
              style={{
                fontFamily: "Inter Tight",
                fontWeight: 500,
                fontSize: 18,
                lineHeight: "120%",
                color: "#171717",
              }}
            >
              {title}
            </p>
            <p
              className="text-center self-stretch"
              style={{
                fontFamily: "Inter Tight",
                fontWeight: 400,
                fontSize: 14,
                lineHeight: "140%",
                color: "#5C5C5C",
              }}
            >
              {description}
            </p>
          </div>
          {extra && <div style={{ width: 360 }}>{extra}</div>}
          {requireCheck && (
            <label
              className="flex items-center self-stretch cursor-pointer"
              style={{ width: 360, height: 20, gap: 8 }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="sr-only"
              />
              <CheckboxIcon size={16} checked={checked} style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "Inter Tight",
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: "140%",
                  color: "#5C5C5C",
                }}
              >
                I understand this action cannot be undone
              </span>
            </label>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-end flex-shrink-0"
          style={{
            boxSizing: "border-box",
            width: 400,
            height: 72,
            padding: "16px 20px",
            gap: 12,
            borderTop: "1px solid #EBEBEB",
          }}
        >
          <button
            onClick={onCancel}
            className="flex items-center justify-center hover:bg-gray-50 transition-colors whitespace-nowrap"
            style={{
              boxSizing: "border-box",
              padding: "10px 12px",
              gap: 6,
              minWidth: 67,
              height: 40,
              background: "#FFFFFF",
              border: "1px solid #EBEBEB",
              boxShadow: "0px 1px 2px rgba(10, 13, 20, 0.03)",
              borderRadius: 367,
              fontFamily: "Inter Tight",
              fontWeight: 500,
              fontSize: 14,
              lineHeight: "120%",
              color: "#171717",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className="flex items-center justify-center hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              boxSizing: "border-box",
              padding: "10px 12px",
              gap: 6,
              minWidth: 106,
              height: 40,
              background: "#CD3636",
              borderRadius: 367,
              fontFamily: "Inter Tight",
              fontWeight: 500,
              fontSize: 14,
              lineHeight: "120%",
              color: "#FFFFFF",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const confirmToast = (title, description, confirmLabel = "Delete", extra = null, requireCheck = false) =>
  new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = (result) => {
      root.unmount();
      container.remove();
      resolve(result);
    };

    root.render(
      <ConfirmModal
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        extra={extra}
        requireCheck={requireCheck}
        onCancel={() => cleanup(false)}
        onConfirm={() => cleanup(true)}
      />,
    );
  });

const RowFolderIcon = ({ size = 20, ...props }) => (
  <svg viewBox="22 11 20 20" width={size} height={size} fill="none" {...props}>
    <path
      d="M25.5904 27.25C25.1695 27.25 24.8132 27.1042 24.5215 26.8125C24.2298 26.5208 24.084 26.1645 24.084 25.7435V16.2565C24.084 15.8355 24.2298 15.4792 24.5215 15.1875C24.8132 14.8958 25.1695 14.75 25.5904 14.75H30.1657L31.8323 16.4167H38.4109C38.8318 16.4167 39.1882 16.5625 39.4798 16.8542C39.7715 17.1458 39.9173 17.5022 39.9173 17.9231V25.7435C39.9173 26.1645 39.7715 26.5208 39.4798 26.8125C39.1882 27.1042 38.8318 27.25 38.4109 27.25H25.5904ZM25.5904 26H38.4109C38.4857 26 38.5472 25.976 38.5952 25.9279C38.6433 25.8799 38.6673 25.8184 38.6673 25.7435V17.9231C38.6673 17.8483 38.6433 17.7868 38.5952 17.7388C38.5472 17.6907 38.4857 17.6667 38.4109 17.6667H31.3211L29.6544 16H25.5904C25.5156 16 25.4541 16.024 25.4061 16.0721C25.358 16.1201 25.334 16.1816 25.334 16.2565V25.7435C25.334 25.8184 25.358 25.8799 25.4061 25.9279C25.4541 25.976 25.5156 26 25.5904 26Z"
      fill="currentColor"
    />
  </svg>
);

const RowFolderOpenIcon = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 17 15" width={size} height={size * (15 / 17)} fill="none" {...props}>
    <path
      d="M1.50646 12.5C1.08549 12.5 0.729167 12.3542 0.4375 12.0625C0.145833 11.7708 0 11.4145 0 10.9935V1.50646C0 1.08549 0.145833 0.729167 0.4375 0.4375C0.729167 0.145833 1.08549 0 1.50646 0H6.08167L7.74833 1.66667H14.3269C14.7478 1.66667 15.1042 1.8125 15.3958 2.10417C15.6875 2.39583 15.8333 2.75215 15.8333 3.17313V8.07854C15.6421 7.93215 15.4423 7.80847 15.234 7.7075C15.0256 7.60653 14.8087 7.50264 14.5833 7.39583V3.17313C14.5833 3.09826 14.5593 3.03681 14.5112 2.98875C14.4632 2.94069 14.4017 2.91667 14.3269 2.91667H7.23708L5.57042 1.25H1.50646C1.4316 1.25 1.37014 1.27403 1.32208 1.32208C1.27403 1.37014 1.25 1.4316 1.25 1.50646V10.9935C1.25 11.0684 1.27403 11.1299 1.32208 11.1779C1.37014 11.226 1.4316 11.25 1.50646 11.25H4.07854V12.5H1.50646ZM11.306 15C10.1651 15 9.11194 14.7027 8.14667 14.1081C7.18139 13.5135 6.44771 12.7051 5.94563 11.6827C6.44771 10.6602 7.18139 9.85174 8.14667 9.25729C9.11194 8.66271 10.1651 8.36542 11.306 8.36542C12.4472 8.36542 13.5003 8.66271 14.4656 9.25729C15.4308 9.85174 16.1644 10.6602 16.6667 11.6827C16.1644 12.7051 15.4308 13.5135 14.4656 14.1081C13.5003 14.7027 12.4472 15 11.306 15ZM13.5177 13.2004C14.211 12.8339 14.7853 12.328 15.2404 11.6827C14.7853 11.0374 14.211 10.5315 13.5177 10.165C12.8242 9.79861 12.087 9.61542 11.306 9.61542C10.5251 9.61542 9.78792 9.79861 9.09458 10.165C8.40125 10.5315 7.82701 11.0374 7.37188 11.6827C7.82701 12.328 8.40125 12.8339 9.09458 13.2004C9.78792 13.5668 10.5251 13.75 11.306 13.75C12.087 13.75 12.8242 13.5668 13.5177 13.2004ZM10.569 12.4198C10.3659 12.2169 10.2644 11.9712 10.2644 11.6827C10.2644 11.3942 10.3659 11.1485 10.569 10.9456C10.7719 10.7426 11.0176 10.641 11.306 10.641C11.5945 10.641 11.8403 10.7426 12.0433 10.9456C12.2463 11.1485 12.3477 11.3942 12.3477 11.6827C12.3477 11.9712 12.2463 12.2169 12.0433 12.4198C11.8403 12.6228 11.5945 12.7244 11.306 12.7244C11.0176 12.7244 10.7719 12.6228 10.569 12.4198ZM1.25 11.25V1.25V7.3575V6.53854V11.25Z"
      fill="currentColor"
    />
  </svg>
);

const RowDeleteIcon = ({ size = 20, ...props }) => (
  <svg viewBox="1200 11 20 20" width={size} height={size} fill="none" {...props}>
    <path
      d="M1206.09 28.0831C1205.67 28.0831 1205.32 27.936 1205.02 27.6417C1204.73 27.3472 1204.58 26.9922 1204.58 26.5767V15.9998H1203.75V14.7498H1207.5V14.0127H1212.5V14.7498H1216.25V15.9998H1215.42V26.5767C1215.42 26.9976 1215.27 27.3539 1214.98 27.6456C1214.69 27.9373 1214.33 28.0831 1213.91 28.0831H1206.09ZM1214.17 15.9998H1205.83V26.5767C1205.83 26.6515 1205.86 26.713 1205.91 26.761C1205.95 26.8091 1206.01 26.8331 1206.09 26.8331H1213.91C1213.97 26.8331 1214.03 26.8064 1214.09 26.7529C1214.14 26.6996 1214.17 26.6408 1214.17 26.5767V15.9998ZM1207.84 25.1664H1209.09V17.6664H1207.84V25.1664ZM1210.91 25.1664H1212.16V17.6664H1210.91V25.1664Z"
      fill="currentColor"
    />
  </svg>
);

const RowEditIcon = ({ size = 20, ...props }) => (
  <svg viewBox="1232 11 20 20" width={size} height={size} fill="none" {...props}>
    <path
      d="M1233.67 30.9999V28.4999H1250.33V30.9999H1233.67ZM1237 24.6778H1238.03L1244.95 17.7739L1244.42 17.242L1243.9 16.7308L1237 23.6474V24.6778ZM1235.75 25.9278V23.1153L1245.09 13.7868C1245.21 13.6661 1245.35 13.5748 1245.5 13.5128C1245.66 13.4509 1245.81 13.4199 1245.98 13.4199C1246.15 13.4199 1246.31 13.4509 1246.46 13.5128C1246.62 13.5748 1246.76 13.6704 1246.89 13.7997L1247.89 14.8141C1248.02 14.9348 1248.11 15.073 1248.17 15.2289C1248.23 15.3846 1248.26 15.5455 1248.26 15.7118C1248.26 15.8676 1248.23 16.0226 1248.17 16.1766C1248.11 16.3308 1248.02 16.4717 1247.89 16.5993L1238.56 25.9278H1235.75ZM1244.95 17.7739L1244.42 17.242L1243.9 16.7308L1244.95 17.7739Z"
      fill="currentColor"
    />
  </svg>
);

const RowAddToDriveIcon = ({ size = 20, ...props }) => (
  <svg viewBox="1264 11 20 20" width={size} height={size} fill="none" {...props}>
    <path
      d="M1269.76 26.8332H1274.08L1271.06 21.6248H1268.95L1267.83 23.5528C1267.62 23.8915 1267.52 24.2561 1267.53 24.6465C1267.54 25.0369 1267.63 25.4012 1267.83 25.7394C1268.02 26.0776 1268.29 26.3444 1268.63 26.5398C1268.98 26.7354 1269.36 26.8332 1269.76 26.8332ZM1274 24.1969L1275.5 21.6248H1272.5L1274 24.1969ZM1269.67 20.3748H1276.22L1277.26 18.588L1275.9 16.2723C1275.7 15.9368 1275.43 15.6686 1275.1 15.4678C1274.76 15.2669 1274.4 15.1665 1274 15.1665C1273.6 15.1665 1273.23 15.2656 1272.89 15.4638C1272.55 15.662 1272.27 15.9315 1272.07 16.2723L1269.67 20.3748ZM1274.93 28.0832H1269.76C1269.13 28.0832 1268.54 27.9298 1268 27.6232C1267.46 27.3165 1267.04 26.8953 1266.73 26.3594C1266.42 25.8234 1266.26 25.2491 1266.26 24.6365C1266.26 24.024 1266.42 23.4501 1266.73 22.9148L1270.99 15.6473C1271.3 15.1121 1271.73 14.6898 1272.27 14.3805C1272.81 14.0712 1273.38 13.9165 1274 13.9165C1274.62 13.9165 1275.2 14.0712 1275.73 14.3805C1276.27 14.6898 1276.69 15.1121 1277 15.6473L1280.58 21.753C1280.34 21.6964 1280.08 21.6582 1279.83 21.6384C1279.57 21.6187 1279.32 21.6286 1279.07 21.6682L1277.98 19.8171L1275.9 23.4036C1275.52 23.8428 1275.23 24.3431 1275.03 24.9046C1274.83 25.466 1274.73 26.0666 1274.73 26.7065C1274.73 26.9419 1274.75 27.1773 1274.79 27.4125C1274.82 27.6478 1274.87 27.8714 1274.93 28.0832ZM1279 29.7498V27.2498H1276.5V25.9998H1279V23.4998H1280.25V25.9998H1282.75V27.2498H1280.25V29.7498H1279Z"
      fill="currentColor"
    />
  </svg>
);

const RowExpandIcon = ({ size = 20, ...props }) => (
  <svg viewBox="1296 11 20 20" width={size} height={size} fill="none" {...props}>
    <path
      d="M1300.58 26.4168V21.8335H1301.83V25.1668H1305.17V26.4168H1300.58ZM1310.17 20.1668V16.8335H1306.83V15.5835H1311.42V20.1668H1310.17Z"
      fill="currentColor"
    />
  </svg>
);

const NoFilesUploadIcon = ({ size = 17, ...props }) => (
  <svg viewBox="27.7637 2.5 16.6667 15" width={size} height={size * (15 / 16.6667)} fill="none" {...props}>
    <path
      d="M29.4303 15.8333H42.7637V10H44.4303V16.6667C44.4303 17.1269 44.0573 17.5 43.597 17.5H28.597C28.1368 17.5 27.7637 17.1269 27.7637 16.6667V10H29.4303V15.8333ZM36.9303 7.5V13.3333H35.2637V7.5H31.097L36.097 2.5L41.097 7.5H36.9303Z"
      fill="currentColor"
    />
  </svg>
);

const SelectCircleIcon = ({ size = 14, selected = false, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {selected ? (
      <>
        <circle cx="7" cy="7" r="7" fill="#0085FF" />
        <path d="M4 7.2L6.1 9.3L10 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ) : (
      <>
        <circle cx="7" cy="7" r="7" fill="white" />
        <circle cx="7" cy="7" r="6" stroke="#0085FF" strokeOpacity="0.2" strokeWidth="2" />
      </>
    )}
  </svg>
);

const CreateNewFolderIcon = ({ size = 28, ...props }) => (
  <svg viewBox="217 8 28 28" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M233.624 26.375H235.374V24.0417H237.708V22.2917H235.374V19.9583H233.624V22.2917H231.291V24.0417H233.624V26.375ZM222.025 30.75C221.436 30.75 220.937 30.5458 220.529 30.1375C220.12 29.7292 219.916 29.2303 219.916 28.641V15.359C219.916 14.7697 220.12 14.2708 220.529 13.8625C220.937 13.4542 221.436 13.25 222.025 13.25H228.43L230.764 15.5833H239.974C240.563 15.5833 241.062 15.7875 241.47 16.1958C241.879 16.6042 242.083 17.103 242.083 17.6924V28.641C242.083 29.2303 241.879 29.7292 241.47 30.1375C241.062 30.5458 240.563 30.75 239.974 30.75H222.025ZM222.025 29H239.974C240.078 29 240.164 28.9664 240.232 28.8991C240.299 28.8318 240.333 28.7458 240.333 28.641V17.6924C240.333 17.5876 240.299 17.5015 240.232 17.4343C240.164 17.367 240.078 17.3333 239.974 17.3333H230.048L227.715 15H222.025C221.92 15 221.834 15.0336 221.767 15.1009C221.7 15.1682 221.666 15.2542 221.666 15.359V28.641C221.666 28.7458 221.7 28.8318 221.767 28.8991C221.834 28.9664 221.92 29 222.025 29Z"
      fill="currentColor"
    />
  </svg>
);

const DragDropZone = ({ onFileDrop, isActive, children }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileDrop(files);
    }
  }, [onFileDrop]);

  if (!isActive) {
    return <div>{children}</div>;
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${isDragOver ? 'bg-gray-50 border-gray-300' : ''}`}
    >
      {children}
      {isDragOver && (
        <div className="absolute inset-0 bg-gray-50 bg-opacity-95 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold text-sm">Drop files here</p>
            <p className="text-gray-600 text-xs mt-1">Release to upload</p>
          </div>
        </div>
      )}
    </div>
  );
};

const formatFileSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
};

const formatRowDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const FileCard = ({ file, onView, onDelete, isLast }) => {
  const isLink = file.isLink;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const menuButtonRef = React.useRef(null);

  const openMenu = () => {
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 150 });
    setMenuOpen(true);
  };

  return (
    <div
      className="flex items-center justify-between hover:bg-gray-50 transition-colors relative"
      style={{
        boxSizing: "border-box",
        width: "100%",
        height: 38,
        padding: "0 12px 0 24px",
        borderBottom: isLast ? "none" : "1px solid #E1E4EA",
      }}
    >
      <div className="flex items-center flex-1 min-w-0" style={{ gap: 24 }}>
        <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 260 }}>
          {isLink ? (
            <LinkIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
          ) : (
            <AttachFileIcon size={9} className="flex-shrink-0" style={{ color: "#48494C" }} />
          )}
          <span
            className="truncate"
            title={file.fileName}
            style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#48494C" }}
          >
            {file.fileName}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 134 }}>
          <FileSizeIcon size={18} className="flex-shrink-0" style={{ color: "#48494C" }} />
          <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#48494C" }}>
            {isLink ? "Link" : formatFileSize(file.fileSize)}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 195 }}>
          <UpdatedByIcon size={15} className="flex-shrink-0" style={{ color: "#48494C" }} />
          <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }}>
            {file.updatedBy || "—"}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 297 }}>
          <LastUpdateIcon size={16} className="flex-shrink-0" style={{ color: "#48494C" }} />
          <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }}>
            Last Update: {formatRowDate(file.uploadedAt)}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 278 }}>
          <CreatedDateIcon size={16} className="flex-shrink-0" style={{ color: "#48494C" }} />
          <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }}>
            Created Date: {formatRowDate(file.uploadedAt)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end flex-shrink-0 relative">
        <button
          ref={menuButtonRef}
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          className="hover:opacity-70 transition-opacity"
        >
          <MoreVertical className="w-5 h-5" style={{ color: "#525252" }} />
        </button>
        {menuOpen && menuPos && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[9999]"
              style={{ minWidth: 150, top: menuPos.top, left: menuPos.left }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onView(file);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <OpenFileIcon size={19} style={{ color: "#5C5D5C" }} />
                Open File
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(file);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <DeleteFileIcon size={17} style={{ color: "#FB3748" }} />
                Delete File
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
};

const FolderCard = ({ folder, expanded, onToggle, onEdit, onDelete, onSelect, onDeleteFile, isFirst, isLast }) => (
  <div className="transition-all">
    <div
      className="flex items-center justify-between gap-2"
      style={{
        boxSizing: "border-box",
        padding: "11px 12px 11px 24px",
        background: "#F5F7FA",
        borderTop: isFirst ? "none" : "1px solid #E1E4EA",
      }}
    >
      <div
        className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
        onClick={() => onToggle(folder._id)}
      >
        {expanded ? (
          <RowFolderOpenIcon size={20} style={{ color: "#404040" }} className="flex-shrink-0" />
        ) : (
          <RowFolderIcon size={20} style={{ color: "#525252" }} className="flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">{folder.name}</h3>
          <p className="text-xs text-gray-500">
            {folder.files?.length || 0} {folder.files?.length === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>
      <div className="flex items-center flex-shrink-0" style={{ gap: 12 }}>
        <button
          onClick={() => onDelete(folder._id)}
          className="hover:opacity-70 transition-opacity"
          title="Delete"
        >
          <RowDeleteIcon size={20} style={{ color: "#CD3636" }} />
        </button>
        <button
          onClick={() => onEdit(folder)}
          className="hover:opacity-70 transition-opacity"
          title="Rename"
        >
          <RowEditIcon size={20} style={{ color: "#404040" }} />
        </button>
        <button
          onClick={() => onSelect(folder._id)}
          className="hover:opacity-70 transition-opacity"
          title="Add files/links"
        >
          <RowAddToDriveIcon size={20} style={{ color: "#404040" }} />
        </button>
        <button
          onClick={() => onToggle(folder._id)}
          className="hover:opacity-70 transition-opacity"
          title="Expand"
        >
          <RowExpandIcon size={20} style={{ color: "#404040" }} />
        </button>
      </div>
    </div>
    {expanded && (
      <div
        className="border-t border-gray-200 overflow-y-auto"
        style={{
          boxSizing: "border-box",
          padding: folder.files?.length > 0 ? 0 : 16,
          width: "100%",
          height: folder.files?.length > 0 ? Math.min(folder.files.length, 4) * 38 : 245,
          background: "#FFFFFF",
        }}
      >
        {folder.files?.length > 0 ? (
          <div>
            {folder.files.map((file, idx) => (
              <FileCard
                key={idx}
                file={file}
                isLast={idx === folder.files.length - 1}
                onView={(file) => {
                  if (file.isLink) {
                    window.open(file.fileUrl, '_blank', 'noopener,noreferrer');
                  } else {
                    window.open(`${file.fileUrl}`, '_blank');
                  }
                }}
                onDelete={(file) => onDeleteFile(folder._id, file)}
              />
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center w-full h-full"
            style={{
              boxSizing: "border-box",
              background: "#F7F7F7",
              border: "1px dashed #EBEBEB",
              borderRadius: 12,
              boxShadow: "0px 1px 1px rgba(10, 13, 20, 0.03)",
            }}
          >
            <NoFilesUploadIcon size={17} style={{ color: "#A3A3A3" }} className="mb-2" />
            <p style={{ color: "#A3A3A3" }} className="text-sm">Upload Files</p>
          </div>
        )}
      </div>
    )}
  </div>
);

const CreateFolderModal = ({ isOpen, onClose, onSubmit, onDelete, initialName = "" }) => {
  const [name, setName] = useState(initialName);
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setName(initialName);
      setTimeout(() => setIsSliding(true), 10);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen, initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
      setName("");
      onClose();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[10001] flex items-center justify-center p-4 transition-all duration-300 ${isSliding ? "opacity-100" : "opacity-0"}`}>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`bg-white overflow-hidden relative z-10 transform transition-all duration-300 ${isSliding ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}
        style={{
          boxSizing: "border-box",
          width: 400,
          border: "1px solid #EBEBEB",
          borderRadius: 12,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            boxSizing: "border-box",
            width: 400,
            height: 72,
            padding: "16px 20px",
            gap: 12,
            borderBottom: "1px solid #EBEBEB",
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, padding: 10, background: "#F5F7FA", borderRadius: 48 }}
          >
            <CreateNewFolderIcon size={20} style={{ color: "#0085FF" }} />
          </div>
          <h3
            className="flex-1"
            style={{
              fontFamily: "Inter Tight",
              fontWeight: 500,
              fontSize: 16,
              lineHeight: "120%",
              color: "#171717",
            }}
          >
            {initialName ? 'Rename Folder' : 'New Folder'}
          </h3>
          <button
            onClick={onClose}
            className="hover:opacity-70 transition-opacity flex-shrink-0"
          >
            <X size={20} style={{ color: "#5D5D5C" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div
            className="flex flex-col items-center justify-center"
            style={{ boxSizing: "border-box", width: 400, padding: 20, gap: 12 }}
          >
            <div
              className="flex flex-col items-start self-stretch"
              style={{ width: 360, gap: 4 }}
            >
              <label
                style={{
                  fontFamily: "Inter Tight",
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: "120%",
                  color: "#171717",
                }}
              >
                Folder Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Document Assets"
                className="self-stretch focus:outline-none focus:border-blue-400 transition-all"
                style={{
                  boxSizing: "border-box",
                  padding: "10px 10px 10px 12px",
                  gap: 8,
                  height: 40,
                  background: "#FFFFFF",
                  border: "1px solid #EBEBEB",
                  boxShadow: "0px 1px 2px rgba(10, 13, 20, 0.03)",
                  borderRadius: 8,
                  fontFamily: "Inter Tight",
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: "120%",
                  color: "#5C5C5C",
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="flex items-center justify-end flex-shrink-0"
            style={{
              boxSizing: "border-box",
              width: 400,
              height: 72,
              padding: "16px 20px",
              gap: 12,
              borderTop: "1px solid #EBEBEB",
            }}
          >
            {initialName && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100 bg-white mr-auto"
                title="Delete Folder"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center hover:bg-gray-50 transition-colors whitespace-nowrap"
              style={{
                boxSizing: "border-box",
                padding: "10px 12px",
                gap: 6,
                minWidth: 107,
                height: 40,
                background: "#FFFFFF",
                border: "1px solid #EBEBEB",
                boxShadow: "0px 1px 2px rgba(10, 13, 20, 0.03)",
                borderRadius: 111,
                fontFamily: "Inter Tight",
                fontWeight: 500,
                fontSize: 14,
                lineHeight: "120%",
                color: "#171717",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center justify-center hover:opacity-90 transition-opacity disabled:cursor-not-allowed whitespace-nowrap"
              style={{
                boxSizing: "border-box",
                padding: "10px 12px",
                gap: 6,
                minWidth: 107,
                height: 40,
                background: "#0085FF",
                borderRadius: 111,
                fontFamily: "Inter Tight",
                fontWeight: 500,
                fontSize: 14,
                lineHeight: "120%",
                color: "#FFFFFF",
              }}
              disabled={!name.trim()}
            >
              {initialName ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddLinkModal = ({ isOpen, onClose, onSubmit }) => {
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (linkName.trim() && linkUrl.trim()) {
      onSubmit({ name: linkName.trim(), url: linkUrl.trim() });
      setLinkName("");
      setLinkUrl("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Add Link</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="e.g., Project Documentation"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              URL
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/document"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
            >
              Add Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Folder = ({ companyId: propCompanyId, onFoldersChange }) => {
  const { id: paramCompanyId } = useParams();
  const companyId = propCompanyId || paramCompanyId;
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedFileNames, setSelectedFileNames] = useState([]);
  const [fileSearchTerm, setFileSearchTerm] = useState("");
  const [openFolderId, setOpenFolderId] = useState("");
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [folderViewMode, setFolderViewMode] = useState("grid");
  const [uploadMode, setUploadMode] = useState("file"); // "file" or "link"
  const [modalState, setModalState] = useState({
    isOpen: false,
    editingId: null,
    initialName: "",
  });
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, [companyId, refresh]);

  const fetchFolders = async () => {
    try {
      const res = await API.get("/folders", {
        params: { companyId },
      });
      setFolders(res.data || []);
      onFoldersChange?.(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch folders");
    }
  };

  const handleModalSubmit = async (name) => {
    if (modalState.editingId) {
      await renameFolder(modalState.editingId, name);
    } else {
      await createFolder(name);
    }
  };

  const createFolder = async (name) => {
    try {
      await API.post("/folders", {
        name,
        company: companyId,
      });
      setRefresh(!refresh);
      toast.success("Folder created");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create folder");
      }
    }
  };

  const renameFolder = async (folderId, name) => {
    try {
      await API.put(`/folders/${folderId}`, { name });
      setRefresh(!refresh);
      toast.success("Folder renamed");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to rename folder");
      }
    }
  };

  const deleteFolder = async (folderId) => {
    const folder = folders.find((f) => f._id === folderId);
    const folderName = folder?.name || "this folder";
    const itemCount = folder?.files?.length || 0;
    const totalBytes = (folder?.files || []).reduce((sum, f) => sum + (f.fileSize || 0), 0);
    if (
      await confirmToast(
        "Delete Folder?",
        <>This will permanently delete <strong style={{ fontWeight: 700, color: "#171717" }}>"{folderName}"</strong> including all files inside this folder. This action cannot be undone.</>,
        "Delete Folder",
        <div
          className="flex items-center"
          style={{
            boxSizing: "border-box",
            width: 360,
            gap: 12,
            padding: 14,
            background: "#FFFFFF",
            border: "1px solid #EBEAEB",
            borderRadius: 12,
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, background: "#F5F7FA", borderRadius: 20 }}
          >
            <MiniOpenFolderIcon size={32} />
          </div>
          <div className="min-w-0">
            <p
              className="truncate"
              style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, color: "#171717" }}
            >
              {folderName}
            </p>
            <p style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, color: "#5C5C5C" }}>
              {itemCount} {itemCount === 1 ? "Item" : "Items"} · {formatFileSize(totalBytes)}
            </p>
          </div>
        </div>,
        true,
      )
    ) {
      try {
        await API.delete(`/folders/${folderId}`);
        setRefresh(!refresh);
        toast.success("Folder deleted");
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || "Failed to delete folder");
        }
      }
    }
  };

  const deleteFile = async (folderId, file) => {
    if (
      await confirmToast(
        "Delete File?",
        <>This file will be permanently deleted from<br /><strong style={{ fontWeight: 700, color: "#171717" }}>"{file.fileName}"</strong>. This action cannot be undone.</>,
        "Delete",
        <div
          className="flex items-center"
          style={{
            boxSizing: "border-box",
            width: 360,
            gap: 12,
            padding: 14,
            background: "#FFFFFF",
            border: "1px solid #EBEAEB",
            borderRadius: 12,
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, background: "#F6F6F6", borderRadius: 48 }}
          >
            <MiniFileIcon size={32} />
          </div>
          <div className="min-w-0">
            <p
              className="truncate"
              style={{ fontFamily: "Inter Tight", fontWeight: 500, fontSize: 14, color: "#171717" }}
            >
              {file.fileName}
            </p>
            <p style={{ fontFamily: "Inter Tight", fontWeight: 400, fontSize: 14, color: "#5C5C5C" }}>
              {file.isLink ? "Link" : formatFileSize(file.fileSize)}
            </p>
          </div>
        </div>,
        true,
      )
    ) {
      try {
        await API.delete(`/folders/${folderId}/files`, {
          data: { fileName: file.fileName, fileUrl: file.fileUrl },
        });
        setRefresh(!refresh);
        toast.success("File deleted");
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || "Failed to delete file");
        }
      }
    }
  };

  const handleFileDrop = useCallback(
    (files) => {
      if (!selectedFolderId) {
        toast.error("Select a folder first");
        return;
      }
      setNewFiles(files);
      handleUpload(files);
    },
    [selectedFolderId],
  );

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles(files);
  };

  const handleUpload = async (files = newFiles) => {
    if (!selectedFolderId) {
      toast.error("Select a folder");
      return;
    }
    if (files.length === 0) {
      toast.error("Select files to upload");
      return;
    }

    const formData = new FormData();
    formData.append("folder", "company");
    formData.append("folderId", selectedFolderId);
    files.forEach((file) => formData.append("files", file));

    try {
      setUploading(true);
      await API.post("/folders/upload", formData);
      setNewFiles([]);
      setRefresh(!refresh);
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err) {
      console.log(err);
      toast.error(err.response?.data?.error);
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = async ({ name, url }) => {
    if (!selectedFolderId) {
      toast.error("Select a folder");
      return;
    }

    try {
      await API.post("/folders/add-link", {
        folderId: selectedFolderId,
        fileName: name,
        fileUrl: url,
      });
      setRefresh(!refresh);
      toast.success("Link added");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to add link");
      }
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId],
    );
  };

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(10);

  const listTotalCount = filteredFolders.length;
  const listTotalPages = Math.max(1, Math.ceil(listTotalCount / listLimit));
  const listStartItem = listTotalCount === 0 ? 0 : (listPage - 1) * listLimit + 1;
  const listEndItem = Math.min(listPage * listLimit, listTotalCount);
  const hasListPrevPage = listPage > 1;
  const hasListNextPage = listPage < listTotalPages;

  const handleListPageChange = (page) => {
    if (page < 1 || page > listTotalPages) return;
    setListPage(page);
  };

  const handleListLimitChange = (newLimit) => {
    setListLimit(newLimit);
    setListPage(1);
  };

  const getListPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = Math.max(2, listPage - delta); i <= Math.min(listTotalPages - 1, listPage + delta); i++) {
      range.push(i);
    }
    if (listPage - delta > 2) rangeWithDots.push(1, "...");
    else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (listPage + delta < listTotalPages - 1) rangeWithDots.push("...", listTotalPages);
    else if (listTotalPages > 1) rangeWithDots.push(listTotalPages);
    return rangeWithDots.filter((item, index, arr) => index === 0 || arr[index - 1] !== item);
  };

  const paginatedFolders = filteredFolders.slice(
    (listPage - 1) * listLimit,
    listPage * listLimit,
  );

  const selectedFolder = folders.find((f) => f._id === selectedFolderId);
  const openFolder = folders.find((f) => f._id === openFolderId);

  return (
    <DragDropZone
      onFileDrop={handleFileDrop}
      isActive={!!selectedFolderId && uploadMode === "file"}
    >
      <div className="h-full">
        <AppToaster />


        {openFolderId && openFolder ? (
          <div className="min-h-[400px]">
            <div
              className="flex items-center justify-between w-full flex-shrink-0"
              style={{ height: 32, margin: "0 auto 18px 0" }}
            >
              <div className="flex items-center flex-shrink-0" style={{ gap: 10, width: 160, height: 20 }}>
                <button
                  onClick={() => setOpenFolderId("")}
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: "150%",
                    letterSpacing: "-0.04em",
                    color: "#000000",
                  }}
                  className="hover:opacity-70 flex-shrink-0"
                >
                  Folders
                </button>
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                <span
                  className="truncate"
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: "150%",
                    letterSpacing: "-0.04em",
                    color: "#404040",
                  }}
                >
                  {openFolder.name}
                </span>
              </div>

              <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 329, height: 32 }}>
                <div
                  className="relative flex items-center flex-shrink-0"
                  style={{
                    boxSizing: "border-box",
                    padding: "0 14px",
                    gap: 10,
                    width: 233,
                    height: 32,
                    border: "1px solid rgba(31, 41, 55, 0.1)",
                    borderRadius: 95,
                  }}
                >
                  <Search className="text-gray-900 opacity-50 w-4 h-4 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search file by name..."
                    value={fileSearchTerm}
                    onChange={(e) => setFileSearchTerm(e.target.value)}
                    className="w-full h-full bg-transparent border-none outline-none text-xs leading-normal"
                    style={{ color: "#1F2937", opacity: 0.9 }}
                  />
                </div>
                <div className="flex items-center flex-shrink-0" style={{ gap: 12, width: 84, height: 20 }}>
                  <button
                    onClick={() => deleteFolder(openFolder._id)}
                    className="hover:opacity-70 transition-opacity"
                    title="Delete"
                  >
                    <RowDeleteIcon size={20} style={{ color: "#CD3636" }} />
                  </button>
                  <button
                    onClick={() =>
                      setModalState({
                        isOpen: true,
                        editingId: openFolder._id,
                        initialName: openFolder.name,
                      })
                    }
                    className="hover:opacity-70 transition-opacity"
                    title="Rename"
                  >
                    <RowEditIcon size={20} style={{ color: "#404040" }} />
                  </button>
                  <button
                    onClick={() => setSelectedFolderId(openFolder._id)}
                    className="hover:opacity-70 transition-opacity"
                    title="Add files/links"
                  >
                    <RowAddToDriveIcon size={20} style={{ color: "#404040" }} />
                  </button>
                </div>
              </div>
            </div>

            {openFolder.files?.length > 0 ? (
              <div
                className="overflow-y-auto"
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  height: 500,
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 206px)",
                  gridAutoRows: 156,
                  columnGap: 15,
                  rowGap: 15,
                }}
              >
                {openFolder.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{
                      boxSizing: "border-box",
                      width: 206,
                      height: 156,
                      borderRadius: 8,
                      padding: 12,
                      gap: 8,
                    }}
                    onClick={() => {
                      if (!selectedFileNames.includes(file.fileName)) {
                        setSelectedFileNames((prev) => [...prev, file.fileName]);
                        return;
                      }
                      if (file.isLink) {
                        window.open(file.fileUrl, "_blank", "noopener,noreferrer");
                      } else {
                        window.open(`${file.fileUrl}`, "_blank");
                      }
                    }}
                  >
                    <SelectCircleIcon
                      size={14}
                      selected={selectedFileNames.includes(file.fileName)}
                      className="absolute cursor-pointer"
                      style={{ top: 8, right: 8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFileNames((prev) =>
                          prev.includes(file.fileName)
                            ? prev.filter((n) => n !== file.fileName)
                            : [...prev, file.fileName],
                        );
                      }}
                    />
                    <img src={pdfIconImg} alt="" width={82} height={82} style={{ objectFit: "contain", marginTop: -16 }} />
                    <span
                      className="absolute left-0 w-full text-center truncate px-3"
                      style={{
                        bottom: 28,
                        fontFamily: "Inter",
                        fontWeight: 500,
                        fontSize: 13,
                        letterSpacing: "-0.02em",
                        color: "#111216",
                      }}
                      title={file.fileName}
                    >
                      {file.fileName}
                    </span>
                    <span
                      className="absolute left-0 w-full text-center"
                      style={{
                        bottom: 8,
                        fontFamily: "Inter",
                        fontWeight: 400,
                        fontSize: 11,
                        color: "#5B5A64",
                      }}
                    >
                      {file.isLink ? "Link" : formatFileSize(file.fileSize)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center"
                style={{
                  boxSizing: "border-box",
                  padding: 16,
                  gap: 8,
                  width: "100%",
                  height: 206,
                  background: "#F7F7F7",
                  border: "1px dashed #EBEBEB",
                  boxShadow: "0px 1px 2px rgba(10, 13, 20, 0.03)",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedFolderId(openFolder._id)}
              >
                <NoFilesUploadIcon size={20} style={{ color: "#A3A3A3" }} />
                <p
                  style={{
                    fontFamily: "Inter Tight",
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: "120%",
                    color: "#A3A3A3",
                  }}
                >
                  Upload Files
                </p>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Search + Controls */}
        <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
          <div className="relative flex-1 h-full">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-900 opacity-50 w-5 h-5" />
            <input
              type="text"
              placeholder="Search folder by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          <div
            className="flex flex-row items-center flex-shrink-0"
            style={{ padding: 4, gap: 6, width: 86, height: 44, background: "#E9EAEB", borderRadius: 95 }}
          >
            <button
              onClick={() => setFolderViewMode("list")}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                padding: 8,
                gap: 10,
                width: 36,
                height: 36,
                background: folderViewMode === "list" ? "#FFFFFF" : "transparent",
                boxShadow: folderViewMode === "list" ? "0px 4px 4px rgba(0, 0, 0, 0.05)" : "none",
                borderRadius: 107,
              }}
            >
              <List size={20} style={{ color: folderViewMode === "list" ? "#0085FF" : "#404040" }} />
            </button>
            <button
              onClick={() => setFolderViewMode("grid")}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                padding: 8,
                gap: 10,
                width: 36,
                height: 36,
                background: folderViewMode === "grid" ? "#FFFFFF" : "transparent",
                boxShadow: folderViewMode === "grid" ? "0px 4px 4px rgba(0, 0, 0, 0.05)" : "none",
                borderRadius: 107,
              }}
            >
              <LayoutGrid size={20} style={{ color: folderViewMode === "grid" ? "#0085FF" : "#404040" }} />
            </button>
          </div>

          <button
            onClick={() =>
              setModalState({ isOpen: true, editingId: null, initialName: "" })
            }
            className="flex items-center justify-center flex-shrink-0"
            style={{
              boxSizing: "border-box",
              padding: 12,
              gap: 8,
              width: 44,
              height: 44,
              background: "#FFFFFF",
              border: "1px solid rgba(31, 41, 55, 0.3)",
              borderRadius: 95,
            }}
            title="New Folder"
          >
            <CreateNewFolderIcon size={20} style={{ color: "#404040" }} />
          </button>
        </div>

        {/* Folders List / Grid */}
        {folderViewMode === "grid" ? (
          <div
            className="w-full"
            style={{
              boxSizing: "border-box",
              width: "100%",
              height: 482,
              borderRadius: 8,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "1.2px",
              alignContent: "flex-start",
              overflowY: "auto",
            }}
          >
            {paginatedFolders.map((folder) => (
              <div
                key={folder._id}
                onClick={() => setOpenFolderId(folder._id)}
                className="flex flex-col justify-center items-center cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ boxSizing: "border-box", width: "100%", height: 150, borderRadius: 8, gap: 2 }}
              >
                <GridFolderIcon size={100} />
                <div
                  className="flex flex-col justify-center items-center"
                  style={{ boxSizing: "border-box", padding: 8, gap: 8, width: 209, height: 40 }}
                >
                  <div
                    className="flex flex-col justify-center items-center self-stretch"
                    style={{ boxSizing: "border-box", padding: 0, width: 193, height: 41 }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: 100,
                        height: 22,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "center",
                        fontFamily: "Inter",
                        fontWeight: 500,
                        fontSize: 18,
                        lineHeight: "22px",
                        letterSpacing: "-0.05em",
                        color: "#111216",
                      }}
                      title={folder.name}
                    >
                      {folder.name || "Untitled"}
                    </span>
                    <span
                      style={{
                        width: 426,
                        maxWidth: "100%",
                        height: 19,
                        fontFamily: "Inter",
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: "19px",
                        textAlign: "center",
                        letterSpacing: "-0.05em",
                        color: "#5B5A64",
                      }}
                    >
                      {folder.files?.length || 0} {folder.files?.length === 1 ? "File" : "Files"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredFolders.length === 0 ? (
          <button
            onClick={() =>
              setModalState({
                isOpen: true,
                editingId: null,
                initialName: "",
              })
            }
            className="flex flex-col items-center justify-center w-full text-gray-500 hover:text-blue-600 transition-colors"
            style={{
              boxSizing: "border-box",
              height: 420,
              background: "#FFFFFF",
              border: "1px solid #E1E4EA",
              borderRadius: 8,
            }}
          >
            <FolderIcon className="w-7 h-7 mb-2" />
            <span className="text-sm font-medium">Create New Folder</span>
          </button>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {paginatedFolders.map((folder, idx) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                expanded={expandedFolders.includes(folder._id)}
                isFirst={idx === 0}
                isLast={idx === paginatedFolders.length - 1}
                onToggle={toggleFolder}
                onEdit={(folder) =>
                  setModalState({
                    isOpen: true,
                    editingId: folder._id,
                    initialName: folder.name,
                  })
                }
                onDelete={deleteFolder}
                onSelect={setSelectedFolderId}
                onDeleteFile={deleteFile}
              />
            ))}
          </div>
        )}

        {folderViewMode === "list" && listTotalCount > 0 && (
          <div className="w-full bg-white px-4 py-3 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handleListPageChange(listPage - 1)}
                disabled={!hasListPrevPage}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handleListPageChange(listPage + 1)}
                disabled={!hasListNextPage}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-700 font-inter">
                  Showing <span className="font-semibold">{listStartItem}</span> to{" "}
                  <span className="font-semibold">{listEndItem}</span> of{" "}
                  <span className="font-semibold">{listTotalCount}</span> Folders
                </p>
                <select
                  value={listLimit}
                  onChange={(e) => handleListLimitChange(parseInt(e.target.value))}
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
                  onClick={() => handleListPageChange(listPage - 1)}
                  disabled={!hasListPrevPage}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {listTotalPages > 0 &&
                  getListPageNumbers().map((pageNum, index) =>
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
                        onClick={() => handleListPageChange(pageNum)}
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                          pageNum === listPage
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ),
                  )}

                <button
                  onClick={() => handleListPageChange(listPage + 1)}
                  disabled={!hasListNextPage}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        </>
        )}

        {/* Upload Section */}
        {selectedFolderId && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Add to: {selectedFolder?.name}
                </p>
                <p className="text-xs text-gray-600">
                  Upload files or add links
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedFolderId("");
                  setNewFiles([]);
                  setUploadMode("file");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setUploadMode("file")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === "file"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
              <button
                onClick={() => {
                  setUploadMode("link");
                  setLinkModalOpen(true);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === "link"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                Add Link
              </button>
            </div>

            {uploadMode === "file" && (
              <div className="space-y-3">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />

                {newFiles.length > 0 && (
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs font-medium text-gray-900 mb-1">
                      {newFiles.length} file(s) selected
                    </p>
                    {newFiles.slice(0, 2).map((file, idx) => (
                      <p key={idx} className="text-xs text-gray-600 truncate">
                        {file.name}
                      </p>
                    ))}
                    {newFiles.length > 2 && (
                      <p className="text-xs text-gray-500">
                        +{newFiles.length - 2} more
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleUpload()}
                  disabled={uploading || newFiles.length === 0}
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        <CreateFolderModal
          isOpen={modalState.isOpen}
          onClose={() =>
            setModalState({ isOpen: false, editingId: null, initialName: "" })
          }
          onSubmit={handleModalSubmit}
          onDelete={() => deleteFolder(modalState.editingId)}
          initialName={modalState.initialName}
        />

        <AddLinkModal
          isOpen={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          onSubmit={handleAddLink}
        />
      </div>
    </DragDropZone>
  );
};

export default Folder;
