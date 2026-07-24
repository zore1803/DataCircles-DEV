import React, { useState } from "react";
import { Files, Cloud, Upload, History } from "lucide-react";
import Folder from "./Folder";

const STORAGE_ALLOCATION_GB = 5;

export default function CompanyFolderTab({ showStats = true }) {
  const [folders, setFolders] = useState([]);

  const allFiles = folders.flatMap((f) => f.files || []);
  const totalFiles = allFiles.length;

  const totalBytes = allFiles.reduce((sum, f) => sum + (f.fileSize || 0), 0);
  const usedGB = totalBytes / (1024 * 1024 * 1024);
  const storageLabel =
    usedGB >= 1
      ? `${usedGB.toFixed(1)} GB`
      : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

  const sortedByDate = [...allFiles].sort(
    (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0),
  );
  const latest = sortedByDate[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentUploads = allFiles.filter(
    (f) => f.uploadedAt && new Date(f.uploadedAt) >= sevenDaysAgo,
  ).length;

  const relativeTime = (date) => {
    if (!date) return "—";
    const diffMs = Date.now() - new Date(date);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return "less than an hour ago";
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const latestUpdatedLabel = (() => {
    if (!latest) return "—";
    const isToday =
      new Date(latest.uploadedAt).toDateString() === new Date().toDateString();
    return isToday ? "Today" : relativeTime(latest.uploadedAt);
  })();

  const latestSubtitle = latest
    ? `${latest.fileName} · ${new Date(latest.uploadedAt).toLocaleTimeString(
      "en-US",
      { hour: "numeric", minute: "2-digit" },
    )}`
    : null;

  const kpiTiles = [
    { label: "Total Files", value: totalFiles, icon: Files },
    {
      label: "Storage Used",
      value: storageLabel,
      icon: Cloud,
      subtitle: `Of ${STORAGE_ALLOCATION_GB} GB allocated`,
      subtitleClass: "text-gray-400",
    },
    {
      label: "Recent Uploads",
      value: recentUploads,
      icon: Upload,
      subtitle: latest ? `Last upload ${relativeTime(latest.uploadedAt)}` : null,
      subtitleClass: "text-gray-400",
    },
    {
      label: "Last Updated",
      value: latestUpdatedLabel,
      icon: History,
      subtitle: latestSubtitle,
      subtitleClass: "text-gray-400",
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      {showStats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpiTiles.map((tile) => (
              <div
                key={tile.label}
                className="h-[72px] flex items-center gap-3 px-3 bg-white border border-gray-200 rounded-xl"
              >
                <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <tile.icon size={20} />
                </div>
                <div className="min-w-0 flex-1 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
                    <p className="text-base font-semibold text-gray-900">
                      {tile.value}
                    </p>
                  </div>
                  {tile.subtitle && (
                    <span className={`text-[11px] truncate min-w-0 max-w-[55%] ${tile.subtitleClass}`}>
                      {tile.subtitle}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="-mx-6" style={{ marginTop: 24, paddingBottom: 24, borderTop: "1px solid #E1E4EA" }} />
        </>
      )}

      {/* Existing folder UI (its own search/grid/upload) */}
      <Folder onFoldersChange={setFolders} />
    </div>
  );
}
