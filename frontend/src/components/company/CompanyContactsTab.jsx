import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  UserPlus,
  Contact as ContactIcon,
  BadgeCheck,
  Activity,
  CalendarClock,
  Mail,
  Phone,
} from "lucide-react";

export default function CompanyContactsTab({ contacts, meetings = [], tasks = [] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const q = searchTerm.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q),
    );
  }, [contacts, searchTerm]);

  const decisionMakers = contacts.filter(
    (c) => c.lifecycleStage === "Customer",
  ).length;

  const upcomingFollowUps = [...tasks, ...meetings].filter((item) => {
    const date = item.dueDate || item.scheduledAt;
    return date && new Date(date) >= new Date();
  }).length;

  const kpiTiles = [
    { label: "Total Contacts", value: contacts.length, icon: ContactIcon },
    { label: "Decision Makers", value: decisionMakers, icon: BadgeCheck },
    { label: "Recent Interactions", value: meetings.length, icon: Activity },
    { label: "Upcoming Follow-ups", value: upcomingFollowUps, icon: CalendarClock },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {kpiTiles.map((tile) => (
          <div
            key={tile.label}
            className="h-[72px] flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <tile.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {tile.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by contact by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
          <Filter size={14} />
          Filter
        </button>
        <Link
          to="/contacts"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Add Contact"
        >
          <Plus size={16} />
        </Link>
      </div>

      {/* Contacts list or empty state */}
      {filteredContacts.length === 0 ? (
        <Link
          to="/contacts"
          className="flex flex-col items-center justify-center min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <UserPlus size={28} className="mb-2" />
          <span className="text-sm font-medium">Create New Contact</span>
        </Link>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContacts.map((contact) => (
            <Link
              to={`/contacts/${contact._id}`}
              key={contact._id}
              className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-blue-300 transition-all"
            >
              <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-200 transition-colors rounded-full flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                {contact.name?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {contact.name}
                </p>
                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                  {contact.email ? (
                    <>
                      <Mail size={11} /> {contact.email}
                    </>
                  ) : contact.phone ? (
                    <>
                      <Phone size={11} /> {contact.phone}
                    </>
                  ) : (
                    "No contact info"
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
