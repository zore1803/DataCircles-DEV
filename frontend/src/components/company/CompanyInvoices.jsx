import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Filter } from "lucide-react";

const CompanyInvoices = ({ invoices, loading }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Invoices</h3>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Invoice Number
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Deal
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Due Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Amount
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Status
              </th>
            </tr>
          </thead>
          {invoices && invoices.length > 0 ? (
            <tbody className="divide-y divide-gray-100">
              {invoices.map((invoice) => (
                <tr key={invoice._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/invoices/${invoice._id}`}
                      className="text-gray-900 hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {invoice.deal?.title || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(invoice.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    ₹{invoice.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === "Paid"
                          ? "bg-green-100 text-green-700"
                          : invoice.status === "Unpaid"
                            ? "bg-orange-100 text-orange-700"
                            : invoice.status === "Overdue"
                              ? "bg-red-100 text-red-700"
                              : invoice.status === "Partially Paid"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No invoices available for this company.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
};

export default CompanyInvoices;
