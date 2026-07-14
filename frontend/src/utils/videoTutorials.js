// VIDEO TUTORIAL CONFIGURATION
// Add your YouTube video IDs for each module here
export const VIDEO_TUTORIALS = {
  companies: {
    videoId: "YOUR_COMPANIES_VIDEO_ID",
    title: "Companies Module - How to Manage Organizations",
  },
  contacts: {
    videoId: "YOUR_CONTACTS_VIDEO_ID",
    title: "Contacts Module - Managing People & Leads",
  },
  deals: {
    videoId: "YOUR_DEALS_VIDEO_ID",
    title: "Deals Module - Sales Pipeline Management",
  },
  invoices: {
    videoId: "YOUR_INVOICES_VIDEO_ID",
    title: "Invoices Module - Creating & Managing Invoices",
  },
  tasks: {
    videoId: "YOUR_TASKS_VIDEO_ID",
    title: "Tasks Module - Assign, Track & Complete Tasks",
  },
  vendors: {
    videoId: "YOUR_VENDORS_VIDEO_ID",
    title: "Vendors Module - Supplier Management",
  },
  "vendors-payment": {
    videoId: "YOUR_VENDOR_PAYMENT_VIDEO_ID",
    title: "Vendor Payments Module - Paying Bills",
  },
  purchases: {
    videoId: "YOUR_PURCHASES_VIDEO_ID",
    title: "Purchases Module - Purchase Management",
  },
  "purchase-orders": {
    videoId: "YOUR_PURCHASE_ORDER_VIDEO_ID",
    title: "Purchase Orders Module - Creating Orders",
  },
  products: {
    videoId: "YOUR_PRODUCTS_VIDEO_ID",
    title: "Products Module - Managing Inventory & Items",
  },
  // Add more modules as needed
};

// Helper function to get video tutorial for a module
export const getVideoTutorial = (moduleName) => {
  return VIDEO_TUTORIALS[moduleName.toLowerCase()] || null;
};
