export const exportToCSV = (data, filename = "export.csv") => {
  if (!data || !data.length) return;

  const csvString = data.join("\n");
  const blob = new Blob(["﻿" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
