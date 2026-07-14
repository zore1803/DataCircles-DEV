import React, { useState, useEffect, useRef, useCallback } from "react";
import { formatNumberToIndian } from "../../utils/numberFormatter";
import {
  Plus,
  IndianRupeeIcon,
  Trash2,
  Calendar,
  FileText,
  X,
  Search,
  Eye,
} from "lucide-react";
import API from "../../services/api";
import ItemForm from "../item/ItemForm";
import QuickDealForm from "../deal/QuickDealForm";
import SearchableDropdown from "../contact/SearchableDropdown";
import toast from "react-hot-toast";

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
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
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
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 bg-white"
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
                              className={`text-xs px-2 py-1 rounded-full ${
                                item.isVariant
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
    if (editingInvoice) {
      const initialForm = {
        deal: editingInvoice.deal?._id || "",
        date: editingInvoice.date ? editingInvoice.date.slice(0, 10) : "",
        dueDate: editingInvoice.dueDate
          ? editingInvoice.dueDate.slice(0, 10)
          : "",
        receiverGSTIN: editingInvoice.receiverGSTIN || "",
        transactionType: editingInvoice.transactionType || "intra",
        gstRate: editingInvoice.gstRate || 18,
        items: editingInvoice.items.map((item) => ({
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
        discount: editingInvoice.discount || { type: "fixed", value: 0 },
        amount: editingInvoice.amount || 0,
        status: editingInvoice.status || "Draft",
        style: editingInvoice.style || "",
        isTaxInvoice: editingInvoice.isTaxInvoice || false,
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
        className="fixed inset-0 bg-black/20 z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        ref={formRef}
        className={`fixed inset-y-0 right-0 z-[10000] w-full md:w-[600px] bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          isSliding ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          <div className="flex justify-between items-center mb-4">
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

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Select Deal *
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-full">
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
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                  <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                    className="w-full pl-4 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                          className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                          className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                          className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                              className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                                className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                                className="border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                              className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                              className="border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
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
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  aria-label="Invoice discount"
                />
                <select
                  value={form.discount.type}
                  onChange={(e) => {
                    handleDiscountChange("type", e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  aria-label="Invoice discount type"
                >
                  <option value="fixed">₹</option>
                  <option value="percentage">%</option>
                </select>
              </div>
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
    </>
  );
};

export default InvoiceForm;
