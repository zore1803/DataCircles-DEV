import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  ChevronDown,
  ArrowRight,
  User,
  CopyPlus,
} from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import ProfilePicture from "../contact/ProfilePicture";

const MergeContactModal = ({ primaryContact, isOpen, onClose, onSuccess }) => {
  const [availableContacts, setAvailableContacts] = useState([]);
  const [selectedSecondary, setSelectedSecondary] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
      setSelectedSecondary(null);
      setSearchTerm("");
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await API.get("/contacts");
      // Exclude the primary contact from the list of merge candidates
      setAvailableContacts(
        res.data.filter((c) => c._id !== primaryContact._id),
      );
    } catch (err) {
      toast.error("Failed to load contacts");
    }
  };

  const filteredContacts = availableContacts.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm),
  );

  const handleSelectContact = (contact) => {
    setSelectedSecondary(contact);
    setSearchTerm(contact.name);
    setIsDropdownOpen(false);
  };

  const handleMerge = async () => {
    if (!selectedSecondary)
      return toast.error("Please select a contact to merge.");

    if (
      !window.confirm(
        `Are you sure you want to merge ${selectedSecondary.name} into ${primaryContact.name}? ${selectedSecondary.name} will be permanently deleted.`,
      )
    )
      return;

    setLoading(true);
    try {
      await API.post(`/contacts/${primaryContact._id}/merge`, {
        secondaryId: selectedSecondary._id,
      });
      toast.success("Contacts merged successfully");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to merge contacts");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CopyPlus className="w-5 h-5 text-orange-600" />
            Merge Duplicate Contact
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {/* Visual Merge Area */}
          <div className="flex items-start justify-between mb-8">
            {/* Left Side: Secondary Contact Select */}
            <div className="w-[40%] flex flex-col items-center">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-orange-400 mb-4 shadow-sm border border-orange-100">
                {selectedSecondary ? (
                  <ProfilePicture
                    contact={{
                      name: selectedSecondary.name,
                      avatar: selectedSecondary.avatar,
                    }}
                    size="w-16 h-16"
                    textSize="text-2xl"
                  />
                ) : (
                  <User size={32} />
                )}
              </div>

              <label className="text-sm font-semibold text-gray-700 mb-2 text-center">
                Search & Select Contact To Be Merged
              </label>

              <div className="relative w-full" ref={dropdownRef}>
                <div
                  className="w-full px-3 py-2.5 border border-blue-300 bg-blue-50/30 rounded-md flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                      if (selectedSecondary) setSelectedSecondary(null);
                    }}
                    placeholder="Search by Name, Email..."
                    className="flex-1 outline-none bg-transparent text-sm placeholder-gray-400"
                  />
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>

                {isDropdownOpen && (
                  <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-50 custom-scrollbar">
                    {filteredContacts.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No contacts found
                      </div>
                    ) : (
                      filteredContacts.map((contact) => (
                        <div
                          key={contact._id}
                          onClick={() => handleSelectContact(contact)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {contact.email || contact.phone}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Middle: Arrow Indicator */}
            <div className="flex flex-col items-center justify-center px-4 mt-8">
              <div className="flex items-center text-gray-400 gap-1 mb-6">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                </div>
                <ArrowRight
                  size={32}
                  strokeWidth={3}
                  className="text-gray-400"
                />
              </div>
            </div>

            {/* Right Side: Primary Contact Display */}
            <div className="w-[40%] flex flex-col items-center">
              <div className="w-20 h-20 mb-4 flex items-center justify-center">
                <ProfilePicture
                  contact={{
                    name: primaryContact.name,
                    avatar: primaryContact.avatar,
                  }}
                  size="w-20 h-20"
                  textSize="text-3xl"
                />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 text-center">
                {primaryContact.name}
              </h4>
              <p className="text-sm text-gray-500 mb-2 text-center truncate w-full px-2">
                {primaryContact.email ||
                  primaryContact.phone ||
                  "No Contact Info"}
              </p>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                Primary Record
              </span>
            </div>
          </div>

          <div className="text-center mb-6 text-gray-600 bg-gray-50 py-3 rounded-lg border border-gray-200">
            <span className="border-b border-gray-400 font-medium inline-block min-w-[80px] text-center text-gray-900 pb-0.5">
              {selectedSecondary?.name || "_________"}
            </span>{" "}
            will be merged into{" "}
            <span className="font-semibold text-gray-900">
              {primaryContact.name}
            </span>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 text-blue-900 p-5 rounded-lg text-sm border border-blue-100 mb-2">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                All related deals, tasks, and meetings of the selected contact
                will be merged into <strong>"{primaryContact.name}"</strong>
              </li>
              <li>
                The selected contact will be deleted after merging into{" "}
                <strong>"{primaryContact.name}"</strong>
              </li>
              <li>
                Only the empty fields of the <strong>"Primary Record"</strong>{" "}
                will be updated from the selected contact
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-100 font-medium transition-colors shadow-sm"
          >
            Close
          </button>

          <button
            onClick={handleMerge}
            disabled={loading || !selectedSecondary}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? "Merging..." : "Merge Contacts"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeContactModal;
