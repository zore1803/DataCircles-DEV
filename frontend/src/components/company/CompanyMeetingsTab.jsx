import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Filter,
  Plus,
  Users,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import CompanyMeetingForm from "./CompanyMeetingForm";
import MeetingDetailsModal from "./MeetingDetailsModal";

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

const DayViewIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="12 14 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M16.1667 28.1667C15.7083 28.1667 15.316 28.0035 14.9896 27.6771C14.6632 27.3507 14.5 26.9583 14.5 26.5V21.5C14.5 21.0417 14.6632 20.6493 14.9896 20.3229C15.316 19.9965 15.7083 19.8333 16.1667 19.8333H27.8333C28.2917 19.8333 28.684 19.9965 29.0104 20.3229C29.3368 20.6493 29.5 21.0417 29.5 21.5V26.5C29.5 26.9583 29.3368 27.3507 29.0104 27.6771C28.684 28.0035 28.2917 28.1667 27.8333 28.1667H16.1667ZM16.1667 26.5H27.8333V21.5H16.1667V26.5ZM14.5 18.1667V16.5H29.5V18.1667H14.5ZM14.5 31.5V29.8333H29.5V31.5H14.5Z" fill="currentColor" />
  </svg>
);

const TotalMeetingsIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="24 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M35.7893 43.9712C35.8879 43.9712 35.9883 43.9481 36.0903 43.902C36.1921 43.8558 36.2725 43.8032 36.3315 43.7442L44.3295 35.7462C44.5552 35.5206 44.7251 35.2795 44.8393 35.023C44.9533 34.7666 45.0103 34.4975 45.0103 34.2155C45.0103 33.9231 44.9533 33.6417 44.8393 33.3712C44.7251 33.1006 44.5552 32.8576 44.3295 32.6422L40.3295 28.6422C40.1142 28.4166 39.8809 28.2515 39.6295 28.147C39.3784 28.0426 39.1066 27.9905 38.8143 27.9905C38.5323 27.9905 38.2614 28.0426 38.0018 28.147C37.7421 28.2515 37.5027 28.4166 37.2835 28.6422L36.7103 29.2155L38.5603 31.0807C38.7846 31.2949 38.9504 31.5391 39.0575 31.8135C39.1645 32.0878 39.218 32.3724 39.218 32.6672C39.218 33.2776 39.0142 33.7866 38.6065 34.1942C38.1989 34.6019 37.6899 34.8057 37.0795 34.8057C36.7847 34.8057 36.4991 34.757 36.2228 34.6595C35.9466 34.5621 35.7014 34.4064 35.4873 34.1922L33.593 32.3135L29.247 36.6595C29.1714 36.7351 29.1146 36.8198 29.0768 36.9135C29.0389 37.007 29.02 37.1031 29.02 37.202C29.02 37.3865 29.0829 37.5441 29.2085 37.675C29.3342 37.8058 29.4893 37.8712 29.6738 37.8712C29.7726 37.8712 29.8729 37.8481 29.9748 37.802C30.0768 37.7558 30.1573 37.7032 30.2163 37.6442L33.5008 34.3597L34.5545 35.4135L31.2853 38.698C31.2098 38.7736 31.1531 38.8583 31.1153 38.952C31.0774 39.0455 31.0585 39.1416 31.0585 39.2405C31.0585 39.4186 31.1229 39.5721 31.2518 39.701C31.3806 39.8298 31.5341 39.8942 31.7123 39.8942C31.8111 39.8942 31.9114 39.8711 32.0133 39.825C32.1153 39.7788 32.1957 39.7262 32.2545 39.6672L35.6545 36.2827L36.7085 37.3365L33.3238 40.7365C33.2546 40.7955 33.1995 40.8759 33.1585 40.9777C33.1175 41.0797 33.097 41.1801 33.097 41.2787C33.097 41.4571 33.1614 41.6106 33.2903 41.7395C33.4191 41.8683 33.5726 41.9327 33.7508 41.9327C33.8494 41.9327 33.9456 41.9138 34.0393 41.876C34.1328 41.8381 34.2174 41.7814 34.293 41.7057L37.693 38.3212L38.747 39.375L35.347 42.775C35.2714 42.8506 35.2146 42.9385 35.1768 43.0385C35.1389 43.1385 35.12 43.2346 35.12 43.327C35.12 43.5115 35.1886 43.665 35.3258 43.7875C35.4629 43.91 35.6174 43.9712 35.7893 43.9712ZM35.7738 45.471C35.2084 45.471 34.7155 45.2749 34.295 44.8827C33.8745 44.4904 33.6547 44.0019 33.6355 43.4172C33.0689 43.3787 32.5954 43.1775 32.2153 42.8135C31.8351 42.4493 31.629 41.9711 31.597 41.3787C31.0047 41.3404 30.5259 41.1334 30.1605 40.7577C29.795 40.3821 29.5994 39.9096 29.5738 39.3402C28.9789 39.3019 28.4879 39.0862 28.1008 38.6932C27.7136 38.3002 27.52 37.8031 27.52 37.202C27.52 36.9071 27.5761 36.6183 27.6883 36.3355C27.8004 36.0528 27.9636 35.8045 28.1778 35.5905L33.593 30.1905L36.522 33.1192C36.5809 33.1884 36.658 33.2436 36.7535 33.2847C36.8492 33.3257 36.9528 33.3462 37.0643 33.3462C37.2463 33.3462 37.4033 33.286 37.5353 33.1655C37.6674 33.045 37.7335 32.8872 37.7335 32.6922C37.7335 32.5807 37.713 32.4772 37.672 32.3817C37.6309 32.2862 37.5757 32.209 37.5065 32.15L33.9988 28.6422C33.7834 28.4166 33.5485 28.2515 33.294 28.147C33.0395 28.0426 32.7661 27.9905 32.4738 27.9905C32.1918 27.9905 31.9242 28.0426 31.671 28.147C31.4177 28.2515 31.1783 28.4166 30.9528 28.6422L27.668 31.9422C27.486 32.1242 27.337 32.3393 27.221 32.5875C27.105 32.8355 27.0368 33.0884 27.0163 33.3462C26.9956 33.5591 27.0052 33.7696 27.045 33.978C27.0847 34.1863 27.1545 34.3821 27.2545 34.5655L26.1508 35.6692C25.9251 35.3436 25.7553 34.9788 25.6413 34.575C25.5271 34.1711 25.4803 33.7616 25.5008 33.3462C25.5213 32.8859 25.6251 32.4413 25.8123 32.0125C25.9994 31.5836 26.2616 31.2006 26.5988 30.8635L29.8738 27.5885C30.2483 27.2243 30.6557 26.9503 31.096 26.7665C31.5364 26.5825 31.9989 26.4905 32.4835 26.4905C32.968 26.4905 33.4289 26.5825 33.866 26.7665C34.3034 26.9503 34.704 27.2243 35.068 27.5885L35.6413 28.1615L36.2143 27.5885C36.5886 27.2243 36.9944 26.9503 37.4315 26.7665C37.8687 26.5825 38.3296 26.4905 38.8143 26.4905C39.2989 26.4905 39.7614 26.5825 40.2018 26.7665C40.6421 26.9503 41.0444 27.2243 41.4085 27.5885L45.3835 31.5635C45.7475 31.9276 46.0264 32.3421 46.22 32.8067C46.4135 33.2714 46.5103 33.7461 46.5103 34.2307C46.5103 34.7154 46.4135 35.1763 46.22 35.6135C46.0264 36.0506 45.7475 36.4512 45.3835 36.8152L37.3853 44.798C37.1648 45.0185 36.9164 45.1858 36.6403 45.3C36.3639 45.414 36.0751 45.471 35.7738 45.471Z" fill="#0085FF" />
  </svg>
);

const UpcomingMeetingsIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="361.5 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M374.557 41.328C374.109 40.8798 373.885 40.3346 373.885 39.6923C373.885 39.0499 374.109 38.5048 374.557 38.0568C375.005 37.6088 375.55 37.3848 376.192 37.3848C376.835 37.3848 377.38 37.6088 377.828 38.0568C378.276 38.5048 378.5 39.0499 378.5 39.6923C378.5 40.3346 378.276 40.8798 377.828 41.328C377.38 41.776 376.835 42 376.192 42C375.55 42 375.005 41.776 374.557 41.328ZM366.808 45.5C366.303 45.5 365.875 45.325 365.525 44.975C365.175 44.625 365 44.1974 365 43.6923V30.3078C365 29.8026 365.175 29.375 365.525 29.025C365.875 28.675 366.303 28.5 366.808 28.5H368.192V26.3848H369.731V28.5H377.308V26.3848H378.808V28.5H380.192C380.697 28.5 381.125 28.675 381.475 29.025C381.825 29.375 382 29.8026 382 30.3078V43.6923C382 44.1974 381.825 44.625 381.475 44.975C381.125 45.325 380.697 45.5 380.192 45.5H366.808ZM366.808 44H380.192C380.269 44 380.34 43.9679 380.404 43.9038C380.468 43.8398 380.5 43.7693 380.5 43.6923V34.3078H366.5V43.6923C366.5 43.7693 366.532 43.8398 366.596 43.9038C366.66 43.9679 366.731 44 366.808 44ZM366.5 32.8078H380.5V30.3078C380.5 30.2308 380.468 30.1603 380.404 30.0963C380.34 30.0321 380.269 30 380.192 30H366.808C366.731 30 366.66 30.0321 366.596 30.0963C366.532 30.1603 366.5 30.2308 366.5 30.3078V32.8078Z" fill="#0085FF" />
  </svg>
);

const ListViewIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="56.5 16.9167 15 14.167" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M60.6667 17.3334H71.5V19.0001H60.6667V17.3334ZM56.5 16.9167H59V19.4167H56.5V16.9167ZM56.5 22.7501H59V25.2501H56.5V22.7501ZM56.5 28.5834H59V31.0834H56.5V28.5834ZM60.6667 23.1667H71.5V24.8334H60.6667V23.1667ZM60.6667 29.0001H71.5V30.6667H60.6667V29.0001Z" fill="currentColor" />
  </svg>
);

const CompletedMeetingsIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="24 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M29.3077 45.5C28.8026 45.5 28.375 45.325 28.025 44.975C27.675 44.625 27.5 44.1974 27.5 43.6923V30.3078C27.5 29.8026 27.675 29.375 28.025 29.025C28.375 28.675 28.8026 28.5 29.3077 28.5H30.6923V26.3848H32.2308V28.5H39.8077V26.3848H41.3077V28.5H42.6923C43.1974 28.5 43.625 28.675 43.975 29.025C44.325 29.375 44.5 29.8026 44.5 30.3078V43.6923C44.5 44.1974 44.325 44.625 43.975 44.975C43.625 45.325 43.1974 45.5 42.6923 45.5H29.3077ZM29.3077 44H42.6923C42.7692 44 42.8398 43.9679 42.9038 43.9038C42.9679 43.8398 43 43.7693 43 43.6923V34.3078H29V43.6923C29 43.7693 29.0321 43.8398 29.0963 43.9038C29.1603 43.9679 29.2307 44 29.3077 44ZM29 32.8078H43V30.3078C43 30.2308 42.9679 30.1603 42.9038 30.0963C42.8398 30.0321 42.7692 30 42.6923 30H29.3077C29.2307 30 29.1603 30.0321 29.0963 30.0963C29.0321 30.1603 29 30.2308 29 30.3078V32.8078ZM31.25 37.75V36.25H40.75V37.75H31.25ZM31.25 41.75V40.25H37.75V41.75H31.25Z" fill="#0085FF" />
  </svg>
);

const NextMeetingIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="361.5 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M375.798 38.149C376.487 37.7483 377.042 37.2179 377.463 36.5577C376.911 36.1321 376.299 35.8077 375.627 35.5848C374.955 35.3616 374.245 35.25 373.499 35.25C372.753 35.25 372.044 35.3616 371.371 35.5848C370.699 35.8077 370.087 36.1321 369.536 36.5577C369.956 37.2179 370.511 37.7483 371.2 38.149C371.889 38.5497 372.656 38.75 373.499 38.75C374.343 38.75 375.109 38.5497 375.798 38.149ZM373.499 33.75C373.985 33.75 374.398 33.5798 374.739 33.2395C375.079 32.899 375.249 32.4858 375.249 32C375.249 31.5142 375.079 31.101 374.739 30.7605C374.398 30.4202 373.985 30.25 373.499 30.25C373.013 30.25 372.6 30.4202 372.26 30.7605C371.919 31.101 371.749 31.5142 371.749 32C371.749 32.4858 371.919 32.899 372.26 33.2395C372.6 33.5798 373.013 33.75 373.499 33.75ZM373.499 43.5135C375.456 41.7622 376.953 40.0823 377.99 38.474C379.028 36.8657 379.547 35.457 379.547 34.248C379.547 32.425 378.968 30.9263 377.81 29.752C376.651 28.5777 375.215 27.9905 373.499 27.9905C371.784 27.9905 370.347 28.5777 369.189 29.752C368.03 30.9263 367.451 32.425 367.451 34.248C367.451 35.457 367.97 36.8657 369.008 38.474C370.046 40.0823 371.543 41.7622 373.499 43.5135ZM373.499 45.5095C370.983 43.3288 369.095 41.2994 367.838 39.4212C366.58 37.5429 365.951 35.8185 365.951 34.248C365.951 31.9403 366.698 30.0721 368.19 28.6432C369.683 27.2144 371.453 26.5 373.499 26.5C375.545 26.5 377.315 27.2144 378.808 28.6432C380.301 30.0721 381.047 31.9403 381.047 34.248C381.047 35.8185 380.418 37.5429 379.161 39.4212C377.903 41.2994 376.016 43.3288 373.499 45.5095Z" fill="#0085FF" />
  </svg>
);

const MoreVertIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10 5.83333C10.9167 5.83333 11.6667 5.08333 11.6667 4.16667C11.6667 3.25 10.9167 2.5 10 2.5C9.08333 2.5 8.33333 3.25 8.33333 4.16667C8.33333 5.08333 9.08333 5.83333 10 5.83333ZM10 8.33333C9.08333 8.33333 8.33333 9.08333 8.33333 10C8.33333 10.9167 9.08333 11.6667 10 11.6667C10.9167 11.6667 11.6667 10.9167 11.6667 10C11.6667 9.08333 10.9167 8.33333 10 8.33333ZM10 14.1667C9.08333 14.1667 8.33333 14.9167 8.33333 15.8333C8.33333 16.75 9.08333 17.5 10 17.5C10.9167 17.5 11.6667 16.75 11.6667 15.8333C11.6667 14.9167 10.9167 14.1667 10 14.1667Z" fill="#1C1B1F" />
  </svg>
);

export default function CompanyMeetingsTab({ companyId, meetings = [], setMeetings }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [pinnedColumn, setPinnedColumn] = useState(null);
  const [colWidths, setColWidths] = useState({
    title: 212,
    type: 160,
    dateTime: 209,
    duration: 113,
    attendees: 140,
    organiser: 144,
    relatedTo: 155,
    status: 213,
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
        const res = await API.get(`/contacts/company/${companyId}`);
        setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load contacts:", err);
      }
    };
    if (companyId) fetchUsers();
  }, [companyId]);

  const refetchMeetings = async () => {
    try {
      const res = await API.get("/meetings", { params: { companyId } });
      setMeetings(res.data.meetings);
    } catch (err) {
      console.error("Failed to refetch meetings:", err);
    }
  };

  const handleMeetingSave = async (meetingData) => {
    try {
      await API.post("/meetings", meetingData);
      await refetchMeetings();
      toast.success("Meeting created successfully!");
      setShowMeetingForm(false);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create meeting.");
      }
      throw err;
    }
  };

  const handleMeetingDelete = async (meetingId) => {
    try {
      await API.delete(`/meetings/${meetingId}`);
      await refetchMeetings();
      toast.success("Meeting deleted successfully!");
      setIsDetailsOpen(false);
      setSelectedMeeting(null);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete meeting.");
      }
      throw err;
    }
  };

  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
    setIsDetailsOpen(true);
  };

  const filteredMeetings = useMemo(() => {
    if (!searchTerm.trim()) return meetings;
    const q = searchTerm.toLowerCase();
    return meetings.filter((m) => (m.title || "").toLowerCase().includes(q));
  }, [meetings, searchTerm]);

  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(10);

  const listTotalCount = filteredMeetings.length;
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

  const paginatedMeetings = useMemo(
    () => filteredMeetings.slice((listPage - 1) * listLimit, listPage * listLimit),
    [filteredMeetings, listPage, listLimit],
  );

  const now = new Date();
  const in15Days = new Date();
  in15Days.setDate(in15Days.getDate() + 15);

  const total = meetings.length;
  const upcoming = meetings.filter(
    (m) => m.scheduledAt && new Date(m.scheduledAt) >= now,
  );
  const upcomingIn15 = upcoming.filter(
    (m) => new Date(m.scheduledAt) <= in15Days,
  ).length;
  const completed = meetings.filter(
    (m) => m.scheduledAt && new Date(m.scheduledAt) < now,
  ).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const nextMeeting = [...upcoming].sort(
    (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt),
  )[0];

  const nextMeetingLabel = (() => {
    if (!nextMeeting) return "—";
    const d = new Date(nextMeeting.scheduledAt);
    const isTomorrow =
      d.toDateString() ===
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    const isToday = d.toDateString() === now.toDateString();
    const dayLabel = isToday
      ? "Today"
      : isTomorrow
        ? "Tomorrow"
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dayLabel} • ${time}`;
  })();

  const kpiTiles = [
    {
      label: "Total Meetings",
      value: total,
      icon: TotalMeetingsIcon,
      subtitle: "Since Onboarding",
      subtitleClass: "text-gray-400",
    },
    {
      label: "Upcoming",
      value: upcomingIn15,
      icon: UpcomingMeetingsIcon,
      subtitle: "Next 15 Days",
      subtitleClass: "text-blue-500",
    },
    {
      label: "Completed",
      value: completed,
      icon: CompletedMeetingsIcon,
      subtitle: `${completionRate}% Completion Rate`,
      subtitleClass: "text-green-600",
    },
    {
      label: "Next Meeting",
      value: nextMeetingLabel,
      icon: NextMeetingIcon,
      valueSmall: true,
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
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
                <p
                  className={`font-semibold text-gray-900 ${tile.valueSmall ? "text-sm" : "text-base"}`}
                >
                  {tile.value}
                </p>
              </div>
              {tile.subtitle && (
                <span className={`text-[11px] flex-shrink-0 whitespace-nowrap ${tile.subtitleClass}`}>
                  {tile.subtitle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
        <div className="relative flex-1 h-full">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by meetings by type, time, or contact..."
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
        <div className="flex items-center gap-1.5 p-1 bg-[#E9EAEB] rounded-full flex-shrink-0" style={{ height: "44px" }}>
          <button
            onClick={() => setViewMode("day")}
            title="Day view"
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
              viewMode === "day"
                ? "bg-white text-[#0085FF] shadow-[0px_0px_6px_rgba(0,0,0,0.1)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <DayViewIcon size={20} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            title="List view"
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
              viewMode === "list"
                ? "bg-white text-[#0085FF] shadow-[0px_0px_6px_rgba(0,0,0,0.1)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ListViewIcon size={15} />
          </button>
        </div>
        <button
          onClick={() => setShowMeetingForm(true)}
          className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
          style={{ width: "44px", height: "44px", borderColor: "#E1E4EA" }}
          title="Add Meeting"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Meeting list or empty state */}
      {filteredMeetings.length === 0 ? (
        <button
          onClick={() => setShowMeetingForm(true)}
          className="flex flex-col items-center justify-center w-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <Users size={28} className="mb-2" />
          <span className="text-sm font-medium">Add New Meetings</span>
        </button>
      ) : viewMode === "list" ? (
        <div
          className="box-border flex flex-col items-start w-full bg-white overflow-x-auto"
          style={{ border: "1px solid #E1E4EA", borderRadius: 8 }}
        >
          <table className="text-sm text-left border-collapse" style={{ tableLayout: "fixed", width: "100%", minWidth: totalTableWidth }}>
            <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
              <tr>
                {[
                  { id: "title", label: "Meeting Title", pinnable: true, firstCol: true },
                  { id: "type", label: "Type", pinnable: true, firstCol: true },
                  { id: "dateTime", label: "Date & Time", pinnable: true },
                  { id: "duration", label: "Duration", pinnable: true },
                  { id: "attendees", label: "Attendees", pinnable: true },
                  { id: "organiser", label: "Organiser", pinnable: true },
                  { id: "relatedTo", label: "₹ Related to", pinnable: true },
                  { id: "status", label: "Status", pinnable: true },
                ].map((col) => {
                  const isPinned = pinnedColumn === col.id;
                  return (
                    <th
                      key={col.id}
                      style={{ width: colWidths[col.id], height: 56, position: "relative" }}
                      className={`py-2.5 font-medium text-[#525252] text-xs border-r border-[#E1E4EA] ${
                        col.firstCol ? "pl-6 pr-3" : "px-3"
                      }`}
                    >
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
              {paginatedMeetings.map((meeting) => {
                const participants = meeting.participants || [];
                const organizer = typeof meeting.createdBy === "object" ? meeting.createdBy : null;
                return (
                  <tr
                    key={meeting._id}
                    onClick={() => handleMeetingClick(meeting)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td style={{ height: 60 }} className="pl-6 pr-3 truncate">
                      <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#222530" }} className="truncate">
                        {meeting.title || "Untitled Meeting"}
                      </span>
                    </td>
                    <td style={{ height: 60 }} className="pl-6 pr-3">
                      <span
                        className="inline-flex items-center justify-center capitalize"
                        style={{
                          padding: "5px 12px",
                          borderRadius: 53,
                          backgroundColor: "rgba(0, 133, 255, 0.1)",
                          fontFamily: "Inter",
                          fontWeight: 500,
                          fontSize: 12,
                          lineHeight: "120%",
                          color: "#0085FF",
                        }}
                      >
                        {meeting.meetingType || "General"}
                      </span>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <div className="flex flex-col">
                        <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }} className="truncate">
                          {meeting.scheduledAt
                            ? new Date(meeting.scheduledAt).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </span>
                        <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "rgba(28, 28, 29, 0.5)" }} className="truncate">
                          {meeting.scheduledAt
                            ? new Date(meeting.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </span>
                      </div>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }}>
                        {meeting.duration ? `${meeting.duration} min` : "—"}
                      </span>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      {participants.length ? (
                        <div className="flex items-center">
                          {participants.slice(0, 3).map((p, i) => (
                            <div
                              key={p._id || i}
                              className="rounded-full bg-gray-200 border border-white flex items-center justify-center text-[9px] font-semibold text-gray-600 flex-shrink-0"
                              style={{ width: 24, height: 24, marginLeft: i === 0 ? 0 : -8 }}
                            >
                              {p.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          ))}
                          {participants.length > 3 && (
                            <div
                              className="rounded-full bg-[#D9D9D9] border border-white flex items-center justify-center flex-shrink-0"
                              style={{ width: 24, height: 24, marginLeft: -8 }}
                            >
                              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#78788D" }}>
                                +{participants.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <div className="flex items-center" style={{ gap: 6 }}>
                        <div
                          className="rounded-full bg-blue-100 border border-white flex items-center justify-center text-[10px] font-semibold text-blue-700 flex-shrink-0"
                          style={{ width: 24, height: 24 }}
                        >
                          {organizer?.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 12, lineHeight: "120%", color: "#1C1C1D" }} className="truncate">
                          {organizer?.name || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <div className="flex flex-col">
                        <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#0085FF" }} className="truncate">
                          {meeting.dealCode || meeting.company?.name || "—"}
                        </span>
                        <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "20px", color: "#525866" }} className="truncate">
                          {meeting.amount ? `₹${Number(meeting.amount).toLocaleString("en-IN")}` : "—"}
                        </span>
                      </div>
                    </td>
                    <td style={{ height: 60 }} className="px-3">
                      <div className="flex items-center justify-start" style={{ gap: 8 }}>
                        <span
                          className="inline-flex items-center justify-center capitalize"
                          style={{
                            padding: "5px 12px",
                            borderRadius: 53,
                            backgroundColor: meeting.status === "completed" ? "rgba(0, 201, 80, 0.1)" : "rgba(0, 133, 255, 0.1)",
                            fontFamily: "Inter",
                            fontWeight: 500,
                            fontSize: 12,
                            lineHeight: "120%",
                            color: meeting.status === "completed" ? "#00C950" : "#0085FF",
                          }}
                        >
                          {meeting.status || "scheduled"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMeetingClick(meeting);
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
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedMeetings.map((meeting) => (
            <button
              key={meeting._id}
              onClick={() => handleMeetingClick(meeting)}
              className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-blue-300 transition-all text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                <Users size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {meeting.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {meeting.scheduledAt &&
                    new Date(meeting.scheduledAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                    })}{" "}
                  · {meeting.status}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewMode === "list" && listTotalCount > 0 && (
        <div className="w-full bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
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

      {showMeetingForm && (
        <CompanyMeetingForm
          open={showMeetingForm}
          mode="create"
          companyId={companyId}
          users={users}
          onSave={handleMeetingSave}
          onDelete={handleMeetingDelete}
          onClose={() => setShowMeetingForm(false)}
        />
      )}

      <MeetingDetailsModal
        open={isDetailsOpen}
        meetingData={selectedMeeting}
        users={users}
        onDelete={handleMeetingDelete}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
