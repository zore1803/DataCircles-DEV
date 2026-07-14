import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

const DealOverview = ({ deals }) => {
  // Process real deals data with intelligent date grouping
  // const { dealStages, timeSeriesData, totalValue, quarterlyGrowth, yearlyGrowth, isMonthlyView } = useMemo(() => {
  //   if (!Array.isArray(deals) || deals.length === 0) {
  //     return {
  //       dealStages: [],
  //       timeSeriesData: [],
  //       totalValue: 0,
  //       quarterlyGrowth: 0,
  //       yearlyGrowth: 0,
  //       isMonthlyView: true
  //     };
  //   }

  //   // Aggregate deal values by actual status
  //   const statusValues = {};
  //   deals.forEach(deal => {
  //     const status = deal.status || 'Unknown';
  //     statusValues[status] = (statusValues[status] || 0) + (deal.amount || 0);
  //   });

  //   const dealStages = Object.keys(statusValues)
  //     .filter(status => statusValues[status] > 0)
  //     .map(status => ({
  //       stage: status,
  //       value: statusValues[status]
  //     }))
  //     .sort((a, b) => b.value - a.value);

  //   // Check if all deals are from the same month
  //   const dealMonths = new Set();
  //   deals.forEach(deal => {
  //     const date = new Date(deal.createdAt);
  //     const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
  //     dealMonths.add(monthYear);
  //   });

  //   const isSingleMonth = dealMonths.size === 1;
  //   let timeSeriesData = [];
  //   let isMonthlyView = true;

  //   if (isSingleMonth) {
  //     // Group by day
  //     isMonthlyView = false;
  //     const dailyAggregation = {};

  //     deals.forEach(deal => {
  //       const date = new Date(deal.createdAt);
  //       const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  //       dailyAggregation[dayKey] = (dailyAggregation[dayKey] || 0) + (deal.amount || 0);
  //     });

  //     const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  //     timeSeriesData = Object.entries(dailyAggregation)
  //       .map(([dateKey, value]) => {
  //         const [year, month, day] = dateKey.split('-');
  //         const monthName = monthNames[parseInt(month) - 1];
  //         return {
  //           label: `${monthName} ${parseInt(day)}`,
  //           value: value,
  //           sortKey: dateKey
  //         };
  //       })
  //       .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  //   } else {
  //     // Group by month
  //     isMonthlyView = true;
  //     const monthlyAggregation = {};

  //     deals.forEach(deal => {
  //       const date = new Date(deal.createdAt);
  //       const month = date.getMonth();
  //       monthlyAggregation[month] = (monthlyAggregation[month] || 0) + (deal.amount || 0);
  //     });

  //     const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  //     timeSeriesData = Object.entries(monthlyAggregation)
  //       .map(([monthNumber, value]) => ({
  //         label: monthNames[parseInt(monthNumber)],
  //         value: value,
  //         sortKey: parseInt(monthNumber)
  //       }))
  //       .sort((a, b) => a.sortKey - b.sortKey);
  //   }

  //   const totalValue = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);

  //   return {
  //     dealStages,
  //     timeSeriesData,
  //     totalValue,
  //     quarterlyGrowth: 15,
  //     yearlyGrowth: 20,
  //     isMonthlyView
  //   };
  // }, [deals]);
  const {
    dealStages,
    timeSeriesData,
    totalValue,
    quarterlyGrowth,
    yearlyGrowth,
    isMonthlyView,
  } = useMemo(() => {
    const dealsArray = Array.isArray(deals) ? deals : []; // SAFE conversion

    if (dealsArray.length === 0) {
      return {
        dealStages: [],
        timeSeriesData: [],
        totalValue: 0,
        quarterlyGrowth: 0,
        yearlyGrowth: 0,
        isMonthlyView: true,
      };
    }

    // Aggregate deal values by actual status
    const statusValues = {};
    dealsArray.forEach((deal) => {
      const status = deal.status || "Unknown";
      statusValues[status] = (statusValues[status] || 0) + (deal.amount || 0);
    });

    const dealStages = Object.keys(statusValues)
      .filter((status) => statusValues[status] > 0)
      .map((status) => ({
        stage: status,
        value: statusValues[status],
      }))
      .sort((a, b) => b.value - a.value);

    // Check if all deals are from the same month
    const dealMonths = new Set();
    dealsArray.forEach((deal) => {
      const date = new Date(deal.createdAt);
      const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
      dealMonths.add(monthYear);
    });

    const isSingleMonth = dealMonths.size === 1;
    let timeSeriesData = [];
    let isMonthlyView = true;

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    if (isSingleMonth) {
      // Group by day
      isMonthlyView = false;
      const dailyAggregation = {};

      dealsArray.forEach((deal) => {
        const date = new Date(deal.createdAt);
        const dayKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        dailyAggregation[dayKey] =
          (dailyAggregation[dayKey] || 0) + (deal.amount || 0);
      });

      timeSeriesData = Object.entries(dailyAggregation)
        .map(([dateKey, value]) => {
          const [year, month, day] = dateKey.split("-");
          const monthName = monthNames[parseInt(month) - 1];
          return {
            label: `${monthName} ${parseInt(day)}`,
            value,
            sortKey: dateKey,
          };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    } else {
      // Group by month
      isMonthlyView = true;
      const monthlyAggregation = {};

      dealsArray.forEach((deal) => {
        const date = new Date(deal.createdAt);
        const month = date.getMonth();
        monthlyAggregation[month] =
          (monthlyAggregation[month] || 0) + (deal.amount || 0);
      });

      timeSeriesData = Object.entries(monthlyAggregation)
        .map(([monthNumber, value]) => ({
          label: monthNames[parseInt(monthNumber)],
          value,
          sortKey: parseInt(monthNumber),
        }))
        .sort((a, b) => a.sortKey - b.sortKey);
    }

    const totalValue = dealsArray.reduce(
      (sum, deal) => sum + (deal.amount || 0),
      0
    );

    return {
      dealStages,
      timeSeriesData,
      totalValue,
      quarterlyGrowth: 15,
      yearlyGrowth: 20,
      isMonthlyView,
    };
  }, [deals]);

  // Fallback to dummy data if no real data available
  const fallbackDealStages = [
    { stage: "Won", value: 450000 },
    { stage: "Negotiation", value: 350000 },
    { stage: "Open", value: 280000 },
    { stage: "Lost", value: 80000 },
  ];

  const fallbackTimeSeriesData = [
    { label: "Jan", value: 100000 },
    { label: "Feb", value: 80000 },
    { label: "Mar", value: 90000 },
    { label: "Apr", value: 70000 },
    { label: "May", value: 95000 },
    { label: "Jun", value: 60000 },
    { label: "Jul", value: 85000 },
    { label: "Aug", value: 55000 },
    { label: "Sep", value: 110000 },
    { label: "Oct", value: 65000 },
  ];

  // const displayDealStages =
  //   dealStages.length > 0 ? dealStages : fallbackDealStages;
  // const displayTimeSeriesData =
  //   timeSeriesData.length > 0 ? timeSeriesData : fallbackTimeSeriesData;

  const displayDealStages = dealStages;
  const displayTimeSeriesData = timeSeriesData;

  // Smart currency formatting
  const formatCurrency = (amount) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    } else {
      return `₹${amount}`;
    }
  };

  // Smart formatting for tooltips
  const formatTooltip = (value) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)}Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    } else {
      return `₹${value}`;
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg px-1">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Deal Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deals by Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <p className="text-gray-600 text-sm mb-1">Deals by Status</p>
          <h6 className="text-2xl font-bold text-gray-800">
            {deals.length > 0 ? formatCurrency(totalValue) : "₹0"}
          </h6>
          <div className="flex text-green-600 text-sm mb-4">
            This Quarter &nbsp; <h6>+{quarterlyGrowth}%</h6>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={displayDealStages}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11, fill: "#666" }}
                axisLine={{ stroke: "#e0e0e0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#666" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                formatter={(value) => [formatTooltip(value), "Value"]}
                labelFormatter={(label) => `Status: ${label}`}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill="#3863ff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Deal Value Over Time */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <p className="text-gray-600 text-sm mb-1">
            Deal Value Over Time{" "}
            {!isMonthlyView && (
              <span className="text-xs text-gray-500">(Daily)</span>
            )}
          </p>
          <h6 className="text-2xl font-bold text-gray-800">
            {deals.length > 0 ? formatCurrency(totalValue) : "₹0"}
          </h6>
          <div className="flex text-green-600 text-sm mb-4">
            This Year &nbsp; <h6>+{yearlyGrowth}%</h6>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={displayTimeSeriesData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#666" }}
                axisLine={{ stroke: "#e0e0e0" }}
                tickLine={false}
                interval={isMonthlyView ? 0 : "preserveStartEnd"}
                angle={isMonthlyView ? 0 : -45}
                textAnchor={isMonthlyView ? "middle" : "end"}
                height={isMonthlyView ? 30 : 60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#666" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                formatter={(value) => [formatTooltip(value), "Value"]}
                labelFormatter={(label) =>
                  `${isMonthlyView ? "Month" : "Date"}: ${label}`
                }
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3863ff"
                strokeWidth={2}
                dot={{ fill: "#3863ff", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DealOverview;
