import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Building,
  IndianRupeeIcon,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import toast from "react-hot-toast";
import API, { configureAxios } from "../services/api";

const Shimmer = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-xl border border-gray-200 h-40"
        ></div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-xl border border-gray-200 h-32"
        ></div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 h-80"></div>
      <div className="bg-white p-6 rounded-xl border border-gray-200 h-80"></div>
    </div>
  </div>
);

const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  gradient,
  subtitle,
  trend,
}) => (
  <div className="relative overflow-hidden bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group">
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`p-3 rounded-lg ${gradient} group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>

      {change && (
        <div className="flex items-center space-x-2">
          {trend === "up" ? (
            <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-md">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span className="text-sm font-semibold">{change}</span>
            </div>
          ) : trend === "down" ? (
            <div className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded-md">
              <ArrowDownRight className="w-4 h-4 mr-1" />
              <span className="text-sm font-semibold">{change}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500">{change}</span>
          )}
        </div>
      )}
    </div>

    <div
      className={`h-1 ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
    ></div>
  </div>
);

const MetricCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-md">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
  </div>
);

const AlertBanner = ({ type, message }) => {
  const styles = {
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    success: "bg-green-50 border-green-200 text-green-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const icons = {
    warning: AlertCircle,
    success: CheckCircle2,
    info: Clock,
  };

  const Icon = icons[type];

  return (
    <div
      className={`${styles[type]} border rounded-lg p-4 flex items-center space-x-3`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

const Overview = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        configureAxios();
        const response = await API.get("/super-admin/overview");
        const {
          totalOrganizations,
          totalUsers,
          totalRevenue,
          activeSubscriptions,
          recentOrganizations,
          recentUsers, // NEW: Add this to your backend response
        } = response.data;

        // Calculate derived metrics
        const avgRevenuePerOrg =
          totalOrganizations > 0 ? totalRevenue / totalOrganizations : 0;
        const avgUsersPerOrg =
          totalOrganizations > 0 ? totalUsers / totalOrganizations : 0;
        const subscriptionRate =
          totalOrganizations > 0
            ? (activeSubscriptions / totalOrganizations) * 100
            : 0;

        // Calculate growth metrics from recentOrganizations
        const last30Days = recentOrganizations || [];
        const last7Days = last30Days.filter((org) => {
          const daysDiff =
            (Date.now() - new Date(org.createdAt).getTime()) /
            (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        });

        const weeklyGrowth = last7Days.length;
        const monthlyGrowth = last30Days.length;

        // Transform organization growth data for chart
        const growthDataMap = {};
        last30Days.forEach((org) => {
          const date = new Date(org.createdAt).toISOString().split("T")[0];
          growthDataMap[date] = (growthDataMap[date] || 0) + 1;
        });

        const sortedDates = Object.keys(growthDataMap).sort();
        let cumulativeCount = totalOrganizations - last30Days.length;

        const growthChartData = sortedDates.map((date) => {
          cumulativeCount += growthDataMap[date];
          return {
            date: new Date(date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            organizations: cumulativeCount,
            newOrgs: growthDataMap[date],
          };
        });

        // NEW: Process user growth data
        const recentUsersData = recentUsers || [];
        const usersLast7Days = recentUsersData.filter((user) => {
          const daysDiff =
            (Date.now() - new Date(user.createdAt).getTime()) /
            (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        });

        const weeklyUserGrowth = usersLast7Days.length;
        const monthlyUserGrowth = recentUsersData.length;

        // Transform user growth data for chart
        const userGrowthDataMap = {};
        recentUsersData.forEach((user) => {
          const date = new Date(user.createdAt).toISOString().split("T")[0];
          userGrowthDataMap[date] = (userGrowthDataMap[date] || 0) + 1;
        });

        const sortedUserDates = Object.keys(userGrowthDataMap).sort();
        let cumulativeUserCount = totalUsers - recentUsersData.length;

        const userGrowthChartData = sortedUserDates.map((date) => {
          cumulativeUserCount += userGrowthDataMap[date];
          return {
            date: new Date(date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            users: cumulativeUserCount,
            newUsers: userGrowthDataMap[date],
          };
        });

        setMetrics({
          totalOrganizations,
          totalUsers,
          totalRevenue,
          activeSubscriptions,
          avgRevenuePerOrg,
          avgUsersPerOrg,
          subscriptionRate,
          weeklyGrowth,
          monthlyGrowth,
          weeklyUserGrowth,
          monthlyUserGrowth,
          growthChartData,
          userGrowthChartData,
          inactiveOrgs: totalOrganizations - activeSubscriptions,
        });
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch overview data");
        toast.error(
          err.response?.data?.error || "Failed to fetch overview data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) return <Shimmer />;

  if (error)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Dashboard
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            DataCircles Technology (Admin Dashboard)
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor your platform's key performance metrics
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Last Updated</p>
          <p className="text-sm font-semibold text-gray-900">
            {new Date().toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Alert Banners */}
      <div className="grid gap-4">
        {metrics.inactiveOrgs > 0 && (
          <AlertBanner
            type="warning"
            message={`${metrics.inactiveOrgs} organizations without active subscriptions - potential churn risk`}
          />
        )}
        {metrics.weeklyGrowth > 0 && (
          <AlertBanner
            type="success"
            message={`${metrics.weeklyGrowth} new organizations joined this week`}
          />
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Organizations"
          value={metrics.totalOrganizations.toLocaleString()}
          change={`+${metrics.monthlyGrowth} this month`}
          trend={metrics.monthlyGrowth > 0 ? "up" : "neutral"}
          icon={Building}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
        />

        <StatCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          change={`+${metrics.monthlyUserGrowth} this month`}
          trend={metrics.monthlyUserGrowth > 0 ? "up" : "neutral"}
          icon={Users}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
        />

        <StatCard
          title="Total Revenue"
          value={`₹${metrics.totalRevenue.toLocaleString()}`}
          change={`₹${Math.round(
            metrics.avgRevenuePerOrg
          ).toLocaleString()} per org`}
          icon={IndianRupee}
          gradient="bg-gradient-to-br from-purple-500 to-purple-600"
        />

        <StatCard
          title="Active Subscriptions"
          value={metrics.activeSubscriptions.toLocaleString()}
          change={`${metrics.subscriptionRate.toFixed(1)}% adoption rate`}
          trend={
            metrics.subscriptionRate >= 80
              ? "up"
              : metrics.subscriptionRate < 50
              ? "down"
              : "neutral"
          }
          icon={Activity}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600"
        />
      </div>

      {/* Secondary Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Key Performance Indicators
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            label="Avg Revenue per Organization"
            value={`₹${Math.round(metrics.avgRevenuePerOrg).toLocaleString()}`}
            icon={IndianRupeeIcon}
            color="text-green-600"
          />

          <MetricCard
            label="Avg Users per Organization"
            value={metrics.avgUsersPerOrg.toFixed(1)}
            icon={Users}
            color="text-blue-600"
          />

          <MetricCard
            label="Subscription Adoption Rate"
            value={`${metrics.subscriptionRate.toFixed(1)}%`}
            icon={TrendingUp}
            color="text-purple-600"
          />
        </div>
      </div>

      {/* Growth Charts - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization Growth Chart */}
        {metrics.growthChartData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Organization Growth Trend
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {metrics.monthlyGrowth} organizations added in the last 30 days
              </p>
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={metrics.growthChartData}>
                <defs>
                  <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  stroke="#9CA3AF"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  stroke="#9CA3AF"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ color: "#111827", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="organizations"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorOrgs)"
                  name="Total Organizations"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* User Growth Chart */}
        {metrics.userGrowthChartData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                User Count Growth Trend
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {metrics.monthlyUserGrowth} users added in the last 30 days
              </p>
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={metrics.userGrowthChartData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  stroke="#9CA3AF"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  stroke="#9CA3AF"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ color: "#111827", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#10B981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                  name="Total Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick Insights Panel */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-blue-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Weekly Org Growth
              </span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {metrics.weeklyGrowth}
            </p>
            <p className="text-xs text-gray-500 mt-1">New orgs this week</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Weekly User Growth
              </span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {metrics.weeklyUserGrowth}
            </p>
            <p className="text-xs text-gray-500 mt-1">New users this week</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Inactive Orgs
              </span>
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {metrics.inactiveOrgs}
            </p>
            <p className="text-xs text-gray-500 mt-1">Without subscriptions</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Health Score
              </span>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {metrics.subscriptionRate >= 80
                ? "Excellent"
                : metrics.subscriptionRate >= 60
                ? "Good"
                : metrics.subscriptionRate >= 40
                ? "Fair"
                : "Needs Attention"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Platform health</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
