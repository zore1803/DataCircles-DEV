import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Truck, IndianRupee } from "lucide-react";
import Vendors from "./Vendors";
import PaymentPage from "./PaymentPage";

const TABS = [
  { key: "vendors", label: "Vendors", icon: Truck },
  { key: "payments", label: "Payments", icon: IndianRupee },
];

export default function VendorsHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tabParam = params.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam === "payments" ? "payments" : "vendors"
  );

  useEffect(() => {
    if (tabParam === "payments" || tabParam === "vendors") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (key) => {
    setActiveTab(key);
    navigate(`/vendors?tab=${key}`, { replace: false });
  };

  return (
    <div>
      <div className="border-b border-gray-200 bg-white rounded-t-xl overflow-hidden mb-6">
        <nav className="flex overflow-x-auto whitespace-nowrap no-scrollbar px-2 sm:px-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center justify-center gap-2 min-w-[130px] sm:min-w-[150px] px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600 bg-white font-bold"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "vendors" ? <Vendors /> : <PaymentPage />}
    </div>
  );
}
