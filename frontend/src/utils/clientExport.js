import { autoTable } from "jspdf-autotable";

export function formatINR(value) {
  const n = Number(value);
  if (value == null || isNaN(n)) return "—";
  return `Rs.${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Client-side Excel/PDF export — same approach as Deals.jsx's ExcelExporter/
// PDFExporter (window.XLSX / window.jspdf loaded from CDN on first use, no
// backend round trip), generalized so Purchase, Purchase Order and
// Products/Services can share one implementation instead of three copies.
//
// `columns`: [{ label: string, value: (row) => string|number }]
// `rows`: the already-filtered/visible records to export — same "export what
// you're currently looking at" behavior as Deals.jsx, no row selection
// required.

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function rowsToSheetData(rows, columns) {
  return rows.map((row) => {
    const obj = {};
    columns.forEach((col) => {
      obj[col.label] = col.value(row) ?? "";
    });
    return obj;
  });
}

async function exportToExcel({ rows, columns, fileNamePrefix }) {
  if (!window.XLSX) {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    );
  }
  const data = rowsToSheetData(rows, columns);
  const ws = window.XLSX.utils.json_to_sheet(data);
  const csv = window.XLSX.utils.sheet_to_csv(ws, {
    FS: ",",
    RS: "\n",
    forceQuotes: true,
    blankrows: false,
  });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(
    blob,
    `${fileNamePrefix}_${new Date().toISOString().split("T")[0]}.csv`,
  );
}

async function exportToPDF({ rows, columns, fileNamePrefix, title }) {
  if (!window.jspdf) {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    );
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(title, 14, 20);

  const tableColumn = ["#", ...columns.map((c) => c.label)];
  const tableRows = rows.map((row, index) => [
    index + 1,
    ...columns.map((c) => String(c.value(row) ?? "—")),
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [52, 144, 220], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 30 },
  });

  doc.save(`${fileNamePrefix}_${new Date().toISOString().split("T")[0]}.pdf`);
}

export async function exportClientSide(format, { rows, columns, fileNamePrefix, title }) {
  if (format === "excel") {
    await exportToExcel({ rows, columns, fileNamePrefix });
  } else if (format === "pdf") {
    await exportToPDF({ rows, columns, fileNamePrefix, title });
  }
}
