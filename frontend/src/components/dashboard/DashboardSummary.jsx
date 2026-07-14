import React from "react";
import { MoreVertical } from "lucide-react";

const DashboardSummaryCard = ({ title, value, change, isCurrency = false }) => {
    return (
        <div className="bg-white rounded-[20px] border border-[#F2F2F7] p-5 shadow-sm font-inter">
            <div className="flex justify-between items-start mb-4">
                <p className="text-[13px] text-gray-500 font-medium">{title}</p>
                <button className="text-gray-300 hover:text-gray-500 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>
            <div className="flex justify-between items-end">
                <h3 className="text-[24px] font-bold text-[#111216]">
                    {isCurrency ? "₹" : ""}{value}
                </h3>
                <p className="text-[11px] text-gray-400 font-medium">{change}</p>
            </div>
        </div>
    );
};

const DashboardSummary = ({ stats }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-2">
            <DashboardSummaryCard
                title="Total Deals Closed"
                value={stats.closedDeals}
                change="+10% from last month"
            />
            <DashboardSummaryCard
                title="Revenue Generated"
                value={stats.revenue.toLocaleString("en-IN")}
                change="+10% from last month"
                isCurrency={true}
            />
            <DashboardSummaryCard
                title="Deal Value Overtime"
                value={stats.monthlyDealValue >= 1000 ? `${(stats.monthlyDealValue / 1000).toFixed(0)}k` : stats.monthlyDealValue}
                change="+20% This Month"
                isCurrency={stats.monthlyDealValue > 0}
            />
        </div>
    );
};

export default DashboardSummary;
