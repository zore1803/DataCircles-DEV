// import React, { useState } from "react";
// import { Loader2, Search, AlertCircle } from "lucide-react";

// const GSTINHelper = ({ form, setForm, setError }) => {
//   const [loading, setLoading] = useState(false);
//   const [gstinInfo, setGstinInfo] = useState(null);

//   // Replace with your actual API key
//   const GSTIN_API_KEY =
//     import.meta.env.REACT_APP_GSTIN_API_KEY || "YOUR_API_KEY";

//   // GSTIN validation regex
//   const validateGSTIN = (gstin) => {
//     const gstinRegex =
//       /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
//     return gstinRegex.test(gstin);
//   };

//   const fetchGSTINDetails = async () => {
//     const gstin = form.gstin?.trim().toUpperCase();

//     if (!gstin) {
//       setError("Please enter a GSTIN number first");
//       return;
//     }

//     if (!validateGSTIN(gstin)) {
//       setError("Invalid GSTIN format. Please check the number");
//       return;
//     }

//     setLoading(true);
//     setError("");
//     setGstinInfo(null);

//     try {
//       const response = await fetch(
//         `https://sheet.gstincheck.co.in/check/${GSTIN_API_KEY}/${gstin}`,
//         {
//           method: "GET",
//           headers: {
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error(`API request failed with status ${response.status}`);
//       }

//       const data = await response.json();

//       if (data && data.flag === 1 && data.data) {
//         const gstData = data.data;

//         // Store the fetched info for display
//         setGstinInfo(gstData);

//         // Auto-fill the form fields
//         setForm((prevForm) => ({
//           ...prevForm,
//           name: gstData.lgnm || prevForm.name, // Legal Name
//           company: gstData.tradeNam || gstData.lgnm || prevForm.company, // Trade Name or Legal Name
//           address: {
//             ...prevForm.address,
//             line1: gstData.pradr?.addr?.bnm || prevForm.address.line1, // Building Name
//             line2:
//               `${gstData.pradr?.addr?.st || ""} ${
//                 gstData.pradr?.addr?.loc || ""
//               }`.trim() || prevForm.address.line2, // Street + Location
//             city: gstData.pradr?.addr?.dst || prevForm.address.city, // District
//             state: gstData.pradr?.addr?.stcd || prevForm.address.state, // State
//             pincode: gstData.pradr?.addr?.pncd || prevForm.address.pincode, // Pincode
//             country: "India",
//           },
//         }));

//         setError("");
//       } else {
//         throw new Error(data?.message || "GSTIN details not found or invalid");
//       }
//     } catch (error) {
//       console.error("GSTIN fetch error:", error);
//       setError(`Failed to fetch GSTIN details: ${error.message}`);
//       setGstinInfo(null);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const clearGSTINInfo = () => {
//     setGstinInfo(null);
//   };

//   return (
//     <div className="space-y-3">
//       {/* Fetch Button */}
//       <div className="flex items-center gap-2">
//         <button
//           type="button"
//           onClick={fetchGSTINDetails}
//           disabled={loading || !form.gstin?.trim()}
//           className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
//             loading || !form.gstin?.trim()
//               ? "bg-gray-100 text-gray-400 cursor-not-allowed"
//               : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
//           }`}
//         >
//           {loading ? (
//             <Loader2 className="w-4 h-4 animate-spin" />
//           ) : (
//             <Search className="w-4 h-4" />
//           )}
//           {loading ? "Fetching..." : "Fetch Details from GSTIN"}
//         </button>

//         {gstinInfo && (
//           <button
//             type="button"
//             onClick={clearGSTINInfo}
//             className="text-sm text-gray-500 hover:text-gray-700"
//           >
//             Clear
//           </button>
//         )}
//       </div>

//       {/* GSTIN Information Display */}
//       {gstinInfo && (
//         <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//           <div className="flex items-start gap-2">
//             <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
//               <div className="w-2 h-2 rounded-full bg-green-600"></div>
//             </div>
//             <div className="flex-1">
//               <h4 className="text-sm font-semibold text-green-800 mb-2">
//                 GSTIN Details Found
//               </h4>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
//                 <div>
//                   <span className="font-medium text-green-700">
//                     Legal Name:
//                   </span>
//                   <p className="text-green-600">{gstinInfo.lgnm || "N/A"}</p>
//                 </div>
//                 {gstinInfo.tradeNam && (
//                   <div>
//                     <span className="font-medium text-green-700">
//                       Trade Name:
//                     </span>
//                     <p className="text-green-600">{gstinInfo.tradeNam}</p>
//                   </div>
//                 )}
//                 <div>
//                   <span className="font-medium text-green-700">Status:</span>
//                   <p className="text-green-600">{gstinInfo.sts || "N/A"}</p>
//                 </div>
//                 <div>
//                   <span className="font-medium text-green-700">
//                     Registration Date:
//                   </span>
//                   <p className="text-green-600">{gstinInfo.rgdt || "N/A"}</p>
//                 </div>
//               </div>
//               <p className="text-xs text-green-600 mt-2">
//                 ✓ Form fields have been automatically filled with the fetched
//                 data
//               </p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Helper Text */}
//       <p className="text-xs text-gray-500">
//         Enter a valid 15-digit GSTIN number and click "Fetch Details" to
//         automatically fill company and address information.
//       </p>
//     </div>
//   );
// };

// export default GSTINHelper;
// GSTINHelperDecentro.jsx
import React, { useState } from "react";

const GSTINHelper = ({ form, setForm, setError }) => {
  const [loading, setLoading] = useState(false);
  const [gstinInfo, setGstinInfo] = useState(null);

  const CLIENT_ID = import.meta.env.VITE_DECENTRO_CLIENT_ID;
  const CLIENT_SECRET = import.meta.env.VITE_DECENTRO_CLIENT_SECRET;
  const MODULE_ID = import.meta.env.VITE_DECENTRO_MODULE_ID;
  const ENV = import.meta.env.VITE_DECENTRO_ENV || "sandbox"; // or "production"

  const validateGSTIN = (gstin) => {
    const gstinRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  };

  // Step 1: Get Access Token
  const getAccessToken = async () => {
    const url =
      ENV === "production"
        ? "https://api.decentro.in/v1/auth/token"
        : "https://sandbox-api.decentro.in/v1/auth/token";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        module_id: MODULE_ID,
      }),
    });

    if (!res.ok) {
      throw new Error(`Token request failed: ${res.status}`);
    }
    const data = await res.json();
    return data.access_token;
  };

  // Step 2: Fetch GSTIN Details
  const fetchGSTINDetails = async () => {
    const gstin = form.gstin?.trim().toUpperCase();

    if (!gstin) {
      setError("Please enter GSTIN number first");
      return;
    }

    if (!gstinRegex.test(gstin)) {
      setError("Invalid GSTIN format. Please check the number.");
      return;
    }

    setGstinLoading(true);
    setError("");
    setGstinData(null);

    try {
      const response = await fetch(
        "https://in.staging.decentro.tech/kyc/public_registry/validate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Client-Id": import.meta.env.VITE_DECENTRO_CLIENT_ID,
            "X-Client-Secret": import.meta.env.VITE_DECENTRO_CLIENT_SECRET,
          },
          body: JSON.stringify({
            reference_id: "GSTIN Verification",
            document_type: "GSTIN",
            id_number: gstin,
            consent: "Y",
            consent_purpose: "To verify GSTIN document",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_message || "GSTIN verification failed");
      }

      if (
        data?.data?.result?.gstin_details &&
        data?.data?.result?.gstin_details?.legal_name
      ) {
        const gst = data.data.result.gstin_details;

        setGstinData(gst);

        // Auto-fill vendor form based on GSTIN
        setForm((prev) => ({
          ...prev,
          name: gst.legal_name || prev.name,
          company: gst.trade_name || gst.legal_name || prev.company,
          address: {
            ...prev.address,
            line1: gst.address_line1 || prev.address.line1,
            line2: gst.address_line2 || prev.address.line2,
            city: gst.principal_place?.city || prev.address.city,
            state: gst.principal_place?.state || prev.address.state,
            pincode: gst.principal_place?.pincode || prev.address.pincode,
            country: "India",
          },
        }));

        setError("");
      } else {
        setError("GSTIN not found or invalid.");
      }
    } catch (err) {
      console.error("GSTIN fetch error:", err);
      setError("Failed to fetch GSTIN details: " + err.message);
    } finally {
      setGstinLoading(false);
    }
  };

  const clearGSTINInfo = () => {
    setGstinInfo(null);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={fetchGSTINDetails}
        disabled={loading || !form.gstin?.trim()}
        className={`px-4 py-2 rounded-lg ${
          loading || !form.gstin?.trim()
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {loading ? "Fetching..." : "Fetch GSTIN Details"}
      </button>

      {gstinInfo && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2">
          <h4 className="font-semibold text-green-800 mb-2">GSTIN Info</h4>
          <p>Legal Name: {gstinInfo.legal_name}</p>
          <p>Trade Name: {gstinInfo.trade_name}</p>
          <p>State: {gstinInfo.address?.state}</p>
          <button
            onClick={clearGSTINInfo}
            className="text-xs text-green-600 hover:text-green-800 mt-2 underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default GSTINHelper;
