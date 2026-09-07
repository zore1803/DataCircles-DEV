import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";

// Catch-all for any unmatched route. Before this, a typo'd or stale URL
// rendered nothing at all inside <Routes> — a blank page with no way back.
const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <SearchX className="w-7 h-7 text-gray-400" />
    </div>
    <h1 className="text-lg font-semibold text-gray-900">Page not found</h1>
    <p className="mt-1.5 text-sm text-gray-500 max-w-sm">
      The page you're looking for doesn't exist or may have moved.
    </p>
    <Link
      to="/"
      className="mt-5 inline-flex items-center px-4 h-9 rounded-full bg-[#0085FF] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
    >
      Back to Dashboard
    </Link>
  </div>
);

export default NotFound;
