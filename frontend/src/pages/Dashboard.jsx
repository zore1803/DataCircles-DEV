import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import TaskAndMeeting, { TasksCard } from "../components/dashboard/TaskAndMeeting";
import ClientsAndDeals from "../components/dashboard/ClientsAndDeals";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import RevenueOvertime from "../components/dashboard/RevenueOvertime";
import PaymentInformation from "../components/dashboard/PaymentInformation";
import MeetingsInformation from "../components/dashboard/MeetingsInformation";
import logo from "/DataCircles.png";

function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [user, setUser] = useState({});
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);

  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [totalClients, setTotalClients] = useState(0);
  const [activeDeals, setActiveDeals] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalMeetings, setTotalMeetings] = useState(0);

  const [averageDealSize, setAverageDealSize] = useState(0);
  const [invoiceStats, setInvoiceStats] = useState({
    delivered: 0,
    sent: 0,
    accepted: 0,
    total: 0,
  });

  // Stable loading message (no re-renders)
  const loadingMessage = useMemo(() => {
    const messages = [
      "Gathering your business insights...",
      "Loading your CRM dashboard...",
      "Preparing your sales overview...",
      "Crunching client data for you...",
      "Setting up your success metrics...",
      "Fetching deals and tasks...",
      "Building your business snapshot...",
      "Syncing your customer pipeline...",
      "Organizing your dashboard data...",
      "Your CRM command center is loading...",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }, []);

  // --------------- Utility Functions ------------------
  const calculateAverageDealAmount = (deals) => {
    if (!Array.isArray(deals) || deals.length === 0) return 0;
    const total = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
    return total / deals.length;
  };

  const calculateInvoiceStats = (invoices) => {
    const stats = { delivered: 0, sent: 0, accepted: 0, total: 0 };

    invoices?.forEach((invoice) => {
      const amount = invoice.amount || 0;
      const status = invoice.status?.toLowerCase();

      if (status === "delivered") stats.delivered += amount;
      if (status === "sent") stats.sent += amount;
      if (status === "accepted") stats.accepted += amount;
    });

    stats.total = stats.delivered + stats.sent + stats.accepted;
    return stats;
  };

  // ---------------- Greeting & Subtitle ----------------
  const friendlyGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = (user?.name || "there").split(" ")[0];
    const isWeekend = [0, 6].includes(new Date().getDay());

    const sets = {
      weekend: [
        `Weekend warrior, ${firstName}!`,
        `Hey ${firstName}! Working on the weekend?`,
        `Weekend vibes, ${firstName}!`,
      ],
      morning: [
        `Good morning, ${firstName}!`,
        `Rise and shine, ${firstName}!`,
        `Morning, ${firstName}! Ready to crush today?`,
      ],
      afternoon: [
        `Good afternoon, ${firstName}!`,
        `Hey ${firstName}, hope your day is productive!`,
      ],
      evening: [
        `Good evening, ${firstName}!`,
        `Evening, ${firstName}! Still going strong?`,
      ],
      night: [
        `Burning the midnight oil, ${firstName}?`,
        `Late night hustle, ${firstName}? Impressive!`,
      ],
    };

    if (isWeekend)
      return sets.weekend[Math.floor(Math.random() * sets.weekend.length)];

    if (hour < 12)
      return sets.morning[Math.floor(Math.random() * sets.morning.length)];
    if (hour < 17)
      return sets.afternoon[Math.floor(Math.random() * sets.afternoon.length)];
    if (hour < 22)
      return sets.evening[Math.floor(Math.random() * sets.evening.length)];

    return sets.night[Math.floor(Math.random() * sets.night.length)];
  }, [user]);

  const motivationalSubtitle = useMemo(() => {
    const subtitles = [
      "Let's see what's on your plate today",
      "Here's your business snapshot",
      "Time to make things happen",
      "Your success dashboard awaits",
      "Let's dive into your metrics",
    ];
    return subtitles[Math.floor(Math.random() * subtitles.length)];
  }, []);

  const summaryStats = useMemo(() => {
    const wonDeals = deals.filter(d => d.status === "Won");
    const closedCount = wonDeals.length;
    const revenueSum = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

    // Revenue section summary stats (for PaymentInformation)
    const allInvoices = invoices || [];
    const totalIssued = allInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalPaidSum = allInvoices
      .filter((inv) => inv.status?.toLowerCase() === "paid" || inv.status?.toLowerCase() === "accepted")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalUnpaid = totalIssued - totalPaidSum;

    // Monthly deal value (all deals created this month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyValue = deals
      .filter(d => {
        const date = new Date(d.createdAt);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    return {
      closedDeals: closedCount || 0,
      revenue: revenueSum || 0,
      monthlyDealValue: monthlyValue || 0,
      revenueSummary: {
        totalIssued: totalIssued || 0,
        totalPaid: totalPaidSum || 0,
        totalUnpaid: totalUnpaid || 0,
      }
    };
  }, [deals, invoices]);

  // ------------------- Auth Check ---------------------
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (!storedUser) {
      return navigate("/login");
    }

    // Remove the admin restriction
    setUser(storedUser);
  }, [navigate]);

  // ------------------- Data Fetching -------------------
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // const [
        //   companiesRes,
        //   contactsRes,
        //   dealsRes,
        //   tasksRes,
        //   invoicesRes,
        //   meetingRes,
        // ] = await Promise.all([
        //   API.get("/companies"),
        //   API.get("/contacts"),
        //   API.get("/deals"),
        //   API.get("/tasks/admin"),
        //   API.get("/invoices"),
        //   API.get("/meetings/all-meetings"),
        // ]);

        const [
          companiesRes,
          contactsRes,
          dealsRes,
          tasksRes,
          invoicesRes,
          meetingRes,
        ] = await Promise.all([
          API.get("/companies"),
          API.get("/contacts"),
          API.get("/deals/dashboard-deals"),
          API.get("/tasks"), // ⬅️ staff can now access this
          API.get("/invoices"), // ⬅️ filtered automatically
          API.get("/meetings/dashboard"), // ⬅️ staff gets own meetings
        ]);

        const allInvoices = invoicesRes.data;

        setDeals(dealsRes.data);
        setTotalClients(companiesRes.data.length);
        setActiveDeals(dealsRes.data.filter((d) => d.status === "Open").length);

        const allTasksData = tasksRes.data;
        setTasks(
          allTasksData.filter((t) => t.status === "Pending").slice(0, 3)
        );
        setAllTasks(allTasksData);
        setTotalTasks(allTasksData.length);

        setAllMeetings(meetingRes.data);
        setMeetings(meetingRes.data.slice(0, 3));
        setTotalMeetings(meetingRes.data.length);

        setInvoices(allInvoices.slice(0, 5));
        setAverageDealSize(calculateAverageDealAmount(dealsRes.data));
        setInvoiceStats(calculateInvoiceStats(allInvoices));
      } catch (err) {
        console.log(err);
        if (err.response?.data?.code == "NO_SUBSCRIPTION") {
          navigate("/subscription");
        }
        console.error("Dashboard error:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [navigate]);

  // ------------------- Loading UI -------------------
  // if (loading) {
  //   return (
  //     <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 z-50">
  //       <img
  //         src={logo}
  //         alt="Loading..."
  //         className="animate-spin drop-shadow-lg"
  //         style={{
  //           width: 48,
  //           height: 48,
  //           animationDuration: "1.8s",
  //           filter: "invert(100%)",
  //         }}
  //       />
  //       <p className="mt-3 text-gray-600 font-medium">{loadingMessage}</p>
  //     </div>
  //   );
  // }

  // ------------------- Error UI -------------------
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 text-lg font-medium mb-2">
            Error Loading Dashboard
          </p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ------------------- Dashboard UI -------------------
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-bold text-3xl text-gray-900 mb-1">
          {friendlyGreeting}
        </h1>
        <p className="text-lg text-gray-600 font-medium">
          {motivationalSubtitle}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <DashboardSummary stats={summaryStats} />

      <RevenueOvertime deals={deals} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <ClientsAndDeals
          totalClients={totalClients}
          activeDeals={activeDeals}
          averageDealSize={averageDealSize}
          deals={deals}
          invoiceStats={invoiceStats}
        />
        <TasksCard
          tasks={allTasks}
          totalTasks={totalTasks}
        />
      </div>


      <div className="mt-8">
        <PaymentInformation
          invoices={invoices}
          summary={summaryStats.revenueSummary}
        />
      </div>

      <div className="mt-8">
        <MeetingsInformation
          meetings={allMeetings}
        />
      </div>
    </div>
  );
}

export default Dashboard;
