import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Plus } from "lucide-react";
import API from "../../services/api";
import QuickContactForm from "../contact/QuickContactForm";
import toast from "react-hot-toast";

const CompanyContacts = ({ contacts, companyId, setContacts }) => {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFilter, setContactFilter] = useState("");
  const [contactSort, setContactSort] = useState("name-asc");
  const [showFilters, setShowFilters] = useState(false);

  const handleContactCreated = async (newContact) => {
    try {
      const resContacts = await API.get("/contacts");
      setContacts(resContacts.data.filter((c) => c.company?._id === companyId));
      toast.success("Contact created successfully!");
    } catch (err) {
      toast.error("Failed to refresh contacts list.");
    }
    setShowContactForm(false);
  };

  const getFilteredAndSortedContacts = () => {
    let filtered = [...contacts];

    if (contactFilter) {
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(contactFilter.toLowerCase()) ||
          contact.email.toLowerCase().includes(contactFilter.toLowerCase()) ||
          contact.phone.toLowerCase().includes(contactFilter.toLowerCase()),
      );
    }

    filtered.sort((a, b) => {
      switch (contactSort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "email-asc":
          return a.email.localeCompare(b.email);
        case "email-desc":
          return b.email.localeCompare(a.email);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredContacts = getFilteredAndSortedContacts();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Contacts</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={() => setShowContactForm(true)}
            className="flex items-center gap-1 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={contactSort}
                onChange={(e) => setContactSort(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="email-asc">Email (A-Z)</option>
                <option value="email-desc">Email (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Email
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Phone No.
              </th>
            </tr>
          </thead>
          {filteredContacts && filteredContacts.length > 0 ? (
            <tbody className="divide-y divide-gray-100">
              {filteredContacts.map((con) => (
                <tr key={con._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/contacts/${con._id}`}
                      className="text-gray-900 hover:underline"
                    >
                      {con.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{con.email}</td>
                  <td className="px-4 py-3 text-gray-600">{con.phone}</td>
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  {contactFilter
                    ? "No contacts match your search."
                    : "No contacts available."}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {showContactForm && (
        <QuickContactForm
          companyId={companyId}
          onClose={() => setShowContactForm(false)}
          onSuccess={handleContactCreated}
        />
      )}
    </div>
  );
};

export default CompanyContacts;
