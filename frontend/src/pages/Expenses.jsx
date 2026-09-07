import React from "react";
import { Wallet } from "lucide-react";
import ExpenseLedgerPage from "../components/expenses/ExpenseLedgerPage";

export default function Expenses() {
  return (
    <ExpenseLedgerPage
      kind="expense"
      icon={Wallet}
      title="Expenses"
      subtitle="Record and categorise business spending"
    />
  );
}

