import React from "react";
import { TrendingUp } from "lucide-react";
import ExpenseLedgerPage from "../components/expenses/ExpenseLedgerPage";

export default function IndirectIncome() {
  return (
    <ExpenseLedgerPage
      kind="income"
      icon={TrendingUp}
      title="Indirect Income"
      subtitle="Track earnings outside of sales invoices"
    />
  );
}

