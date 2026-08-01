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
    <div className="w-full h-full">
      {activeTab === "vendors" ? <Vendors /> : <PaymentPage />}
    </div>
  );
}
