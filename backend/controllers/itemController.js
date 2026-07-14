const Item = require("../models/Item");

const createItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      user: req.user.id,
      organization: req.user.organization,
    };

    // Validate and parse gstRate
    itemData.gstRate = parseFloat(itemData.gstRate) || 0;

    // Validate variants if present
    if (itemData.variants && Array.isArray(itemData.variants)) {
      for (const variant of itemData.variants) {
        if (!variant.name || variant.name.trim() === "") {
          return res.status(400).json({ error: "Variant name is required" });
        }
        // Ensure numerical fields are properly formatted
        variant.purchasePrice = parseFloat(variant.purchasePrice) || 0;
        variant.sellingPrice = parseFloat(variant.sellingPrice) || 0;
        variant.stock = parseInt(variant.stock) || 0;
        variant.gstRate = parseFloat(variant.gstRate) || 0;
        variant.isActive = variant.isActive !== undefined ? variant.isActive : true;
        // Ensure attributes is a Map-like object
        variant.attributes = variant.attributes || {};
      }
    }
    console.log(itemData);
    const item = new Item(itemData);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    console.error("Create item error:", err);
    res.status(400).json({ error: err.message });
  }
};

const getAllItems = async (req, res) => {
  try {
    const { search, category, type, isActive, gstRate } = req.query;
    let query = { organization: req.user.organization }; // Filter by organization

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { hsnSac: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { "variants.name": { $regex: search, $options: "i" } }, // Search in variant names
        { "variants.sku": { $regex: search, $options: "i" } }, // Search in variant SKUs
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (gstRate !== undefined) {
      query.gstRate = parseFloat(gstRate);
    }

    const items = await Item.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllItemsPaginated = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Filter parameters
    const { search, category, type, isActive, gstRate, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Build query object
    let query = { organization: req.user.organization };

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { hsnSac: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { "variants.name": { $regex: search, $options: "i" } }, // Search in variant names
        { "variants.sku": { $regex: search, $options: "i" } }, // Search in variant SKUs
      ];
    }

    // Category filter
    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Active status filter
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // GST Rate filter
    if (gstRate !== undefined) {
      query.gstRate = parseFloat(gstRate);
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute queries in parallel for better performance
    const [items, totalCount] = await Promise.all([
      Item.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean() // Returns plain JavaScript objects instead of Mongoose documents
        .select("-__v"), // Exclude version field
      Item.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      items,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({
      error: "Failed to fetch items",
      message: err.message,
    });
  }
};

const getItemById = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate("user", "name email");

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      user: req.user.id,
      organization: req.user.organization,
    };

    // Validate and parse gstRate
    itemData.gstRate = parseFloat(itemData.gstRate) || 0;

    // Validate variants if present
    if (itemData.variants && Array.isArray(itemData.variants)) {
      for (const variant of itemData.variants) {
        if (!variant.name || variant.name.trim() === "") {
          return res.status(400).json({ error: "Variant name is required" });
        }
        // Ensure numerical fields are properly formatted
        variant.purchasePrice = parseFloat(variant.purchasePrice) || 0;
        variant.sellingPrice = parseFloat(variant.sellingPrice) || 0;
        variant.stock = parseInt(variant.stock) || 0;
        variant.gstRate = parseFloat(variant.gstRate) || 0;
        variant.isActive = variant.isActive !== undefined ? variant.isActive : true;
        // Ensure attributes is a Map-like object
        variant.attributes = variant.attributes || {};
      }
    }

    const item = await Item.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      itemData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("user", "name email");

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (err) {
    console.error("Update item error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getItemCategories = async (req, res) => {
  try {
    const categories = await Item.distinct("category", {
      organization: req.user.organization,
      category: { $ne: "" },
    });
    res.json(categories.filter((cat) => cat && cat.trim() !== ""));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const toggleItemStatus = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    item.isActive = !item.isActive;
    await item.save();

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  getItemCategories,
  toggleItemStatus,
  getAllItemsPaginated
};