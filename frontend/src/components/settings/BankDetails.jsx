import BankLogo from '../BankLogo';

import { useCallback, useEffect, useState, useRef } from "react";

// Inside component render
// Replace the existing flex block for bank icon and name
// Updated block starts at line 210
// We'll modify lines 210-216 accordingly

import toast from "react-hot-toast";
import API from "../../services/api";
import {
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  ArrowRight,
  Link2,
  Landmark,
  Star,
  ArrowLeftRight,
} from "lucide-react";
import { MdAccountBalance } from "react-icons/md";
import React from "react";

// Load all bank icons from the banks-in-india package using Vite's glob import.
// Icon loading disabled for now to avoid build errors.
// const bankIcons = import.meta.globEager("/node_modules/banks-in-india/icons/**/bi_*.png", { as: "url" });
// const getBankIcon = (bankName) => null; // placeholder

// No custom logo helper; using generic icon from react-icons
import BankModal from "./BankModal";

const maskAccountNumber = (num = "") => {
  const value = String(num);
  if (value.length <= 4) return value;
  return `${"X".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
};

const BankDetails = () => {

  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [deleteBankId, setDeleteBankId] = useState(null);
  const orderRef = useRef([]); // holds order of bank IDs

  const fetchBanks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/bank-details/all");
      const incoming = Array.isArray(res.data) ? res.data : [];
      // Preserve previous order to avoid moving default to top
      setBanks((prev) => {
        if (prev.length === 0) {
          // First load, store order
          orderRef.current = incoming.map((b) => b._id);
          return incoming;
        }
        // Create a map of previous order
        const prevOrder = orderRef.current;
        const sorted = incoming.slice().sort((a, b) => {
          const ia = prevOrder.indexOf(a._id);
          const ib = prevOrder.indexOf(b._id);
          // If both exist in previous order, keep that order
          if (ia !== -1 && ib !== -1) return ia - ib;
          // New items go to the end
          if (ia === -1 && ib === -1) return 0;
          return ia === -1 ? 1 : -1;
        });
        // Update the stored order for next fetch
        orderRef.current = sorted.map((b) => b._id);
        return sorted;
      });
    } catch (error) {
      console.error("Failed to load banks:", error);
      toast.error("Failed to load bank accounts");
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const hasExistingDefault = banks.some((b) => b.isDefault);

  const handleOpenAdd = () => {
    setEditingBank(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (bank) => {
    setEditingBank(bank);
    setIsModalOpen(true);
  };

  const handleSaveBank = async (payload) => {
    try {
      if (editingBank?._id) {
        await API.put(`/bank-details/${editingBank._id}`, payload);
        toast.success("Bank account updated successfully");
      } else {
        await API.post("/bank-details", payload);
        toast.success("Bank account added successfully");
      }
      setIsModalOpen(false);
      setEditingBank(null);
      await fetchBanks();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      }
      throw err;
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await API.patch(`/bank-details/${id}/default`);
      toast.success("Default bank updated");
      await fetchBanks();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to set default bank");
    }
  };

  const handleDelete = (id) => {
    // Open confirmation modal
    setDeleteBankId(id);
  };

  const confirmDelete = async () => {
    if (!deleteBankId) return;
    try {
      await API.delete(`/bank-details/${deleteBankId}`);
      toast.success("Bank account deleted");
      await fetchBanks();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete bank account");
    } finally {
      setDeleteBankId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteBankId(null);
  };

  const handleTransferFunds = () => {
    toast("Transfer Funds is coming soon", { icon: "🏦" });
  };

  const handleConnectAxis = () => {
    toast("Connect Axis Bank integration is coming soon", { icon: "🔗" });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-4 w-72 rounded bg-gray-100" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="h-40 rounded-xl bg-gray-100" />
            <div className="h-40 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Banks</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your bank accounts for invoices, payments, and online orders
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTransferFunds}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer Funds
            </button>
            <button
              type="button"
              onClick={handleConnectAxis}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
            >
              <Link2 className="h-4 w-4" />
              Connect Axis
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              Add Bank Details
            </button>
          </div>
        </div>
      </div>

      {banks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center shadow-sm">
          <div className="mb-3 rounded-full bg-purple-50 p-4 text-purple-600">
            <Landmark className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-gray-800">No bank accounts added yet</p>
          <p className="mt-1 max-w-md text-xs text-gray-500">
            Add your first bank account to display payment details on invoices and generate UPI QR codes.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-4 text-xs font-bold text-purple-600 hover:text-purple-700 hover:underline"
          >
            + Add First Bank Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {banks.map((bank) => (
            <div
              key={bank._id}
              className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 transition-all ${
                bank.isDefault
                  ? "border-purple-500 bg-purple-50/20 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {bank.isDefault && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                  <CheckCircle className="h-3 w-3" />
                  Default
                </span>
              )}

              <div>
                <div className="flex items-start gap-3">
                  <BankLogo bankName={bank.bank} size={40} />
                  <div className="min-w-0 flex-1 pr-16">
                    <h4 className="truncate font-bold text-gray-900">{bank.bank}</h4>
                    <p className="mt-0.5 text-sm text-gray-600">{bank.accountHolder}</p>
                    <p className="mt-1 text-xs text-gray-400">{bank.branch}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-500">Account No</span>
                    <p className="mt-0.5 font-mono font-medium text-gray-800 flex items-center">
                      {maskAccountNumber(bank.accountNumber)}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500">IFSC</span>
                    <p className="mt-0.5 font-mono font-medium text-gray-800">{bank.ifscCode || "—"}</p>
                  </div>
                  {bank.upi && (
                    <div className="col-span-2">
                      <span className="font-semibold text-gray-500">UPI ID</span>
                      <p className="mt-0.5 font-medium text-gray-800">{bank.upi}</p>
                    </div>
                  )}
                  {bank.openingBalance !== null && bank.openingBalance !== undefined && (
                    <div>
                      <span className="font-semibold text-gray-500">Opening Balance</span>
                      <p className="mt-0.5 font-medium text-gray-800">
                        ₹{Number(bank.openingBalance).toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}
                  {bank.swiftCode && (
                    <div>
                      <span className="font-semibold text-gray-500">SWIFT</span>
                      <p className="mt-0.5 font-medium text-gray-800">{bank.swiftCode}</p>
                    </div>
                  )}
                </div>

                {bank.notes && (
                  <p className="mt-3 line-clamp-2 text-xs text-gray-500">
                    <span className="font-semibold">Notes:</span> {bank.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                {!bank.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(bank._id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:underline"
                  >
                    <Star className="h-3.5 w-3.5 align-middle" />
                    Make Default
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Current default payment account</span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(bank)}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-sky-50 hover:text-sky-600"
                    title="Edit bank"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(bank._id)}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                    title="Delete bank"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Confirm Deletion</h3>
            <p className="mb-4 text-sm text-gray-700">
              Deleting the bank account from here will remove the bank details from all existing invoices and it is irreversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <BankModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBank(null);
        }}
        onSave={handleSaveBank}
        initialData={editingBank}
        hasExistingDefault={hasExistingDefault && !editingBank?.isDefault}
      />
    </div>
  );
};

export default BankDetails;
