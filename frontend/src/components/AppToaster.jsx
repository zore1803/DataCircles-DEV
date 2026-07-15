import React from "react";
import { Toaster, ToastBar, toast } from "react-hot-toast";
import { X } from "lucide-react";

// Shared toast renderer used app-wide (see PROJECT-level note: every page previously
// mounted its own bare <Toaster/>, which never showed a dismiss control). Rendering the
// toast body ourselves via the ToastBar children render-prop lets us add a close (X)
// button without touching react-hot-toast's internals.
const AppToaster = (props) => (
  <Toaster position="top-right" toastOptions={{ duration: 5000 }} {...props}>
    {(t) => (
      <ToastBar toast={t}>
        {({ icon, message }) => (
          <>
            {icon}
            {message}
            {t.type !== "loading" && (
              <button
                onClick={() => toast.dismiss(t.id)}
                className="ml-2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            )}
          </>
        )}
      </ToastBar>
    )}
  </Toaster>
);

export default AppToaster;
