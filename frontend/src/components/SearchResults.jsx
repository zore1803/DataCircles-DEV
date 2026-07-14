import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import logo from "/DataCircles.png";

const SearchResults = ({ isOpen, onClose, searchQuery }) => {
  const [results, setResults] = useState({
    candidates: [],
    contacts: [],
    companies: [],
    vendors: [],
    jobs: [],
    deals: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();

  // Unified Search API call
  const searchAPI = async (query) => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_APP_AUTH0_AUDIENCE,
        scope: "openid profile email",
      },
    });

    // const response = await fetch(
    //   `${import.meta.env.VITE_APP_API_URL}/api/search?q=${encodeURIComponent(query)}`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${token}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    const response = await fetch(
      `${
        import.meta.env.VITE_APP_API_URL
      }/api/search?search=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to search");
    }

    return response.json();
  };

  useEffect(() => {
    if (searchQuery && searchQuery.trim().length > 0) {
      setLoading(true);
      setError(null);

      searchAPI(searchQuery)
        .then((data) => {
          setResults({
            candidates: [], // Not implemented in API yet
            contacts: Array.isArray(data.contacts) ? data.contacts : [],
            companies: Array.isArray(data.companies) ? data.companies : [],
            vendors: Array.isArray(data.vendors) ? data.vendors : [],
            jobs: [], // Not implemented in API yet
            deals: Array.isArray(data.deals) ? data.deals : [],
          });
          setLoading(false);
        })
        .catch((err) => {
          console.error("Search API error:", err);
          setError("Failed to search. Please try again.");
          setLoading(false);
        });
    } else {
      // Reset results on empty search
      setResults({
        candidates: [],
        contacts: [],
        companies: [],
        vendors: [],
        jobs: [],
        deals: [],
      });
      setError(null);
    }
  }, [searchQuery]);

  const handleResultClick = (type, item) => {
    switch (type) {
      case "contacts":
        navigate(`/contacts/${item._id || item.id}`);
        break;
      case "companies":
        navigate(`/companies/${item._id || item.id}`);
        break;
      case "vendors":
        navigate(`/vendors/${item._id || item.id}`);
        break;
      case "deals":
        navigate(`/deals/${item._id || item.id}`);
        break;
      default:
        console.log(`Clicked ${type}:`, item);
    }
    onClose();
  };

  const renderSection = (title, items, type) => (
    <div className="mb-10">
      <div className="flex items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {items.length > 0 && (
          <span className="ml-3 px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">
            {items.length}
          </span>
        )}
      </div>
      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div
              key={item._id || item.id}
              onClick={() => handleResultClick(type, item)}
              className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                    {item.name || item.title || item.companyName}
                  </h4>
                  {/* (rest of your item detail rendering unchanged) */}
                </div>
                <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">
            No {title.toLowerCase()} found for your search
          </p>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed top-16 left-0 lg:left-16 right-0 bottom-0 bg-gray-50 z-[9991] transition-all duration-300 transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <img
                  src={logo}
                  alt="Loading..."
                  className="animate-spin-smooth drop-shadow-lg"
                  style={{
                    width: 48,
                    height: 48,
                    animationDuration: "1.8s",
                    filter: "invert(100%)",
                  }}
                />
                <p className="mt-4 text-gray-600 font-medium">
                  Searching across all records...
                </p>
              </div>
            ) : searchQuery && searchQuery.trim().length > 0 ? (
              <div className="space-y-8">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Search Results
                  </h1>
                  <p className="text-gray-600">
                    Showing results for{" "}
                    <span className="font-semibold text-gray-800">
                      "{searchQuery}"
                    </span>
                  </p>
                </div>
                {renderSection("Companies", results.companies, "companies")}
                {renderSection("Vendors", results.vendors, "vendors")}
                {renderSection("Contacts", results.contacts, "contacts")}
                {renderSection("Deals", results.deals, "deals")}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Start Typing To Search
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Search across companies, vendors, contacts, and deals by any
                    field. Results will appear as you type.
                  </p>
                </div>
                {renderSection("Companies", [], "companies")}
                {renderSection("Vendors", [], "vendors")}
                {renderSection("Contacts", [], "contacts")}
                {renderSection("Deals", [], "deals")}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchResults;
