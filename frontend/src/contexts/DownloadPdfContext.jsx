import React, { createContext, useContext, useRef, useState } from "react";
import DownloadPdfModal from "../components/common/DownloadPdfModal";

const DownloadPdfContext = createContext(null);

/**
 * Call requestDownloadFilename(documentData) anywhere inside the app to
 * open the "Download PDF" dialog and await the user's chosen filename.
 *
 * documentData shape:
 *   { invoiceNumber, companyName, customerName, documentType, date }
 *
 * Returns:
 *   - A sanitized filename string (no .pdf) when the user clicks Download
 *   - null when the user clicks Cancel or presses Escape
 */
export const useDownloadPdf = () => {
  const ctx = useContext(DownloadPdfContext);
  if (!ctx) throw new Error("useDownloadPdf must be inside DownloadPdfProvider");
  return ctx;
};

export const DownloadPdfProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, documentData: null });
  const resolveRef = useRef(null);

  const requestDownloadFilename = (documentData) =>
    new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, documentData });
    });

  const handleConfirm = (filename) => {
    setState({ open: false, documentData: null });
    resolveRef.current?.(filename);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    setState({ open: false, documentData: null });
    resolveRef.current?.(null);
    resolveRef.current = null;
  };

  return (
    <DownloadPdfContext.Provider value={{ requestDownloadFilename }}>
      {children}
      <DownloadPdfModal
        isOpen={state.open}
        documentData={state.documentData}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </DownloadPdfContext.Provider>
  );
};
