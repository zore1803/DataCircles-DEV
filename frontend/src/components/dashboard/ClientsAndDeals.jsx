import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from "recharts";
import { Banknote, ArrowUpRight } from "lucide-react";

const ClientsAndDeals = ({ totalClients, activeDeals, averageDealSize, deals }) => {
  // Process deals for the chart - fallback to dummy data if empty
  const chartData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

    // If we have real deals, group them by month
    if (deals && deals.length > 0) {
      const grouped = {};
      deals.forEach(deal => {
        const date = new Date(deal.createdAt);
        const month = monthNames[date.getMonth()] || monthNames[0];
        grouped[month] = (grouped[month] || 0) + 1;
      });

      return monthNames.map(month => ({
        name: month,
        deals: grouped[month] || 0
      }));
    }

    // Default high-fidelity dummy data to match screenshot
    return [
      { name: "Jan", deals: 1.3 },
      { name: "Feb", deals: 2.1 },
      { name: "Mar", deals: 1.8 },
      { name: "Apr", deals: 3.1 },
      { name: "May", deals: 1.1 },
      { name: "Jun", deals: 3 },
      { name: "Jul", deals: 1 },
      { name: "Aug", deals: 4 },
    ].slice(0, 6); // Just 6 months for the view
  }, [deals]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111216] text-white px-3 py-2 rounded-[10px] shadow-xl text-center">
          <p className="text-[12px] font-bold">{payload[0].value}</p>
          <p className="text-[10px] text-gray-400">Active Deals</p>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#111216] rotate-45"></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-[20px] border border-[#F2F2F7] p-6 shadow-sm h-full relative font-inter overflow-hidden">
      {/* Header Row */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-[10px] flex items-center justify-center border border-[#F2F2F7]">
            <Banknote className="w-5 h-5 text-[#111216]" />
          </div>
          <h2 className="text-[18px] font-bold text-[#111216]">Clients and Deals</h2>
        </div>
        <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowUpRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Stats Section */}
      <div className="mb-4">
        <p className="text-[12px] text-gray-400 font-medium mb-1">Average Deal Size</p>
        <h3 className="text-[28px] font-bold text-[#111216]">
          ₹{averageDealSize.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h3>
      </div>

      {/* Chart Section */}
      <div className="h-[180px] w-full mt-4 -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3863ff" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#3863ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#A0A0A0' }}
              dy={10}
            />
            <YAxis
              hide={true}
              domain={[0, 'auto']}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#3863ff', strokeWidth: 1, strokeDasharray: '3 3' }}
              position={{ y: 20 }}
            />
            <Area
              type="monotone"
              dataKey="deals"
              stroke="#3863ff"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorDeals)"
              dot={{ r: 4, fill: "white", stroke: "#3863ff", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "white", stroke: "#3863ff", strokeWidth: 2 }}
            />
            {/* Adding vertical lines for aesthetic parity */}
            {chartData.map((entry, index) => (
              <ReferenceLine
                key={index}
                x={entry.name}
                stroke="#E0E0E1"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Decorative vertical lines at the bottom like the screenshot */}
      <div className="absolute bottom-0 left-6 right-6 flex justify-between h-20 opacity-20 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="w-[1px] bg-blue-500 h-full"></div>
        ))}
      </div>
    </div>
  );
};

export default ClientsAndDeals;

