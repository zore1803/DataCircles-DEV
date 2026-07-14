const PurchaseOrder = require("../models/PurchaseOrder");
const Vendor = require("../models/Vendor");

// Helper function to generate unique PO number per organization
async function generatePONumber(organizationId) {
  const count = await PurchaseOrder.countDocuments({ organization: organizationId });
  return `PO-${(count + 1).toString().padStart(5, "0")}`;
}

// Create Purchase Order
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { vendorId, items, paymentTerms, notes } = req.body;

    // Validate vendor within organization
    const vendor = await Vendor.findOne({
      _id: vendorId,
      organization: req.user.organization
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // Calculate totals
    let totalAmount = 0;
    const formattedItems = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      totalAmount += itemTotal;
      return { ...item, total: itemTotal };
    });

    // Generate PO Number for organization
    const poNumber = await generatePONumber(req.user.organization);

    const purchaseOrder = new PurchaseOrder({
      vendor: vendorId,
      poNumber,
      items: formattedItems,
      totalAmount,
      paymentTerms,
      notes,
      user: req.user.id,
      organization: req.user.organization
    });

    await purchaseOrder.save();
    res.status(201).json(purchaseOrder);
  } catch (err) {
    console.error("Create purchase order error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get All Purchase Orders
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };
    
    if (search) {
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } },
        { paymentTerms: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }
    
    const purchaseOrders = await PurchaseOrder.find(query).populate("vendor");
    res.json(purchaseOrders);
  } catch (err) {
    console.error("Error fetching purchase orders:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Purchase Orders with Pagination
exports.getAllPurchaseOrdersWithPagination = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const { search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build query object
    let query = { organization: req.user.organization };
    
    // Search functionality
    if (search) {
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } },
        { paymentTerms: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute queries in parallel for better performance
    const [purchaseOrders, totalCount] = await Promise.all([
      PurchaseOrder.find(query)
        .populate("vendor")
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean() // Returns plain JavaScript objects instead of Mongoose documents
        .select('-__v'), // Exclude version field
      PurchaseOrder.countDocuments(query)
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      purchaseOrders,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    });
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    res.status(500).json({ 
      error: 'Failed to fetch purchase orders',
      message: err.message 
    });
  }
};

// Get All Purchase Orders for a Vendor
exports.getPurchaseOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    // Verify vendor belongs to organization
    const vendor = await Vendor.findOne({
      _id: vendorId,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    
    const purchaseOrders = await PurchaseOrder.find({ 
      vendor: vendorId,
      organization: req.user.organization
    }).populate("vendor", "name email");
    res.json(purchaseOrders);
  } catch (err) {
    console.error("Error fetching vendor purchase orders:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Single Purchase Order by ID
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate("vendor");
    
    if (!purchaseOrder) return res.status(404).json({ message: "Purchase Order not found" });
    res.json(purchaseOrder);
  } catch (err) {
    console.error("Error fetching purchase order:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update Purchase Order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { items, paymentTerms, notes, status } = req.body;

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!purchaseOrder) return res.status(404).json({ message: "Purchase Order not found" });

    // Update fields
    if (items) {
      let totalAmount = 0;
      const formattedItems = items.map(item => {
        const itemTotal = item.quantity * item.unitPrice;
        totalAmount += itemTotal;
        return { ...item, total: itemTotal };
      });
      purchaseOrder.items = formattedItems;
      purchaseOrder.totalAmount = totalAmount;
    }

    if (paymentTerms) purchaseOrder.paymentTerms = paymentTerms;
    if (notes) purchaseOrder.notes = notes;
    if (status) purchaseOrder.status = status;

    await purchaseOrder.save();
    res.json(purchaseOrder);
  } catch (err) {
    console.error("Update purchase order error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Update Purchase Order Status
exports.updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Pending", "Approved", "Rejected", "Delivered"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
      { 
        _id: req.params.id,
        organization: req.user.organization 
      },
      { status },
      { new: true }
    );
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }
    
    res.json(purchaseOrder);
  } catch (err) {
    console.error("Update purchase order status error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Delete Purchase Order
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }
    
    res.json({ message: "Purchase Order deleted successfully" });
  } catch (err) {
    console.error("Delete purchase order error:", err);
    res.status(500).json({ error: err.message });
  }
};
