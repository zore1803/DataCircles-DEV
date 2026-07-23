import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Filter,
  Plus,
  Pin,
  PinOff,
  ChevronLeft,
  ChevronRight,
  ListChecks,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import CompanyTaskForm from "./CompanyTaskForm";
import TaskDetailsModal from "../Task/TaskDetailsModal";

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

const TotalTasksIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="24 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M40.1943 44.4845L37.7155 42.0057L38.7595 40.9615L40.1845 42.3865L43.4462 39.125L44.5 40.1788L40.1943 44.4845ZM27.5 44.5V43H36V44.5H27.5ZM27.5 40.625V39.125H36V40.625H27.5ZM27.5 36.75V35.25H44.5V36.75H27.5ZM27.5 32.875V31.375H44.5V32.875H27.5ZM27.5 29V27.5H44.5V29H27.5Z" fill="#0085FF" />
  </svg>
);

const PendingTasksIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="361.5 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M372.75 40.7499H374.25V37.7499H377.25V36.2499H374.25V33.2499H372.75V36.2499H369.75V37.7499H372.75V40.7499ZM370.185 44.8307C369.154 44.3845 368.255 43.7781 367.489 43.0114C366.722 42.2448 366.116 41.3463 365.669 40.3159C365.223 39.2854 365 38.1803 365 37.0004C365 35.8206 365.223 34.7153 365.669 33.6847C366.116 32.6538 366.722 31.7551 367.489 30.9884C368.255 30.2218 369.154 29.6153 370.184 29.1692C371.215 28.723 372.32 28.4999 373.5 28.4999C374.68 28.4999 375.785 28.723 376.815 29.1692C377.846 29.6153 378.745 30.2218 379.512 30.9884C380.278 31.7551 380.885 32.6536 381.331 33.6839C381.777 34.7144 382 35.8196 382 36.9994C382 38.1793 381.777 39.2845 381.331 40.3152C380.885 41.346 380.278 42.2448 379.512 43.0114C378.745 43.7781 377.847 44.3845 376.816 44.8307C375.786 45.2768 374.681 45.4999 373.501 45.4999C372.321 45.4999 371.216 45.2768 370.185 44.8307ZM367.254 26.8884L368.308 27.9422L364.442 31.8077L363.389 30.7537L367.254 26.8884ZM379.746 26.8884L383.612 30.7537L382.558 31.8077L378.692 27.9422L379.746 26.8884ZM373.5 43.9999C375.444 43.9999 377.096 43.3192 378.458 41.9577C379.819 40.5962 380.5 38.9436 380.5 36.9999C380.5 35.0563 379.819 33.4037 378.458 32.0422C377.096 30.6807 375.444 29.9999 373.5 29.9999C371.557 29.9999 369.904 30.6807 368.542 32.0422C367.181 33.4037 366.5 35.0563 366.5 36.9999C366.5 38.9436 367.181 40.5962 368.542 41.9577C369.904 43.3192 371.557 43.9999 373.5 43.9999Z" fill="#0085FF" />
  </svg>
);

const PendingActionIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="530 42 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M537.416 51.749C537.528 51.6372 537.584 51.4987 537.584 51.3334C537.584 51.1681 537.528 51.0296 537.416 50.9178C537.304 50.806 537.166 50.7501 537 50.7501C536.835 50.7501 536.697 50.806 536.585 50.9178C536.473 51.0296 536.417 51.1681 536.417 51.3334C536.417 51.4987 536.473 51.6372 536.585 51.749C536.697 51.8608 536.835 51.9167 537 51.9167C537.166 51.9167 537.304 51.8608 537.416 51.749ZM536.417 49.5834H537.584V46.0834H536.417V49.5834ZM537 54.8334C536.193 54.8334 535.435 54.6803 534.725 54.374C534.016 54.0678 533.398 53.6522 532.873 53.1272C532.348 52.6022 531.933 51.9848 531.626 51.2751C531.32 50.5654 531.167 49.807 531.167 49.0001C531.167 48.1931 531.32 47.4348 531.626 46.7251C531.933 46.0154 532.348 45.398 532.873 44.873C533.398 44.348 534.016 43.9324 534.725 43.6261C535.435 43.3199 536.193 43.1667 537 43.1667C537.807 43.1667 538.566 43.3199 539.275 43.6261C539.985 43.9324 540.602 44.348 541.127 44.873C541.652 45.398 542.068 46.0154 542.374 46.7251C542.681 47.4348 542.834 48.1931 542.834 49.0001C542.834 49.807 542.681 50.5654 542.374 51.2751C542.068 51.9848 541.652 52.6022 541.127 53.1272C540.602 53.6522 539.985 54.0678 539.275 54.374C538.566 54.6803 537.807 54.8334 537 54.8334ZM537 53.6667C538.303 53.6667 539.407 53.2147 540.311 52.3105C541.215 51.4063 541.667 50.3029 541.667 49.0001C541.667 47.6973 541.215 46.5938 540.311 45.6897C539.407 44.7855 538.303 44.3334 537 44.3334C535.698 44.3334 534.594 44.7855 533.69 45.6897C532.786 46.5938 532.334 47.6973 532.334 49.0001C532.334 50.3029 532.786 51.4063 533.69 52.3105C534.594 53.2147 535.698 53.6667 537 53.6667Z" fill="#BCAA00" />
  </svg>
);

const OverdueTasksIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="24 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M38.902 33.9212C39.6982 33.1122 40.0962 32.1385 40.0962 31V28H31.9037V31C31.9037 32.1385 32.3018 33.1122 33.098 33.9212C33.8942 34.7302 34.8615 35.1348 36 35.1348C37.1385 35.1348 38.1058 34.7302 38.902 33.9212ZM28.5 45.5V44H30.404V41C30.404 39.8743 30.712 38.8497 31.328 37.926C31.944 37.0022 32.7603 36.3602 33.777 36C32.7603 35.6333 31.944 34.9898 31.328 34.0693C30.712 33.1488 30.404 32.1257 30.404 31V28H28.5V26.5H43.5V28H41.596V31C41.596 32.1257 41.288 33.1488 40.672 34.0693C40.056 34.9898 39.2397 35.6333 38.223 36C39.2397 36.3602 40.056 37.0022 40.672 37.926C41.288 38.8497 41.596 39.8743 41.596 41V44H43.5V45.5H28.5Z" fill="#0085FF" />
  </svg>
);

const OverdueActionIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="189.5 42 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M196.916 51.749C197.028 51.6372 197.084 51.4987 197.084 51.3334C197.084 51.1681 197.028 51.0296 196.916 50.9178C196.804 50.806 196.666 50.7501 196.5 50.7501C196.335 50.7501 196.197 50.806 196.085 50.9178C195.973 51.0296 195.917 51.1681 195.917 51.3334C195.917 51.4987 195.973 51.6372 196.085 51.749C196.197 51.8608 196.335 51.9167 196.5 51.9167C196.666 51.9167 196.804 51.8608 196.916 51.749ZM195.917 49.5834H197.084V46.0834H195.917V49.5834ZM196.5 54.8334C195.693 54.8334 194.935 54.6803 194.225 54.374C193.516 54.0678 192.898 53.6522 192.373 53.1272C191.848 52.6022 191.433 51.9848 191.126 51.2751C190.82 50.5654 190.667 49.807 190.667 49.0001C190.667 48.1931 190.82 47.4348 191.126 46.7251C191.433 46.0154 191.848 45.398 192.373 44.873C192.898 44.348 193.516 43.9324 194.225 43.6261C194.935 43.3199 195.693 43.1667 196.5 43.1667C197.307 43.1667 198.066 43.3199 198.775 43.6261C199.485 43.9324 200.102 44.348 200.627 44.873C201.152 45.398 201.568 46.0154 201.874 46.7251C202.181 47.4348 202.334 48.1931 202.334 49.0001C202.334 49.807 202.181 50.5654 201.874 51.2751C201.568 51.9848 201.152 52.6022 200.627 53.1272C200.102 53.6522 199.485 54.0678 198.775 54.374C198.066 54.6803 197.307 54.8334 196.5 54.8334ZM196.5 53.6667C197.803 53.6667 198.907 53.2147 199.811 52.3105C200.715 51.4063 201.167 50.3029 201.167 49.0001C201.167 47.6973 200.715 46.5938 199.811 45.6897C198.907 44.7855 197.803 44.3334 196.5 44.3334C195.198 44.3334 194.094 44.7855 193.19 45.6897C192.286 46.5938 191.834 47.6973 191.834 49.0001C191.834 50.3029 192.286 51.4063 193.19 52.3105C194.094 53.2147 195.198 53.6667 196.5 53.6667Z" fill="#CD3636" />
  </svg>
);

const CompletedTasksIcon = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="361.5 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M367 44.75V28.5H372.615C372.564 28.75 372.523 29 372.492 29.25C372.462 29.5 372.455 29.75 372.471 30H368.5V36H375.75L376.15 38H379.5V36.3595C379.75 36.3532 380 36.3315 380.25 36.2943C380.5 36.2571 380.75 36.2014 381 36.127V39.5H374.904L374.504 37.5H368.5V44.75H367ZM378.438 31.8308L381.846 28.4385L381.008 27.6L378.438 30.1385L377.3 29L376.462 29.8538L378.438 31.8308ZM382.34 26.5098C383.216 27.3853 383.654 28.4475 383.654 29.6963C383.654 30.945 383.216 32.0071 382.34 32.8828C381.465 33.7583 380.403 34.196 379.154 34.196C377.905 34.196 376.843 33.7583 375.967 32.8828C375.092 32.0071 374.654 30.945 374.654 29.6963C374.654 28.4475 375.092 27.3853 375.967 26.5098C376.843 25.6341 377.905 25.1963 379.154 25.1963C380.403 25.1963 381.465 25.6341 382.34 26.5098Z" fill="#0085FF" />
  </svg>
);

const CompletedTrendIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="497 44 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M502.583 46.5665V53.6666H501.417V46.5665L498.288 49.6955L497.463 48.8705L502 44.3333L506.537 48.8705L505.712 49.6955L502.583 46.5665Z" fill="#00C950" />
  </svg>
);

const TotalTrendIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="197 44 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M203.083 46.568V53.668H201.917V46.568L198.788 49.6969L197.963 48.872L202.5 44.3347L207.037 48.872L206.212 49.6969L203.083 46.568Z" fill="#00C950" />
  </svg>
);

const MoreVertIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10 5.83333C10.9167 5.83333 11.6667 5.08333 11.6667 4.16667C11.6667 3.25 10.9167 2.5 10 2.5C9.08333 2.5 8.33333 3.25 8.33333 4.16667C8.33333 5.08333 9.08333 5.83333 10 5.83333ZM10 8.33333C9.08333 8.33333 8.33333 9.08333 8.33333 10C8.33333 10.9167 9.08333 11.6667 10 11.6667C10.9167 11.6667 11.6667 10.9167 11.6667 10C11.6667 9.08333 10.9167 8.33333 10 8.33333ZM10 14.1667C9.08333 14.1667 8.33333 14.9167 8.33333 15.8333C8.33333 16.75 9.08333 17.5 10 17.5C10.9167 17.5 11.6667 16.75 11.6667 15.8333C11.6667 14.9167 10.9167 14.1667 10 14.1667Z" fill="#1C1B1F" />
  </svg>
);

const CircleCheckIcon = ({ size = 20, checked = false, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {checked ? (
      <>
        <circle cx="10" cy="10" r="9" fill="#0085FF" />
        <path d="M6 10.2L8.5 12.7L14 7.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ) : (
      <circle cx="10" cy="10" r="8.5" stroke="#C1C7D0" strokeWidth="1.2" fill="none" />
    )}
  </svg>
);

const BriefcaseIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 15.8333C1.20833 15.8333 0.815972 15.6701 0.489583 15.3438C0.163194 15.0174 0 14.625 0 14.1667V5C0 4.54167 0.163194 4.14931 0.489583 3.82292C0.815972 3.49653 1.20833 3.33333 1.66667 3.33333H5V1.66667C5 1.20833 5.16319 0.815972 5.48958 0.489583C5.81597 0.163194 6.20833 0 6.66667 0H10C10.4583 0 10.8507 0.163194 11.1771 0.489583C11.5035 0.815972 11.6667 1.20833 11.6667 1.66667V3.33333H15C15.4583 3.33333 15.8507 3.49653 16.1771 3.82292C16.5035 4.14931 16.6667 4.54167 16.6667 5V14.1667C16.6667 14.625 16.5035 15.0174 16.1771 15.3438C15.8507 15.6701 15.4583 15.8333 15 15.8333H1.66667ZM1.66667 14.1667H15V5H1.66667V14.1667ZM6.66667 3.33333H10V1.66667H6.66667V3.33333Z" fill="#8D8D8E" />
  </svg>
);

export default function CompanyTasksTab({ companyId, tasks = [], setTasks, showStats = true }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [pinnedColumn, setPinnedColumn] = useState(null);
  const [colWidths, setColWidths] = useState({
    title: 264,
    assignedTo: 190,
    status: 160,
    priority: 148,
    dueDate: 166,
    progress: 362,
  });
  const [resizingCol, setResizingCol] = useState(null);
  const resizingRef = useRef(null);
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/auth/all-user");
        setUsers(res.data.allUsers || []);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    fetchUsers();
  }, []);

  const refetchTasks = async () => {
    try {
      const res = await API.get(`/tasks/company/${companyId}`);
      setTasks(res.data || []);
    } catch (err) {
      console.error("Failed to refetch tasks:", err);
    }
  };

  const handleTaskSave = async (taskData) => {
    try {
      await API.post("/tasks", taskData);
      await refetchTasks();
      toast.success("Task created successfully!");
      setShowTaskForm(false);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create task.");
      }
      throw err;
    }
  };

  const handleTaskDelete = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      await refetchTasks();
      toast.success("Task deleted successfully!");
      setIsDetailsOpen(false);
      setSelectedTask(null);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete task.");
      }
      throw err;
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsDetailsOpen(true);
  };

  const handleEditTask = (task) => {
    setIsDetailsOpen(false);
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return tasks;
    const q = searchTerm.toLowerCase();
    return tasks.filter((t) => (t.title || "").toLowerCase().includes(q));
  }, [tasks, searchTerm]);

  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(10);

  const listTotalCount = filteredTasks.length;
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

  const paginatedTasks = useMemo(
    () => filteredTasks.slice((listPage - 1) * listLimit, listPage * listLimit),
    [filteredTasks, listPage, listLimit],
  );

  const formatTaskDueLabel = (dateString) => {
    if (!dateString) return { day: "—", time: "" };
    const date = new Date(dateString);
    const now = new Date();
    const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

    if (isSameDay(date, now)) return { day: "Today.", time };
    if (isSameDay(date, tomorrow)) return { day: "Tomorrow", time };
    return {
      day: date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getTaskAssignees = (task) => {
    if (!Array.isArray(task.users) || task.users.length === 0) return [];
    return task.users.filter((u) => typeof u === "object" && u?.name);
  };

  const getTaskProgress = (task) => (task.status === "Completed" ? 100 : 0);

  const total = tasks.length;
  const pending = tasks.filter((t) => t.status !== "Completed").length;
  const overdue = tasks.filter(
    (t) =>
      t.status !== "Completed" && t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const kpiTiles = [
    {
      label: "Total Tasks",
      value: total,
      icon: TotalTasksIcon,
      subtitle: "12% Last week",
      subtitleColor: "#00C950",
      subtitleIcon: TotalTrendIcon,
    },
    {
      label: "Pending Tasks",
      value: pending,
      icon: PendingTasksIcon,
      subtitle: "Awaiting action",
      subtitleColor: "#BCAA00",
      subtitleIcon: PendingActionIcon,
    },
    {
      label: "Overdue Tasks",
      value: overdue,
      icon: OverdueTasksIcon,
      subtitle: "Action Required",
      subtitleColor: "#CD3636",
      subtitleIcon: OverdueActionIcon,
    },
    {
      label: "Completed Tasks",
      value: completed,
      icon: CompletedTasksIcon,
      subtitle: `${completionRate}% Completion Rate`,
      subtitleColor: "#00C950",
      subtitleIcon: CompletedTrendIcon,
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
                className="h-[72px] flex items-center gap-3 px-3 bg-white border border-gray-200 rounded-xl"
              >
                <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <tile.icon size={20} />
                </div>
                <div className="min-w-0 flex-1 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
                    <p className="text-base font-semibold text-gray-900">{tile.value}</p>
                  </div>
                  {tile.subtitle && (
                    <span
                      className="flex items-center flex-shrink-0"
                      style={{
                        gap: 4,
                        color: tile.subtitleColor,
                        fontFamily: "Inter",
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: "120%",
                      }}
                    >
                      <tile.subtitleIcon size={14} />
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
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by tasks by name, team, or deal..."
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
        <button
          onClick={() => setShowTaskForm(true)}
          className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
          style={{ width: "44px", height: "44px", borderColor: "#E1E4EA" }}
          title="Add Task"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Task list or empty state */}
      {tasks.length === 0 ? (
        <button
          onClick={() => setShowTaskForm(true)}
          className="flex flex-col items-center justify-center w-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <ListChecks size={28} className="mb-2" />
          <span className="text-sm font-medium">Add New Task</span>
        </button>
      ) : (
      <div
        className="box-border flex flex-col items-start w-full bg-white overflow-x-auto"
        style={{ border: "1px solid #E1E4EA", borderRadius: 8 }}
      >
        <table
          className="text-sm text-left border-collapse"
          style={{ tableLayout: "fixed", width: "100%", minWidth: totalTableWidth, maxWidth: "100%" }}
        >
          <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
            <tr>
              <th style={{ width: 51, height: 56 }} className="px-3" />
              {[
                { id: "title", label: "Task", width: 264, pinnable: true },
                { id: "assignedTo", label: "Assigned to", width: 190, pinnable: true },
                { id: "status", label: "Status", width: 160, pinnable: true },
                { id: "priority", label: "Priority", width: 148, pinnable: true },
                { id: "dueDate", label: "Due Date", width: 166, pinnable: true },
                { id: "progress", label: "Progress", width: 362, pinnable: true },
              ].map((col) => {
                const isPinned = pinnedColumn === col.id;
                return (
                  <th
                    key={col.id}
                    style={{ width: colWidths[col.id], height: 56, position: "relative" }}
                    className={`py-2.5 font-medium text-[#525252] text-xs border-r border-[#E1E4EA] ${
                      col.id === "title" ? "pl-6 pr-3" : "px-3"
                    }`}
                  >
                    {col.pinnable ? (
                      <div
                        className="relative flex items-center justify-start w-full group cursor-pointer select-none"
                        onDoubleClick={() => togglePinColumn(col.id)}
                      >
                        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                          <span className="truncate">{col.label}</span>
                        </div>
                        <button
                          onClick={() => togglePinColumn(col.id)}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${
                            isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"
                          }`}
                          title={isPinned ? "Unpin Column" : "Pin Column"}
                        >
                          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : null}
                    <div
                      onMouseDown={(e) => startResize(e, col.id)}
                      className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-10 ${
                        resizingCol === col.id ? "bg-blue-500" : "bg-transparent"
                      }`}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1E4EA] bg-white">
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-medium">
                  No tasks found.
                </td>
              </tr>
            ) : (
              paginatedTasks.map((task) => {
                const isCompleted = task.status === "Completed";
                const assignees = getTaskAssignees(task);
                const progress = getTaskProgress(task);
                const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();
                const priority = task.priority || null;
                const priorityStyles = {
                  high: { bg: "rgba(205, 54, 54, 0.1)", color: "#CD3636" },
                  medium: { bg: "rgba(188, 170, 0, 0.1)", color: "#BCAA00" },
                  low: { bg: "rgba(0, 201, 80, 0.1)", color: "#00C950" },
                };
                const linkedEntity = task.relatedEntities?.[0];
                const dueLabel = formatTaskDueLabel(task.dueDate);
                const textDecoration = isCompleted ? "line-through" : "none";
                const primaryAssignee = assignees[0];
                const avatarUrl = primaryAssignee?.profileUrl || primaryAssignee?.userData?.mainData?.profilePic;
                return (
                  <tr key={task._id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => handleTaskClick(task)}>
                    <td style={{ height: 60 }} className="px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-start">
                        <CircleCheckIcon checked={isCompleted} className="flex-shrink-0" />
                      </div>
                    </td>
                    <td style={{ height: 60 }} className="pl-6 pr-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "20px", color: "#0E121B", textDecoration }}
                          className="truncate"
                        >
                          {task.title || "Untitled Task"}
                        </span>
                        <div className="flex items-center gap-1">
                          <BriefcaseIcon className="flex-shrink-0" />
                          <span
                            style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#8D8D8E", textDecoration }}
                            className="truncate"
                          >
                            Related to: {linkedEntity?.entityId?.name || linkedEntity?.entityId?.title || "(Deal Name)"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      {primaryAssignee ? (
                        <div className="flex items-center justify-start gap-2">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={primaryAssignee.name}
                              className="rounded-full object-cover flex-shrink-0 border border-white"
                              style={{ width: 32, height: 32 }}
                            />
                          ) : (
                            <div
                              className="rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0 border border-white"
                              style={{ width: 32, height: 32 }}
                            >
                              {primaryAssignee.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span
                              style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "20px", color: "#0E121B", textDecoration }}
                              className="truncate"
                            >
                              {primaryAssignee.name}
                              {assignees.length > 1 ? ` +${assignees.length - 1}` : ""}
                            </span>
                            <span
                              style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "20px", color: "#8D8D8E", textDecoration }}
                              className="truncate"
                            >
                              {primaryAssignee.role || "Team Member"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <span
                        className="inline-flex items-center justify-center"
                        style={{
                          padding: "5px 12px",
                          borderRadius: 53,
                          backgroundColor: isCompleted ? "rgba(0, 201, 80, 0.1)" : "rgba(0, 133, 255, 0.1)",
                          fontFamily: "Inter",
                          fontWeight: 500,
                          fontSize: 12,
                          lineHeight: "120%",
                          color: isCompleted ? "#00C950" : "#0085FF",
                        }}
                      >
                        {isCompleted ? "Completed" : "In-Progress"}
                      </span>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      {priority ? (
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            padding: "5px 12px",
                            borderRadius: 53,
                            backgroundColor: (priorityStyles[priority] || priorityStyles.medium).bg,
                            fontFamily: "Inter",
                            fontWeight: 500,
                            fontSize: 12,
                            lineHeight: "120%",
                            color: (priorityStyles[priority] || priorityStyles.medium).color,
                          }}
                        >
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <div className="flex flex-col gap-0.5">
                        <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866", textDecoration }}>
                          {dueLabel.day} {dueLabel.time}
                        </span>
                        {isCompleted ? (
                          <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#00C950" }}>
                            Completed
                          </span>
                        ) : (
                          isOverdue && (
                            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#CD3636" }}>
                              Overdue
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, backgroundColor: "#D9D9D9" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#00C950" : "#0085FF" }}
                          />
                        </div>
                        <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }} className="flex-shrink-0">
                          {progress}%
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskClick(task);
                          }}
                          className="p-1 rounded hover:bg-gray-200 text-gray-800 flex-shrink-0"
                          title="More options"
                        >
                          <MoreVertIcon className="w-5 h-5" />
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
      )}

      {listTotalCount > 0 && (
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
                <span className="font-semibold">{listTotalCount}</span> results
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

      <CompanyTaskForm
        open={showTaskForm}
        mode={editingTask ? "view" : "create"}
        startInEditMode={!!editingTask}
        taskData={editingTask}
        companyId={companyId}
        users={users}
        onSave={handleTaskSave}
        onUpdate={async () => {
          await refetchTasks();
          setShowTaskForm(false);
          setEditingTask(null);
        }}
        onClose={() => {
          setShowTaskForm(false);
          setEditingTask(null);
        }}
      />

      <TaskDetailsModal
        open={isDetailsOpen}
        taskData={selectedTask}
        users={users}
        onDelete={handleTaskDelete}
        onEdit={handleEditTask}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
