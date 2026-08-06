import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Vendors from "./Vendors";
import PaymentPage from "./PaymentPage";

export default function VendorsHub() {
  const location = useLocation();
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

  return activeTab === "vendors" ? <Vendors /> : <PaymentPage />;
}
