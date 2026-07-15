import React from "react";
import { FileStack } from "lucide-react";

export default function EInvoicing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <FileStack className="h-12 w-12 text-gray-300 mb-4" />
      <h1 className="text-xl font-semibold text-gray-800">E-Invoicing</h1>
      <p className="text-gray-500 mt-2 max-w-md">
        This feature is coming soon.
      </p>
    </div>
  );
}
