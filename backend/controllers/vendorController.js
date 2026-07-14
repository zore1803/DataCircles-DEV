const Vendor = require("../models/Vendor");
const Payment = require("../models/Payment");
const vendorService = require("../services/vendorService");
const { processAdditionalFields } = require("../services/fieldCoercionService");

// Create Vendor
exports.createVendor = async (req, res) => {
  try {
    const vendor = await vendorService.createVendor(req.user.organization, req.body, {
      userId: req.user.id,
      avatarUrl: req.fileLocation,
    });
    res.status(201).json(vendor);
  } catch (err) {
    if (err instanceof vendorService.VendorInputError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(400).json({ error: err.message });
  }
};
// Get All Vendors (enhanced search)
exports.getAllVendors = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
        { 'additionalFields.value': { $regex: search, $options: 'i' } }
      ];
    }
    
    const vendors = await Vendor.find(query);
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get All Vendors (paginated)
exports.getAllVendorsWithPagination = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const { search, company, sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    // Build query object
    let query = { organization: req.user.organization };
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
        { 'address.line1': { $regex: search, $options: 'i' } },
        { 'address.line2': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } },
        { 'address.pincode': { $regex: search, $options: 'i' } },
        { 'address.country': { $regex: search, $options: 'i' } },
        { 'additionalFields.value': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Company filter
    if (company) {
      query.company = company;
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute queries in parallel for better performance
    const [vendors, totalCount] = await Promise.all([
      Vendor.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select('-__v'),
      Vendor.countDocuments(query)
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      vendors,
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
    console.error('Error fetching vendors:', err);
    res.status(500).json({ 
      error: 'Failed to fetch vendors',
      message: err.message 
    });
  }
};

// Get Vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Vendor
exports.updateVendor = async (req, res) => {
  try {
    const vendor = await vendorService.updateVendor(req.params.id, req.user.organization, req.body, {
      avatarUrl: req.fileLocation,
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(vendor);
  } catch (err) {
    if (err instanceof vendorService.VendorInputError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(400).json({ error: err.message });
  }
};

// Delete Vendor
exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Delete associated payments within the same organization
    await Payment.deleteMany({ 
      vendor: req.params.id,
      organization: req.user.organization 
    });

    await vendor.deleteOne();
    res.json({ message: "Vendor deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk Import Vendors
exports.bulkImportVendors = async (req, res) => {
  try {
    const { vendors } = req.body;
    
    if (!vendors || !Array.isArray(vendors) || vendors.length === 0) {
      return res.status(400).json({ message: "No vendors data provided" });
    }

    console.log(`Processing ${vendors.length} vendors for bulk import`);

    const validVendors = [];
    const skippedVendors = [];

    for (let i = 0; i < vendors.length; i++) {
      const vendor = vendors[i];
      const rowNumber = i + 1;

      if (!vendor.name || vendor.name.trim() === '') {
        skippedVendors.push({
          row: rowNumber,
          vendor,
          reason: "Missing required field: Name",
        });
        continue;
      }

      vendor.balance = parseFloat(vendor.balance) || 0;

      if (!vendor.address) {
        vendor.address = {
          line1: '',
          line2: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India'
        };
      } else {
        vendor.address.country = vendor.address.country || 'India';
      }

      // Process additional fields with types
      if (vendor.additionalFields) {
        vendor.additionalFields = await processAdditionalFields("vendor", vendor.additionalFields, req.user.organization);
      }

      vendor.user = req.user.id;
      vendor.organization = req.user.organization;

      validVendors.push(vendor);
    }

    if (validVendors.length === 0) {
      return res.status(400).json({
        message: "No valid vendors to import",
        imported: 0,
        total: vendors.length,
        skipped: skippedVendors.length,
        errors: skippedVendors.map(skip => `Row ${skip.row}: ${skip.reason}`),
      });
    }

    console.log(`Found ${validVendors.length} valid vendors to import`);

    try {
      const results = await Vendor.insertMany(validVendors, { 
        ordered: false,
        rawResult: false
      });
      
      console.log(`Successfully imported ${results.length} vendors`);
      
      const response = {
        message: `Successfully imported ${results.length} vendors`,
        imported: results.length,
        total: vendors.length,
        skipped: skippedVendors.length,
      };

      if (skippedVendors.length > 0) {
        response.warnings = skippedVendors.map(skip => `Row ${skip.row}: ${skip.reason}`);
        response.message += `. ${skippedVendors.length} vendors were skipped.`;
      }

      res.json(response);
    } catch (error) {
      if (error.name === 'BulkWriteError' || error.name === 'MongoBulkWriteError') {
        const successCount = error.result?.insertedCount || 0;
        const errorCount = error.writeErrors ? error.writeErrors.length : 0;
        
        console.log(`Partial success: ${successCount} imported, ${errorCount} failed`);
        
        const detailedErrors = error.writeErrors?.slice(0, 5).map((err, index) =>
          `Row ${err.index + 1}: ${err.errmsg || 'Database error'}`
        ) || [];

        res.json({
          message: `Imported ${successCount} vendors, ${errorCount} failed`,
          imported: successCount,
          total: vendors.length,
          skipped: skippedVendors.length,
          errors: [...skippedVendors.map(skip => `Row ${skip.row}: ${skip.reason}`), ...detailedErrors],
          warnings: skippedVendors.length > 0 ? skippedVendors.map(skip => `Row ${skip.row}: ${skip.reason}`) : undefined,
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ 
      message: "Failed to import vendors: " + error.message,
      imported: 0,
      total: 0,
      errors: [error.message],
    });
  }
};

// Add Payment for Vendor
exports.addPaymentForVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    // Verify vendor belongs to user's organization
    const vendor = await Vendor.findOne({
      _id: vendorId,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const payment = new Payment({ 
      ...req.body, 
      vendor: vendorId,
      user: req.user.id,
      organization: req.user.organization
    });
    await payment.save();

    // Update vendor balance
    if (req.body.direction === "IN") {
      vendor.balance += req.body.amount;
    } else {
      vendor.balance -= req.body.amount;
    }
    await vendor.save();

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get All Payments for a Vendor
exports.getPaymentsForVendor = async (req, res) => {
  try {
    // Verify vendor belongs to user's organization
    const vendor = await Vendor.findOne({
      _id: req.params.vendorId,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const payments = await Payment.find({ 
      vendor: req.params.vendorId,
      organization: req.user.organization
    }).populate('vendor', 'name');

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get All Payments (paginated)
exports.getAllPaymentsWithPagination = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const { search, direction, sortBy = 'paymentDate', sortOrder = 'desc' } = req.query;
    
    // Build query object
    let query = { organization: req.user.organization };
    
    // Search functionality
    if (search) {
      query.$or = [
        { notes: { $regex: search, $options: 'i' } },
        { bank: { $regex: search, $options: 'i' } },
        { paymentType: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Direction filter
    if (direction) {
      query.direction = direction;
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute queries in parallel for better performance
    const [payments, totalCount] = await Promise.all([
      Payment.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .populate('vendor', 'name')
        .lean()
        .select('-__v'),
      Payment.countDocuments(query)
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      payments,
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
    console.error('Error fetching payments:', err);
    res.status(500).json({ 
      error: 'Failed to fetch payments',
      message: err.message 
    });
  }
};

// Update Payment
exports.updatePayment = async (req, res) => {
  try {
    const { vendorId, paymentId } = req.params;

    // Find the payment to update with organization filter
    const payment = await Payment.findOne({ 
      _id: paymentId, 
      vendor: vendorId,
      organization: req.user.organization
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify vendor belongs to user's organization
    const vendor = await Vendor.findOne({
      _id: vendorId,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Save old amount and direction for balance update
    const oldAmount = payment.amount;
    const oldDirection = payment.direction;

    // Update payment fields
    Object.assign(payment, req.body);
    await payment.save();

    // Update vendor balance accordingly
    if (oldDirection === 'IN') {
      vendor.balance -= oldAmount;
    } else {
      vendor.balance += oldAmount;
    }

    if (payment.direction === 'IN') {
      vendor.balance += payment.amount;
    } else {
      vendor.balance -= payment.amount;
    }

    await vendor.save();

    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Payment (by vendor and payment ID)
exports.deletePaymentByVendorAndId = async (req, res) => {
  try {
    const { vendorId, paymentId } = req.params;

    // Find the payment to delete with organization filter
    const payment = await Payment.findOne({ 
      _id: paymentId, 
      vendor: vendorId,
      organization: req.user.organization
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify vendor belongs to user's organization
    const vendor = await Vendor.findOne({
      _id: vendorId,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Store payment details before deletion
    const paymentAmount = payment.amount;
    const paymentDirection = payment.direction;

    // Remove payment
    await Payment.findByIdAndDelete(paymentId);

    // Revert the payment effect
    if (paymentDirection === 'IN') {
      vendor.balance -= paymentAmount;
    } else {
      vendor.balance += paymentAmount;
    }

    await vendor.save();

    res.json({ 
      message: 'Payment deleted successfully',
      deletedPayment: {
        id: paymentId,
        amount: paymentAmount,
        direction: paymentDirection
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Payment (by payment ID only)
exports.deletePaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log("Deleting payment with ID:", paymentId);
    // Find the payment to delete with organization filter
    const payment = await Payment.findOne({ 
      _id: paymentId, 
      organization: req.user.organization
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify vendor belongs to user's organization
    const vendor = await Vendor.findOne({
      _id: payment.vendor,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Store payment details before deletion
    const paymentAmount = payment.amount;
    const paymentDirection = payment.direction;

    // Remove payment
    await Payment.findByIdAndDelete(paymentId);

    // Revert the payment effect
    if (paymentDirection === 'IN') {
      vendor.balance -= paymentAmount;
    } else {
      vendor.balance += paymentAmount;
    }

    await vendor.save();

    res.json({ 
      message: 'Payment deleted successfully',
      deletedPayment: {
        id: paymentId,
        amount: paymentAmount,
        direction: paymentDirection
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
