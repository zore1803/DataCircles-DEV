import React, { useEffect, useState } from "react";
import { AtSign, CheckCircle2, Loader2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

const HANDLE_REGEX = /^[a-z0-9]{5,32}$/;

function EmailHandle() {
  const [loading, setLoading] = useState(true);
  const [claimedHandle, setClaimedHandle] = useState(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null); // null = not checked yet
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    API.get("/email-handle")
      .then((res) => setClaimedHandle(res.data?.handle || null))
      .catch(() => setClaimedHandle(null))
      .finally(() => setLoading(false));
  }, []);

  const handleInputChange = (e) => {
    setInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
    setAvailable(null);
  };

  const checkAvailability = async () => {
    if (!HANDLE_REGEX.test(input)) {
      toast.error("Min 5 characters, letters and numbers only.");
      return;
    }
    setChecking(true);
    try {
      const res = await API.get("/email-handle/check", { params: { handle: input } });
      setAvailable(!!res.data?.available);
      if (!res.data?.available) toast.error("That handle is already taken");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not check availability");
    } finally {
      setChecking(false);
    }
  };

  const claim = async () => {
    setSaving(true);
    try {
      const res = await API.post("/email-handle", { handle: input });
      setClaimedHandle(res.data.handle);
      toast.success(`Claimed ${res.data.handle}.dc`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to claim handle");
    } finally {
      setSaving(false);
    }
  };

  const release = async () => {
    setReleasing(true);
    try {
      await API.delete("/email-handle");
      setClaimedHandle(null);
      setInput("");
      setAvailable(null);
      toast.success("Handle released");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to release handle");
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-xl">
            <AtSign className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Email Domain</h2>
            <p className="text-sm text-gray-600">
              Claim a unique handle for your organization — reserved now, ready to use for outgoing emails once fully enabled.
            </p>
          </div>
        </div>
        {claimedHandle && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-semibold whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Claimed
          </div>
        )}
      </div>

      {claimedHandle ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Your handle</p>
            <div className="flex items-center gap-2">
              <AtSign className="w-5 h-5 text-gray-400" />
              <span className="text-lg font-semibold text-gray-900 font-mono">{claimedHandle}.dc</span>
            </div>
          </div>
          <button
            onClick={release}
            disabled={releasing}
            className="px-4 py-2 rounded-xl font-medium text-red-600 bg-white border-2 border-red-100 hover:border-red-200 hover:bg-red-50 transition-colors text-sm disabled:opacity-50"
          >
            {releasing ? "Releasing…" : "Release Handle"}
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-6 max-w-lg">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Pick a name. You'll get <span className="font-mono">yourname.dc</span> reserved for your organization.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="yourbrand"
                className="w-full pl-4 pr-16 py-2.5 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border-gray-300 hover:border-gray-400"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono">.dc</span>
            </div>
            <button
              onClick={checkAvailability}
              disabled={checking || !input}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
            >
              {checking ? "Checking…" : "Check Availability"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Min 5 characters, letters and numbers only.</p>

          {available === true && (
            <div className="mt-4 flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                {input}.dc is available
              </span>
              <button
                onClick={claim}
                disabled={saving}
                className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-colors"
              >
                {saving ? "Claiming…" : "Claim Handle"}
              </button>
            </div>
          )}
          {available === false && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-red-600">
              <XCircle className="w-4 h-4" />
              {input}.dc is already taken
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default EmailHandle;
