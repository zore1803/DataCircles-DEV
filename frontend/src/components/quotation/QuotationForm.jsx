import React, { useState, useEffect, useRef, useCallback } from "react";
import { formatNumberToIndian } from "../../utils/numberFormatter";
import {
  Plus,
  IndianRupeeIcon,
  Trash2,
  Calendar,
  FileText,
  X,
  Eye,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Settings,
  Minimize2,
} from "lucide-react";
import API from "../../services/api";
import ItemForm from "../item/ItemForm";
import QuickDealForm from "../deal/QuickDealForm";
import SearchableDropdown from "../contact/SearchableDropdown";
import toast from "react-hot-toast";

import SearchIcon from "../common/SearchIcon";
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
      hsn: item.hsnSac || "",
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
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 bg-white"
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

const QuotationForm = ({
  deals,
  isOpen,
  onClose,
  fetchData,
  editingQuotation,
  onPreview,
  // Optional. Supplied when this screen was opened as the "full width" mode of
  // the split-view quotation panel — renders a control to go back to it.
  onExitFullWidth,
}) => {
  const [form, setForm] = useState({
    deal: "",
    date: "",
    dueDate: "",
    reference: "",
    receiverGSTIN: "",
    quotationPrefix: "EST-",
    quotationNumber: "",
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
    style: "Regular",
    isTaxQuotation: false,
    notes: "",
    terms: "",
    attachments: [],
    bankDetails: "",
    signature: "",
  });
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
      if (formRef.current) formRef.current.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      return () => {
        if (formRef.current) formRef.current.style.overflow = "auto";
        document.body.style.overflow = "";
      };
    }
  }, [showItemForm]);

  // GSTIN validation regex
  const gstinRegex =
    /^[0-9]{2}[A-Z0-9]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;

  // Fetch items and variants
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
      toast.error("Failed to fetch items.");
    } finally {
      setItemFormLoading(false);
    }
  }, []);

  // Fetch companies and contacts
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

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
      fetchItems();
      fetchCompanies();
      fetchContacts();
      setLocalDeals(deals);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen, fetchItems, fetchCompanies, fetchContacts, deals]);

  useEffect(() => {
    if (editingQuotation) {
      setForm({
        deal: editingQuotation.deal?._id || "",
        date: editingQuotation.date ? editingQuotation.date.slice(0, 10) : "",
        dueDate: editingQuotation.dueDate
          ? editingQuotation.dueDate.slice(0, 10)
          : "",
        receiverGSTIN: editingQuotation.receiverGSTIN || "",
        reference: editingQuotation.reference || "",
        quotationPrefix: editingQuotation.quotationPrefix || "EST-",
        quotationNumber: editingQuotation.quotationNumber || "",
        items: editingQuotation.items.map((item) => ({
          _id: item.itemId || null,
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
        discount: editingQuotation.discount || { type: "fixed", value: 0 },
        amount: editingQuotation.amount || 0,
        status: editingQuotation.status || "Draft",
        style: editingQuotation.style || "Regular",
        isTaxQuotation: editingQuotation.isTaxQuotation || false,
        notes: editingQuotation.notes || "",
        terms: editingQuotation.terms || "",
        attachments: editingQuotation.attachments || [],
        bankDetails: editingQuotation.bankDetails || "",
        signature: editingQuotation.signature || "",
      });
      setHasUnsavedChanges(false);
    } else {
      setForm({
        deal: "",
        date: "",
        dueDate: "",
        receiverGSTIN: "",
        reference: "",
        quotationPrefix: "EST-",
        quotationNumber: "",
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
        style: "Regular",
        isTaxQuotation: false,
        notes: "",
        terms: "",
        attachments: [],
        bankDetails: "",
        signature: "",
      });
      setHasUnsavedChanges(false);
    }
  }, [editingQuotation]);

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

  const calculateTotalAmount = useCallback((items, discount) => {
    const subtotalAfterItemDiscounts =
      calculateSubtotalAfterItemDiscounts(items);
    const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
      subtotalAfterItemDiscounts,
      discount
    );
    return subtotalAfterItemDiscounts - invoiceDiscountAmount;
  }, []);

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      let newValue = value;

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
        amount: calculateTotalAmount(newItems, prev.discount),
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

      if (field === "value") {
        const parsedValue = parseFloat(value) || 0;
        if (
          prev.discount.type === "fixed" &&
          parsedValue > subtotalAfterItemDiscounts
        ) {
          newValue = subtotalAfterItemDiscounts;
          toast.error(
            "Quotation discount cannot exceed subtotal after item discounts."
          );
        } else if (prev.discount.type === "percentage" && parsedValue > 100) {
          newValue = 100;
          toast.error("Percentage discount cannot exceed 100%.");
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
        toast.error(
          "Quotation discount cannot exceed subtotal after item discounts."
        );
      }

      return {
        ...prev,
        discount: newDiscount,
        amount: calculateTotalAmount(prev.items, newDiscount),
      };
    });
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
        amount: calculateTotalAmount(newItems, prev.discount),
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
        prev.discount
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
        amount: calculateTotalAmount(newItems, prev.discount),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleOpenItemForm = () => {
    if (formRef.current) formRef.current.scrollTop = 0;
    setShowItemForm(true);
  };

  const handleDealCreated = (newDeal) => {
    setLocalDeals((prev) => [...prev, newDeal]);
    setForm((prev) => ({ ...prev, deal: newDeal._id }));
    setHasUnsavedChanges(true);
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
    if (!gstin) return true;
    return gstinRegex.test(gstin);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!form.deal) {
      toast.error("Deal is required.");
      setIsSubmitting(false);
      return;
    }

    if (!form.date) {
      toast.error("Quotation Date is required.");
      setIsSubmitting(false);
      return;
    }

    if (form.receiverGSTIN && !validateGSTIN(form.receiverGSTIN)) {
      toast.error(
        "Invalid GSTIN format. It should be 15 characters (e.g., 22AAAAA0000A1Z5)."
      );
      setIsSubmitting(false);
      return;
    }

    const invalidItems = form.items.filter(
      (item) =>
        !item.name ||
        !item.rate ||
        !item.quantity ||
        (form.isTaxQuotation && !item.hsn) ||
        (item.discountType === "percentage" && item.discount > 100)
    );
    if (invalidItems.length > 0) {
      toast.error(
        `Please fill in all item details (name, rate, quantity${form.isTaxQuotation ? ", and HSN/SAC" : ""
        }) and ensure percentage discounts are not above 100.`
      );
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
      toast.error(
        "Quotation discount cannot exceed subtotal after item discounts."
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        deal: form.deal,
        date: form.date,
        dueDate: form.dueDate,
        receiverGSTIN: form.receiverGSTIN,
        amount: calculateTotalAmount(form.items, form.discount),
        discount: form.discount,
        status: form.status,
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
        style: form.style,
        isTaxQuotation: form.isTaxQuotation,
      };

      if (editingQuotation) {
        await API.put(`/quotations/${editingQuotation._id}`, payload);
        toast.success("Quotation updated successfully!");
      } else {
        await API.post("/quotations", payload);
        toast.success("Quotation created successfully!");
      }

      setHasUnsavedChanges(false);
      setForm({
        deal: "",
        date: "",
        dueDate: "",
        receiverGSTIN: "",
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
        isTaxQuotation: false,
      });
      await fetchData();
      onClose();
    } catch (err) {
      const errorMessage = err.response?.status === 402
        ? (err.response?.data?.message || "An active subscription is required to make changes.")
        : (err.response?.data?.error || (editingQuotation ? "Failed to update quotation" : "Failed to create quotation"));
      toast.error(errorMessage);
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

  if (!shouldRender) return null;

  const subtotal = calculateSubtotal(form.items);
  const totalItemDiscounts = calculateTotalItemDiscounts(form.items);
  const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
  const invoiceDiscountAmount = calculateInvoiceDiscountAmount(
    subtotalAfterItemDiscounts,
    form.discount
  );
  const finalTotal = subtotalAfterItemDiscounts - invoiceDiscountAmount;

  return (
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
        ref={formRef}
        className={`fixed inset-0 z-[10000] w-full h-full bg-white overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          isSliding ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="h-full flex flex-col bg-[#F8F9FA] w-full min-h-screen">
          {/* Section 1: Header */}
          <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1"
                aria-label="Close form"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-1 cursor-pointer">
                    Create Quotation <ChevronDown className="w-5 h-5 text-gray-400" />
                  </h2>
                  <span className="text-xs text-gray-500">Jivesh Sales</span>
                </div>
                
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-10 bg-white">
                  <input
                    type="text"
                    value={form.quotationPrefix}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, quotationPrefix: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-300 focus:outline-none focus:bg-white"
                  />
                  <input
                    type="text"
                    placeholder="1"
                    value={form.quotationNumber}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, quotationNumber: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-24 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {onExitFullWidth && (
                <button
                  type="button"
                  onClick={onExitFullWidth}
                  title="Back to split view with live preview"
                  className="h-8 w-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {}}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                Save <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center px-6 py-3 bg-white border-b border-gray-100 text-sm">
            <span className="text-gray-500 mr-2">Type</span>
            <select
              value={form.style}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, style: e.target.value }));
                setHasUnsavedChanges(true);
              }}
              className="font-medium text-gray-800 bg-transparent border-none focus:ring-0 cursor-pointer p-0"
            >
              <option value="Regular">Regular</option>
              {styles.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Section 2: Customer Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Select Customer */}
                <div className="md:col-span-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-700">Select Customer</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickDealForm(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      + Create Customer
                    </button>
                  </div>
                  <div className="bg-blue-50/50 rounded-lg">
                    <SearchableDropdown
                      options={localDeals}
                      value={form.deal}
                      onChange={(value) => {
                        setForm((prev) => ({ ...prev, deal: value }));
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Search customers by name, company, GSTIN..."
                      displayKey="title"
                      valueKey="_id"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Quotation Date */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Quotation Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      required
                      value={form.date}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, date: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>

                {/* Validity */}
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-semibold text-gray-700">Validity</label>
                    <div className="group relative">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] cursor-help">?</div>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={form.dueDate}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, dueDate: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  {/* Quick Date Buttons */}
                  <div className="flex gap-2 mt-1">
                    {[7, 15, 30].map(days => (
                      <button
                        key={days}
                        type="button"
                        className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                        onClick={() => {
                          const newDate = new Date();
                          newDate.setDate(newDate.getDate() + days);
                          setForm(prev => ({ ...prev, dueDate: newDate.toISOString().split('T')[0] }));
                          setHasUnsavedChanges(true);
                        }}
                      >
                        +{days} Days
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference */}
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-semibold text-gray-700">Reference</label>
                    <div className="group relative">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] cursor-help">?</div>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Reference, e.g. PO Number... (Optional)"
                    value={form.reference}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, reference: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

              </div>
            </div>

            {/* ── Section 3: Products & Services ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">Products & Services</h3>
                  <div className="group relative">
                    <div className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] cursor-help">?</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenItemForm}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 ml-2"
                  >
                    + Add new Product?
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" defaultChecked />
                    Show description
                  </label>
                  <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="Settings">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-12 gap-4 pb-2 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <div className="col-span-4">Product Name</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-center">Discount</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {/* Item Rows */}
              <div className="space-y-4 mt-4">
                {form.items.map((item, index) => {
                  const rowTotal = calculateItemAmount(item);
                  return (
                    <div key={index} className="group relative bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:border-blue-100 transition-colors">
                      <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-move p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-400 hover:text-gray-600">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                      </div>
                      
                      <div className="grid grid-cols-12 gap-4 items-start">
                        {/* Product Name (using ItemSearchSelect) */}
                        <div className="col-span-4">
                          <ItemSearchSelect
                            value={item}
                            onSelect={(itemData) => handleItemSelect(index, itemData)}
                            onAddNew={handleOpenItemForm}
                            fetchItems={fetchItems}
                            items={items}
                            setItems={setItems}
                          />
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="1"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              handleItemChange(index, "quantity", e.target.value);
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            required
                          />
                        </div>

                        {/* Rate */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => {
                              handleItemChange(index, "rate", e.target.value);
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full text-right text-sm border border-gray-200 rounded-lg px-2 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            required
                          />
                        </div>

                        {/* Discount */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-colors overflow-hidden">
                            <input
                              type="number"
                              placeholder="0"
                              min="0"
                              step="0.01"
                              value={item.discount}
                              onChange={(e) => {
                                handleItemChange(index, "discount", e.target.value);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full min-w-0 text-center text-sm px-2 py-2.5 bg-transparent focus:outline-none"
                            />
                            <select
                              value={item.discountType}
                              onChange={(e) => {
                                handleItemChange(index, "discountType", e.target.value);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-12 text-xs font-medium border-l border-gray-200 bg-gray-100 py-3 focus:outline-none cursor-pointer"
                            >
                              <option value="percentage">%</option>
                              <option value="amount">₹</option>
                            </select>
                          </div>
                        </div>

                        {/* Total & Delete */}
                        <div className="col-span-2 flex items-center justify-end gap-3 pt-2">
                          <span className="font-semibold text-gray-900 tabular-nums">
                            ₹{formatNumberToIndian(rowTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* More Details (Expandable) */}
                      <details className="mt-4 group/details">
                        <summary className="text-xs font-semibold text-blue-600 cursor-pointer list-none flex items-center gap-1 w-max select-none">
                          <ChevronRight className="w-3.5 h-3.5 transition-transform group-open/details:rotate-90" />
                          More Details
                        </summary>
                        <div className="pt-3 pb-1 pl-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-l-2 border-blue-100 ml-1.5 mt-2">
                          {form.isTaxQuotation && (
                            <div className="space-y-1">
                              <label className="text-xs text-gray-500 font-medium">HSN/SAC Code</label>
                              <input
                                type="text"
                                placeholder="Enter HSN/SAC code"
                                value={item.hsn}
                                onChange={(e) => {
                                  handleItemChange(index, "hsn", e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400"
                                required
                              />
                            </div>
                          )}
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs text-gray-500 font-medium">Item Description</label>
                            <textarea
                              placeholder="Enter item description..."
                              value={item.description}
                              rows={2}
                              onChange={(e) => {
                                handleItemChange(index, "description", e.target.value);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full resize-none text-sm text-gray-700 border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-blue-400"
                            />
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>

              {/* Add New Product Button */}
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 text-blue-600 font-semibold text-sm rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Product
                </button>
              </div>
            </div>

            {/* ── Section 4 & 5: Bottom Details & Totals ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Notes, Terms, Attachments */}
              <div className="space-y-4">
                {/* Notes Accordion */}
                <details className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm" open>
                  <summary className="flex items-center gap-2 px-4 py-3 bg-gray-50/50 cursor-pointer select-none">
                    <ChevronDown className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
                    <span className="font-semibold text-gray-800 text-sm">Notes</span>
                    <div className="group/help relative ml-1">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] cursor-help">?</div>
                    </div>
                  </summary>
                  <div className="p-4 border-t border-gray-200 space-y-3">
                    <textarea
                      placeholder="Enter your notes, say thanks, or anything else"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, notes: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder-gray-400"
                    />
                    <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                      <span className="text-sm">✨</span> AI
                    </button>
                  </div>
                </details>

                {/* Terms Accordion */}
                <details className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <summary className="flex items-center gap-2 px-4 py-3 bg-gray-50/50 cursor-pointer select-none">
                    <ChevronRight className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-90" />
                    <span className="font-semibold text-gray-800 text-sm">Terms & Conditions</span>
                    <div className="group/help relative ml-1">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] cursor-help">?</div>
                    </div>
                  </summary>
                  <div className="p-4 border-t border-gray-200">
                    <textarea
                      placeholder="Enter terms & conditions"
                      rows={3}
                      value={form.terms}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, terms: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder-gray-400"
                    />
                  </div>
                </details>

                {/* E-Waybill & Attachments */}
                <div className="pt-4 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Create E-Waybill</span>
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-gray-700">Attach files</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px]">?</div>
                    </div>
                    <button type="button" className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                      <span className="text-lg">↑</span> Attach Files (Max: 5)
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                    <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">
                      {/* empty state */}
                    </div>
                    Use Coupons
                  </label>
                </div>
              </div>

              {/* Right Column: Totals, Bank, Signature */}
              <div className="space-y-6">
                
                {/* Math Card */}
                <div className="bg-[#EBF5EE] rounded-xl p-5 shadow-sm space-y-4 relative">
                  <div className="flex justify-end gap-2 items-center mb-2">
                    <span className="text-xs text-gray-500 font-medium">Extra Discount</span>
                    <div className="flex items-center border border-gray-200 bg-white rounded-lg overflow-hidden h-8">
                      <select
                        value={form.discount.type}
                        onChange={(e) => {
                          handleDiscountChange("type", e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        className="text-xs font-medium text-gray-600 bg-transparent border-r border-gray-200 px-2 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="fixed">₹</option>
                        <option value="percentage">%</option>
                      </select>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={form.discount.value}
                        onChange={(e) => {
                          handleDiscountChange("value", e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-16 text-right text-xs px-2 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 font-medium">Taxable Amount</span>
                      <span className="text-gray-900 font-semibold">₹{formatNumberToIndian(subtotalAfterItemDiscounts)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium">Round Off</span>
                        <div className="relative">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                      </div>
                      <span className="text-gray-900 font-semibold">0.00</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-bold text-gray-900">Total Amount</span>
                      <span className="text-lg font-bold text-gray-900">₹{formatNumberToIndian(finalTotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-gray-500">Total Discount</span>
                      <span className="text-gray-600 font-medium">₹{formatNumberToIndian(totalItemDiscounts + invoiceDiscountAmount)}</span>
                    </div>

                    <div className="flex justify-end gap-2 text-xs pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-gray-500">
                        Hide Totals
                        <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                      </label>
                    </div>
                    
                    <div className="text-xs text-gray-400 italic text-right mt-1">
                      {numberToWords(finalTotal)}
                    </div>
                  </div>
                </div>

                {/* Select Bank */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-semibold text-gray-700">Select Bank</label>
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px]">?</div>
                  </div>
                  <button type="button" className="w-full py-3 bg-[#FAF5FF] border border-[#E9D5FF] rounded-xl text-[#9333EA] font-semibold text-sm hover:bg-[#F3E8FF] transition-colors flex items-center justify-center gap-2">
                    <span className="text-lg">🏦</span> Add Bank to Invoice (Optional)
                  </button>
                </div>

                {/* Select Signature */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-semibold text-gray-700">Select Signature</label>
                    <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                  </div>
                  <button type="button" className="w-full py-8 bg-[#FDF2F8] border border-[#FBCFE8] rounded-xl text-[#DB2777] font-semibold text-sm hover:bg-[#FCE7F3] transition-colors flex flex-col items-center justify-center gap-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✍️</span> Add Signature to Invoice (Optional)
                    </div>
                    <span className="absolute bottom-2 right-4 text-[10px] font-bold text-gray-800">Signature on the document</span>
                  </button>
                </div>

              </div>
            </div>

            {/* ── Section 6: Sticky Footer Actions ── */}
            <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-white border-t border-gray-200 flex justify-end gap-3 rounded-b-xl z-40 mt-12">
              <button
                type="button"
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Save as Draft
              </button>
              
              <button
                type="button"
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                disabled={isSubmitting}
              >
                Save and Print <ChevronDown className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>Save <ChevronRight className="w-4 h-4" /></>
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
    </>
  );
};

export default QuotationForm;

// Thin wrapper around the shared CreateInvoicePanel for quotation type.
// Used by Accounting.jsx when opening the two-pane create/edit form.
import { CreateInvoicePanel } from "../invoice/InvoiceForm";

const CreateQuotationPanel = (props) => (
  <CreateInvoicePanel {...props} type="quotation" />
);

export { CreateQuotationPanel };
