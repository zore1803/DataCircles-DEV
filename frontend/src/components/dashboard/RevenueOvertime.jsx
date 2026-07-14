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
    CartesianGrid
} from "recharts";
import { ChevronDown as ChevronIcon, ArrowUpRight as ArrowIcon, MoreHorizontal as MoreIcon } from "lucide-react";

const RevenueOvertime = ({ deals }) => {
    // Generate high-fidelity mockup data to match the visual complexity of the screenshot
    const chartData = useMemo(() => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentYear = new Date().getFullYear();

        // Initialize months with 0 revenue
        const monthlyRevenue = months.map((month) => ({
            name: month,
            revenue: 0,
            trend: 0,
        }));

        // Aggregate real revenue from Won deals this year
        (deals || []).forEach(deal => {
            if (deal.status === "Won") {
                const date = new Date(deal.createdAt || deal.updatedAt);
                if (date.getFullYear() === currentYear) {
                    const monthIdx = date.getMonth();
                    monthlyRevenue[monthIdx].revenue += (deal.amount || 0);
                }
            }
        });

        // Calculate trend (3-month moving average)
        return monthlyRevenue.map((data, idx, arr) => {
            const start = Math.max(0, idx - 2);
            const window = arr.slice(start, idx + 1);
            const avg = window.reduce((sum, d) => sum + d.revenue, 0) / window.length;
            return {
                ...data,
                trend: Math.round(avg)
            };
        });
    }, [deals]);

    return (
        <div className="bg-white rounded-[20px] border border-[#F2F2F7] p-8 shadow-sm mb-8 font-inter">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-10">
                <div>
                    <h2 className="text-[20px] font-bold text-[#111216] mb-1">Revenue Overtime</h2>
                    <p className="text-[14px] text-gray-400 font-medium">Monitor how your money is being generated</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#F2F2F7] rounded-xl text-[12px] font-bold text-[#111216] hover:bg-gray-50 transition-colors shadow-sm">
                        Monthly <ChevronIcon className="w-3 h-3" />
                    </button>
                    <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <ArrowIcon className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <MoreIcon className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Chart Section */}
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3863ff" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#3863ff" stopOpacity={0.01} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            vertical={false}
                            stroke="#F2F2F7"
                            strokeDasharray="0"
                        />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#A0A0A0' }}
                            interval={3} // Show fewer months for clarity
                            dy={15}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#A0A0A0' }}
                            domain={[0, 450]}
                            ticks={[0, 100, 200, 300, 400]}
                            dx={-10}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#111216',
                                border: 'none',
                                borderRadius: '10px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{ stroke: '#3863ff', strokeWidth: 1 }}
                        />
                        {/* The trend line (dashed green) */}
                        <Line
                            type="monotone"
                            dataKey="trend"
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={false}
                        />
                        {/* The main revenue line/area */}
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#3863ff"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                            activeDot={{ r: 6, fill: "#3863ff", stroke: "white", strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default RevenueOvertime;
