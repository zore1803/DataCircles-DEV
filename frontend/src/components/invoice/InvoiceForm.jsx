import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { formatNumberToIndian } from "../../utils/numberFormatter";
import {
  Plus,
  IndianRupeeIcon,
  Trash2,
  FileText,
  X,
  Eye,
  ChevronDown,
  PenLine,
  CheckCircle2,
  Printer,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Maximize2,
  Minimize2,
  Settings,
  ChevronsLeftRight,
  Search,
} from "lucide-react";
import API from "../../services/api";
import ItemForm from "../item/ItemForm";
import QuickDealForm from "../deal/QuickDealForm";
import SearchableDropdown from "../contact/SearchableDropdown";
import toast from "react-hot-toast";

import SearchIcon from "../common/SearchIcon";
import InvoiceLivePreview from "./InvoiceLivePreview";
import TemplateDrawer from "./TemplateDrawer";
import NotesTermsDrawer from "./NotesTermsDrawer";
import { buildDocumentHtml, GST_RATES, splitGst } from "../../../../shared/documentTemplates.js";
import {
  SectionHeader,
  FieldLabel,
  PickerSelect,
  AddressFieldsGroup,
  emptyAddress,
  isAddressEmpty,
  GSTIN_REGEX,
  blankItem,
} from "./formPrimitives.jsx";
import FullWidthDocumentPanel from "./FullWidthDocumentPanel.jsx";
// Function to convert number to words
function numberToWords(num) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Lakh", "Crore"];

  function toWords(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    }
    if (n < 1000) {
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    }
    let scaleIndex = 0;
    let result = "";
    if (n >= 10000000) {
      result += toWords(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      result += toWords(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      result += toWords(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n > 0) {
      result += toWords(n);
    }
    return result.trim();
  }

  if (num === 0) return "Zero Rupees Only";

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let words = toWords(integerPart) + " Rupees";
  if (decimalPart > 0) {
    words += " and " + toWords(decimalPart) + " Paise";
  }
  words += " Only";
  return words;
}

// Item Search Component
const ItemSearchSelect = ({
  value,
  onSelect,
  onAddNew,
  fetchItems,
  items,
  setItems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const debouncedFetchItems = useCallback(
    (search) => {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        fetchItems(search);
      }, 300);
    },
    [fetchItems]
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.length >= 2 || value === "") {
      setLoading(true);
      debouncedFetchItems(value);
    }
  };

  const handleItemSelect = (item) => {
    onSelect({
      _id: item._id,
      name: item.displayName,
      description: item.description || "",
      rate: item.sellingPrice,
      quantity: 1,
      hsn: item.hsn || "",
      isVariant: item.isVariant || false,
      parentItemId: item.parentItemId || null,
      discountType: "amount",
      discount: 0,
    });
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (items.length === 0) {
      setLoading(true);
      fetchItems();
    }
  };

  const selectedItem = items.find((item) => item._id === value?._id);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <SearchIcon className="absolute left-3 -translate-y-1/2 top-1/2 w-4 h-4 text-[#525866]" />
        <input
          ref={inputRef}
          type="text"
          placeholder={
            selectedItem
              ? selectedItem.displayName
              : "Search items or variants..."
          }
          value={selectedItem ? selectedItem.displayName : searchTerm}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-[25px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 bg-white"
          aria-label="Search items or variants"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Loading...</div>
          ) : (
            <>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddNew();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label="Add new item"
                >
                  <Plus className="w-4 h-4" />
                  Add New Item
                </button>
              </div>
              <div className="border-t border-slate-100"></div>
              {items.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {searchTerm
                    ? "No items or variants found"
                    : "No items or variants available"}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {items.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleItemSelect(item)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                      aria-label={`Select ${item.displayName}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">
                            {item.displayName}
                          </div>
                          {item.description && (
                            <div
                              className="text-sm text-slate-500 mt-1"
                              dangerouslySetInnerHTML={{
                                __html: item.description,
                              }}
                            ></div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${item.isVariant
                                  ? "bg-purple-100 text-purple-800"
                                  : item.type === "product"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                            >
                              {item.isVariant ? "Variant" : item.type}
                            </span>
                            {item.category && (
                              <span className="text-xs text-slate-500">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-semibold text-slate-900">
                            ₹{item.sellingPrice}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.primaryUnit}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles = ["Classic", "Modern", "Minimal", "Elegant"];

const InvoiceForm = ({
  deals,
  isOpen,
  onClose,
  fetchData,
  editingInvoice,
  conversionData,
  onPreview,
}) => {
  const [form, setForm] = useState({
    deal: "",
    date: "",
    dueDate: "",
    receiverGSTIN: "",
    transactionType: "intra",
    gstRate: 18,
    items: [
      {
        _id: null,
        name: "",
        description: "",
        rate: "",
        quantity: 1,
        hsn: "",
        isVariant: false,
        parentItemId: null,
        discountType: "amount",
        discount: 0,
      },
    ],
    discount: {
      type: "fixed",
      value: 0,
    },
    amount: 0,
    status: "Draft",
    style: "",
    isTaxInvoice: false,
    notes: "",
    terms: "",
    signature: "",
  });
  const [savedSignatures, setSavedSignatures] = useState([]);
  const [signaturesLoading, setSignaturesLoading] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showQuickDealForm, setShowQuickDealForm] = useState(false);
  const [localDeals, setLocalDeals] = useState(deals);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [itemForm, setItemForm] = useState({
    type: "product",
    name: "",
    description: "",
    purchasePrice: 0,
    sellingPrice: 0,
    taxInclusive: true,
    hsnSac: "",
    barcode: "",
    category: "",
    primaryUnit: "OTH OTHERS",
    images: [],
    isActive: true,
  });
  const [itemFormLoading, setItemFormLoading] = useState(false);
  const [itemFormError, setItemFormError] = useState("");
  const [itemFormSuccess, setItemFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [items, setItems] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (showItemForm) {
      // Disable scroll on the invoice form when ItemForm is open
      if (formRef.current) {
        formRef.current.style.overflow = "hidden";
      }

      // Also prevent body scroll
      document.body.style.overflow = "hidden";

      return () => {
        // Re-enable scroll when ItemForm closes
        if (formRef.current) {
          formRef.current.style.overflow = "auto";
        }
        document.body.style.overflow = "";
      };
    }
  }, [showItemForm]);

  // GSTIN validation regex (Indian GSTIN format: 2 digits, 5 alphanumeric, 4 digits, 1 alphanumeric, 1 digit, 1 alphanumeric)
  const gstinRegex =
    /^[0-9]{2}[A-Z0-9]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;

  // Fetch items and variants for ItemSearchSelect
  const fetchItems = useCallback(async (search = "") => {
    try {
      setItemFormLoading(true);
      const res = await API.get(`/items?search=${search}&includeVariants=true`);
      const itemsWithVariants = res.data
        .filter((item) => item.isActive)
        .flatMap((item) => {
          const baseItem = {
            _id: item._id,
            displayName: item.name,
            name: item.name,
            description: item.description || "",
            sellingPrice: item.sellingPrice,
            hsnSac: item.hsnSac || "",
            type: item.type,
            category: item.category || "",
            primaryUnit: item.primaryUnit || "OTH OTHERS",
            isVariant: false,
            parentItemId: null,
          };
          const variants =
            item.variants?.map((variant) => ({
              _id: variant._id,
              displayName: `${item.name} - ${variant.name}`,
              name: variant.name,
              description: variant.description || item.description || "",
              sellingPrice: variant.sellingPrice || item.sellingPrice,
              hsnSac: variant.hsnSac || item.hsnSac || "",
              type: item.type,
              category: item.category || "",
              primaryUnit:
                variant.primaryUnit || item.primaryUnit || "OTH OTHERS",
              isVariant: true,
              parentItemId: item._id,
            })) || [];
          return [baseItem, ...variants];
        });
      setItems(itemsWithVariants);
    } catch (error) {
      console.error("Error fetching items:", error);
      setToastMessage("Failed to fetch items.");
      setTimeout(() => setToastMessage(""), 3000);
    } finally {
      setItemFormLoading(false);
    }
  }, []);

  // Fetch companies and contacts for QuickDealForm
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await API.get("/companies");
      setCompanies(res.data);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to fetch companies.");
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await API.get("/contacts");
      setContacts(res.data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to fetch contacts.");
    }
  }, []);

  const calculateItemAmount = (item) => {
    const rate = parseFloat(item.rate) || 0;
    const quantity = parseInt(item.quantity) || 0;
    const subtotal = rate * quantity;
    const discount = parseFloat(item.discount) || 0;
    if (item.discountType === "percentage") {
      return subtotal * (1 - discount / 100);
    }
    return subtotal - discount;
  };

  const calculateSubtotal = (items) =>
    items.reduce(
      (total, item) =>
        total + (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0),
      0
    );

  const calculateTotalItemDiscounts = (items) =>
    items.reduce((total, item) => {
      const subtotal =
        (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0);
      const discount = parseFloat(item.discount) || 0;
      if (item.discountType === "percentage") {
        return total + (subtotal * discount) / 100;
      }
      return total + discount;
    }, 0);

  const calculateSubtotalAfterItemDiscounts = (items) =>
    calculateSubtotal(items) - calculateTotalItemDiscounts(items);

  const calculateInvoiceDiscountAmount = (
    subtotalAfterItemDiscounts,
    discount
  ) => {
    if (discount && discount.value > 0) {
      if (discount.type === "percentage") {
        return (subtotalAfterItemDiscounts * discount.value) / 100;
      }
      return discount.value;
    }
    return 0;
  };

  const calculateTotalAmount = useCallback(
    (items, discount, gstRate, transactionType) => {
      const subtotalAfterItemDiscounts =
        calculateSubtotalAfterItemDiscounts(items);
      const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
        subtotalAfterItemDiscounts,
        discount
      );
      const netTaxable = subtotalAfterItemDiscounts - invoiceDiscountAmount;
      const totalTax = netTaxable * (gstRate / 100);
      return netTaxable + totalTax;
    },
    []
  );

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      let newValue = value;

      // Validate item discount to ensure it doesn't exceed item subtotal
      if (field === "discount") {
        const item = newItems[index];
        const rate = parseFloat(item.rate) || 0;
        const quantity = parseInt(item.quantity) || 0;
        const subtotal = rate * quantity;
        const parsedDiscount = parseFloat(value) || 0;

        if (item.discountType === "amount" && parsedDiscount > subtotal) {
          newValue = subtotal;
          toast.error("Item discount cannot exceed item total price.");
        } else if (item.discountType === "percentage" && parsedDiscount > 100) {
          newValue = 100;
          toast.error("Percentage discount cannot exceed 100%.");
        }
      }

      newItems[index][field] = newValue;
      return {
        ...prev,
        items: newItems,
        amount: calculateTotalAmount(
          newItems,
          prev.discount,
          prev.gstRate,
          prev.transactionType
        ),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleDiscountChange = (field, value) => {
    setForm((prev) => {
      const subtotalAfterItemDiscounts = calculateSubtotalAfterItemDiscounts(
        prev.items
      );
      let newValue = value;

      // Validate discount to ensure it doesn't exceed subtotal
      if (field === "value") {
        const parsedValue = parseFloat(value) || 0;
        if (
          prev.discount.type === "fixed" &&
          parsedValue > subtotalAfterItemDiscounts
        ) {
          newValue = subtotalAfterItemDiscounts;
          setToastMessage(
            "Invoice discount cannot exceed subtotal after item discounts."
          );
          setTimeout(() => setToastMessage(""), 3000);
        } else if (prev.discount.type === "percentage" && parsedValue > 100) {
          newValue = 100;
          setToastMessage("Percentage discount cannot exceed 100%.");
          setTimeout(() => setToastMessage(""), 3000);
        }
      }

      const newDiscount = { ...prev.discount, [field]: newValue };
      const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
        subtotalAfterItemDiscounts,
        newDiscount
      );

      if (invoiceDiscountAmount > subtotalAfterItemDiscounts) {
        newDiscount.value = subtotalAfterItemDiscounts;
        if (newDiscount.type === "percentage") {
          newDiscount.value = 100;
        }
        setToastMessage(
          "Invoice discount cannot exceed subtotal after item discounts."
        );
        setTimeout(() => setToastMessage(""), 3000);
      }

      return {
        ...prev,
        discount: newDiscount,
        amount: calculateTotalAmount(
          prev.items,
          newDiscount,
          prev.gstRate,
          prev.transactionType
        ),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleTaxChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      amount: calculateTotalAmount(
        prev.items,
        prev.discount,
        value,
        prev.transactionType
      ),
    }));
    setHasUnsavedChanges(true);
  };

  const handleItemSelect = (index, itemData) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...itemData,
        quantity: newItems[index].quantity || 1,
        hsn: itemData.hsn || "",
        discountType: newItems[index].discountType || "amount",
        discount: newItems[index].discount || 0,
      };
      return {
        ...prev,
        items: newItems,
        amount: calculateTotalAmount(
          newItems,
          prev.discount,
          prev.gstRate,
          prev.transactionType
        ),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleAddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          _id: null,
          name: "",
          description: "",
          rate: "",
          quantity: 1,
          hsn: "",
          isVariant: false,
          parentItemId: null,
          discountType: "amount",
          discount: 0,
        },
      ],
      amount: calculateTotalAmount(
        [
          ...prev.items,
          {
            _id: null,
            name: "",
            description: "",
            rate: "",
            quantity: 1,
            hsn: "",
            isVariant: false,
            parentItemId: null,
            discountType: "amount",
            discount: 0,
          },
        ],
        prev.discount,
        prev.gstRate,
        prev.transactionType
      ),
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (index) => {
    setForm((prev) => {
      const newItems = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items: newItems,
        amount: calculateTotalAmount(
          newItems,
          prev.discount,
          prev.gstRate,
          prev.transactionType
        ),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleOpenItemForm = () => {
    // Instantly scroll to top
    if (formRef.current) {
      formRef.current.scrollTop = 0;
    }

    // Open ItemForm immediately
    setShowItemForm(true);
  };

  const handleDealCreated = (newDeal) => {
    setLocalDeals((prev) => [...prev, newDeal]);
    setForm((prev) => ({ ...prev, deal: newDeal._id }));
    setIsFormDirty(true);
    setShowQuickDealForm(false);
  };

  const resetItemForm = () => {
    setItemForm({
      type: "product",
      name: "",
      description: "",
      purchasePrice: 0,
      sellingPrice: 0,
      taxInclusive: true,
      hsnSac: "",
      barcode: "",
      category: "",
      primaryUnit: "OTH OTHERS",
      images: [],
      isActive: true,
    });
  };

  const validateGSTIN = (gstin) => {
    if (!gstin) return true; // GSTIN is optional
    return gstinRegex.test(gstin);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate required fields
    if (!form.deal) {
      setToastMessage("Deal is required.");
      setTimeout(() => setToastMessage(""), 3000);
      setIsSubmitting(false);
      return;
    }
    if (!form.style) {
      form.style = "Classic";
    }
    if (!form.date) {
      setToastMessage("Invoice Date is required.");
      setTimeout(() => setToastMessage(""), 3000);
      setIsSubmitting(false);
      return;
    }

    // Validate GSTIN format
    if (form.receiverGSTIN && !validateGSTIN(form.receiverGSTIN)) {
      setToastMessage(
        "Invalid GSTIN format. It should be 15 characters (e.g., 22AAAAA0000A1Z5)."
      );
      setTimeout(() => setToastMessage(""), 3000);
      setIsSubmitting(false);
      return;
    }

    // Validate items
    const invalidItems = form.items.filter(
      (item) =>
        !item.name ||
        !item.rate ||
        !item.quantity ||
        (form.isTaxInvoice && !item.hsn) ||
        (item.discountType === "percentage" && item.discount > 100)
    );
    if (invalidItems.length > 0) {
      setToastMessage(`Item not found`);
      setTimeout(() => setToastMessage(""), 3000);
      setIsSubmitting(false);
      return;
    }

    const subtotalAfterItemDiscounts = calculateSubtotalAfterItemDiscounts(
      form.items
    );
    const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
      subtotalAfterItemDiscounts,
      form.discount
    );
    if (invoiceDiscountAmount > subtotalAfterItemDiscounts) {
      setToastMessage(
        "Invoice discount cannot exceed subtotal after item discounts."
      );
      setTimeout(() => setToastMessage(""), 3000);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        ...form,
        amount: form.isTaxInvoice
          ? calculateTotalAmount(
            form.items,
            form.discount,
            form.gstRate,
            form.transactionType
          )
          : calculateTotalAmount(
            form.items,
            form.discount,
            0,
            form.transactionType
          ),
        items: form.items.map((item) => ({
          itemId: item._id,
          name: item.name,
          description: item.description,
          rate: parseFloat(item.rate),
          quantity: parseInt(item.quantity),
          hsn: item.hsn,
          isVariant: item.isVariant,
          parentItemId: item.parentItemId,
          discountType: item.discountType,
          discount: parseFloat(item.discount),
        })),
      };

      if (editingInvoice) {
        await API.put(`/invoices/${editingInvoice._id}`, payload);
        toast.success("Invoice updated successfully!");
      } else {
        await API.post("/invoices", payload);
        toast.success("Invoice created successfully!");
      }

      setHasUnsavedChanges(false);
      setForm({
        deal: "",
        date: "",
        dueDate: "",
        receiverGSTIN: "",
        transactionType: "intra",
        gstRate: 18,
        items: [
          {
            _id: null,
            name: "",
            description: "",
            rate: "",
            quantity: 1,
            hsn: "",
            isVariant: false,
            parentItemId: null,
            discountType: "amount",
            discount: 0,
          },
        ],
        discount: { type: "fixed", value: 0 },
        amount: 0,
        status: "Draft",
        style: "",
        isTaxInvoice: false,
        notes: "",
        terms: "",
        signature: "",
      });
      await fetchData();
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        setToastMessage(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        setToastMessage(
          err.response?.data?.error ||
          (editingInvoice
            ? "Failed to update invoice"
            : "Failed to create invoice")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmExit = () => {
    setHasUnsavedChanges(false);
    setShowConfirmDialog(false);
    onClose();
  };

  const handleSaveAndExit = async () => {
    await handleSubmit(new Event("submit"));
    if (!toastMessage.includes("Failed")) {
      setShowConfirmDialog(false);
      onClose();
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (editingInvoice || conversionData) {
      const sourceData = editingInvoice || conversionData;
      const initialForm = {
        deal: sourceData.deal?._id || sourceData.deal || "",
        date: sourceData.date ? sourceData.date.slice(0, 10) : "",
        dueDate: sourceData.dueDate
          ? sourceData.dueDate.slice(0, 10)
          : "",
        receiverGSTIN: sourceData.receiverGSTIN || "",
        transactionType: sourceData.transactionType || "intra",
        gstRate: sourceData.gstRate || 18,
        items: (sourceData.items || []).map((item) => ({
          _id: item.itemId || item._id || null,
          name: item.name || "",
          description: item.description || "",
          rate: item.rate || "",
          quantity: item.quantity || 1,
          hsn: item.hsn || "",
          isVariant: item.isVariant || false,
          parentItemId: item.parentItemId || null,
          discountType: item.discountType || "amount",
          discount: item.discount || 0,
        })),
        discount: sourceData.discount || { type: "fixed", value: 0 },
        amount: sourceData.amount || 0,
        status: editingInvoice ? sourceData.status : "Draft",
        style: sourceData.style || "",
        isTaxInvoice: sourceData.isTaxInvoice || false,
        notes: sourceData.notes || "",
        terms: sourceData.terms || "",
        signature: sourceData.signature || "",
      };
      setForm(initialForm);
      setHasUnsavedChanges(false);
    } else {
      const initialForm = {
        deal: "",
        date: "",
        dueDate: "",
        receiverGSTIN: "",
        transactionType: "intra",
        gstRate: 18,
        items: [
          {
            _id: null,
            name: "",
            description: "",
            rate: "",
            quantity: 1,
            hsn: "",
            isVariant: false,
            parentItemId: null,
            discountType: "amount",
            discount: 0,
          },
        ],
        discount: { type: "fixed", value: 0 },
        amount: 0,
        status: "Draft",
        style: "",
        isTaxInvoice: false,
        notes: "",
        terms: "",
        signature: "",
      };
      setForm(initialForm);
      setHasUnsavedChanges(false);
    }
  }, [editingInvoice]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
      fetchItems();
      fetchCompanies();
      fetchContacts();
      setLocalDeals(deals);

      // Fetch saved signatures and auto-select default for new invoices
      const fetchSignatures = async () => {
        setSignaturesLoading(true);
        try {
          const res = await API.get("/document-settings/signatures");
          const sigs = Array.isArray(res.data) ? res.data : [];
          setSavedSignatures(sigs);

          // Auto-apply default signature only when creating a new invoice
          if (!editingInvoice) {
            const defaultSig = sigs.find((s) => s.isDefault);
            if (defaultSig) {
              setForm((prev) => ({ ...prev, signature: defaultSig.dataUrl || "" }));
            }
          }
        } catch (err) {
          console.error("Failed to fetch signatures:", err);
          setSavedSignatures([]);
        } finally {
          setSignaturesLoading(false);
        }
      };
      fetchSignatures();
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen, deals]);

  if (!shouldRender) return null;

  const subtotal = calculateSubtotal(form.items);
  const totalItemDiscounts = calculateTotalItemDiscounts(form.items);
  const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
  const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
    subtotalAfterItemDiscounts,
    form.discount
  );
  const netTaxable = subtotalAfterItemDiscounts - invoiceDiscountAmount;
  const totalTax = form.isTaxInvoice ? (netTaxable * form.gstRate) / 100 : 0;
  const finalTotal = netTaxable + totalTax;

  const cgstAmount =
    form.transactionType === "intra" ? netTaxable * (form.gstRate / 200) : 0;
  const sgstAmount =
    form.transactionType === "intra" ? netTaxable * (form.gstRate / 200) : 0;
  const igstAmount = form.transactionType === "inter" ? totalTax : 0;

  // format deals with company name
  const formattedDeals = localDeals.map((deal) => ({
    ...deal,
    label: `${deal.title} — ${deal.company?.name || "No Company"}`,
  }));

  return createPortal(
    <>
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[10002] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-out">
          {toastMessage}
        </div>
      )}

      {showQuickDealForm && (
        <QuickDealForm
          companies={companies}
          contacts={contacts}
          onDealCreated={handleDealCreated}
          onRequestClose={() => setShowQuickDealForm(false)}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10004] flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unsaved Changes
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to exit without
              saving?
            </p>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors cursor-pointer hidden sm:block"
              >
                Cancel
              </button>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Exit Without Saving
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save and Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        ref={formRef}
        className={`fixed dc-panel-card dc-panel-w z-[10000] bg-white shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out ${isSliding ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"
          }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b flex-shrink-0 bg-white">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close form"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto flex-1">
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Select Deal *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {/* <SearchableDropdown
                      options={localDeals}
                      value={form.deal}
                      onChange={(value) => {
                        setForm((prev) => ({ ...prev, deal: value }));
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Select Deal"
                      displayKey="title"
                      valueKey="_id"
                      className="flex-1"
                    /> */}
                      <SearchableDropdown
                        options={formattedDeals}
                        value={form.deal}
                        onChange={(value) => {
                          setForm((prev) => ({ ...prev, deal: value }));
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Select Deal"
                        valueKey="_id"
                        className="flex-1"
                        displayKey="label"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickDealForm(true)}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                      aria-label="Add new deal"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Invoice Style
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative w-full">
                      <select
                        className="w-full appearance-none border border-slate-300 rounded-[25px] p-2.5 pr-9 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                        value={form.style}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, style: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        aria-label="Select invoice style"
                      >
                        <option value="">Select style...</option>
                        {styles.map((s, idx) => (
                          <option key={idx} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                    {form.style && (
                      <button
                        type="button"
                        onClick={() => onPreview(form)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                        aria-label="Preview invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Invoice Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full pl-4 pr-4 py-2.5 border border-slate-300 rounded-[25px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                      required
                      value={form.date}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, date: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                      aria-label="Select invoice date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full pl-4 pr-4 py-2.5 border border-slate-300 rounded-[25px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                      value={form.dueDate}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, dueDate: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                      aria-label="Select due date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Receiver GSTIN
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter Receiver GSTIN (e.g., 22AAAAA0000A1Z5)"
                      className="w-full pl-4 pr-4 py-2.5 border border-slate-300 rounded-[25px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                      value={form.receiverGSTIN}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          receiverGSTIN: e.target.value.toUpperCase(),
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      aria-label="Receiver GSTIN"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Tax Invoice
                </label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.isTaxInvoice}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        isTaxInvoice: e.target.checked,
                      }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    aria-label="Enable tax invoice"
                  />
                  <span className="ml-2 text-sm text-slate-600">
                    Enable Tax Invoice
                  </span>
                </div>
              </div>

              {form.isTaxInvoice && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Transaction Type
                    </label>
                    <select
                      className="w-full border border-slate-300 rounded-[25px] p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                      value={form.transactionType}
                      onChange={(e) =>
                        handleTaxChange("transactionType", e.target.value)
                      }
                    >
                      <option value="intra">Intra-State (CGST + SGST)</option>
                      <option value="inter">Inter-State (IGST)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      GST Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.gstRate}
                      onChange={(e) =>
                        handleTaxChange(
                          "gstRate",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full border border-slate-300 rounded-[25px] p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                      placeholder="18"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IndianRupeeIcon className="w-5 h-5 text-slate-600" />
                  <label className="block font-semibold text-slate-700">
                    Invoice Items
                  </label>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white p-3 rounded-lg border border-slate-200 space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">
                            Item
                          </label>
                          <ItemSearchSelect
                            value={item}
                            onSelect={(itemData) =>
                              handleItemSelect(index, itemData)
                            }
                            onAddNew={handleOpenItemForm}
                            fetchItems={fetchItems}
                            items={items}
                            setItems={setItems}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">
                            Description
                          </label>
                          <input
                            type="text"
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => {
                              handleItemChange(
                                index,
                                "description",
                                e.target.value
                              );
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                            aria-label="Item description"
                          />
                        </div>
                      </div>

                      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3`}>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">
                            Rate (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            min="0"
                            step="1"
                            value={item.rate}
                            onChange={(e) => {
                              handleItemChange(index, "rate", e.target.value);
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                            required
                            aria-label="Item rate"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">
                            Quantity
                          </label>
                          <input
                            type="number"
                            placeholder="1"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              handleItemChange(index, "quantity", e.target.value);
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                            required
                            aria-label="Item quantity"
                          />
                        </div>
                        {form.isTaxInvoice && (
                          <>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-600">
                                HSN/SAC
                              </label>
                              <input
                                type="text"
                                placeholder="HSN/SAC code"
                                value={item.hsn}
                                onChange={(e) => {
                                  handleItemChange(index, "hsn", e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                                required
                                aria-label="HSN/SAC code"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-600">
                                Discount
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  step={
                                    item.discountType === "percentage" ? "1" : "1"
                                  }
                                  value={item.discount}
                                  onChange={(e) => {
                                    handleItemChange(
                                      index,
                                      "discount",
                                      e.target.value
                                    );
                                    setHasUnsavedChanges(true);
                                  }}
                                  className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                                  aria-label="Item discount"
                                />
                                <select
                                  value={item.discountType}
                                  onChange={(e) => {
                                    handleItemChange(
                                      index,
                                      "discountType",
                                      e.target.value
                                    );
                                    setHasUnsavedChanges(true);
                                  }}
                                  className="border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                                  aria-label="Discount type"
                                >
                                  <option value="amount">₹</option>
                                  <option value="percentage">%</option>
                                </select>
                              </div>
                            </div>
                          </>
                        )}
                        {!form.isTaxInvoice && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">
                              Discount
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="0"
                                min="0"
                                step={
                                  item.discountType === "percentage" ? "1" : "1"
                                }
                                value={item.discount}
                                onChange={(e) => {
                                  handleItemChange(
                                    index,
                                    "discount",
                                    e.target.value
                                  );
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                                aria-label="Item discount"
                              />
                              <select
                                value={item.discountType}
                                onChange={(e) => {
                                  handleItemChange(
                                    index,
                                    "discountType",
                                    e.target.value
                                  );
                                  setHasUnsavedChanges(true);
                                }}
                                className="border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                                aria-label="Discount type"
                              >
                                <option value="amount">₹</option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">
                            Amount
                          </label>
                          <div className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium">
                            <h6>₹{calculateItemAmount(item).toFixed(2)}</h6>
                          </div>
                        </div>
                      </div>

                      {form.items.length > 1 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove Item
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                    aria-label="Add another item"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Item
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Invoice Discount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step={form.discount.type === "percentage" ? "1" : "1"}
                    value={form.discount.value}
                    onChange={(e) => {
                      handleDiscountChange("value", e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                    aria-label="Invoice discount"
                  />
                  <select
                    value={form.discount.type}
                    onChange={(e) => {
                      handleDiscountChange("type", e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="border border-slate-300 rounded-[25px] p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                    aria-label="Invoice discount type"
                  >
                    <option value="fixed">₹</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>

              {/* Signature Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-slate-600" />
                  <label className="block font-semibold text-slate-700">Signature</label>
                </div>

                {signaturesLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm p-3">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z" />
                    </svg>
                    Loading signatures...
                  </div>
                ) : savedSignatures.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    No saved signatures found. Add one in{" "}
                    <span className="font-medium text-blue-600">Settings → Document Settings → Signatures</span>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* No Signature option */}
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, signature: "" }));
                        setHasUnsavedChanges(true);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${!form.signature
                          ? "border-blue-500 bg-blue-50/60"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      aria-label="No signature"
                    >
                      <div className="w-20 h-12 flex items-center justify-center bg-slate-100 rounded-lg border border-dashed border-slate-300 flex-shrink-0">
                        <span className="text-slate-400 text-xs">None</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">No Signature</p>
                        <p className="text-xs text-slate-400">Invoice will not include a signature</p>
                      </div>
                      {!form.signature && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      )}
                    </button>

                    {/* Saved signature options */}
                    {savedSignatures.map((sig) => (
                      <button
                        key={sig.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, signature: sig.dataUrl || "" }));
                          setHasUnsavedChanges(true);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${form.signature === sig.dataUrl
                            ? "border-blue-500 bg-blue-50/60"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        aria-label={`Select signature: ${sig.name}`}
                      >
                        <div className="w-20 h-12 flex items-center justify-center bg-white rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
                          {sig.dataUrl ? (
                            <img
                              src={sig.dataUrl}
                              alt={sig.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <span className="text-slate-400 text-xs">No preview</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-700 truncate">{sig.name}</p>
                            {sig.isDefault && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">Default</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 capitalize">
                            {sig.type === "draw" ? "Drawn" : sig.type === "upload" ? "Uploaded" : "Typed"}
                          </p>
                        </div>
                        {form.signature === sig.dataUrl && (
                          <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg border border-slate-200/50">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    Subtotal
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    <h6>₹{formatNumberToIndian(subtotal)}</h6>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    Item Discounts
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    <h6>- ₹{formatNumberToIndian(totalItemDiscounts)}</h6>
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium text-slate-600">
                    After Item Discounts
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    <h6>₹{formatNumberToIndian(subtotalAfterItemDiscounts)}</h6>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    Invoice Discount
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    <h6>- ₹{formatNumberToIndian(invoiceDiscountAmount)}</h6>
                  </span>
                </div>
                {form.isTaxInvoice && (
                  <>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-sm font-medium text-slate-600">
                        Net Taxable Value
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        <h6>₹{formatNumberToIndian(netTaxable)}</h6>
                      </span>
                    </div>
                    {form.transactionType === "intra" ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-slate-600">
                            CGST @{form.gstRate / 2}%
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            <h6>₹{formatNumberToIndian(cgstAmount)}</h6>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-slate-600">
                            SGST @{form.gstRate / 2}%
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            <h6>₹{formatNumberToIndian(sgstAmount)}</h6>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-slate-600">
                          IGST @{form.gstRate}%
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          <h6>₹{igstAmount.toLocaleString()}</h6>
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-sm font-bold text-slate-600">
                        Total Tax
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        <h6>₹{totalTax.toLocaleString()}</h6>
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-lg font-bold text-slate-900">
                    Final Total
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    <h6>₹{formatNumberToIndian(finalTotal)}</h6>
                  </span>
                </div>
                <div className="text-sm text-slate-600 italic text-right mt-1">
                  {numberToWords(finalTotal)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t flex-shrink-0 bg-white">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg border border-slate-200/50">
              <button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-700 hover:to-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                disabled={isSubmitting}
                aria-label={
                  editingInvoice ? "Update invoice" : "Create invoice"
                }
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : editingInvoice ? (
                  "Update Invoice"
                ) : (
                  "Create Invoice"
                )}
              </button>
            </div>
          </div>
        </form>

        {showItemForm && (
          <ItemForm
            form={itemForm}
            setForm={setItemForm}
            loading={itemFormLoading}
            setLoading={setItemFormLoading}
            setError={setItemFormError}
            setSuccess={setItemFormSuccess}
            fetchItems={fetchItems}
            onRequestClose={() => {
              resetItemForm();
              setShowItemForm(false);
            }}
          />
        )}
      </div>
    </>,
    document.body
  );
};


// ============================================================================
// CreateInvoicePanel — moved here from Accounting.jsx
// Shared two-pane create/edit form used by all document types.
// ============================================================================

const OpenNotesTermsButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Edit notes and terms"
    className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0085FF] hover:underline flex-shrink-0"
  >
    <Plus className="w-3 h-3" />
    {label}
  </button>
);

const apiPathFor = (type) =>
  type === "tax"
    ? "invoices"
    : type === "performa"
      ? "performa-invoices"
      : type === "quotation"
        ? "quotations"
        : "delivery-challans";

const numberKeyFor = (type) =>
  type === "tax"
    ? "invoiceNumber"
    : type === "performa"
      ? "performaInvoiceNumber"
      : type === "quotation"
        ? "quotationNumber"
        : "deliveryChallanNumber";

const docNameFor = (type) =>
  type === "tax"
    ? "Invoice"
    : type === "performa"
      ? "Pro Forma Invoice"
      : type === "quotation"
        ? "Quotation"
        : "Delivery Challan";

// Single source of truth for the template list — the same one the renderer and
// the PDF generator use, so a template added there shows up here automatically.
/* The "Add Invoice" experience for the Invoices tab: details on the left,
   live preview on the right. */
const CreateInvoicePanel = ({
  deals,
  onClose,
  onCreated,
  onAddDeal,
  initialDoc = null,
  conversionData = null,
  onFullView,
  // Optional. When provided, the header's expand button switches to a
  // dedicated full-width screen owned by the parent instead of hiding the
  // preview pane in place. Quotations use this; other types leave it unset.
  onRequestFullWidth,
  type = "tax",
}) => {
  const isEditing = !!initialDoc;
  // Per-type capabilities. Delivery challans have no GSTIN / tax / HSN; the
  // quotation tax flag is stored under a different key.
  const isChallan = type === "deliveryChallan";
  const supportsTax = !isChallan;
  const supportsGSTIN = !isChallan;
  const taxFlagKey = type === "quotation" ? "isTaxQuotation" : "isTaxInvoice";
  const docName = docNameFor(type);
  // Section badges are numbered by position so a hidden section doesn't leave
  // a gap in the sequence.
  const sectionNo = (() => {
    let n = 1;
    const pad = (v) => String(v).padStart(2, "0");
    const out = { details: pad(n++) };
    out.address = pad(n++);
    if (supportsGSTIN) out.billing = pad(n++);
    out.items = pad(n++);
    out.notes = pad(n++);
    out.terms = pad(n++);
    out.signature = pad(n++);
    out.summary = pad(n++);
    return out;
  })();
  const [form, setForm] = useState(() => {
    const sourceDoc = initialDoc || conversionData;
    return sourceDoc
      ? {
          deal: sourceDoc.deal?._id || sourceDoc.deal || "",
          style: sourceDoc.style || "",
          date: sourceDoc.date ? sourceDoc.date.slice(0, 10) : "",
          dueDate: sourceDoc.dueDate ? sourceDoc.dueDate.slice(0, 10) : "",
          receiverGSTIN: sourceDoc.receiverGSTIN || "",
          billingAddress: { ...emptyAddress(), ...(sourceDoc.billingAddress || {}) },
          shippingAddress: { ...emptyAddress(), ...(sourceDoc.shippingAddress || {}) },
          sameAsBilling:
            isAddressEmpty(sourceDoc.shippingAddress) ||
            JSON.stringify({ ...emptyAddress(), ...(sourceDoc.billingAddress || {}) }) ===
              JSON.stringify({ ...emptyAddress(), ...(sourceDoc.shippingAddress || {}) }),
          isTaxInvoice:
            sourceDoc[type === "quotation" ? "isTaxQuotation" : "isTaxInvoice"] ||
            false,
          transactionType: sourceDoc.transactionType || "intra",
          gstRate: sourceDoc.gstRate || 18,
          invoicePrefix: sourceDoc.invoicePrefix || "INV-",
          invoiceSuffix: sourceDoc.invoiceSuffix || "",
          invoiceNumber: sourceDoc.invoiceNumber || "",
          nextInvoiceNumber: sourceDoc.nextInvoiceNumber || 1,
          items:
            sourceDoc.items && sourceDoc.items.length
              ? sourceDoc.items.map((item) => ({
                  _id: item.itemId || item._id,
                  name: item.name,
                  description: item.description || "",
                  rate: item.rate,
                  quantity: item.quantity,
                  hsn: item.hsn || "",
                  isVariant: item.isVariant || false,
                  parentItemId: item.parentItemId || null,
                  discountType: item.discountType || "amount",
                  discount: item.discount || 0,
                }))
              : [blankItem()],
          discount: sourceDoc.discount || { type: "fixed", value: 0 },
          notes: sourceDoc.notes || "",
          terms: sourceDoc.terms || "",
          signature: sourceDoc.signature || "",
          status: initialDoc ? sourceDoc.status : "Draft",
        }
      : {
          deal: "",
          style: "",
          date: "",
          dueDate: "",
          receiverGSTIN: "",
          billingAddress: emptyAddress(),
          shippingAddress: emptyAddress(),
          sameAsBilling: true,
          isTaxInvoice: false,
          transactionType: "intra",
          gstRate: 18,
          invoicePrefix: "INV-",
          invoiceSuffix: "",
          invoiceNumber: "",
          nextInvoiceNumber: 1,
          items: [blankItem()],
          discount: { type: "fixed", value: 0 },
          notes: "",
          terms: "",
          signature: "",
          status: "Draft",
        };
  });
  const [catalogue, setCatalogue] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [orgDetails, setOrgDetails] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  // Numbering (prefix/suffix/next number) comes from DocumentSettings.
  const [docSettings, setDocSettings] = useState({
    invoicePrefix: "INV-",
    invoiceSuffix: "",
    invoicePrefixes: ["INV-"],
    invoiceSuffixes: [],
    nextInvoiceNumber: 1,
    defaultNotes: "",
    defaultTerms: "",
    documentTypeSettings: {
      invoice: { prefix: "INV-", suffix: "", prefixes: ["INV-"], suffixes: [] },
    },
  });
  // Rendering template comes from DocumentTemplateSettings — a separate model.
  const [orgTemplate, setOrgTemplate] = useState("Classic");
  // Signatures saved under Settings → Document Settings. New documents adopt
  // the org's default; existing ones keep whatever was chosen when created.
  const [savedSignatures, setSavedSignatures] = useState([]);
  const [signaturesLoading, setSignaturesLoading] = useState(false);

  // Draggable split between the form (left) and the preview (right).
  const splitRef = useRef(null);
  const [leftPct, setLeftPct] = useState(50);
  // Collapses the preview entirely so the form gets the full width — useful
  // when filling in a long item list on a narrow screen.
  const [hidePreview, setHidePreview] = useState(false);
  // null when closed; otherwise the section to focus ("notes" | "terms").
  const [notesDrawer, setNotesDrawer] = useState(null);
  // Width the two columns actually use; the split only applies while the
  // preview is on screen.
  const formWidth = hidePreview ? "100%" : `${leftPct}%`;

  // Document number, renamed inline from the header. Only the trailing part
  // after the last hyphen is editable — the prefix (INV-, QUO-, …) identifies
  // the document type and must survive any rename.
  const numberKey = numberKeyFor(type);
  const [docNumber, setDocNumber] = useState(initialDoc?.[numberKey] || "");
  const numberPrefix = docNumber.includes("-")
    ? docNumber.slice(0, docNumber.lastIndexOf("-") + 1)
    : "";
  const numberSuffix = docNumber.slice(numberPrefix.length);
  const [numberDraft, setNumberDraft] = useState(null); // null = not editing
  const [savingNumber, setSavingNumber] = useState(false);

  const saveDocNumber = async () => {
    const suffix = (numberDraft || "").trim();
    if (!suffix) return toast.error(`${docName} number cannot be empty.`);
    const next = `${numberPrefix}${suffix}`;
    if (next === docNumber) return setNumberDraft(null);
    try {
      setSavingNumber(true);
      await API.patch(`/${apiPathFor(type)}/number/${initialDoc._id}`, {
        [numberKey]: next,
      });
      setDocNumber(next);
      setNumberDraft(null);
      toast.success(`${docName} number updated.`);
      onCreated?.(); // refresh the list behind the panel so it shows the new number
    } catch (err) {
      toast.error(
        err?.response?.status === 409
          ? `${next} already exists.`
          : err?.response?.data?.error || "Failed to update the number."
      );
    } finally {
      setSavingNumber(false);
    }
  };

  // "Full view" renders the same live preview blown up in a modal rather than
  // fetching the server's PDF — the PDF only knows the *saved* invoice, so
  // opening it would silently discard whatever the user has edited since.
  const [showFullView, setShowFullView] = useState(false);

  // The preview renders at a fixed design width and is scaled to fit the panel
  // (like zooming an image) so resizing never reflows the invoice layout.
  const PREVIEW_BASE_W = 760;
  const previewAreaRef = useRef(null);
  const sheetRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  useLayoutEffect(() => {
    const area = previewAreaRef.current;
    if (!area) return;
    const update = () => {
      const avail = area.clientWidth - 12; // minus the p-1.5 padding
      const s = Math.max(0.1, avail / PREVIEW_BASE_W);
      setPreviewScale(s);
      if (sheetRef.current)
        setSheetHeight(sheetRef.current.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(area);
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [leftPct]);
  const startSplitDrag = (e) => {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const onMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Same branding + bank details the backend feeds into the PDF, so the live
  // preview shows the real seller header, GSTIN and bank block. The template
  // chosen in the Template drawer renders every document of this type, which is
  // exactly how the backend resolves it when generating the PDF.
  // Re-runs when the drawer closes so a change made there shows up right away.
  useEffect(() => {
    if (showTemplates) return;
    (async () => {
      try {
        const [b, bank, settings, docSettingsRes] = await Promise.allSettled([
          API.get("/branding"),
          API.get("/bank-details"),
          API.get("/document-templates"),
          API.get("/document-settings"),
        ]);
        if (b.status === "fulfilled") setOrgDetails(b.value.data || null);
        if (bank.status === "fulfilled")
          setBankDetails(bank.value.data || null);
        if (settings.status === "fulfilled") {
          const chosen = settings.value.data?.templates?.[type];
          if (chosen) setOrgTemplate(chosen);
        }
        // Keep numbering in sync with edits made in the drawer's Numbering tab.
        if (docSettingsRes.status === "fulfilled") {
          const d = docSettingsRes.value.data || {};
          setDocSettings((prev) => ({
            ...prev,
            invoicePrefix: d.invoicePrefix || "INV-",
            invoiceSuffix: d.invoiceSuffix || "",
            invoicePrefixes: d.invoicePrefixes || ["INV-"],
            invoiceSuffixes: d.invoiceSuffixes || [],
            nextInvoiceNumber: d.nextInvoiceNumber || 1,
            documentTypeSettings: d.documentTypeSettings || prev.documentTypeSettings,
          }));
        }
      } catch (err) {
        console.error("Fetch branding/bank error:", err);
      }
    })();
  }, [type, showTemplates]);

  // The panel is an overlay, not a route. Push a history entry while it's open
  // so the browser Back button closes the panel and stays on Accounting,
  // instead of navigating away to the previous page.
  useEffect(() => {
    window.history.pushState({ accountingPanel: true }, "");
    const handlePop = () => onClose();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await API.get("/items?search=&includeVariants=true");
        const flattened = (res.data || [])
          .filter((item) => item.isActive)
          .flatMap((item) => {
            const base = {
              _id: item._id,
              displayName: item.name,
              name: item.name,
              description: item.description || "",
              sellingPrice: item.sellingPrice,
              hsnSac: item.hsnSac || "",
              isVariant: false,
              parentItemId: null,
            };
            const variants = (item.variants || []).map((v) => ({
              _id: v._id,
              displayName: `${item.name} - ${v.name}`,
              name: v.name,
              description: v.description || item.description || "",
              sellingPrice: v.sellingPrice || item.sellingPrice,
              hsnSac: v.hsnSac || item.hsnSac || "",
              isVariant: true,
              parentItemId: item._id,
            }));
            return [base, ...variants];
          });
        setCatalogue(flattened);
      } catch (err) {
        console.error("Fetch items error:", err);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    const loadDocSettings = async () => {
      try {
        const res = await API.get("/document-settings");
        setDocSettings({
          invoicePrefix: res.data?.invoicePrefix || "INV-",
          invoiceSuffix: res.data?.invoiceSuffix || "",
          invoicePrefixes: res.data?.invoicePrefixes || ["INV-"],
          invoiceSuffixes: res.data?.invoiceSuffixes || [],
          nextInvoiceNumber: res.data?.nextInvoiceNumber || 1,
          defaultNotes: res.data?.defaultNotes || "",
          defaultTerms: res.data?.defaultTerms || "",
          documentTypeSettings: res.data?.documentTypeSettings || { invoice: { prefix: "INV-", suffix: "", prefixes: ["INV-"], suffixes: [] } },
        });
        setForm((prev) => ({
          ...prev,
          invoicePrefix: res.data?.invoicePrefix || "INV-",
          invoiceSuffix: res.data?.invoiceSuffix || "",
          nextInvoiceNumber: res.data?.nextInvoiceNumber || 1,
        }));
      } catch (error) {
        console.error("Failed to load document settings", error);
      }
    };

    loadDocSettings();
  }, []);

  // Load the org's saved signatures and fall back to the one marked default
  // whenever the document doesn't already carry a signature of its own — so
  // every invoice gets the default unless someone picked a specific one. A
  // document that stored its own custom signature keeps it untouched.
  useEffect(() => {
    const loadSignatures = async () => {
      setSignaturesLoading(true);
      try {
        const res = await API.get("/document-settings/signatures");
        const sigs = Array.isArray(res.data) ? res.data : [];
        setSavedSignatures(sigs);
        const defaultSig = sigs.find((s) => s.isDefault);
        if (defaultSig) {
          // Fall back to the default whenever the document isn't already
          // pointing at one of the saved signatures — so a blank, stale, or
          // never-set signature resolves to the default rather than nothing.
          // A document that stored a still-valid custom signature keeps it.
          setForm((prev) => {
            const hasSavedMatch = sigs.some((s) => s.dataUrl === prev.signature);
            return hasSavedMatch
              ? prev
              : { ...prev, signature: defaultSig.dataUrl || "" };
          });
        }
      } catch (error) {
        console.error("Failed to load signatures", error);
        setSavedSignatures([]);
      } finally {
        setSignaturesLoading(false);
      }
    };

    loadSignatures();
  }, []);

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const updateItem = (index, patch) =>
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));

  const addItem = () =>
    setForm((p) => ({ ...p, items: [...p.items, blankItem()] }));

  const removeItem = (index) =>
    setForm((p) => ({
      ...p,
      items:
        p.items.length === 1 ? [blankItem()] : p.items.filter((_, i) => i !== index),
    }));

  // Same breakdown as InvoiceForm.jsx: line total -> per-item discount ->
  // subtotal after item discounts -> invoice-level discount -> GST -> final.
  const lineTotal = (item) =>
    (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0);

  const itemDiscountAmount = (item) => {
    const base = lineTotal(item);
    const discount = parseFloat(item.discount) || 0;
    return item.discountType === "percentage" ? (base * discount) / 100 : discount;
  };

  const subtotal = form.items.reduce((sum, it) => sum + lineTotal(it), 0);
  const itemDiscountsTotal = form.items.reduce(
    (sum, it) => sum + itemDiscountAmount(it),
    0
  );
  const afterItemDiscounts = subtotal - itemDiscountsTotal;
  const invoiceDiscountAmount =
    form.discount.value > 0
      ? form.discount.type === "percentage"
        ? (afterItemDiscounts * form.discount.value) / 100
        : form.discount.value
      : 0;
  const netTaxable = afterItemDiscounts - invoiceDiscountAmount;
  // Same split used for the item table and totals in the PDF/live preview
  // (buildDocumentHtml → computeDocument → splitGst) — kept as one function
  // so this summary can never disagree with what actually prints.
  const gstSplit = form.isTaxInvoice
    ? splitGst(netTaxable, form.gstRate, form.transactionType)
    : { cgst: 0, sgst: 0, igst: 0, isInterState: false };
  const taxAmount = gstSplit.cgst + gstSplit.sgst + gstSplit.igst;
  const finalTotal = netTaxable + taxAmount;

  const money = (n) =>
    `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const submitInvoice = async (statusValue) => {
    const isDraft = statusValue === "Draft";
    if (!form.deal) return toast.error("Please select a deal.");
    if (!form.date) return toast.error(`Please pick a ${docName} date.`);
    // A quick draft only needs enough to identify the document; full GSTIN and
    // item validation apply once it's actually being created for real.
    if (!isDraft) {
      if (supportsGSTIN) {
        if (!form.receiverGSTIN.trim())
          return toast.error("Receiver GSTIN is required.");
        if (!GSTIN_REGEX.test(form.receiverGSTIN.trim().toUpperCase()))
          return toast.error(
            "Invalid GSTIN format. It should be 15 characters (e.g., 22AAAAA0000A1Z5)."
          );
      }
      const needsHsn = supportsTax && form.isTaxInvoice;
      const badItem = form.items.find(
        (it) => !it.name || !it.rate || !it.quantity || (needsHsn && !it.hsn)
      );
      if (badItem)
        return toast.error(
          needsHsn
            ? "Every item needs a name, rate, quantity and HSN."
            : "Every item needs a name, rate and quantity."
        );
    }

    try {
      setSubmitting(true);
      const payload = {
        deal: form.deal,
        date: form.date,
        dueDate: form.dueDate,
        status: statusValue,
        // Saved blank on purpose when no style was picked: the document then
        // follows the organization's template instead of freezing today's
        // choice into the record.
        transactionType: form.transactionType,
        gstRate: form.gstRate,
        discount: form.discount,
        notes: form.notes,
        terms: form.terms,
        signature: form.signature,
        amount: finalTotal,
        items: form.items.map((it) => ({
          itemId: it._id,
          name: it.name,
          description: it.description,
          rate: parseFloat(it.rate) || 0,
          quantity: parseInt(it.quantity) || 0,
          hsn: it.hsn,
          isVariant: it.isVariant,
          parentItemId: it.parentItemId,
          discountType: it.discountType,
          discount: parseFloat(it.discount) || 0,
        })),
      };
      if (supportsGSTIN) {
        payload.receiverGSTIN = form.receiverGSTIN.trim().toUpperCase();
      }
      // Sent for every document type — the backend model carries billing/
      // shipping address on invoices, pro forma invoices, quotations and
      // delivery challans alike. Left blank, the server falls back to the
      // deal's company address on its own.
      payload.billingAddress = form.billingAddress;
      payload.shippingAddress = form.sameAsBilling
        ? form.billingAddress
        : form.shippingAddress;
      if (supportsTax) {
        payload[taxFlagKey] = form.isTaxInvoice;
      }
      // Numbering is configured per document type and only wired up for
      // invoices, so the prefix/suffix/next-number fields ride along on that
      // type alone rather than on every document.
      if (type === "tax") {
        payload.invoicePrefix =
          form.invoicePrefix?.trim() || docSettings.invoicePrefix || "INV-";
        payload.invoiceSuffix = form.invoiceSuffix ?? docSettings.invoiceSuffix ?? "";
        payload.invoiceNumber = form.invoiceNumber?.toString().trim() || undefined;
        payload.nextInvoiceNumber =
          form.nextInvoiceNumber ?? docSettings.nextInvoiceNumber ?? 1;
      }

      const path = apiPathFor(type);
      if (isEditing) {
        await API.put(`/${path}/${initialDoc._id}`, payload);
        toast.success(isDraft ? "Saved as draft!" : `${docName} updated successfully!`);
      } else {
        await API.post(`/${path}`, payload);
        toast.success(isDraft ? "Saved as draft!" : `${docName} created successfully!`);
      }
      onCreated();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        `Failed to ${isEditing ? "update" : isDraft ? "save draft" : "create"} ${docName.toLowerCase()}`
      );
      console.error(`${isEditing ? "Update" : "Create"} ${type} error:`, err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => submitInvoice("Draft");

  // The template this document renders with. The organization's choice wins
  // outright: htmlDocumentPdf.resolveTemplate ignores the document's stored
  // `style` entirely, and every document saved before that change still
  // carries style:"Classic" from the old schema default. Honouring it here
  // would pin the preview to Classic forever *and* disagree with the PDF.
  // Used by the preview *and* the print window so all three agree.
  const previewTemplate = orgTemplate;

  // Prints exactly what the preview shows — the same shared fragment the PDF
  // is rendered from — including edits that haven't been saved yet, rather
  // than fetching the server's copy of the document.
  const handlePrint = () => {
    const html = buildDocumentHtml(
      {
        ...form,
        isTaxInvoice: supportsTax && !!form.isTaxInvoice,
        isTaxQuotation: supportsTax && !!form.isTaxInvoice,
      },
      {
        type,
        template: previewTemplate,
        orgDetails,
        bankDetails,
        dealName: dealOptions.find((d) => d.value === form.deal)?.label,
        documentNumber: docNumber,
      }
    );
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast.error("Allow pop-ups for this site to print.");
      return;
    }
    win.document.write(`<!doctype html>
<html>
<head><meta charset="utf-8" /><title>${docNumber || docName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  .dcsheet { padding: 0 !important; }
  /* Browsers drop background fills when printing unless asked not to, which
     would strip the header bands and tinted rows some templates rely on. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  /* The sheet is authored at 760px and Chrome scales it to the printable
     width, so 1px rules land on fractions of a device pixel and get rounded
     away — the <table> blocks keep theirs (collapsed borders round up), the
     plain div boxes lose theirs entirely and only reappear when zoomed in.
     Printing at a slightly thicker hairline survives the downscale. */
  .dcsheet { --line-w: 1.5px; }
</style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    win.focus();
    // Give the styles (and the logo, if any) a moment to apply before the
    // dialog snapshots the page. document.write can finish loading before
    // onload is attached, so fall back to a timer rather than never printing.
    let printed = false;
    const print = () => {
      if (printed) return;
      printed = true;
      win.print();
    };
    win.onload = print;
    setTimeout(print, 500);
  };
  const handleSubmit = () => submitInvoice(form.status || "Draft");

  const dealOptions = deals.map((d) => ({ value: d._id, label: d.title }));
  const inputClass =
    "w-full h-10 px-2.5 rounded-[25px] border border-[#E1E4EA] bg-white text-[13px] text-[#1F2937] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] transition-colors";

  // Catalogue descriptions can be stored as rich-text HTML; show plain text in
  // the description field instead of raw markup.
  const stripHtml = (html) => {
    if (!html) return "";
    if (!/[<&]/.test(html)) return html;
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  };

  // Grid template for the wide (row/list) item layout — includes an HSN column
  // only for tax invoices. Card layout ignores this and stacks fields.
  // Description isn't a column any more — it's an optional box under each row.
  const itemRowCols = form.isTaxInvoice
    ? "@2xl:grid-cols-[1.9fr_0.7fr_0.7fr_0.55fr_1.1fr_0.9fr_32px]"
    : "@2xl:grid-cols-[2.2fr_0.8fr_0.6fr_1.2fr_0.9fr_32px]";

  return (
    <div
      className="fixed right-0 bottom-0 bg-white z-[60] flex flex-col top-[54px] lg:top-16"
      style={{ left: "var(--sidebar-width, 0px)" }}
    >
      {/* Single continuous resizer line spanning the strip + panels, so the
          divider reads as one line from the navbar down. */}
      <div
        onMouseDown={startSplitDrag}
        title="Drag to resize"
        style={{ left: `calc(0.5rem + (100% - 1rem) * ${leftPct / 100} + 3px)` }}
        className={`${hidePreview ? "hidden" : "hidden lg:flex"} absolute top-0 bottom-0 w-4 -translate-x-1/2 cursor-col-resize items-center justify-center gap-[3px] z-20 group`}
      >
        {/* Two hairlines at rest; on hover the gap between them fills so the
            pair reads as one solid blue bar. */}
        <div className="flex h-full gap-[3px] rounded-full group-hover:bg-[#0085FF] group-active:bg-[#0085FF] transition-colors">
          <span className="w-px h-full rounded-full bg-[#E1E4EA] group-hover:bg-[#0085FF] group-active:bg-[#0085FF] transition-colors" />
          <span className="w-px h-full rounded-full bg-[#E1E4EA] group-hover:bg-[#0085FF] group-active:bg-[#0085FF] transition-colors" />
        </div>

        {/* Decoration only — it marks the divider so the split reads as
            draggable. `pointer-events-none` is deliberate: clicks and drags
            pass straight through to the resizer behind it, so grabbing the
            knob resizes rather than doing nothing. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-30 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-[#E1E4EA] text-[#525866] shadow-md group-hover:text-[#0085FF] group-hover:border-[#0085FF] group-active:text-[#0085FF] group-active:border-[#0085FF] transition-colors"
        >
          <ChevronsLeftRight className="w-3.5 h-3.5" />
        </div>
      </div>
      {/* Fixed top strip — one 64px header bar (same height as the Companies
          toolbar), not part of the scrolling panels. Same border + shadow as
          the app navbar so the header reads as a separate layer above the
          form. Each column draws its own divider *and* its own shadow, so the
          two segments stay visually separate and the resizer gap between them
          casts nothing. `relative z-10` matters: without it the panels below
          paint their white background over the shadows and they vanish. */}
      <div className="relative z-10 flex-shrink-0 h-16 flex items-stretch bg-white px-2">
        {/* Left: form header */}
        <div
          style={{ width: formWidth }}
          className={`flex items-stretch px-3 lg:px-4 lg:pr-6 min-w-0 self-stretch ${hidePreview ? "" : "max-lg:!w-1/2"}`}
        >
          <div className="w-full flex items-center justify-between gap-2 border-b border-[#E1E4EA] shadow-[0_4px_5px_-3px_rgba(0,0,0,0.16)]">
            <div className="min-w-0">
              {isEditing && docNumber ? (
                <>
                  {numberDraft === null ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="text-xl font-bold text-[#1F2937] truncate">
                        {docNumber}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setNumberDraft(numberSuffix)}
                        title={`Rename this ${docName.toLowerCase()}`}
                        aria-label={`Rename this ${docName.toLowerCase()}`}
                        className="p-1 rounded-md text-[#99A0AE] hover:text-[#0085FF] hover:bg-[#F0F6FF] transition-colors flex-shrink-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    // The prefix sits outside the input so it reads as part of
                    // the number but can't be edited or deleted.
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="flex items-center h-9 pl-2.5 pr-1 border border-[#E1E4EA] rounded-lg focus-within:border-[#0085FF] min-w-0">
                        <span className="text-xl font-bold text-[#99A0AE] flex-shrink-0">
                          {numberPrefix}
                        </span>
                        <input
                          autoFocus
                          value={numberDraft}
                          disabled={savingNumber}
                          onChange={(e) => setNumberDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveDocNumber();
                            if (e.key === "Escape") setNumberDraft(null);
                          }}
                          className="w-28 min-w-0 px-1 text-xl font-bold text-[#1F2937] outline-none bg-transparent"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveDocNumber}
                        disabled={savingNumber}
                        className="h-7 px-2 rounded-lg bg-[#0085FF] hover:bg-blue-600 text-white text-[11px] font-medium transition-colors disabled:opacity-60 flex-shrink-0"
                      >
                        {savingNumber ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNumberDraft(null)}
                        disabled={savingNumber}
                        className="h-7 px-2 rounded-lg border border-[#E1E4EA] text-[11px] font-medium text-[#525866] hover:bg-gray-50 transition-colors flex-shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <h2 className="text-xl font-bold text-[#1F2937] truncate">
                  {isEditing ? `Edit ${docName}` : `Create New ${docName}`}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* When the parent supplies onRequestFullWidth (quotations), this
                  button hands off to that dedicated full-width screen instead
                  of just collapsing the preview pane in place. Every other
                  document type keeps the original in-place toggle. */}
              <button
                type="button"
                onClick={() =>
                  onRequestFullWidth
                    ? onRequestFullWidth()
                    : setHidePreview((v) => !v)
                }
                title={
                  onRequestFullWidth
                    ? `Open full width ${docName.toLowerCase()} form`
                    : hidePreview
                      ? "Show preview"
                      : "Hide preview — full width form"
                }
                aria-pressed={onRequestFullWidth ? undefined : hidePreview}
                className="h-8 w-8 flex items-center justify-center bg-white border border-[#E1E4EA] rounded-full text-[#525866] hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0"
              >
                {hidePreview && !onRequestFullWidth ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Document-level settings for this screen — distinct from the
                  app's global Settings page. Saving moved to the sticky bar at
                  the bottom of the form, so this slot hosts it instead.
                  Reachable even with the preview hidden, unlike the "Change
                  Template" button that lives in the preview header. */}
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                title={`${docName} settings`}
                className="h-8 px-4 flex items-center gap-1.5 bg-white border border-[#E1E4EA] rounded-full text-[13px] font-medium text-[#1F2937] hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0"
              >
                <Settings className="w-3.5 h-3.5 text-[#525866]" />
                Settings
              </button>
              {/* Saving/creating lives in the sticky bar at the foot of the
                  form; this slot offers the draft escape hatch instead. */}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="h-8 px-4 flex items-center gap-1.5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Save as Draft
              </button>
            </div>
          </div>
        </div>
        {/* Gap reserved for the absolute resizer line — no bottom border here,
            so the strip line reads as two separate parts (left / right). */}
        {!hidePreview && <div className="hidden lg:block w-1.5 flex-shrink-0 self-stretch" />}
        {/* Right: preview header */}
        <div
          className={`flex-1 min-w-0 items-stretch px-3 lg:pl-6 self-stretch ${hidePreview ? "hidden" : "flex"}`}
        >
          <div className="w-full flex items-center justify-between gap-4 border-b border-[#E1E4EA] shadow-[0_4px_5px_-3px_rgba(0,0,0,0.16)]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#1F2937] truncate">
              {docName} Preview
            </h2>
            <p className="text-xs text-[#99A0AE] truncate">
              This is how your {docName.toLowerCase()} will appear to the customer.
            </p>
          </div>
          {/* The template is an organization-wide setting, so this opens the
              same Template drawer the Accounting toolbar uses rather than
              pinning a style onto this one document. */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="h-8 px-4 flex items-center gap-1.5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Change Template
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Frame 2147225003 — the two panels sit side by side, each scrolling
          independently, so neither one's height depends on the other. */}
      <div ref={splitRef} className="flex-1 min-h-0 flex flex-col lg:flex-row items-stretch px-2 pb-2 pt-0 gap-0 overflow-hidden">
        {/* Left: form. Frame 1351649637
            The scrolling element itself must NOT be a flex container: when a
            flex item's parent has `overflow` other than visible, the spec
            drops that item's min-height from `auto` to `0`, so flex-shrink:1
            (the default) is free to squash it below its content size instead
            of the overflow ever kicking in — exactly the "top of the item
            list collapses to a sliver" bug reported at 100% zoom (less
            available height = more squashing; zooming out to 90% just gave
            the content more room, masking it). Fix: keep `overflow-y-auto`
            on this outer box but make it a plain block, and put all the
            flex-col spacing on a single inner wrapper instead — that
            wrapper isn't itself inside an overflow context, so its children
            keep their natural `min-height: auto` and the outer box scrolls
            for real instead of silently crushing them. */}
        <div
          style={{ width: formWidth }}
          className="@container max-lg:!w-full flex-shrink-0 bg-white p-3 lg:p-4 lg:pr-6 overflow-y-auto self-stretch"
        >
          <div className="w-full flex flex-col items-start gap-1">
          {/* Sections 01-04 (Details/Address/GST/Items) swap to the
              full-width table layout when the preview is hidden — same form
              state and handlers either way, just a different arrangement.
              Notes onward always renders from this file, unchanged.
              Quotations always use the inline form (never FullWidthDocumentPanel)
              so their Swipe-style layout renders in both modes. */}
          {hidePreview && type !== "quotation" ? (
            <FullWidthDocumentPanel
              type={type}
              docName={docName}
              supportsGSTIN={supportsGSTIN}
              supportsTax={supportsTax}
              sectionNo={sectionNo}
              form={form}
              setField={setField}
              setForm={setForm}
              deals={deals}
              dealOptions={dealOptions}
              onAddDeal={onAddDeal}
              catalogue={catalogue}
              addItem={addItem}
              removeItem={removeItem}
              updateItem={updateItem}
              stripHtml={stripHtml}
            />
          ) : (
          <>
          <SectionHeader number={sectionNo.details} title={`${docName} Details`} />
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-6 gap-y-2 w-full">
            <div className="flex flex-col gap-1">
              <FieldLabel required>Select Deal</FieldLabel>
              <div className="flex items-center gap-2">
                <PickerSelect
                  value={form.deal}
                  options={dealOptions}
                  placeholder="Search and select deal"
                  icon={Search}
                  onSelect={(o) => {
                    // Switching the deal always replaces the Receiver GSTIN
                    // and billing/shipping address with whatever the new
                    // deal's company has — including clearing them to empty
                    // when that company doesn't have them saved. Carrying
                    // over the previous deal's company data would attach it
                    // to a company it was never actually collected for.
                    const selectedDeal = deals.find((d) => d._id === o.value);
                    const company = selectedDeal?.company;
                    const nextBilling =
                      company && !isAddressEmpty(company.billingAddress)
                        ? { ...emptyAddress(), ...company.billingAddress }
                        : emptyAddress();
                    const nextShipping =
                      company && !isAddressEmpty(company.shippingAddresses?.[0])
                        ? { ...emptyAddress(), ...company.shippingAddresses[0] }
                        : emptyAddress();
                    setForm((p) => ({
                      ...p,
                      deal: o.value,
                      receiverGSTIN: supportsGSTIN ? company?.gstin || "" : p.receiverGSTIN,
                      billingAddress: nextBilling,
                      shippingAddress: p.sameAsBilling ? nextBilling : nextShipping,
                    }));
                  }}
                />
                <button
                  type="button"
                  onClick={onAddDeal}
                  title="Create a new deal"
                  className="w-10 h-10 flex-shrink-0 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel required>{docName} Date</FieldLabel>
              {/* Reserve the same 40px + gap the Select Deal "+" button takes,
                  so this input lines up with the deal picker's width. */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setField("date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel>Due Date</FieldLabel>
              {/* Same reserved 40px + gap as the fields above, so this input
                  ends flush with the deal picker instead of running past it. */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setField("dueDate", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
              {/* Quick set, below the field rather than beside it so it reads
                  as "options for this input" instead of a competing control.
                  Always computed from the Invoice Date, never from whatever
                  Due Date currently holds — so re-clicking the same button
                  is idempotent, and it stays disabled (with an explanatory
                  title) until an Invoice Date exists to add days to. Picking
                  a Due Date this way never re-runs on its own afterwards: if
                  the Invoice Date is edited later, the existing Due Date is
                  left as-is unless a quick-set button is clicked again. */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[11px] font-medium ${form.date ? "text-[#99A0AE]" : "text-[#C9CFD8]"}`}
                >
                  Quick set:
                </span>
                {[7, 15, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    disabled={!form.date}
                    title={
                      form.date
                        ? `Set Due Date to ${days} days after the ${docName} date`
                        : `Select the ${docName} date first`
                    }
                    onClick={() => {
                      if (!form.date) {
                        toast.error(`Please select the ${docName} date first.`);
                        return;
                      }
                      const d = new Date(form.date);
                      d.setDate(d.getDate() + days);
                      setField("dueDate", d.toISOString().split("T")[0]);
                    }}
                    className={`h-6 px-2.5 text-[11px] font-medium rounded-full border-none focus:outline-none transition-colors ${
                      form.date
                        ? "text-[#525866] bg-[#F5F7FA] hover:bg-[#E1E4EA] cursor-pointer"
                        : "text-[#C9CFD8] bg-[#F5F7FA] cursor-not-allowed"
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionHeader number={sectionNo.address} title="Billing & Shipping Address" />
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-6 gap-y-2 w-full">
            <AddressFieldsGroup
              label="Billing address"
              value={form.billingAddress}
              onChange={(next) =>
                setForm((p) => ({
                  ...p,
                  billingAddress: next,
                  shippingAddress: p.sameAsBilling ? next : p.shippingAddress,
                }))
              }
            />
            <div className="flex items-center gap-2 @md:col-span-2 -mb-1">
              <button
                type="button"
                onClick={() =>
                  setForm((p) => {
                    const nowSame = !p.sameAsBilling;
                    return {
                      ...p,
                      sameAsBilling: nowSame,
                      shippingAddress: nowSame ? p.billingAddress : p.shippingAddress,
                    };
                  })
                }
                className="flex-shrink-0"
              >
                <span
                  className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.sameAsBilling ? "bg-[#0085FF]" : "bg-[#E1E4EA]"
                    }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.sameAsBilling ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </span>
              </button>
              <span className="text-[12px] font-medium text-[#1F2937]">
                Shipping address same as billing
              </span>
            </div>
            <AddressFieldsGroup
              label="Shipping address"
              value={form.shippingAddress}
              disabled={!!form.sameAsBilling}
              onChange={(next) => setField("shippingAddress", next)}
            />
          </div>

          {supportsGSTIN && (
          <>
          <SectionHeader number={sectionNo.billing} title="Billing & Tax Information" />
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-6 gap-y-2 w-full">
            <div className="flex flex-col gap-1">
              <FieldLabel required>Receiver GSTIN</FieldLabel>
              {/* Match the Select Deal picker width (reserve the "+" button space). */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.receiverGSTIN}
                  onChange={(e) => setField("receiverGSTIN", e.target.value)}
                  placeholder="Enter Receiver GSTIN (e.g., 22AAAAA0000A1Z5)"
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel>Tax Invoice</FieldLabel>
              <div className="flex items-center gap-2.5 h-8">
                <button
                  type="button"
                  onClick={() => setField("isTaxInvoice", !form.isTaxInvoice)}
                  className="flex-shrink-0"
                >
                  <span
                    className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.isTaxInvoice ? "bg-[#0085FF]" : "bg-[#E1E4EA]"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isTaxInvoice ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[12px] font-medium text-[#1F2937]">
                    Enable Tax Invoice
                  </span>
                  <span className="text-[10px] text-[#99A0AE]">
                    Include GST and tax details in this invoice
                  </span>
                </div>
              </div>
            </div>

            {form.isTaxInvoice && (
              <>
                <div className="flex flex-col gap-1">
                  <FieldLabel required>GST Rate</FieldLabel>
                  <div className="flex items-center gap-2">
                    <select
                      value={form.gstRate}
                      onChange={(e) => setField("gstRate", Number(e.target.value))}
                      className={`${inputClass} flex-1 min-w-0`}
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                    <div className="w-10 flex-shrink-0" aria-hidden="true" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Transaction Type</FieldLabel>
                  {/* Decides whether GST splits as CGST + SGST (buyer in the
                      same state) or is charged in full as IGST (buyer in a
                      different state) — see splitGst() in
                      shared/documentTemplates.js, the single place this
                      split is calculated for both the preview and the PDF. */}
                  <div className="flex items-center gap-2">
                    <select
                      value={form.transactionType}
                      onChange={(e) => setField("transactionType", e.target.value)}
                      className={`${inputClass} flex-1 min-w-0`}
                    >
                      <option value="intra">Intra-state (CGST + SGST)</option>
                      <option value="inter">Inter-state (IGST)</option>
                    </select>
                    <div className="w-10 flex-shrink-0" aria-hidden="true" />
                  </div>
                </div>
              </>
            )}
          </div>
          </>
          )}

          {/* Items */}
          {type === "quotation" ? (
            /* ── Quotation: Swipe-style Products & Services ── */
            <div className="w-full mt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#1F2937]">Products &amp; Services</span>
                </div>
              </div>

              {/* ── Items table ── */}
              <div className="w-full -mx-3 lg:-mx-4 border border-[#E1E4EA] rounded-lg overflow-hidden">
                {/* Column headers */}
                <div
                  className="grid items-center bg-[#F8F9FB] border-b border-[#E1E4EA] text-[11px] font-semibold text-[#525866] uppercase tracking-wide"
                  style={{ gridTemplateColumns: "minmax(200px,2fr) 80px 100px 120px 110px 36px", padding: "10px 16px" }}
                >
                  <span>Product Name</span>
                  <span className="text-center">Quantity</span>
                  <span className="text-right">Unit Price</span>
                  <span className="text-center">Discount</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {form.items.map((item, index) => {
                  const rowTotal = lineTotal(item) - itemDiscountAmount(item);
                  const hasDescription = item.showDescription || !!item.description;
                  const qInput = "w-full h-9 px-2.5 rounded-lg border border-[#E1E4EA] text-[13px] bg-white focus:outline-none focus:border-[#0085FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
                  return (
                    <div key={index} className="border-b border-[#F0F1F3] last:border-b-0 hover:bg-[#FAFBFC] transition-colors">
                      <div
                        className="grid items-start gap-x-3"
                        style={{ gridTemplateColumns: "minmax(200px,2fr) 80px 100px 120px 110px 36px", padding: "12px 16px" }}
                      >
                        {/* Product Name + metadata */}
                        <div className="flex flex-col gap-1 min-w-0">
                          <PickerSelect
                            value={item._id}
                            options={catalogue.map((c) => ({ value: c._id, label: c.displayName }))}
                            placeholder="Search items or variants"
                            onSelect={(o) => {
                              const picked = catalogue.find((c) => c._id === o.value);
                              if (!picked) return;
                              updateItem(index, {
                                _id: picked._id,
                                name: picked.name,
                                description: stripHtml(picked.description),
                                rate: picked.sellingPrice ?? "",
                                hsn: picked.hsnSac || "",
                                isVariant: picked.isVariant,
                                parentItemId: picked.parentItemId,
                              });
                            }}
                          />
                          {item.name && (
                            <div className="flex items-center gap-2 text-[11px] text-[#99A0AE]">
                              <span className="font-medium text-[#525866]">#{index + 1}</span>
                              {form.isTaxInvoice && item.hsn && (
                                <span>HSN: {item.hsn}</span>
                              )}
                            </div>
                          )}
                          {form.isTaxInvoice && (
                            <input
                              value={item.hsn}
                              onChange={(e) => updateItem(index, { hsn: e.target.value })}
                              placeholder="HSN/SAC code"
                              className="w-full h-7 px-2 rounded-md border border-[#E1E4EA] text-[11px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF]"
                            />
                          )}
                          {hasDescription ? (
                            <textarea
                              rows={2}
                              autoFocus={item.showDescription && !item.description}
                              value={item.description}
                              onChange={(e) => updateItem(index, { description: e.target.value })}
                              onBlur={() => { if (!item.description) updateItem(index, { showDescription: false }); }}
                              placeholder="Item description…"
                              className="w-full resize-none text-[12px] text-[#525866] placeholder:text-[#99A0AE] border border-[#E1E4EA] rounded-md px-2 py-1.5 focus:outline-none focus:border-[#0085FF]"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateItem(index, { showDescription: true })}
                              className="self-start inline-flex items-center gap-1 text-[11px] font-medium text-[#0085FF] hover:underline"
                            >
                              <Plus className="w-3 h-3" />
                              Add Description
                            </button>
                          )}
                        </div>

                        {/* Quantity */}
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: e.target.value })}
                          placeholder="1"
                          className={`${qInput} text-center`}
                        />

                        {/* Unit Price */}
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(e) => updateItem(index, { rate: e.target.value })}
                          placeholder="0"
                          className={`${qInput} text-right`}
                        />

                        {/* Discount */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={item.discount}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = parseFloat(raw) || 0;
                              const base = lineTotal(item);
                              let clamped = raw;
                              if (item.discountType === "amount" && parsed > base) {
                                clamped = base; toast.error("Item discount cannot exceed item total.");
                              } else if (item.discountType === "percentage" && parsed > 100) {
                                clamped = 100; toast.error("Percentage discount cannot exceed 100%.");
                              }
                              updateItem(index, { discount: clamped });
                            }}
                            placeholder="0"
                            className={`${qInput} flex-1 min-w-0`}
                          />
                          <select
                            value={item.discountType}
                            onChange={(e) => updateItem(index, { discountType: e.target.value })}
                            className="h-9 w-10 rounded-lg border border-[#E1E4EA] text-[12px] bg-white focus:outline-none focus:border-[#0085FF] flex-shrink-0 text-center"
                          >
                            <option value="percentage">%</option>
                            <option value="amount">₹</option>
                          </select>
                        </div>

                        {/* Total */}
                        <span className="text-right text-[14px] font-semibold text-[#1F2937] pt-2 tabular-nums">
                          {(rowTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          title="Remove item"
                          disabled={form.items.length === 1}
                          className="w-8 h-8 mt-0.5 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add item button */}
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-[#0085FF] hover:bg-blue-50/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Product
                </button>
              </div>

              {/* ── Below table: Apply discount + summary ── */}
              <div className="flex items-center justify-between mt-4 -mx-3 lg:-mx-4 px-4 py-3 border-t border-[#E1E4EA]">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-[#525866]">Apply discount (%) to all items?</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.discount.type === "percentage" ? form.discount.value : ""}
                    onChange={(e) => {
                      const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      setField("discount", { type: "percentage", value: v });
                    }}
                    placeholder="0"
                    className="w-16 h-8 px-2 rounded-lg border border-[#E1E4EA] text-[13px] text-center focus:outline-none focus:border-[#0085FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="text-[12px] text-[#99A0AE] tabular-nums">
                  Items: {form.items.filter((it) => it.name).length}, Qty: {form.items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0).toFixed(3)}
                </div>
              </div>
            </div>
          ) : (
            /* ── Invoice / Proforma / Challan — existing responsive card/row layout ── */
            <>
            <div className="w-full flex flex-col gap-2 @2xl:gap-0 mb-1">
              {/* Column header — only shown in the wide (row/list) layout. */}
              <div
                className={`hidden @2xl:grid @2xl:items-center gap-2 px-2 pb-1 text-[11px] font-medium text-[#525866] ${itemRowCols}`}
              >
                <span>Item</span>
                {form.isTaxInvoice && <span>HSN</span>}
                <span>Rate (₹)</span>
                <span>Qty</span>
                <span>Discount</span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              {form.items.map((item, index) => {
                const numInput =
                  "w-full h-10 px-2.5 rounded-[25px] border border-[#E1E4EA] text-[13px] focus:outline-none focus:border-[#0085FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
                const txtInput =
                  "w-full h-10 px-2.5 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF]";
                const lbl =
                  "text-[11px] font-medium text-[#525866] mb-1 block @2xl:hidden";
                const hasDescription = item.showDescription || !!item.description;
                return (
                  <div
                    key={index}
                    className="border border-[#E1E4EA] rounded-lg bg-white p-3 @2xl:border-0 @2xl:border-b @2xl:rounded-none @2xl:p-0 @2xl:last:border-b-0"
                  >
                  <div
                    className={`grid grid-cols-1 @md:grid-cols-2 gap-x-3 gap-y-2 @2xl:items-center @2xl:gap-2 @2xl:px-2 @2xl:py-1.5 ${itemRowCols}`}
                  >
                    <div className="flex items-center justify-between mb-1 @md:col-span-2 @2xl:hidden">
                      <span className="text-[12px] font-semibold text-[#1F2937]">Item {index + 1}</span>
                      <button type="button" onClick={() => removeItem(index)} title="Remove item" disabled={form.items.length === 1} className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="@md:col-span-2 @2xl:col-span-1 min-w-0">
                      <label className={lbl}>Item</label>
                      <PickerSelect
                        value={item._id}
                        options={catalogue.map((c) => ({ value: c._id, label: c.displayName }))}
                        placeholder="Search items or variants"
                        onSelect={(o) => {
                          const picked = catalogue.find((c) => c._id === o.value);
                          if (!picked) return;
                          updateItem(index, { _id: picked._id, name: picked.name, description: stripHtml(picked.description), rate: picked.sellingPrice ?? "", hsn: picked.hsnSac || "", isVariant: picked.isVariant, parentItemId: picked.parentItemId });
                        }}
                      />
                    </div>
                    {form.isTaxInvoice && (
                      <div className="min-w-0">
                        <label className={lbl}>HSN / SAC</label>
                        <input value={item.hsn} onChange={(e) => updateItem(index, { hsn: e.target.value })} placeholder="HSN" className={txtInput} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <label className={lbl}>Rate (₹)</label>
                      <input type="number" min="0" value={item.rate} onChange={(e) => updateItem(index, { rate: e.target.value })} placeholder="0.00" className={numInput} />
                    </div>
                    <div className="min-w-0">
                      <label className={lbl}>Qty</label>
                      <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} placeholder="1" className={numInput} />
                    </div>
                    <div className="min-w-0">
                      <label className={lbl}>Discount</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min="0" value={item.discount}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const parsed = parseFloat(rawValue) || 0;
                            const base = lineTotal(item);
                            let clamped = rawValue;
                            if (item.discountType === "amount" && parsed > base) { clamped = base; toast.error("Item discount cannot exceed item total."); }
                            else if (item.discountType === "percentage" && parsed > 100) { clamped = 100; toast.error("Percentage discount cannot exceed 100%."); }
                            updateItem(index, { discount: clamped });
                          }}
                          placeholder="0" className={`${numInput} flex-1 min-w-0`}
                        />
                        <select value={item.discountType} onChange={(e) => updateItem(index, { discountType: e.target.value })} className="h-10 px-1.5 rounded-[25px] border border-[#E1E4EA] text-[13px] text-gray-700 bg-white focus:outline-none focus:border-[#0085FF] flex-shrink-0">
                          <option value="amount">₹</option>
                          <option value="percentage">%</option>
                        </select>
                      </div>
                    </div>
                    <span className="hidden @2xl:block text-right text-[13px] font-semibold text-[#1F2937] pr-1">
                      {money(lineTotal(item) - itemDiscountAmount(item))}
                    </span>
                    <button type="button" onClick={() => removeItem(index)} title="Remove item" disabled={form.items.length === 1} className="hidden @2xl:flex w-8 h-8 items-center justify-center text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center justify-between border-t border-[#E1E4EA] mt-2 pt-2 @md:col-span-2 @2xl:hidden">
                      <span className="text-[12px] text-[#525866]">Amount</span>
                      <span className="text-[14px] font-semibold text-[#1F2937]">{money(lineTotal(item) - itemDiscountAmount(item))}</span>
                    </div>
                  </div>
                  <div className="mt-2 @2xl:mt-0 @2xl:px-2 @2xl:pb-2">
                    {hasDescription ? (
                      <textarea rows={2} autoFocus={item.showDescription && !item.description} value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        onBlur={() => { if (!item.description) updateItem(index, { showDescription: false }); }}
                        placeholder="Describe this item — appears under its name on the document"
                        className="w-full px-2.5 py-2 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
                      />
                    ) : (
                      <button type="button" onClick={() => updateItem(index, { showDescription: true })} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0085FF] hover:underline">
                        <Plus className="w-3 h-3" />
                        Add description
                      </button>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="w-full h-10 min-h-[40px] flex-shrink-0 flex items-center justify-center gap-2 rounded-lg bg-white border border-[#0085FF]/20 text-sm font-medium text-[#0085FF] hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Another Item
            </button>
            </>
          )}
          </>
          )}

          {type === "quotation" ? (
            /* ── Quotation: Swipe-style Notes, Terms, Summary ── */
            <div className="w-full mt-4 grid grid-cols-1 @2xl:grid-cols-2 gap-6">
              {/* Left: Notes + Terms (collapsible accordion) */}
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[#525866]">Notes, terms &amp; more...</span>

                {/* Notes accordion */}
                <div className="border border-[#E1E4EA] rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setField("_notesOpen", !form._notesOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#FAFBFC] transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#1F2937]">
                      {form._notesOpen ? <ChevronDown className="w-4 h-4 text-[#525866]" /> : <ChevronRight className="w-4 h-4 text-[#525866]" />}
                      Notes
                    </span>
                  </button>
                  {form._notesOpen && (
                    <div className="px-4 pb-4">
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setField("notes", e.target.value)}
                        placeholder="Enter your notes, say thanks, or anything else"
                        className="w-full px-3 py-2 rounded-lg border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
                      />
                    </div>
                  )}
                </div>

                {/* Terms accordion */}
                <div className="border border-[#E1E4EA] rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setField("_termsOpen", !form._termsOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#FAFBFC] transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#1F2937]">
                      {form._termsOpen ? <ChevronDown className="w-4 h-4 text-[#525866]" /> : <ChevronRight className="w-4 h-4 text-[#525866]" />}
                      Terms &amp; Conditions
                    </span>
                  </button>
                  {form._termsOpen && (
                    <div className="px-4 pb-4">
                      <textarea
                        rows={3}
                        value={form.terms}
                        onChange={(e) => setField("terms", e.target.value)}
                        placeholder={"1. Goods once sold cannot be taken back or exchanged.\n2. Subject to local jurisdiction."}
                        className="w-full px-3 py-2 rounded-lg border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
                      />
                    </div>
                  )}
                </div>

                {/* Signature */}
                <div className="border border-[#E1E4EA] rounded-lg p-4">
                  <span className="text-[13px] font-semibold text-[#1F2937] mb-2 block">Select Signature</span>
                  <div className="relative flex items-center h-10 rounded-lg border border-[#E1E4EA] focus-within:border-[#0085FF] overflow-hidden">
                    <select
                      value={form.signature}
                      onChange={(e) => setField("signature", e.target.value)}
                      disabled={signaturesLoading}
                      className="flex-1 min-w-0 h-full pl-3 pr-8 text-[13px] bg-transparent appearance-none focus:outline-none disabled:opacity-60"
                    >
                      <option value="">No signature</option>
                      {savedSignatures.map((sig) => (
                        <option key={sig.id} value={sig.dataUrl}>
                          {sig.name}{sig.isDefault ? " (Default)" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  {form.signature && (
                    <div className="mt-2 h-16 flex items-center justify-center rounded-lg border border-dashed border-[#E1E4EA] bg-[#FAFBFC]">
                      <img src={form.signature} alt="Signature" className="max-h-14 max-w-full object-contain" />
                    </div>
                  )}
                  <p className="text-[11px] text-[#99A0AE] mt-1.5">Signature on the document</p>
                </div>
              </div>

              {/* Right: Summary panel */}
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-[#E1E4EA] bg-[#F0FFF0] p-4">
                  {/* Extra Discount */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-medium text-[#525866]">Extra Discount</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={form.discount.type === "percentage" ? "%" : "₹"}
                        onChange={(e) =>
                          setField("discount", { ...form.discount, type: e.target.value === "%" ? "percentage" : "fixed" })
                        }
                        className="h-8 px-1.5 rounded-lg border border-[#E1E4EA] text-[12px] bg-white focus:outline-none focus:border-[#0085FF]"
                      >
                        <option value="₹">₹</option>
                        <option value="%">%</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={form.discount.value}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = parseFloat(raw) || 0;
                          let clamped = raw;
                          if (form.discount.type === "percentage" && parsed > 100) {
                            clamped = 100; toast.error("Percentage discount cannot exceed 100%.");
                          } else if (form.discount.type === "fixed" && parsed > afterItemDiscounts) {
                            clamped = afterItemDiscounts; toast.error("Discount cannot exceed subtotal.");
                          }
                          setField("discount", { ...form.discount, value: clamped });
                        }}
                        placeholder="0"
                        className="w-20 h-8 px-2 rounded-lg border border-[#E1E4EA] text-[13px] text-right focus:outline-none focus:border-[#0085FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-2 text-[13px] border-t border-[#D0E8D0] pt-3">
                    {form.isTaxInvoice && (
                      <div className="flex justify-between text-[#525866]">
                        <span>Taxable Amount</span>
                        <span className="font-medium text-[#1F2937]">{money(netTaxable)}</span>
                      </div>
                    )}
                    {form.isTaxInvoice && (
                      gstSplit.isInterState ? (
                        <div className="flex justify-between text-[#525866]">
                          <span>IGST ({form.gstRate}%)</span>
                          <span className="font-medium text-[#1F2937]">{money(gstSplit.igst)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-[#525866]">
                            <span>CGST ({form.gstRate / 2}%)</span>
                            <span className="font-medium text-[#1F2937]">{money(gstSplit.cgst)}</span>
                          </div>
                          <div className="flex justify-between text-[#525866]">
                            <span>SGST ({form.gstRate / 2}%)</span>
                            <span className="font-medium text-[#1F2937]">{money(gstSplit.sgst)}</span>
                          </div>
                        </>
                      )
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-[#D0E8D0]">
                      <span className="text-[15px] font-bold text-[#1F2937]">Total Amount</span>
                      <span className="text-[15px] font-bold text-[#1F2937]">{money(finalTotal)}</span>
                    </div>
                    {invoiceDiscountAmount > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>Total Discount</span>
                        <span>{money(itemDiscountsTotal + invoiceDiscountAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount in words */}
                <div className="text-[12px] text-[#525866]">
                  <span className="text-[#99A0AE]">Amount in Words: </span>
                  <span className="font-medium">{numberToWords(finalTotal)}</span>
                </div>
              </div>
            </div>
          ) : (
            /* ── Invoice / Proforma / Challan: original layout ── */
            <>
          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-6 gap-y-2 w-full mt-3">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <SectionHeader number={sectionNo.notes} title="Notes" />
                <OpenNotesTermsButton
                  label="Add Notes"
                  onClick={() => setNotesDrawer("notes")}
                />
              </div>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={`A short message to the customer, e.g. "Thank you for the business!"`}
                className="w-full px-3 py-2 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <SectionHeader
                  number={sectionNo.terms}
                  title="Terms and Conditions"
                />
                <OpenNotesTermsButton
                  label="Add Terms"
                  onClick={() => setNotesDrawer("terms")}
                />
              </div>
              <textarea
                rows={4}
                value={form.terms}
                onChange={(e) => setField("terms", e.target.value)}
                placeholder={"1. Goods once sold cannot be taken back or exchanged.\n2. Subject to local jurisdiction."}
                className="w-full px-3 py-2 rounded-[25px] border border-[#E1E4EA] text-[13px] placeholder:text-[#99A0AE] focus:outline-none focus:border-[#0085FF] resize-y"
              />
            </div>
          </div>

          <SectionHeader number={sectionNo.signature} title="Signature" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
            <div className="flex flex-col gap-1">
              <FieldLabel>Signature</FieldLabel>
              <div className="relative flex items-center h-10 rounded-[25px] border border-[#E1E4EA] focus-within:border-[#0085FF] overflow-hidden">
                <select
                  value={form.signature}
                  onChange={(e) => setField("signature", e.target.value)}
                  disabled={signaturesLoading}
                  className="flex-1 min-w-0 h-full pl-3 pr-8 text-[13px] bg-transparent appearance-none focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">No signature</option>
                  {savedSignatures.map((sig) => (
                    <option key={sig.id} value={sig.dataUrl}>
                      {sig.name}
                      {sig.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-[#99A0AE]">
                {signaturesLoading
                  ? "Loading signatures…"
                  : savedSignatures.length === 0
                    ? "No saved signatures yet — add them in Settings → Document Settings → Signatures."
                    : "The default is applied to every document unless you pick another here."}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>Preview</FieldLabel>
              <div className="h-[72px] flex items-center justify-center rounded-lg border border-dashed border-[#E1E4EA] bg-[#FAFBFC]">
                {form.signature ? (
                  <img
                    src={form.signature}
                    alt="Selected signature"
                    className="max-h-16 max-w-full object-contain"
                  />
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#99A0AE]">
                    <PenLine className="w-3.5 h-3.5" />
                    No signature selected
                  </span>
                )}
              </div>
            </div>
          </div>

          <SectionHeader number={sectionNo.summary} title={`${docName} Summary`} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
            <div className="flex flex-col gap-1">
              <FieldLabel>{docName} Discount</FieldLabel>
              <div className="flex items-center gap-2">
              <div className="relative flex items-center flex-1 min-w-0 h-10 rounded-[25px] border border-[#E1E4EA] focus-within:border-[#0085FF] overflow-hidden">
                <input
                  type="number"
                  min="0"
                  value={form.discount.value}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = parseFloat(raw) || 0;
                    let clamped = raw;
                    if (
                      form.discount.type === "percentage" &&
                      parsed > 100
                    ) {
                      clamped = 100;
                      toast.error("Percentage discount cannot exceed 100%.");
                    } else if (
                      form.discount.type === "fixed" &&
                      parsed > afterItemDiscounts
                    ) {
                      clamped = afterItemDiscounts;
                      toast.error(
                        "Invoice discount cannot exceed subtotal after item discounts."
                      );
                    }
                    setField("discount", { ...form.discount, value: clamped });
                  }}
                  className="flex-1 min-w-0 h-full px-2.5 text-[13px] focus:outline-none"
                />
                <div className="flex items-stretch h-full">
                  <span className="w-7 flex items-center justify-center text-[13px] font-semibold text-[#0085FF]">
                    {form.discount.type === "percentage" ? "%" : "₹"}
                  </span>
                  <div className="flex flex-col justify-center">
                    {[ChevronUp, ChevronDown].map((Icon, i) => (
                      <button
                        key={i}
                        type="button"
                        title="Switch between ₹ and %"
                        onClick={() =>
                          setField("discount", {
                            ...form.discount,
                            type:
                              form.discount.type === "percentage"
                                ? "fixed"
                                : "percentage",
                          })
                        }
                        className={`w-5 h-2.5 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded transition-colors ${i === 1 ? "-mt-0.5" : ""}`}
                      >
                        <Icon className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
                <div className="w-10 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#1F2937]">
                    {money(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Item Discounts</span>
                  <span>- {money(itemDiscountsTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>After Item Discounts</span>
                  <span className="font-medium text-[#1F2937]">
                    {money(afterItemDiscounts)}
                  </span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Invoice Discount</span>
                  <span>- {money(invoiceDiscountAmount)}</span>
                </div>
                {form.isTaxInvoice && (
                  gstSplit.isInterState ? (
                    <div className="flex justify-between text-gray-600">
                      <span>IGST ({form.gstRate}%)</span>
                      <span className="font-medium text-[#1F2937]">
                        {money(gstSplit.igst)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>CGST ({form.gstRate / 2}%)</span>
                        <span className="font-medium text-[#1F2937]">
                          {money(gstSplit.cgst)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SGST ({form.gstRate / 2}%)</span>
                        <span className="font-medium text-[#1F2937]">
                          {money(gstSplit.sgst)}
                        </span>
                      </div>
                    </>
                  )
                )}
                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-lg bg-[#F0F6FF]">
                  <span className="font-bold text-[#0085FF]">Final Total</span>
                  <span className="font-bold text-[#0085FF]">
                    {money(finalTotal)}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="text-xs text-[#99A0AE]">Amount in Words</p>
                  <p className="text-xs font-medium text-[#525866]">
                    {numberToWords(finalTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
            </>
          )}

          {/* Running total + primary actions, pinned to the bottom of the form
              column. It sticks inside this scroll container rather than being
              fixed to the viewport, so it stays inside the form even when the
              preview is showing and the split is dragged. */}
          {/* Sized to its contents and centred, so it reads as a floating bar
              over the form rather than another full-width section. The wrapper
              ignores pointer events so the empty space either side of the pill
              doesn't block the fields underneath it. */}
          <div className="sticky bottom-0 z-20 w-full pt-3 pb-1 flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-5 rounded-full border border-[#E1E4EA] bg-white/95 backdrop-blur-sm pl-6 pr-2.5 py-2.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.22)]">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-wide text-[#99A0AE] uppercase leading-none">
                  Total
                </p>
                <p className="text-[18px] font-bold text-[#1F2937] leading-tight truncate">
                  {money(finalTotal)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-4 flex items-center gap-1.5 bg-white border border-[#E1E4EA] rounded-full text-[13px] font-medium text-[#1F2937] hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-[#525866]" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-full bg-[#0085FF] hover:bg-blue-600 text-white text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting
                    ? isEditing
                      ? "Updating..."
                      : "Creating..."
                    : isEditing
                      ? `Update ${docName}`
                      : `Create ${docName}`}
                  {!submitting && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Gap reserved for the absolute resizer line (rendered at panel level). */}
        {!hidePreview && <div className="hidden lg:block w-1.5 flex-shrink-0" />}

        {/* Right: preview. Frame 1351649638 — stretches to fill whatever's left beside the form panel. */}
        <div
          className={`relative w-full lg:flex-1 min-w-0 bg-white p-3 lg:pl-6 flex-col items-start gap-4 self-stretch ${hidePreview ? "hidden" : "flex"}`}
        >
          {/* Live invoice preview — mirrors the structure of the downloaded /
              printed document and reflects the form's changes in real time. */}
          <div
            ref={previewAreaRef}
            className="group w-full flex-1 min-h-0 self-stretch overflow-y-auto overflow-x-hidden relative p-1.5"
          >
            {/* Full-view button — appears on hover, opens the same document
                viewer as the eye action in the list (edit mode only). */}
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowFullView(true)}
                title="Full view"
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#1F2937] text-white text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="w-3.5 h-3.5" />
                Full view
              </button>
            )}
            {/* Fixed-width sheet scaled to fit — resizing zooms the invoice
                instead of reflowing it. Outer div reserves the scaled height. */}
            <div style={{ height: sheetHeight || undefined }}>
              <div
                ref={sheetRef}
                style={{
                  width: PREVIEW_BASE_W,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <InvoiceLivePreview
                  form={form}
                  orgDetails={orgDetails}
                  bankDetails={bankDetails}
                  type={type}
                  template={previewTemplate}
                  supportsTax={supportsTax}
                  invoiceNumber={docNumber}
                  dealName={dealOptions.find((d) => d.value === form.deal)?.label}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full view — the same live preview at full size, driven by the current
          (possibly unsaved) form state, so it always shows what's on screen. */}
      {/* Opened by the "Add Notes" / "Add Terms" links beside those sections.
          Writes to the same form fields the inline boxes use, so the preview
          updates as you type either way. */}
      <NotesTermsDrawer
        isOpen={notesDrawer !== null}
        focus={notesDrawer || "notes"}
        onClose={() => setNotesDrawer(null)}
        type={type}
        docName={docName}
        onApplyNotes={(v) => setField("notes", v)}
        onApplyTerms={(v) => setField("terms", v)}
      />

      {/* Opened by "Change Template" above — edits the organization-wide
          choice, so closing it refreshes orgTemplate and the preview restyles. */}
      <TemplateDrawer
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        type={type}
        docLabel={docName}
      />

      {showFullView &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100002] flex flex-col"
            onClick={() => setShowFullView(false)}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-[#E1E4EA]">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#1F2937] truncate">
                  {docName} Preview
                  {initialDoc?.[numberKeyFor(type)]
                    ? ` #${initialDoc[numberKeyFor(type)]}`
                    : ""}
                </h2>
                <p className="text-xs text-[#99A0AE] truncate">
                  Showing your current edits, including unsaved changes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullView(false)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-6">
              <div
                className="mx-auto bg-white shadow-2xl"
                style={{ width: PREVIEW_BASE_W }}
                onClick={(e) => e.stopPropagation()}
              >
                <InvoiceLivePreview
                  form={form}
                  orgDetails={orgDetails}
                  bankDetails={bankDetails}
                  type={type}
                  template={previewTemplate}
                  supportsTax={supportsTax}
                  invoiceNumber={docNumber}
                  dealName={dealOptions.find((d) => d.value === form.deal)?.label}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export { CreateInvoicePanel };

export default InvoiceForm;
