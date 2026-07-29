import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import API from "../services/api";
import TaskForm from "../components/Task/TaskForm";
import AdminMeetingForm from "../components/admin/AdminMeetingForm";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import FilterIcon from "../components/common/FilterIcon";
import AdvancedFilterPanel from "../components/common/AdvancedFilterPanel";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Edit2,
  Trash2,
  Plus,
  Calendar,
  Users,
  X,
  Download,
  Clock,
  MapPin,
  Building2,
  User,
  Truck,
  Settings,
  Upload,
  MoreVertical,
  CheckCircle,
  Layout,
  Eye,
  FileText,
  Pin,
  PinOff,
  EyeOff,
} from "lucide-react";
import BulkActions from "../components/BulkActions";
import TaskDetailsModal from "../components/Task/TaskDetailsModal";
import logo from "/DataCircles.png";
import * as XLSX from "xlsx";
import VideoTutorialModal from "../components/VideoTutorialModal";
import { getVideoTutorial } from "../utils/videoTutorials";
import VideoTutorialButton from "../components/VideoTutorialButton";
import TaskKanbanBoard from "../components/Task/TaskKanbanBoard";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import AppToaster from "../components/AppToaster";
import TableSkeletonRows from "../components/common/TableSkeletonRows";
import useMinDelay from "../hooks/useMinDelay";

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Wraps every case-insensitive occurrence of `query` inside `text` in a <mark>,
// matching Companies/Contacts' search-highlighting exactly.
const HighlightText = ({ text, query }) => {
  const str = text === null || text === undefined ? "" : String(text);
  const q = (query || "").trim();
  if (!q) return <>{str}</>;

  const parts = str.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
};

const TuneFilterIcon = (props) => (
  <svg viewBox="433 15 24 24" width={16} height={16} fill="none" {...props}>
    <path
      d="M444.167 19.8346C444.167 19.1443 444.726 18.5846 445.417 18.5846C446.107 18.5846 446.667 19.1443 446.667 19.8346C446.667 20.525 446.107 21.0846 445.417 21.0846C444.726 21.0846 444.167 20.525 444.167 19.8346ZM445.417 16.918C443.806 16.918 442.5 18.2238 442.5 19.8346C442.5 21.4455 443.806 22.7513 445.417 22.7513C447.027 22.7513 448.333 21.4455 448.333 19.8346C448.333 18.2238 447.027 16.918 445.417 16.918ZM450 20.668H456.667V19.0013H450V20.668ZM453.333 28.168C453.333 27.4776 453.893 26.918 454.583 26.918C455.274 26.918 455.833 27.4776 455.833 28.168C455.833 28.8583 455.274 29.418 454.583 29.418C453.893 29.418 453.333 28.8583 453.333 28.168ZM454.583 25.2513C452.972 25.2513 451.667 26.5571 451.667 28.168C451.667 29.7788 452.972 31.0846 454.583 31.0846C456.194 31.0846 457.5 29.7788 457.5 28.168C457.5 26.5571 456.194 25.2513 454.583 25.2513ZM443.333 27.3346V29.0013H450V27.3346H443.333Z"
      fill="currentColor"
    />
  </svg>
);

const CustomListIcon = (props) => (
  <svg viewBox="0 0 15 15" width={15} height={15} fill="none" {...props}>
    <path
      d="M4.16667 0.416667H15V2.08333H4.16667V0.416667ZM0 0H2.5V2.5H0V0ZM0 5.83333H2.5V8.33333H0V5.83333ZM0 11.6667H2.5V14.1667H0V11.6667ZM4.16667 6.25H15V7.91667H4.16667V6.25ZM4.16667 12.0833H15V13.75H4.16667V12.0833Z"
      fill="currentColor"
    />
  </svg>
);

const CustomMeetingIcon = (props) => (
  <svg viewBox="62 18 20 20" width={20} height={20} fill="none" {...props}>
    <path
      d="M67.4887 31.0448H73.5785V30.7469C73.5785 30.2212 73.2956 29.7922 72.7299 29.46C72.1642 29.1276 71.4322 28.9615 70.5337 28.9615C69.6351 28.9615 68.9029 29.1276 68.3372 29.46C67.7715 29.7922 67.4887 30.2212 67.4887 30.7469V31.0448ZM70.5337 27.8719C70.9386 27.8719 71.2828 27.73 71.5664 27.4462C71.8501 27.1626 71.992 26.8184 71.992 26.4135C71.992 26.0085 71.8501 25.6642 71.5664 25.3806C71.2828 25.097 70.9386 24.9552 70.5337 24.9552C70.1287 24.9552 69.7844 25.097 69.5008 25.3806C69.2172 25.6642 69.0754 26.0085 69.0754 26.4135C69.0754 26.8184 69.2172 27.1626 69.5008 27.4462C69.7844 27.73 70.1287 27.8719 70.5337 27.8719ZM65.7899 34.25C65.3691 34.25 65.0129 34.1042 64.7212 33.8125C64.4295 33.5208 64.2837 33.1645 64.2837 32.7435V23.2565C64.2837 22.8355 64.4295 22.4792 64.7212 22.1875C65.0129 21.8958 65.3691 21.75 65.7899 21.75H75.2772C75.6981 21.75 76.0543 21.8958 76.346 22.1875C76.6376 22.4792 76.7835 22.8355 76.7835 23.2565V27.0706L79.7162 24.1379V31.8621L76.7835 28.9294V32.7435C76.7835 33.1645 76.6376 33.5208 76.346 33.8125C76.0543 34.1042 75.6981 34.25 75.2772 34.25H65.7899ZM65.7899 33H75.2772C75.352 33 75.4133 32.976 75.4614 32.9279C75.5096 32.8799 75.5337 32.8184 75.5337 32.7435V23.2565C75.5337 23.1816 75.5096 23.1201 75.4614 23.0721C75.4133 23.024 75.352 23 75.2772 23H65.7899C65.7152 23 65.6538 23.024 65.6058 23.0721C65.5577 23.1201 65.5337 23.1816 65.5337 23.2565V32.7435C65.5337 32.8184 65.5577 32.8799 65.6058 32.9279C65.6538 32.976 65.7152 33 65.7899 33Z"
      fill="currentColor"
    />
  </svg>
);

const CustomEventIcon = (props) => (
  <svg viewBox="355 18 20 20" width={20} height={20} fill="none" {...props}>
    <path
      d="M365.88 32.44C365.507 32.0665 365.32 31.6122 365.32 31.0769C365.32 30.5416 365.507 30.0873 365.88 29.714C366.254 29.3406 366.708 29.154 367.243 29.154C367.779 29.154 368.233 29.3406 368.607 29.714C368.98 30.0873 369.167 30.5416 369.167 31.0769C369.167 31.6122 368.98 32.0665 368.607 32.44C368.233 32.8133 367.779 33 367.243 33C366.708 33 366.254 32.8133 365.88 32.44ZM359.423 35.9167C359.002 35.9167 358.646 35.7708 358.354 35.4792C358.062 35.1875 357.917 34.8312 357.917 34.4102V23.2565C357.917 22.8355 358.062 22.4792 358.354 22.1875C358.646 21.8958 359.002 21.75 359.423 21.75H360.577V19.9873H361.859V21.75H368.173V19.9873H369.423V21.75H370.577C370.998 21.75 371.354 21.8958 371.646 22.1875C371.937 22.4792 372.083 22.8355 372.083 23.2565V34.4102C372.083 34.8312 371.937 35.1875 371.646 35.4792C371.354 35.7708 370.998 35.9167 370.577 35.9167H359.423ZM359.423 34.6667H370.577C370.641 34.6667 370.7 34.6399 370.753 34.5865C370.806 34.5331 370.833 34.4744 370.833 34.4102V26.5898H359.167V34.4102C359.167 34.4744 359.193 34.5331 359.247 34.5865C359.3 34.6399 359.359 34.6667 359.423 34.6667ZM359.167 25.3398H370.833V23.2565C370.833 23.1923 370.806 23.1336 370.753 23.0802C370.7 23.0267 370.641 23 370.577 23H359.423C359.359 23 359.3 23.0267 359.247 23.0802C359.193 23.1336 359.167 23.1923 359.167 23.2565V25.3398Z"
      fill="currentColor"
    />
  </svg>
);

const CustomTargetIcon = (props) => (
  <svg viewBox="594 18 20 20" width={20} height={20} fill="none" {...props}>
    <path
      d="M600.914 35.293C599.95 34.8775 599.112 34.3135 598.4 33.6011C597.687 32.8888 597.123 32.0511 596.707 31.088C596.291 30.125 596.083 29.096 596.083 28.0011C596.083 26.9061 596.291 25.8769 596.707 24.9134C597.122 23.95 597.686 23.1119 598.399 22.3993C599.111 21.6866 599.949 21.1224 600.912 20.7065C601.875 20.2909 602.904 20.083 603.999 20.083C605.094 20.083 606.123 20.2908 607.086 20.7063C608.05 21.1219 608.888 21.6859 609.601 22.3982C610.313 23.1106 610.877 23.9483 611.293 24.9113C611.709 25.8744 611.917 26.9034 611.917 27.9982C611.917 29.0932 611.709 30.1225 611.293 31.0859C610.878 32.0494 610.314 32.8875 609.602 33.6001C608.889 34.3127 608.052 34.877 607.088 35.2928C606.125 35.7085 605.096 35.9163 604.002 35.9163C602.907 35.9163 601.877 35.7086 600.914 35.293ZM608.729 32.7288C610.021 31.4372 610.667 29.8608 610.667 27.9997C610.667 26.1386 610.021 24.5622 608.729 23.2705C607.438 21.9788 605.861 21.333 604 21.333C602.139 21.333 600.563 21.9788 599.271 23.2705C597.979 24.5622 597.333 26.1386 597.333 27.9997C597.333 29.8608 597.979 31.4372 599.271 32.7288C600.563 34.0205 602.139 34.6663 604 34.6663C605.861 34.6663 607.438 34.0205 608.729 32.7288ZM600.755 31.2468C599.863 30.3559 599.417 29.2742 599.417 28.0015C599.417 26.7289 599.862 25.6465 600.753 24.7545C601.644 23.8624 602.726 23.4163 603.998 23.4163C605.271 23.4163 606.353 23.8618 607.245 24.7526C608.137 25.6434 608.583 26.7252 608.583 27.9978C608.583 29.2704 608.138 30.3528 607.247 31.2449C606.356 32.137 605.275 32.583 604.002 32.583C602.729 32.583 601.647 32.1376 600.755 31.2468ZM606.354 30.3538C607.007 29.7011 607.333 28.9163 607.333 27.9997C607.333 27.083 607.007 26.2983 606.354 25.6455C605.702 24.9927 604.917 24.6663 604 24.6663C603.083 24.6663 602.299 24.9927 601.646 25.6455C600.993 26.2983 600.667 27.083 600.667 27.9997C600.667 28.9163 600.993 29.7011 601.646 30.3538C602.299 31.0066 603.083 31.333 604 31.333C604.917 31.333 605.702 31.0066 606.354 30.3538ZM603.12 28.8803C602.873 28.634 602.75 28.3405 602.75 27.9997C602.75 27.6588 602.873 27.3653 603.12 27.119C603.366 26.8728 603.659 26.7497 604 26.7497C604.341 26.7497 604.635 26.8728 604.881 27.119C605.127 27.3653 605.25 27.6588 605.25 27.9997C605.25 28.3405 605.127 28.634 604.881 28.8803C604.635 29.1265 604.341 29.2497 604 29.2497C603.659 29.2497 603.366 29.1265 603.12 28.8803Z"
      fill="currentColor"
    />
  </svg>
);

const CustomContactIcon = (props) => (
  <svg viewBox="807 18 20 20" width={20} height={20} fill="none" {...props}>
    <path
      d="M817 32.6954C816.137 32.6954 815.305 32.8437 814.506 33.1402C813.707 33.4367 812.97 33.8868 812.296 34.4904V34.6186C812.318 34.6347 812.339 34.6467 812.36 34.6546C812.382 34.6627 812.406 34.6667 812.433 34.6667H821.551C821.578 34.6667 821.601 34.6627 821.619 34.6546C821.638 34.6467 821.658 34.6347 821.679 34.6186V34.4904C821.016 33.8868 820.287 33.4367 819.493 33.1402C818.7 32.8437 817.868 32.6954 817 32.6954ZM811.167 33.8206C811.917 33.0845 812.788 32.5047 813.781 32.0811C814.774 31.6574 815.847 31.4456 817 31.4456C818.153 31.4456 819.226 31.6574 820.219 32.0811C821.212 32.5047 822.083 33.0845 822.833 33.8206V23.2565C822.833 23.1923 822.806 23.1336 822.753 23.0802C822.7 23.0267 822.641 23 822.577 23H811.423C811.359 23 811.3 23.0267 811.247 23.0802C811.193 23.1336 811.167 23.1923 811.167 23.2565V33.8206ZM815.082 28.6683C814.555 28.1415 814.292 27.5021 814.292 26.75C814.292 25.9979 814.555 25.3585 815.082 24.8317C815.608 24.305 816.248 24.0417 817 24.0417C817.752 24.0417 818.391 24.305 818.918 24.8317C819.445 25.3585 819.708 25.9979 819.708 26.75C819.708 27.5021 819.445 28.1415 818.918 28.6683C818.391 29.195 817.752 29.4583 817 29.4583C816.248 29.4583 815.608 29.195 815.082 28.6683ZM818.029 27.7796C818.315 27.4939 818.458 27.1507 818.458 26.75C818.458 26.3493 818.315 26.0061 818.029 25.7204C817.744 25.4346 817.401 25.2917 817 25.2917C816.599 25.2917 816.256 25.4346 815.97 25.7204C815.684 26.0061 815.542 26.3493 815.542 26.75C815.542 27.1507 815.684 27.4939 815.97 27.7796C816.256 28.0654 816.599 28.2083 817 28.2083C817.401 28.2083 817.744 28.0654 818.029 27.7796ZM811.423 35.9167C811.002 35.9167 810.646 35.7708 810.354 35.4792C810.062 35.1875 809.917 34.8312 809.917 34.4102V23.2565C809.917 22.8355 810.062 22.4792 810.354 22.1875C810.646 21.8958 811.002 21.75 811.423 21.75H812.577V19.9873H813.859V21.75H820.173V19.9873H821.423V21.75H822.577C822.998 21.75 823.354 21.8958 823.646 22.1875C823.937 22.4792 824.083 22.8355 824.083 23.2565V34.4102C824.083 34.8312 823.937 35.1875 823.646 35.4792C823.354 35.7708 822.998 35.9167 822.577 35.9167H811.423Z"
      fill="currentColor"
    />
  </svg>
);

const CustomKanbanIcon = (props) => (
  <svg viewBox="538 14 20 20" width={16} height={16} fill="none" {...props}>
    <path
      d="M543.833 28.1667H545.5V19.8333H543.833V28.1667ZM550.5 26.5H552.167V19.8333H550.5V26.5ZM547.167 24H548.833V19.8333H547.167V24ZM542.167 31.5C541.708 31.5 541.316 31.3368 540.99 31.0104C540.663 30.684 540.5 30.2917 540.5 29.8333V18.1667C540.5 17.7083 540.663 17.316 540.99 16.9896C541.316 16.6632 541.708 16.5 542.167 16.5H553.833C554.292 16.5 554.684 16.6632 555.01 16.9896C555.337 17.316 555.5 17.7083 555.5 18.1667V29.8333C555.5 30.2917 555.337 30.684 555.01 31.0104C554.684 31.3368 554.292 31.5 553.833 31.5H542.167ZM542.167 29.8333H553.833V18.1667H542.167V29.8333Z"
      fill="currentColor"
    />
  </svg>
);

// Task Status Dropdown Component
const StatusSelect = ({ task, onUpdate, query }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const statuses = ["Pending", "In Progress", "Completed"];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBadgeColor = (status) => {
    if (status === "Completed")
      return "bg-green-100 text-green-800 border-green-200";
    if (status === "In Progress")
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (status === "Pending")
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${getBadgeColor(
          task.status,
        )} border-transparent hover:brightness-95`}
      >
        {task.status === "Completed" && <CheckCircle className="w-3 h-3" />}
        <span className="truncate max-w-[100px]">
          <HighlightText text={task.status || "Pending"} query={query} />
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 left-0 max-h-60 overflow-y-auto">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(task._id, status);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between group transition-colors"
            >
              <span
                className={
                  task.status === status ? "font-medium text-blue-600" : ""
                }
              >
                {status}
              </span>
              {task.status === status && (
                <CheckSquare className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Meeting Priority Dropdown Component
const MeetingStatusSelect = ({ meeting, onUpdate, query }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const statuses = ["scheduled", "completed", "cancelled", "no-show"];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBadgeColor = (status) => {
    if (status === "completed")
      return "bg-green-100 text-green-800 border-green-200";
    if (status === "scheduled")
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (status === "cancelled")
      return "bg-red-100 text-red-800 border-red-200";
    if (status === "no-show")
      return "bg-gray-100 text-gray-800 border-gray-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ") : "");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${getBadgeColor(
          meeting.status,
        )} border-transparent hover:brightness-95`}
      >
        {meeting.status === "completed" && <CheckCircle className="w-3 h-3" />}
        <span className="truncate max-w-[100px]">
          <HighlightText text={capitalize(meeting.status || "scheduled")} query={query} />
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 left-0 max-h-60 overflow-y-auto">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(meeting._id, status);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between group transition-colors"
            >
              <span
                className={
                  meeting.status === status ? "font-medium text-blue-600" : ""
                }
              >
                {capitalize(status)}
              </span>
              {meeting.status === status && (
                <CheckSquare className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MeetingPriorityDropdown = ({ meeting, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const priorities = ["low", "medium", "high"];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getBadgeColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-50 text-red-600 border-red-100";
      case "medium":
        return "bg-yellow-50 text-yellow-600 border-yellow-100";
      case "low":
        return "bg-green-50 text-green-600 border-green-100";
      default:
        return "bg-gray-50 text-gray-500 border-gray-100";
    }
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${getBadgeColor(
          meeting.priority || "medium",
        )} border-transparent hover:brightness-95`}
      >
        <span className="truncate max-w-[100px]">
          {capitalize(meeting.priority || "medium")}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 left-0 overflow-y-auto">
          {priorities.map((priority) => (
            <button
              key={priority}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(meeting._id, priority);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between group transition-colors"
            >
              <span
                className={
                  meeting.priority === priority
                    ? "font-medium text-blue-600"
                    : ""
                }
              >
                {capitalize(priority)}
              </span>
              {meeting.priority === priority && (
                <CheckSquare className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// The app scales its desktop layout via a dynamic CSS `zoom` on <html> (App.jsx).
// getBoundingClientRect() returns UNSCALED layout coordinates while portal overlays on
// document.body render in visual space, so rect-derived positions must be multiplied by
// this zoom factor to line up on screen.
const getRootZoom = () => {
  if (typeof window === "undefined") return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z && !Number.isNaN(z) ? z : 1;
};

const getAncestorZoom = (el) => {
  let z = 1;
  let node = el;
  while (node && node.nodeType === 1) {
    const cz = parseFloat(getComputedStyle(node).zoom);
    if (cz && !Number.isNaN(cz)) z *= cz;
    node = node.parentElement;
  }
  return z || 1;
};

function Tasks() {
  // Tab state
  const [activeTab, setActiveTab] = useState("tasks"); // "tasks" or "meetings"
  const [showKanban, setShowKanban] = useState(false);
  const [showMeetingCalendar, setShowMeetingCalendar] = useState(false);
  const meetingToggleRefs = useRef({});
  const [meetingToggleIndicator, setMeetingToggleIndicator] = useState({ left: 4, width: 32 });
  useEffect(() => {
    const key = showMeetingCalendar ? "calendar" : "list";
    const el = meetingToggleRefs.current[key];
    if (el) {
      setMeetingToggleIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [showMeetingCalendar, activeTab]);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "Pending",
    relatedTo: "",
    relationModel: "Company",
    users: [],
  });
  // Available Task Statuses for Kanban
  const taskStatuses = ["Pending", "In Progress", "Completed"];

  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingModalMode, setMeetingModalMode] = useState("create");

  // Shared state
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [debouncedFilterStatus, setDebouncedFilterStatus] = useState("");

  // Bulk Selection for Tasks
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectionMode, setSelectionMode] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Bulk Selection for Meetings
  const [selectedMeetings, setSelectedMeetings] = useState([]);
  // Delays the bulk-strip's unmount so it can play a slide-out-right exit
  // animation on deselect (mirroring the slide-in entrance), same as Companies.
  const [showBulkStrip, setShowBulkStrip] = useState(false);
  const [bulkStripClosing, setBulkStripClosing] = useState(false);
  useEffect(() => {
    const selectedCount = activeTab === "tasks" ? selectedTasks.length : selectedMeetings.length;
    const active = selectionMode && selectedCount > 0;
    if (active) {
      setBulkStripClosing(false);
      setShowBulkStrip(true);
    } else if (showBulkStrip) {
      setBulkStripClosing(true);
      const t = setTimeout(() => {
        setShowBulkStrip(false);
        setBulkStripClosing(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [activeTab, selectionMode, selectedTasks.length, selectedMeetings.length]);
  const [showMeetingBulkActions, setShowMeetingBulkActions] = useState(false);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("task"); // "task" or "meeting"
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [showVideoTutorial, setShowVideoTutorial] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [userFilter, setUserFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [activeAdvancedFilters, setActiveAdvancedFilters] = useState([]);
  // Backend only supports exact-day matching on dueDate for tasks/meetings
  // pagination (no generic per-field querying yet), so this panel is scoped
  // to that one field rather than offering columns it can't actually filter.
  const advancedFilterColumns = [{ key: "dueDate", label: "Due Date (YYYY-MM-DD)" }];
  const applyAdvancedTaskFilters = (newFilters) => {
    setActiveAdvancedFilters(newFilters);
    const dueDateFilter = newFilters.find((f) => f.column === "dueDate");
    setDateFilter(dueDateFilter?.value || "");
  };

  // Debounced states
  const [debouncedUserFilter, setDebouncedUserFilter] = useState("");
  const [debouncedDateFilter, setDebouncedDateFilter] = useState("");

  const location = useLocation();
  const { state } = location;
  useEffect(() => {
    if (state && state.tab && state.tab !== activeTab) {
      setActiveTab(state.tab);
    }
  }, [state]);

  const showTaskLoadingSkeleton = useMinDelay(loading && tasks.length === 0, 300);
  const showMeetingLoadingSkeleton = useMinDelay(loading && meetings.length === 0, 300);

  // Pagination & Sorting for Tasks
  const [taskPagination, setTaskPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 50,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [taskSortConfig, setTaskSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  // Pagination & Sorting for Meetings
  const [meetingPagination, setMeetingPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 50,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [taskColumnSizing, setTaskColumnSizing] = useState({});
  const [meetingColumnSizing, setMeetingColumnSizing] = useState({});
  const [meetingSortConfig, setMeetingSortConfig] = useState({
    key: "scheduledAt",
    direction: "desc",
  });

  // Column pin/hide/reorder + row-actions menu — shared across the Tasks and
  // Meetings tables (only one is ever visible at a time), same pattern as
  // Companies/Contacts/Deals.
  const [pinnedColumns, setPinnedColumns] = useState([]); // [{ key, side }]
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [columnOrder, setColumnOrder] = useState([]);
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

  const pinColumnToSide = (colKey, side) => {
    setPinnedColumns((prev) => [...prev.filter((p) => p.key !== colKey), { key: colKey, side }]);
  };
  const unpinColumn = (colKey) => {
    setPinnedColumns((prev) => prev.filter((p) => p.key !== colKey));
  };
  const getColumnPinSide = (colKey) => pinnedColumns.find((p) => p.key === colKey)?.side || null;
  const hideColumn = (colKey) => setHiddenColumns((prev) => [...prev, colKey]);

  const reorderColumns = (draggedKey, targetKey, fallbackOrder) => {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;
    const base = columnOrder.length ? columnOrder : fallbackOrder;
    const order = base.includes(draggedKey) ? [...base] : [...base, draggedKey];
    const from = order.indexOf(draggedKey);
    const to = order.indexOf(targetKey);
    if (from === -1 || to === -1) return;
    order.splice(from, 1);
    order.splice(to, 0, draggedKey);
    setColumnOrder(order);
  };

  const startColumnDrag = (e, colId, label, previewRows, fallbackOrder = []) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]")) return;

    if (e.detail === 1) {
      e.stopPropagation();
      if (openColMenuKey === colId) {
        setOpenColMenuKey(null);
        setColMenuPos(null);
        return;
      }
      const th = e.currentTarget;
      const rect = th.getBoundingClientRect();
      let calculatedLeft = rect.right - 190;
      if (th.cellIndex === th.parentNode.cells.length - 1) {
        calculatedLeft -= 80;
      }
      setColMenuPos({ top: rect.bottom + 4, left: calculatedLeft });
      setOpenColMenuKey(colId);
      return;
    }

    const th = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const DRAG_THRESHOLD = 5;
    const dragState = { started: false, offsetX: 0, offsetY: 0, zGhost: 1 };

    const positionGhost = (clientX, clientY) => {
      const el = ghostElRef.current;
      if (!el) return;
      const visualTop = clientY - dragState.offsetY;
      const visualLeft = clientX - dragState.offsetX;
      el.style.top = `${visualTop / dragState.zGhost}px`;
      el.style.left = `${visualLeft / dragState.zGhost}px`;
      el.style.maxHeight = `${Math.max(100, window.innerHeight - visualTop - 72) / dragState.zGhost}px`;
    };

    const updateDragOver = (clientX, clientY) => {
      const elAtPoint = document.elementFromPoint(clientX, clientY);
      const thAtPoint = elAtPoint?.closest("th[data-col-id]");
      const overKey = thAtPoint?.getAttribute("data-col-id") || null;
      if (dragOverRef.current !== overKey) {
        dragOverRef.current = overKey;
        setDragOverColKey(overKey);
      }
    };

    const beginDrag = () => {
      dragState.started = true;
      window.getSelection?.()?.removeAllRanges();

      const rect = th.getBoundingClientRect();
      dragState.zGhost = getAncestorZoom(document.body);
      dragState.offsetX = startX - rect.left;
      dragState.offsetY = startY - rect.top;

      dragOverRef.current = null;
      setDraggedColKey(colId);
      setDragOverColKey(null);
      document.body.style.userSelect = "none";
      setDragGhost({
        label,
        previewRows,
        offsetX: dragState.offsetX,
        offsetY: dragState.offsetY,
        width: rect.width / dragState.zGhost,
        height: rect.height / dragState.zGhost,
      });

      requestAnimationFrame(() => positionGhost(startX, startY));
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragState.started) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        e.preventDefault();
        beginDrag();
      }
      positionGhost(moveEvent.clientX, moveEvent.clientY);
      updateDragOver(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (!dragState.started) return;
      document.body.style.userSelect = "";
      const overKey = dragOverRef.current;
      if (overKey && overKey !== colId) {
        reorderColumns(colId, overKey, columnOrder.length ? columnOrder : fallbackOrder);
      }
      dragOverRef.current = null;
      setDraggedColKey(null);
      setDragOverColKey(null);
      setDragGhost(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [openColMenuKey, setOpenColMenuKey] = useState(null);
  const [colMenuPos, setColMenuPos] = useState(null);
  const colMenuRef = useRef(null);

  const [openRowActionsId, setOpenRowActionsId] = useState(null);
  const [rowActionsPos, setRowActionsPos] = useState(null);
  const rowActionsRef = useRef(null);

  // Click outside listener for the row-actions ("⋮") menu, matching Companies.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rowActionsRef.current && !rowActionsRef.current.contains(event.target)) {
        setOpenRowActionsId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock page scroll while a row-actions or column-options menu is open so the
  // background can't shift/scroll out from under the portal-positioned menu.
  // Any scroll/wheel/touch/keyboard-scroll attempt closes the menu instead of
  // moving the page.
  useEffect(() => {
    if (!openRowActionsId && !openColMenuKey) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
    const closeMenus = () => {
      setOpenRowActionsId(null);
      setRowActionsPos(null);
      setOpenColMenuKey(null);
      setColMenuPos(null);
    };
    const handleWheel = (e) => {
      e.preventDefault();
      closeMenus();
    };
    const handleTouchMove = () => closeMenus();
    const handleKeyDown = (e) => {
      if (SCROLL_KEYS.includes(e.key)) closeMenus();
    };
    const handleScroll = () => closeMenus();

    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true, capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("scroll", handleScroll, { capture: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("wheel", handleWheel, { capture: true });
      window.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [openRowActionsId, openColMenuKey]);

  // Debounce effects
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilterStatus(filterStatus), 300);
    return () => clearTimeout(timer);
  }, [filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUserFilter(userFilter), 300);
    return () => clearTimeout(timer);
  }, [userFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDateFilter(dateFilter), 300);
    return () => clearTimeout(timer);
  }, [dateFilter]);

  // Reset selection on filter/search/tab change
  useEffect(() => {
    exitSelectionMode();
    if (activeTab === "tasks") {
      setTaskPagination((prev) => ({ ...prev, currentPage: 1 }));
    } else {
      setMeetingPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
  }, [debouncedSearchTerm, debouncedFilterStatus, activeTab]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === "tasks") {
      fetchTasks();
    } else {
      fetchMeetings();
    }
  }, [
    activeTab,
    taskPagination.currentPage,
    taskPagination.limit,
    taskSortConfig,
    meetingPagination.currentPage,
    meetingPagination.limit,
    meetingSortConfig,
    debouncedSearchTerm,
    debouncedFilterStatus,
    debouncedUserFilter,
    debouncedDateFilter,
  ]);

  useEffect(() => {
    fetchRelatedData();
  }, []);

  const fetchRelatedData = async () => {
    try {
      const [comp, cont, dl, vend, usr] = await Promise.all([
        API.get("/companies"),
        API.get("/contacts"),
        API.get("/deals"),
        API.get("/vendors"),
        API.get("/auth/all-user"),
      ]);
      setCompanies(comp.data || []);
      setContacts(cont.data || []);
      setDeals(dl.data || []);
      setVendors(vend.data || []);
      setUsers(usr.data?.allUsers || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load related data");
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: taskPagination.currentPage,
        limit: taskPagination.limit,
        sortBy: taskSortConfig.key,
        sortOrder: taskSortConfig.direction,
      });
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
      if (debouncedFilterStatus) params.append("status", debouncedFilterStatus);
      if (debouncedUserFilter) params.append("user", debouncedUserFilter);
      if (debouncedDateFilter) params.append("dueDate", debouncedDateFilter);

      const res = await API.get(`/tasks/pagination?${params.toString()}`);
      setTasks(res.data.tasks || []);
      setTaskPagination((prev) => ({
        ...prev,
        ...res.data.pagination,
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: meetingPagination.currentPage,
        limit: meetingPagination.limit,
        sortBy: meetingSortConfig.key,
        sortOrder: meetingSortConfig.direction,
      });
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
      if (debouncedFilterStatus)
        params.append("priority", debouncedFilterStatus);
      if (debouncedUserFilter) params.append("user", debouncedUserFilter);
      if (debouncedDateFilter)
        params.append("scheduledAt", debouncedDateFilter);

      const res = await API.get(`/meetings/pagination?${params.toString()}`);
      setMeetings(res.data.meetings || []);
      setMeetingPagination((prev) => ({
        ...prev,
        ...res.data.pagination,
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load meetings");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  // "Select All" grabs every task/meeting ID matching the current
  // search/filters straight from the database (not just the loaded page of
  // up to `limit` rows). "Deselect All" is its counterpart: it doesn't clear
  // the selection outright (that's what "Clear" does) — it steps back down
  // to only the rows on the current page.
  const handleSelectAllAcrossPages = async () => {
    try {
      if (activeTab === "tasks") {
        const params = new URLSearchParams({ allIds: "true" });
        if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
        if (debouncedFilterStatus) params.append("status", debouncedFilterStatus);
        if (debouncedUserFilter) params.append("user", debouncedUserFilter);
        if (debouncedDateFilter) params.append("dueDate", debouncedDateFilter);
        const res = await API.get(`/tasks/pagination?${params.toString()}`);
        setSelectedTasks(res.data.ids || []);
      } else {
        const params = new URLSearchParams({ allIds: "true" });
        if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
        if (debouncedFilterStatus) params.append("priority", debouncedFilterStatus);
        if (debouncedUserFilter) params.append("user", debouncedUserFilter);
        if (debouncedDateFilter) params.append("scheduledAt", debouncedDateFilter);
        const res = await API.get(`/meetings/pagination?${params.toString()}`);
        setSelectedMeetings(res.data.ids || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to select all rows");
    }
  };

  const handleDeselectAllExtra = () => {
    if (activeTab === "tasks") {
      setSelectedTasks(tasks.map((t) => t._id));
    } else {
      setSelectedMeetings(meetings.map((m) => m._id));
    }
  };


  // Task handlers
  const toggleTaskForm = () => {
    if (showTaskForm) resetTaskForm();
    setShowTaskForm(!showTaskForm);
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      dueDate: "",
      status: "Pending",
      relatedTo: "",
      relationModel: "Company",
      users: [],
    });
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return toast.error("Title is required");

    try {
      setLoading(true);
      if (taskForm._id) {
        await API.put(`/tasks/${taskForm._id}`, taskForm);
        toast.success("Task updated");
      } else {
        await API.post("/tasks", taskForm);
        toast.success("Task created");
      }
      await fetchTasks();
      setShowTaskForm(false);
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskEdit = (task) => {
    setTaskForm({
      _id: task._id || task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.substring(0, 10),
      status: task.status || "Pending",
      relatedEntities:
        Array.isArray(task.relatedEntities) && task.relatedEntities.length
          ? task.relatedEntities.map((e) => ({
            entityModel: e.entityModel,
            entityId: e.entityId?._id || e.entityId?.id || e.entityId,
          }))
          : task.relatedTo && task.relationModel
            ? [{ entityModel: task.relationModel, entityId: task.relatedTo }]
            : [{ entityModel: "Company", entityId: "" }],

      users: Array.isArray(task.users)
        ? task.users.map((u) => u.id || u._id)
        : [],
    });

    setShowTaskForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTaskStatusChange = async (id, status) => {
    try {
      await API.put(`/tasks/${id}/status`, { status });
      fetchTasks();
      toast.success("Status updated");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Update failed");
      }
    }
  };

  const handleTaskMove = async (taskId, newStatus, oldStatus) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
    );
    try {
      await API.put(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success("Task status updated");
    } catch (err) {
      console.error("Move failed", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update status");
      }
      fetchTasks(); // Revert
    }
  };

  const handleSelectAllMeetings = () => {
    setSelectedMeetings((prev) =>
      prev.length === meetings.length ? [] : meetings.map((m) => m._id),
    );
  };

  const handleMeetingStatusChange = async (id, status) => {
    try {
      setMeetings((prev) =>
        prev.map((m) => (m._id === id ? { ...m, status } : m)),
      );
      await API.put(`/meetings/${id}`, { status });
      toast.success("Status updated");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Update failed");
      }
      fetchMeetings(); // Revert
    }
  };

  const handleMeetingPriorityChange = async (id, priority) => {
    try {
      setMeetings((prev) =>
        prev.map((m) => (m._id === id ? { ...m, priority } : m)),
      );
      // Using generic update route or specific if available
      await API.put(`/meetings/${id}`, { priority });
      toast.success("Priority updated");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Update failed");
      }
      fetchMeetings(); // Revert
    }
  };

  // Meeting handlers
  const toggleMeetingForm = () => {
    if (showMeetingForm) {
      setSelectedMeeting(null);
      setMeetingModalMode("create");
    }
    setShowMeetingForm(!showMeetingForm);
  };

  const handleMeetingEdit = (meeting) => {
    setSelectedMeeting(meeting);
    setMeetingModalMode("view");
    setShowMeetingForm(true);
  };

  const handleMeetingSave = async (form) => {
    try {
      if (selectedMeeting) {
        await API.put(`/meetings/${selectedMeeting._id}`, form);
        toast.success("Meeting updated");
      } else {
        await API.post("/meetings", form);
        toast.success("Meeting created");
      }
      await fetchMeetings();
      setShowMeetingForm(false);
      setSelectedMeeting(null);
      exitSelectionMode();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    }
  };

  const handleMeetingDelete = async (id) => {
    try {
      await API.delete(`/meetings/${id}`);
      await fetchMeetings();
      toast.success("Meeting deleted");
      exitSelectionMode();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Delete failed");
      }
    }
  };

  // Generic delete handler
  const handleDelete = (id, type) => {
    setItemToDelete(id);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const toastId = toast.loading("Deleting...");
    try {
      if (deleteType === "task") {
        await API.delete(`/tasks/${itemToDelete}`);
        await fetchTasks();
      } else {
        await API.delete(`/meetings/${itemToDelete}`);
        await fetchMeetings();
      }
      toast.success(
        `${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted`,
        { id: toastId },
      );
      exitSelectionMode();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.", { id: toastId });
      } else {
        toast.error(err.response?.data?.error || "Delete failed", { id: toastId });
      }
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  // Selection handlers
  const taskFieldConfig = {
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["Pending", "In Progress", "Completed"],
      },
      {
        key: "dueDate",
        label: "Due Date",
        type: "text",
      },
    ],
  };

  const handleBulkUpdateTasks = async ({ field, value, itemIds }) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => API.put(`/tasks/${id}`, { [field]: value })),
      );
      await fetchTasks();
      setSelectedTasks([]);
      setShowBulkActions(false);
      toast.success(`Successfully updated ${itemIds.length} tasks`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeleteTasks = async (itemIds) => {
    setBulkLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/tasks/${id}`)));
      await fetchTasks();
      setSelectedTasks([]);
      setShowBulkDeleteModal(false);
      toast.success(`Successfully deleted ${itemIds.length} tasks`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const meetingFieldConfig = {
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["scheduled", "completed", "cancelled", "no-show"],
      },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["low", "medium", "high"],
      },
    ],
  };

  const handleBulkUpdateMeetings = async ({ field, value, itemIds }) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        itemIds.map((id) => API.put(`/meetings/${id}`, { [field]: value })),
      );
      await fetchMeetings();
      setSelectedMeetings([]);
      setShowMeetingBulkActions(false);
      toast.success(`Successfully updated ${itemIds.length} meetings`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeleteMeetings = async (itemIds) => {
    setBulkLoading(true);
    try {
      await Promise.all(itemIds.map((id) => API.delete(`/meetings/${id}`)));
      await fetchMeetings();
      setSelectedMeetings([]);
      setShowBulkDeleteModal(false);
      toast.success(`Successfully deleted ${itemIds.length} meetings`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Bulk delete failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = () => {
    const dataToExport = activeTab === "tasks" ? tasks : meetings;
    const filename =
      activeTab === "tasks" ? "tasks_export.xlsx" : "meetings_export.xlsx";

    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Flatten data for export
    const flatData = dataToExport.map((item) => {
      const flatItem = { ...item };

      // Handle nested objects
      if (flatItem.relatedEntities && Array.isArray(flatItem.relatedEntities)) {
        flatItem.relatedEntities = flatItem.relatedEntities
          .map(
            (e) =>
              `${e.entityModel}: ${e.entityId?.name || e.entityId?.title || e.entityId}`,
          )
          .join(", ");
      }

      if (flatItem.participants && Array.isArray(flatItem.participants)) {
        flatItem.participants = flatItem.participants
          .map((p) => p.name || p.email)
          .join(", ");
      }

      if (flatItem.users && Array.isArray(flatItem.users)) {
        flatItem.users = flatItem.users
          .map((u) => u.name || u.email)
          .join(", ");
      }

      // Format dates
      if (flatItem.dueDate)
        flatItem.dueDate = new Date(flatItem.dueDate).toLocaleDateString();
      if (flatItem.scheduledAt)
        flatItem.scheduledAt = new Date(flatItem.scheduledAt).toLocaleString();
      if (flatItem.createdAt)
        flatItem.createdAt = new Date(flatItem.createdAt).toLocaleDateString();
      if (flatItem.updatedAt)
        flatItem.updatedAt = new Date(flatItem.updatedAt).toLocaleDateString();

      // Remove internal fields
      delete flatItem.__v;
      delete flatItem._id;
      delete flatItem.organization;

      return flatItem;
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
    toast.success(
      `${activeTab === "tasks" ? "Tasks" : "Meetings"} exported successfully`,
    );
  };

  const handleSelectTask = (taskId) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const handleSelectAllTasks = () => {
    setSelectedTasks((prev) =>
      prev.length === tasks.length ? [] : tasks.map((t) => t._id),
    );
  };

  const handleSelectMeeting = (meetingId) => {
    setSelectedMeetings((prev) =>
      prev.includes(meetingId)
        ? prev.filter((id) => id !== meetingId)
        : [...prev, meetingId],
    );
  };

  const handleSelectAll = () => {
    if (activeTab === "tasks") {
      if (selectedTasks.length === tasks.length && tasks.length > 0) {
        setSelectedTasks([]);
      } else {
        setSelectedTasks(tasks.map((t) => t._id));
      }
    } else {
      if (selectedMeetings.length === meetings.length && meetings.length > 0) {
        setSelectedMeetings([]);
      } else {
        setSelectedMeetings(meetings.map((m) => m._id));
      }
    }
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(true);
    setSelectedTasks([]);
    setSelectedMeetings([]);
    setShowBulkActions(false);
    setShowMeetingBulkActions(false);
  };

  // Long press handlers
  const handleMouseDown = (id) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      if (activeTab === "tasks") {
        handleSelectTask(id);
      } else {
        handleSelectMeeting(id);
      }
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const handleTouchStart = (id) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      if (activeTab === "tasks") {
        handleSelectTask(id);
      } else {
        handleSelectMeeting(id);
      }
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const getMeetingEntityName = (meeting) => {
    if (meeting.contact) {
      return typeof meeting.contact === "object"
        ? meeting.contact.name
        : "Contact";
    } else if (meeting.company) {
      return typeof meeting.company === "object"
        ? meeting.company.name
        : "Company";
    } else if (meeting.vendor) {
      return typeof meeting.vendor === "object"
        ? meeting.vendor.name
        : "Vendor";
    }
    return "N/A";
  };

  const getMeetingEntityType = (meeting) => {
    if (meeting.contact) return "Contact";
    if (meeting.company) return "Company";
    if (meeting.vendor) return "Vendor";
    return "Unknown";
  };
  // Returns a plain string (not JSX) so callers can run it through
  // HighlightText for search-match highlighting, same as getCompanyName.
  const getRelatedToName = (task) => {
    if (
      task.relatedEntities &&
      Array.isArray(task.relatedEntities) &&
      task.relatedEntities.length > 0
    ) {
      return task.relatedEntities
        .map((entity) => {
          const entityData = entity.entityId;

          if (entityData && typeof entityData === "object") {
            return entityData.name || entityData.title || "N/A";
          }
          const entityId = entityData;
          const map = {
            Company: companies,
            Contact: contacts,
            Deal: deals,
            Vendor: vendors,
          };
          const options = map[entity.entityModel] || [];
          const related = options.find((item) => item._id === entityId);
          return related ? related.name || related.title || "N/A" : "N/A";
        })
        .join(", ");
    }

    if (task.relatedTo && task.relationModel) {
      const map = {
        Company: companies,
        Contact: contacts,
        Deal: deals,
        Vendor: vendors,
      };
      const options = map[task.relationModel] || [];
      const relatedToId = task.relatedTo?._id || task.relatedTo;
      const related = options.find((item) => item._id === relatedToId);
      return related ? related.name || related.title || "N/A" : "N/A";
    }

    return "N/A";
  };

  const getCompanyName = (task) => {
    if (task.relatedEntities && Array.isArray(task.relatedEntities) && task.relatedEntities.length > 0) {
      const companyEntities = task.relatedEntities.filter((entity) => entity.entityModel === "Company");
      if (companyEntities.length === 0) return "-";
      return companyEntities
        .map((entity) => {
          const entityData = entity.entityId;
          if (entityData && typeof entityData === "object") {
            return entityData.name || entityData.title || "N/A";
          }
          const related = companies.find((item) => item._id === entityData);
          return related?.name || "N/A";
        })
        .join(", ");
    }

    if (task.relatedTo && task.relationModel === "Company") {
      const relatedToId = task.relatedTo?._id || task.relatedTo;
      const related = companies.find((item) => item._id === relatedToId);
      if (related) return related.name || "N/A";
      if (task.relatedTo && typeof task.relatedTo === "object") return task.relatedTo.name || "N/A";
      return "N/A";
    }

    return "-";
  };

  const getAssignedUsers = (task) => {
    const ids = Array.isArray(task.users)
      ? task.users.map((u) => u._id || u)
      : task.user
        ? [task.user._id || task.user]
        : [];
    if (!ids.length) return "Self Assigned";
    const names = ids
      .map(
        (id) =>
          users.find((u) => u._id === id)?.name ||
          users.find((u) => u._id === id)?.email,
      )
      .filter(Boolean);
    if (!names.length) return "Self Assigned";
    return names.length > 3
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
      : names.join(", ");
  };

  const getMeetingParticipants = (meeting) => {
    if (!meeting.participants || meeting.participants.length === 0)
      return "No participants";
    const names = meeting.participants
      .map((p) =>
        typeof p === "object" ? p.name : users.find((u) => u._id === p)?.name,
      )
      .filter(Boolean);
    if (!names.length) return "No participants";
    return names.length > 3
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
      : names.join(", ");
  };

  const getStatusColor = (status) => {
    if (status === "Completed")
      return "bg-green-100 text-green-800 border-green-200";
    if (status === "In Progress")
      return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  const getMeetingTypeIcon = (type) => {
    switch (type) {
      case "video-call":
        return "ðŸŽ¥";
      case "phone-call":
        return "ðŸ“ž";
      default:
        return "ðŸ¢";
    }
  };

  // Sorting handlers
  const handleSort = (key) => {
    if (activeTab === "tasks") {
      setTaskSortConfig((prev) => ({
        key,
        direction:
          prev.key === key && prev.direction === "asc" ? "desc" : "asc",
      }));
      setTaskPagination((prev) => ({ ...prev, currentPage: 1 }));
    } else {
      setMeetingSortConfig((prev) => ({
        key,
        direction:
          prev.key === key && prev.direction === "asc" ? "desc" : "asc",
      }));
      setMeetingPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
    exitSelectionMode();
  };

  const SortIcons = ({ field, config }) => (
    <div className="flex flex-col ml-1">
      <ChevronUp
        className={`w-3 h-3 ${config.key === field && config.direction === "asc" ? "text-blue-600" : "text-gray-400"}`}
      />
      <ChevronDown
        className={`w-3 h-3 -mt-1 ${config.key === field && config.direction === "desc" ? "text-blue-600" : "text-gray-400"}`}
      />
    </div>
  );

  // Reusable header: label (sortable via click) + dropdown-menu trigger
  // (Pin Left / Pin Right / Sort Asc / Sort Desc / Hide Column), matching
  // Companies/Contacts/Deals exactly.
  // Display labels + drag-ghost preview values for the column-drag-reorder
  // feature — must resolve the SAME human-readable text shown in the real
  // header/cells, never raw object/array field values (which stringify to
  // "[object Object]").
  const TASK_COLUMN_LABELS = {
    title: "Task",
    relatedTo: "Related To",
    company: "Company",
    status: "Status",
    users: "Assigned Users",
    dueDate: "Due Date",
  };
  const getTaskColumnPreviewValue = (task, colId) => {
    switch (colId) {
      case "title":
        return task.title || "-";
      case "relatedTo":
        return getRelatedToName(task);
      case "company":
        return getCompanyName(task);
      case "status":
        return task.status || "-";
      case "users":
        return getAssignedUsers(task);
      case "dueDate":
        return task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No Date";
      default:
        return "-";
    }
  };

  const MEETING_COLUMN_LABELS = {
    title: "Meeting",
    participants: "Contact",
    scheduledAt: "Date & Time",
    status: "Status",
    url: "URL",
  };
  const getMeetingColumnPreviewValue = (meeting, colId) => {
    switch (colId) {
      case "title":
        return meeting.title || "-";
      case "participants":
        return getMeetingEntityName(meeting);
      case "scheduledAt":
        return meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : "No Date";
      case "status":
        return meeting.status || "-";
      case "url":
        return meeting.location || "-";
      default:
        return "-";
    }
  };

  const renderHeaderMenu = (colKey, label, { sortable = true } = {}) => {
    const isMenuOpen = openColMenuKey === colKey;
    const pinSide = getColumnPinSide(colKey);
    return (
      <div className="flex items-center justify-between w-full group">
        <div
          className="flex items-center gap-1.5 flex-1 overflow-hidden cursor-pointer select-none"
          onClick={(e) => {
            e.stopPropagation();
            if (sortable) handleSort(colKey);
          }}
        >
          <span className="truncate" title={label}>{label}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isMenuOpen) {
              setOpenColMenuKey(null);
              setColMenuPos(null);
              return;
            }
            // rect is VISUAL px; the menu is portaled into document.body, which
            // paints inside the dynamic <html> zoom, so rect-derived values must be
            // divided by that zoom (same correction as the drag-ghost above).
            const zMenu = getAncestorZoom(document.body);
            const MENU_W = 160;
            const rect = e.currentTarget.getBoundingClientRect();
            let calcLeft = rect.right / zMenu - MENU_W;
            calcLeft = Math.min(calcLeft, window.innerWidth / zMenu - MENU_W - 8);
            calcLeft = Math.max(calcLeft, 8);
            setColMenuPos({ top: rect.bottom / zMenu + 4, left: calcLeft });
            setOpenColMenuKey(colKey);
          }}
          className="ml-1 p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0"
          title="Column options"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {isMenuOpen && colMenuPos && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenColMenuKey(null); setColMenuPos(null); }} />
            <div
              ref={colMenuRef}
              style={{ position: "fixed", top: colMenuPos.top, left: colMenuPos.left }}
              className="w-[160px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right"
            >
              <button
                onClick={() => {
                  setOpenColMenuKey(null);
                  setColMenuPos(null);
                  pinSide === "left" ? unpinColumn(colKey) : pinColumnToSide(colKey, "left");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap ${pinSide === "left" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
              >
                {pinSide === "left" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />}
                Pin to Left
              </button>
              <button
                onClick={() => {
                  setOpenColMenuKey(null);
                  setColMenuPos(null);
                  pinSide === "right" ? unpinColumn(colKey) : pinColumnToSide(colKey, "right");
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap ${pinSide === "right" ? "bg-blue-50 text-blue-700" : "text-[#161618] hover:bg-gray-50"}`}
              >
                {pinSide === "right" ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-[#1C1B1F]" />}
                Pin to Right
              </button>

              {sortable && (
                <>
                  <button
                    onClick={() => {
                      setOpenColMenuKey(null);
                      setColMenuPos(null);
                      handleSort(colKey);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-[#1C1B1F]" />
                    Sort Ascending
                  </button>
                  <button
                    onClick={() => {
                      setOpenColMenuKey(null);
                      setColMenuPos(null);
                      handleSort(colKey);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-[#1C1B1F]" />
                    Sort Descending
                  </button>
                </>
              )}

              <div className="w-full border-t border-[#F1F1F5] my-0.5" />

              <button
                onClick={() => {
                  setOpenColMenuKey(null);
                  setColMenuPos(null);
                  hideColumn(colKey);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
              >
                <EyeOff className="w-3.5 h-3.5 text-[#1C1B1F]" />
                Hide Column
              </button>
            </div>
          </>,
          document.body,
        )}
      </div>
    );
  };

  // Reusable "⋮" row-actions menu: View / Edit / Delete, matching
  // Companies/Contacts/Deals exactly.
  const renderRowActionsMenu = (item, type) => {
    const isOpen = openRowActionsId === item._id;
    return (
      <div
        className="relative flex-shrink-0"
        ref={isOpen ? rowActionsRef : null}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setOpenRowActionsId(null);
              return;
            }
            setOpenRowActionsId(item._id);
          }}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          title="More actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 z-[9999] w-[160px] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenRowActionsId(null);
                type === "task" ? handleTaskEdit(item) : handleMeetingEdit(item);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 text-[#1C1B1F]" />
              View
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenRowActionsId(null);
                type === "task" ? handleTaskEdit(item) : handleMeetingEdit(item);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-[#161618] hover:bg-gray-50 whitespace-nowrap"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#1C1B1F]" />
              Edit
            </button>
            <div className="w-full border-t border-[#F1F1F5] my-0.5" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenRowActionsId(null);
                handleDelete(item._id, type);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal text-red-600 hover:bg-red-50 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const SortableHeader = ({ field, children }) => {
    const sortConfig =
      activeTab === "tasks" ? taskSortConfig : meetingSortConfig;

    return (
      <th
        onClick={() => handleSort(field)}
        className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none border-r border-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {children}
          <div className="flex flex-col">
            <ChevronUp
              className={`w-3 h-3 ${sortConfig.key === field && sortConfig.direction === "asc"
                ? "text-blue-600"
                : "text-gray-300"
                }`}
            />
            <ChevronDown
              className={`w-3 h-3 -mt-1 ${sortConfig.key === field && sortConfig.direction === "desc"
                ? "text-blue-600"
                : "text-gray-300"
                }`}
            />
          </div>
        </div>
      </th>
    );
  };

  const taskColumnHelper = createColumnHelper();
  const taskColumnsConfig = useMemo(
    () => [
      taskColumnHelper.display({
        id: "selection",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                tasks.length > 0 && selectedTasks.length === tasks.length
              }
              onChange={(e) => {
                e.stopPropagation();
                handleSelectAllTasks();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedTasks.includes(row.original._id)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectTask(row.original._id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      }),
      taskColumnHelper.accessor("title", {
        id: "title",
        size: 250,
        header: () => renderHeaderMenu("title", "Task"),
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="flex items-start gap-3 w-full overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaskStatusChange(
                    task._id,
                    task.status === "Completed" ? "Pending" : "Completed",
                  );
                }}
                className={`flex-shrink-0 mt-0.5 p-0.5 rounded-full transition-all duration-200 ${task.status === "Completed" ? "bg-green-100 text-green-600" : "text-gray-300 hover:text-green-500 hover:bg-green-50"}`}
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className={`font-medium text-gray-900 truncate ${task.status === "Completed" ? "line-through text-gray-400" : ""}`}
                  title={task.title}
                >
                  <HighlightText text={task.title} query={searchTerm} />
                </span>
                {task.description && (
                  <p
                    className={`text-xs text-gray-500 truncate mt-0.5 ${task.status === "Completed" ? "line-through text-gray-300" : ""}`}
                    title={task.description}
                  >
                    <HighlightText text={task.description} query={searchTerm} />
                  </p>
                )}
              </div>
            </div>
          );
        },
      }),
      taskColumnHelper.accessor("relatedTo", {
        id: "relatedTo",
        size: 200,
        header: () => renderHeaderMenu("relatedTo", "Related To"),
        cell: ({ row }) => (
          <div className="truncate text-gray-700 w-full" title={getRelatedToName(row.original)}>
            <HighlightText text={getRelatedToName(row.original)} query={searchTerm} />
          </div>
        ),
      }),
      taskColumnHelper.accessor("company", {
        id: "company",
        size: 180,
        header: () => renderHeaderMenu("company", "Company"),
        cell: ({ row }) => (
          <div className="truncate text-gray-700 w-full" title={getCompanyName(row.original)}>
            <HighlightText text={getCompanyName(row.original)} query={searchTerm} />
          </div>
        ),
      }),
      taskColumnHelper.accessor("status", {
        id: "status",
        size: 160,
        header: () => renderHeaderMenu("status", "Status"),
        cell: ({ row }) => (
          <div
            className="w-full flex items-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <StatusSelect
              task={row.original}
              onUpdate={handleTaskStatusChange}
              query={searchTerm}
            />
          </div>
        ),
      }),
      taskColumnHelper.accessor("users", {
        id: "users",
        size: 200,
        header: () => renderHeaderMenu("users", "Assigned Users", { sortable: false }),
        cell: ({ row }) => (
          <div
            className="truncate text-gray-700 w-full"
            title={getAssignedUsers(row.original)}
          >
            <HighlightText text={getAssignedUsers(row.original)} query={searchTerm} />
          </div>
        ),
      }),
      taskColumnHelper.accessor("dueDate", {
        id: "dueDate",
        size: 150,
        header: () => renderHeaderMenu("dueDate", "Due Date"),
        cell: ({ getValue }) => {
          const val = getValue();
          const text = val ? new Date(val).toLocaleDateString() : "No Date";
          return (
            <div
              className="truncate text-gray-700"
              title={text}
            >
              <HighlightText text={text} query={searchTerm} />
            </div>
          );
        },
      }),
    ],
    [
      tasks,
      selectedTasks,
      taskSortConfig,
      users,
      companies,
      contacts,
      deals,
      vendors,
      pinnedColumns,
      openColMenuKey,
      colMenuPos,
      openRowActionsId,
      rowActionsPos,
      searchTerm,
    ],
  );

  // Apply hide/pin/reorder on top of the base column defs — selection & actions
  // columns always stay in place; the rest respect hiddenColumns/columnOrder,
  // with left-pinned columns first and right-pinned columns last.
  // Orders/filters columns by pin+hide+drag state, then merges the row-actions
  // "⋮" trigger into whichever column ends up last (instead of a dedicated
  // Actions column), matching the DealsTable pattern.
  const orderColumns = (baseCols, itemType) => {
    const visibleCols = baseCols.filter(
      (col) => !hiddenColumns.includes(col.id) || col.id === "selection",
    );
    const selectionCol = visibleCols.find((c) => c.id === "selection");
    let middle = visibleCols.filter((c) => c.id !== "selection");
    if (columnOrder.length) {
      const rank = (id) => {
        const idx = columnOrder.indexOf(id);
        return idx === -1 ? columnOrder.length + middle.findIndex((c) => c.id === id) : idx;
      };
      middle = [...middle].sort((a, b) => rank(a.id) - rank(b.id));
    }
    const leftPinned = middle.filter((c) => getColumnPinSide(c.id) === "left");
    const rightPinned = middle.filter((c) => getColumnPinSide(c.id) === "right");
    const unpinned = middle.filter((c) => !getColumnPinSide(c.id));
    const ordered = [selectionCol, ...leftPinned, ...unpinned, ...rightPinned].filter(Boolean);

    const lastIdx = ordered.length - 1;
    if (lastIdx >= 0 && ordered[lastIdx].id !== "selection") {
      const lastCol = ordered[lastIdx];
      const originalCell = lastCol.cell;
      ordered[lastIdx] = {
        ...lastCol,
        cell: (ctx) => (
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="min-w-0 flex-1">
              {typeof originalCell === "function" ? originalCell(ctx) : originalCell}
            </div>
            {renderRowActionsMenu(ctx.row.original, itemType)}
          </div>
        ),
      };
    }
    return ordered;
  };

  const orderedTaskColumns = useMemo(
    () => orderColumns(taskColumnsConfig, "task"),
    [taskColumnsConfig, hiddenColumns, columnOrder, pinnedColumns],
  );

  const taskTable = useReactTable({
    data: tasks,
    columns: orderedTaskColumns,
    state: { columnSizing: taskColumnSizing },
    onColumnSizingChange: setTaskColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getRowId: (row) => row._id, // Ensures stable clicking/selection when sorting
  });

  /* ==================== TANSTACK TABLE: MEETINGS ==================== */
  const meetingColumnHelper = createColumnHelper();
  const meetingColumnsConfig = useMemo(
    () => [
      meetingColumnHelper.display({
        id: "selection",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                meetings.length > 0 &&
                selectedMeetings.length === meetings.length
              }
              onChange={(e) => {
                e.stopPropagation();
                handleSelectAllMeetings();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedMeetings.includes(row.original._id)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectMeeting(row.original._id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      }),
      meetingColumnHelper.accessor("title", {
        id: "title",
        size: 293,
        header: () => renderHeaderMenu("title", "Meeting"),
        cell: ({ row }) => {
          const meeting = row.original;
          return (
            <div className="w-full truncate">
              <div
                className="truncate"
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#222530" }}
                title={meeting.title}
              >
                <HighlightText text={meeting.title} query={searchTerm} />
              </div>
              <div
                className="flex items-center gap-1.5 mt-0.5 truncate"
                title={`With ${getMeetingEntityName(meeting)}`}
              >
                <CustomMeetingIcon width={14} height={14} style={{ color: "#525252", flexShrink: 0 }} />
                <span
                  className="truncate"
                  style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#525252" }}
                >
                  With <HighlightText text={getMeetingEntityName(meeting)} query={searchTerm} />
                </span>
              </div>
            </div>
          );
        },
      }),
      meetingColumnHelper.accessor("scheduledAt", {
        id: "scheduledAt",
        size: 239,
        header: () => renderHeaderMenu("scheduledAt", "Date & Time"),
        cell: ({ getValue }) => {
          const val = getValue();
          if (!val)
            return <div className="text-gray-700 truncate w-full">No Date</div>;
          const d = new Date(val);
          const dateText = d.toLocaleDateString();
          const timeText = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div
              className="w-full truncate text-gray-700"
              title={d.toLocaleString()}
            >
              <div><HighlightText text={dateText} query={searchTerm} /></div>
              <div className="text-xs text-gray-500">
                <HighlightText text={timeText} query={searchTerm} />
              </div>
            </div>
          );
        },
      }),
      meetingColumnHelper.accessor("status", {
        id: "status",
        size: 213,
        header: () => renderHeaderMenu("status", "Status"),
        cell: ({ row }) => (
          <div
            className="w-full flex items-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <MeetingStatusSelect
              meeting={row.original}
              onUpdate={handleMeetingStatusChange}
              query={searchTerm}
            />
          </div>
        ),
      }),
      meetingColumnHelper.accessor("participants", {
        id: "participants",
        size: 379,
        header: () => renderHeaderMenu("participants", "Contact"),
        cell: ({ row }) => {
          const meeting = row.original;
          return (
            <div className="w-full truncate">
              <div
                className="truncate"
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#222530" }}
                title={getMeetingEntityName(meeting)}
              >
                <HighlightText text={getMeetingEntityName(meeting)} query={searchTerm} />
              </div>
              <div
                className="truncate mt-0.5"
                style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#525252" }}
                title={getMeetingParticipants(meeting)}
              >
                <HighlightText text={getMeetingParticipants(meeting)} query={searchTerm} />
              </div>
            </div>
          );
        },
      }),
      meetingColumnHelper.accessor("location", {
        id: "url",
        size: 220,
        enableResizing: true,
        header: () => renderHeaderMenu("url", "URL"),
        cell: ({ getValue }) => {
          const url = getValue();
          if (!url) return <div className="text-gray-400 truncate w-full">—</div>;
          const isLink = /^https?:\/\//i.test(url);
          return isLink ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate w-full block text-blue-600 hover:underline"
              title={url}
            >
              <HighlightText text={url} query={searchTerm} />
            </a>
          ) : (
            <div className="truncate w-full text-gray-700" title={url}>
              <HighlightText text={url} query={searchTerm} />
            </div>
          );
        },
      }),
    ],
    [
      meetings,
      selectedMeetings,
      meetingSortConfig,
      users,
      companies,
      contacts,
      vendors,
      searchTerm,
    ],
  );

  const orderedMeetingColumns = useMemo(
    () => orderColumns(meetingColumnsConfig, "meeting"),
    [meetingColumnsConfig, hiddenColumns, columnOrder, pinnedColumns],
  );

  const meetingTable = useReactTable({
    data: meetings,
    columns: orderedMeetingColumns,
    state: { columnSizing: meetingColumnSizing },
    onColumnSizingChange: setMeetingColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getRowId: (row) => row._id, // Ensures stable clicking/selection when sorting
  });

  // Pagination handlers
  const handlePageChange = (page) => {
    const pagination =
      activeTab === "tasks" ? taskPagination : meetingPagination;
    if (
      page >= 1 &&
      page <= pagination.totalPages &&
      page !== pagination.currentPage
    ) {
      if (activeTab === "tasks") {
        setTaskPagination((prev) => ({ ...prev, currentPage: page }));
      } else {
        setMeetingPagination((prev) => ({ ...prev, currentPage: page }));
      }
      exitSelectionMode();
    }
  };

  const handleLimitChange = (limit) => {
    if (activeTab === "tasks") {
      setTaskPagination((prev) => ({ ...prev, limit, currentPage: 1 }));
    } else {
      setMeetingPagination((prev) => ({ ...prev, limit, currentPage: 1 }));
    }
    exitSelectionMode();
  };

  const PaginationControls = () => {
    const pagination =
      activeTab === "tasks" ? taskPagination : meetingPagination;

    if (pagination.totalCount === 0) return null;
    const start = (pagination.currentPage - 1) * pagination.limit + 1;
    const end = Math.min(
      pagination.currentPage * pagination.limit,
      pagination.totalCount,
    );

    const { currentPage, totalPages } = pagination;
    const commitPage = () => {
      const n = parseInt(pageInput, 10);
      if (!Number.isNaN(n)) handlePageChange(Math.min(Math.max(n, 1), totalPages));
      setEditingPage(false);
    };
    const pageItems = [1];
    if (currentPage > 2) pageItems.push("left-dots");
    if (currentPage !== 1 && currentPage !== totalPages) pageItems.push(currentPage);
    if (currentPage < totalPages - 1) pageItems.push("right-dots");
    if (totalPages > 1) pageItems.push(totalPages);

    return (
      <div className="w-full bg-white px-4 py-3 flex items-center justify-between sm:px-6">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-700 font-inter">
              Showing <span className="font-semibold">{start}</span> to{" "}
              <span className="font-semibold">{end}</span> of{" "}
              <span className="font-semibold">{pagination.totalCount}</span>{" "}
              results
            </p>
            <div className="relative ml-2">
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-700"
              >
                {[10, 20, 50, 100].map((v) => (
                  <option key={v} value={v}>
                    {v} per page
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageItems.map((item, index) => {
              if (item === "left-dots" || item === "right-dots") {
                return (
                  <span
                    key={`${item}-${index}`}
                    className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400 select-none"
                  >
                    ....
                  </span>
                );
              }
              const isCurrent = item === currentPage;
              if (isCurrent && editingPage) {
                return (
                  <input
                    key="page-edit"
                    autoFocus
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={commitPage}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitPage();
                      if (e.key === "Escape") setEditingPage(false);
                    }}
                    className="w-10 h-8 rounded-full border border-blue-500 text-center text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                );
              }
              return (
                <button
                  key={`page-${item}`}
                  onClick={() => handlePageChange(item)}
                  onDoubleClick={() => {
                    if (isCurrent) {
                      setPageInput(String(currentPage));
                      setEditingPage(true);
                    }
                  }}
                  title={isCurrent ? "Double-click to type a page number" : undefined}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${isCurrent ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                >
                  {item}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 pb-16">
      <AppToaster />

      {/* Video Tutorial Modal */}
      <VideoTutorialModal
        isOpen={showVideoTutorial}
        onClose={() => setShowVideoTutorial(false)}
        videoId={getVideoTutorial("tasks")?.videoId}
        title={getVideoTutorial("tasks")?.title}
      />

      <div
        className="flex flex-row justify-between items-center"
        style={{
          boxSizing: "border-box",
          padding: "0px 24px",
          gap: 16,
          height: 64,
          minHeight: 64,
          maxHeight: 64,
          background: "#FFFFFF",
          borderBottom: "1px solid #E1E4EA",
          borderRadius: 0,
          position: "fixed",
          top: "64px",
          left: "var(--sidebar-width, 0px)",
          right: 0,
          zIndex: 40,
        }}
      >
        {showBulkStrip ? (
          <div className={`${bulkStripClosing ? "animate-slideOutRight" : "animate-slideInLeft"} flex flex-wrap items-center justify-between gap-6 w-full h-full`}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-white border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 focus:outline-none transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => (activeTab === "tasks" ? setShowBulkActions(true) : setShowMeetingBulkActions(true))}
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
                onClick={() => (activeTab === "tasks" ? setSelectedTasks([]) : setSelectedMeetings([]))}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-semibold font-inter">
                {activeTab === "tasks" ? selectedTasks.length : selectedMeetings.length}{" "}
                {activeTab === "tasks" ? "task" : "meeting"}
                {(activeTab === "tasks" ? selectedTasks.length : selectedMeetings.length) !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={handleSelectAllAcrossPages}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                Select All
              </button>
              <button
                onClick={handleDeselectAllExtra}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Deselect All
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="flex flex-row items-center flex-shrink-0" style={{ height: 44 }}>
          <button
            onClick={() => setActiveTab("tasks")}
            className="flex flex-row justify-center items-center flex-shrink-0"
            style={{
              boxSizing: "border-box",
              padding: "0px 16px",
              gap: 10,
              height: 44,
              borderBottom: activeTab === "tasks" ? "3px solid #0085FF" : "3px solid transparent",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: "150%",
              letterSpacing: "-0.02em",
              color: activeTab === "tasks" ? "#0085FF" : "#44444A",
              whiteSpace: "nowrap",
            }}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveTab("meetings")}
            className="flex flex-row justify-center items-center flex-shrink-0"
            style={{
              boxSizing: "border-box",
              padding: "0px 16px",
              gap: 10,
              height: 44,
              borderBottom: activeTab === "meetings" ? "3px solid #0085FF" : "3px solid transparent",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: "150%",
              letterSpacing: "-0.02em",
              color: activeTab === "meetings" ? "#0085FF" : "#44444A",
              whiteSpace: "nowrap",
            }}
          >
            Meetings
          </button>
        </div>

        <div className="flex-1 min-w-0" />

        <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 12 }}>
          <div
            className={`relative h-10 flex items-center border rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-gray-50 focus-within:border-[#0085FF] focus-within:hover:bg-white ${isSearchExpanded ? "w-[416px]" : "w-10"} max-w-full flex-shrink-0`}
            style={{ borderColor: isSearchExpanded ? "#0085FF" : "rgba(31, 41, 55, 0.1)" }}
          >
            <Search
              strokeWidth={2.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-800 w-4 h-4 cursor-pointer z-10 flex-shrink-0"
              onClick={() => {
                setIsSearchExpanded(true);
                searchInputRef.current?.focus();
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => {
                if (!searchTerm) setIsSearchExpanded(false);
              }}
              className={`w-full h-full pl-9 pr-4 bg-transparent text-sm focus:outline-none transition-opacity duration-200 cursor-pointer ${isSearchExpanded ? "opacity-100 focus:cursor-text" : "opacity-0"}`}
              style={{ fontFamily: "Inter", fontWeight: 400, lineHeight: "20px", color: "#1F2937" }}
              placeholder={
                activeTab === "tasks"
                  ? "Search Task by Title or Description..."
                  : "Search Meetings by Title..."
              }
            />
          </div>

          {activeTab === "tasks" && (
            <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 8 }}>
              <button
                onClick={() => setShowMobileFilters(true)}
                className="relative flex flex-row justify-center items-center flex-shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  background: "#FFFFFF",
                  border: "1px solid #E1E4EA",
                  borderRadius: 95,
                }}
              >
                <FilterIcon size={15} style={{ color: "#1F2937" }} />
                {activeAdvancedFilters.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#0085FF] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {activeAdvancedFilters.length}
                  </span>
                )}
              </button>

              <div
                className="relative flex flex-row items-center flex-shrink-0"
                style={{ padding: 4, gap: 6, width: 80, height: 40, background: "#F1F1F5", borderRadius: 95 }}
              >
                <span
                  className="absolute top-1 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out pointer-events-none"
                  style={{ width: 32, height: 32, left: showKanban ? 42 : 4 }}
                />
                <button
                  onClick={() => setShowKanban(false)}
                  className="relative z-10 flex flex-row justify-center items-center flex-shrink-0"
                  style={{
                    padding: 8,
                    gap: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 95,
                  }}
                >
                  <CustomListIcon width={15} height={15} style={{ color: !showKanban ? "#0085FF" : "#525252" }} />
                </button>
                <button
                  onClick={() => setShowKanban(true)}
                  className="relative z-10 flex flex-row justify-center items-center flex-shrink-0"
                  style={{
                    padding: 8,
                    gap: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 96,
                  }}
                >
                  <CustomKanbanIcon width={20} height={20} style={{ color: showKanban ? "#0085FF" : "#525252" }} />
                </button>
              </div>
            </div>
          )}

          {activeTab === "meetings" && (
            <div className="flex flex-row items-center flex-shrink-0" style={{ gap: 8 }}>
              <button
                onClick={() => setShowMobileFilters(true)}
                className="relative flex flex-row justify-center items-center flex-shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  background: "#FFFFFF",
                  border: "1px solid #E1E4EA",
                  borderRadius: 95,
                }}
              >
                <FilterIcon size={15} style={{ color: "#1F2937" }} />
                {activeAdvancedFilters.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#0085FF] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {activeAdvancedFilters.length}
                  </span>
                )}
              </button>

              <div
                className="relative flex flex-row items-center flex-shrink-0"
                style={{ padding: 4, gap: 6, height: 40, background: "#F1F1F5", borderRadius: 95 }}
              >
                <span
                  className="absolute top-1 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out pointer-events-none"
                  style={{ height: 32, left: meetingToggleIndicator.left, width: meetingToggleIndicator.width }}
                />
                <button
                  ref={(el) => (meetingToggleRefs.current.list = el)}
                  onClick={() => setShowMeetingCalendar(false)}
                  className="relative z-10 flex flex-row justify-center items-center flex-shrink-0"
                  style={{
                    padding: 8,
                    gap: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 95,
                  }}
                >
                  <CustomListIcon width={15} height={15} style={{ color: !showMeetingCalendar ? "#0085FF" : "#525252" }} />
                </button>
                <button
                  ref={(el) => (meetingToggleRefs.current.calendar = el)}
                  onClick={() => setShowMeetingCalendar(true)}
                  className="relative z-10 flex flex-row justify-center items-center gap-2 flex-shrink-0"
                  style={{
                    padding: "8px 14px",
                    height: 32,
                    borderRadius: 96,
                  }}
                >
                  <Calendar className="w-4 h-4" style={{ color: showMeetingCalendar ? "#0085FF" : "#525252" }} />
                  <span
                    className="whitespace-nowrap"
                    style={{
                      fontFamily: "Inter",
                      fontWeight: 500,
                      fontSize: 14,
                      color: showMeetingCalendar ? "#0085FF" : "#525252",
                    }}
                  >
                    View in Calendar
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="flex flex-row items-center flex-shrink-0"
          style={{ gap: 8, width: 186, height: 40 }}
        >
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                boxSizing: "border-box",
                padding: 12,
                gap: 8,
                width: 40,
                height: 40,
                background: "#FFFFFF",
                border: "1px solid #E1E4EA",
                borderRadius: 96,
              }}
            >
              <MoreVertical size={20} style={{ color: "#1F2937" }} />
            </button>
            {isMoreMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in duration-200 origin-top-right">
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
            )}
          </div>
          <button
            onClick={() => (activeTab === "tasks" ? toggleTaskForm() : toggleMeetingForm())}
            className="flex flex-row justify-center items-center flex-shrink-0"
            style={{
              padding: 12,
              gap: 6,
              width: 138,
              height: 40,
              background: "#0085FF",
              borderRadius: 96,
            }}
          >
            <Plus size={18} style={{ color: "#FFFFFF" }} />
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 14,
                lineHeight: "20px",
                color: "#FFFFFF",
              }}
            >
              New Activity
            </span>
          </button>
        </div>
        </>
        )}
      </div>
      {/* Spacer to offset the fixed strip above */}
      <div style={{ height: 64 }} />

      {activeTab === "tasks" && !showKanban && (
      <>
      <div
        className="overflow-x-auto overflow-y-auto"
        style={{
          position: "fixed",
          top: 128,
          left: "var(--sidebar-width, 0px)",
          right: 0,
          bottom: !loading ? 64 : 0,
        }}
      >
      <div
        className={`relative bg-white border border-[#E1E4EA] ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
          <table
            className="w-full border-separate border-spacing-0 text-left"
            style={{ minWidth: `${taskTable.getTotalSize()}px`, tableLayout: "fixed" }}
          >
            <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA] sticky top-0 z-10">
              {taskTable.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    const isLeftSticky = colId === "selection";
                    const isDraggable = colId !== "selection" && colId !== "actions";
                    const isDragging = draggedColKey === colId;
                    const isDragOver = dragOverColKey === colId && draggedColKey && draggedColKey !== colId;
                    return (
                      <th
                        key={header.id}
                        data-col-id={colId}
                        onMouseDown={isDraggable ? (e) => startColumnDrag(
                          e,
                          colId,
                          TASK_COLUMN_LABELS[colId] || colId,
                          completedTasks.map((t) => String(getTaskColumnPreviewValue(t, colId))),
                          headerGroup.headers.map((h) => h.column.id).filter((id) => id !== "selection"),
                        ) : undefined}
                        style={{
                          width: header.getSize(),
                          position: isLeftSticky ? "sticky" : "relative",
                          left: isLeftSticky ? 0 : "auto",
                          zIndex: isLeftSticky ? 20 : 1,
                          opacity: isDragging ? 0.35 : 1,
                        }}
                        className={`px-3 py-3 text-sm font-medium text-[#525866] transition-colors bg-[#F5F7FA] border-r border-[#E1E4EA] last:border-r-0 overflow-hidden ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragOver ? "bg-blue-100" : "hover:bg-gray-100"}`}
                      >
                        <div className="truncate w-full">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {header.column.getCanResize() && (
                          <div
                            data-resize-handle="true"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 ${header.column.getIsResizing() ? "bg-blue-500" : "bg-transparent"}`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#E1E4EA] bg-white">
              {showTaskLoadingSkeleton ? (
                <TableSkeletonRows
                  numRows={taskPagination.limit}
                  columns={taskTable.getVisibleLeafColumns().filter((c) => c.id !== "selection")}
                  hasCheckbox
                  rowHeight={54}
                />
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={taskTable.getAllColumns().length} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                taskTable.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleTaskEdit(row.original)}
                    className={`group cursor-pointer hover:bg-blue-50 transition-colors ${selectedTasks.includes(row.original._id) ? "bg-blue-50" : "bg-white"}`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;
                      const isLeftSticky = colId === "selection";
                      return (
                        <td
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            height: 54,
                            position: isLeftSticky ? "sticky" : "static",
                            left: isLeftSticky ? 0 : "auto",
                            zIndex: isLeftSticky ? 10 : 1,
                          }}
                          className="px-3 align-middle text-sm text-[#1C1B1F] bg-inherit border-r border-b border-[#E1E4EA] last:border-r-0"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
      {!loading && (
        <div
          className="fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center"
          style={{ left: "var(--sidebar-width, 0px)", height: 64 }}
        >
          <PaginationControls />
        </div>
      )}
      </>
      )}

      {activeTab === "meetings" && !showMeetingCalendar && (
      <>
      <div
        className="overflow-x-auto overflow-y-auto"
        style={{
          position: "fixed",
          top: 128,
          left: "var(--sidebar-width, 0px)",
          right: 0,
          bottom: !loading ? 64 : 0,
        }}
      >
      <div
        className={`relative bg-white border border-[#E1E4EA] ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
          <table
            className="w-full border-separate border-spacing-0 text-left"
            style={{ minWidth: `${meetingTable.getTotalSize()}px`, tableLayout: "fixed" }}
          >
            <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA] sticky top-0 z-10">
              {meetingTable.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    const isLeftSticky = colId === "selection";
                    const isDraggable = colId !== "selection" && colId !== "actions";
                    const isDragging = draggedColKey === colId;
                    const isDragOver = dragOverColKey === colId && draggedColKey && draggedColKey !== colId;
                    return (
                      <th
                        key={header.id}
                        data-col-id={colId}
                        onMouseDown={isDraggable ? (e) => startColumnDrag(
                          e,
                          colId,
                          MEETING_COLUMN_LABELS[colId] || colId,
                          meetings.map((m) => String(getMeetingColumnPreviewValue(m, colId))),
                          headerGroup.headers.map((h) => h.column.id).filter((id) => id !== "selection"),
                        ) : undefined}
                        style={{
                          width: header.getSize(),
                          position: isLeftSticky ? "sticky" : "relative",
                          left: isLeftSticky ? 0 : "auto",
                          zIndex: isLeftSticky ? 20 : 1,
                          opacity: isDragging ? 0.35 : 1,
                        }}
                        className={`px-3 py-3 text-sm font-medium text-[#525866] transition-colors bg-[#F5F7FA] border-r border-[#E1E4EA] last:border-r-0 overflow-hidden ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragOver ? "bg-blue-100" : "hover:bg-gray-100"}`}
                      >
                        <div className="truncate w-full">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {header.column.getCanResize() && (
                          <div
                            data-resize-handle="true"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 ${header.column.getIsResizing() ? "bg-blue-500" : "bg-transparent"}`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#E1E4EA] bg-white">
              {showMeetingLoadingSkeleton ? (
                <TableSkeletonRows
                  numRows={meetingPagination.limit}
                  columns={meetingTable.getVisibleLeafColumns().filter((c) => c.id !== "selection")}
                  hasCheckbox
                  rowHeight={54}
                />
              ) : meetings.length === 0 ? (
                <tr>
                  <td colSpan={meetingTable.getAllColumns().length} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No meetings found.
                  </td>
                </tr>
              ) : (
                meetingTable.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleMeetingEdit(row.original)}
                    className={`group cursor-pointer hover:bg-blue-50 transition-colors ${selectedMeetings.includes(row.original._id) ? "bg-blue-50" : "bg-white"}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize(), height: 54 }}
                        className="px-3 align-middle text-sm text-[#1C1B1F] bg-inherit border-r border-b border-[#E1E4EA] last:border-r-0"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && (
        <div
          className="fixed bottom-0 right-0 bg-white border-t border-[#E1E4EA] shadow-sm z-[9992] flex items-center"
          style={{ left: "var(--sidebar-width, 0px)", height: 64 }}
        >
          <PaginationControls />
        </div>
      )}
      </>
      )}

      {activeTab === "tasks" && showKanban && (
        <div className="mx-6" style={{ height: 587 }}>
          <TaskKanbanBoard
            columns={["Pending", "In Progress", "Completed"]}
            items={tasks}
            getItemColumn={(t) => t.status || "Pending"}
            onItemMove={handleTaskMove}
            onCardEdit={handleTaskEdit}
            onCardDelete={(task) => handleDelete(task._id, "task")}
          />
        </div>
      )}

      {/* Legacy Forms/Modals */}
      {showTaskForm && (
        <TaskForm
          form={taskForm}
          setForm={setTaskForm}
          users={users}
          companies={companies}
          contacts={contacts}
          deals={deals}
          vendors={vendors}
          loading={loading}
          onSubmit={handleTaskSubmit}
          onCancel={() => setShowTaskForm(false)}
          fetchTasks={fetchTasks}
        />
      )}

      {showMeetingForm && (
        <AdminMeetingForm
          open={showMeetingForm}
          onClose={() => setShowMeetingForm(false)}
          onSubmit={handleMeetingSave}
          initialData={selectedMeeting || {}}
          contacts={contacts}
          companies={companies}
          vendors={vendors}
          mode={meetingModalMode}
          onSave={handleMeetingSave}
        />
      )}

      {/* {showMeetingForm && (
        <AdminMeetingForm
          open={showMeetingForm}
          mode={meetingModalMode}
          meetingData={selectedMeeting}
          calendarDate={null} // optional
          users={users}
          contacts={contacts}
          companies={companies}
          vendors={vendors}
          candidates={null} // if you have candidates
          onSave={async (payload) => {
            await API.post("/meetings", payload);
            // refresh meetings list
          }}
          onDelete={async (id) => {
            await API.delete(`/meetings/${id}`);
            // refresh
          }}
          onClose={() => setShowMeetingForm(false)}
        />
      )} */}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            {/* Same content as before */}
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 font-sf">
                Delete {deleteType === "task" ? "Task" : "Meeting"}
              </h2>
            </div>
            <p className="text-gray-600 mb-6 font-inter">
              Are you sure you want to delete this {deleteType}? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Modals */}
      <BulkActions
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedItems={selectedTasks.map((id) =>
          tasks.find((t) => t._id === id),
        )}
        onBulkUpdate={handleBulkUpdateTasks}
        fieldConfig={taskFieldConfig}
        module="tasks"
      />

      <BulkActions
        isOpen={showMeetingBulkActions}
        onClose={() => setShowMeetingBulkActions(false)}
        selectedItems={selectedMeetings.map((id) =>
          meetings.find((m) => m._id === id),
        )}
        onBulkUpdate={handleBulkUpdateMeetings}
        fieldConfig={meetingFieldConfig}
        module="meetings"
      />

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
                <strong>
                  {activeTab === "tasks" ? selectedTasks.length : selectedMeetings.length}
                </strong>{" "}
                {activeTab === "tasks" ? "tasks" : "meetings"}? This action
                cannot be undone.
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
                  onClick={() =>
                    activeTab === "tasks"
                      ? handleBulkDeleteTasks(selectedTasks)
                      : handleBulkDeleteMeetings(selectedMeetings)
                  }
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

      {dragGhost && createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: dragGhost.width,
            zIndex: 10000,
            pointerEvents: "none",
          }}
          className="flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]" style={{ height: dragGhost.height }}>
            <span className="text-sm font-bold text-[#525866] truncate block">{dragGhost.label}</span>
          </div>
          {(dragGhost.previewRows || []).slice(0, 10).map((rowVal, i) => (
            <div key={i} className="px-3 py-2 border-b border-[#F1F1F5] last:border-b-0">
              <span className="text-sm text-gray-700 truncate block">{rowVal}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}

      <AdvancedFilterPanel
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        columns={advancedFilterColumns}
        filters={activeAdvancedFilters}
        setFilters={setActiveAdvancedFilters}
        onApply={applyAdvancedTaskFilters}
        title={activeTab === "tasks" ? "Filter Tasks" : "Filter Meetings"}
        subtitle="Find items due on a specific date"
        emptyStateText="Add a rule to narrow down the list."
      />
    </div>
  );
}

export default Tasks;
