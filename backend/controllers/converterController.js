const Invoice = require('../models/Invoice');
const ProformaInvoice = require('../models/ProformaInvoice');
const Quotation = require('../models/quotation');
const DeliveryChallan = require('../models/deliveryChallan');
const mongoose = require('mongoose');
const Counter = require('../models/Counter');

// Utility function to format date as YYYYMMDD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

// Atomic document number generation - prevents duplicate numbers for same document type
const generateDocumentNumber = async (prefix, organization, session) => {
  const counterId = `${organization}_${prefix}`; // Unique counter per org + document type
  
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } }, // Atomic increment
    { 
      new: true, // Return updated document
      upsert: true, // Create if doesn't exist
      session, // Use transaction session
      setDefaultsOnInsert: true 
    }
  );
  
  return `${prefix}-${counter.seq}`;
};

// Validate required fields
const validateRequiredFields = (data, fields, items) => {
  for (const field of fields) {
    if (!data[field]) {
      return `Missing required field: ${field}`;
    }
  }
  for (const item of items) {
    if (!item.name || !item.rate || !item.quantity) {
      return 'All items must have name, rate, and quantity';
    }
  }
  return null;
};

// Invoice to Proforma Invoice
exports.convertToProformaInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const performaInvoiceNumber = await generateDocumentNumber('PI', invoice.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const proformaInvoiceData = {
      ...invoice.toObject(),
      _id: newId,
      performaInvoiceNumber,
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete proformaInvoiceData.invoiceNumber;

    const requiredFields = ['deal', 'performaInvoiceNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(proformaInvoiceData, requiredFields, proformaInvoiceData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const proformaInvoice = new ProformaInvoice(proformaInvoiceData);
    await proformaInvoice.save({ session });

    await Invoice.findByIdAndDelete(invoiceId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Proforma Invoice successfully', proformaInvoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert invoice: ${error.message}` });
  }
};

// Invoice to Quotation
exports.convertToQuotation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const quotationNumber = await generateDocumentNumber('QUO', invoice.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const quotationData = {
      ...invoice.toObject(),
      _id: newId,
      quotationNumber,
      isTaxQuotation: invoice.isTaxInvoice,
      status: 'Draft',
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete quotationData.invoiceNumber;

    const requiredFields = ['deal', 'quotationNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(quotationData, requiredFields, quotationData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const quotation = new Quotation(quotationData);
    await quotation.save({ session });

    await Invoice.findByIdAndDelete(invoiceId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Quotation successfully', quotation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert invoice: ${error.message}` });
  }
};

// Invoice to Delivery Challan
exports.convertToDeliveryChallan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const deliveryChallanNumber = await generateDocumentNumber('DC', invoice.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const deliveryChallanData = {
      ...invoice.toObject(),
      _id: newId,
      deliveryChallanNumber,
      status: 'Draft',
      items: invoice.items.map(item => ({
        ...item,
        hsn: undefined, // Remove HSN for Delivery Challan
      })),
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete deliveryChallanData.invoiceNumber;
    delete deliveryChallanData.isTaxInvoice;
    delete deliveryChallanData.receiverGSTIN;

    const requiredFields = ['deal', 'deliveryChallanNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    // const validationError = validateRequiredFields(deliveryChallanData, requiredFields, deliveryChallanData.items);
    // if (validationError) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: validationError });
    // }

    const deliveryChallan = new DeliveryChallan(deliveryChallanData);
    await deliveryChallan.save({ session });

    await Invoice.findByIdAndDelete(invoiceId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Delivery Challan successfully', deliveryChallan });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert invoice: ${error.message}` });
  }
};

// Proforma Invoice to Tax Invoice
exports.convertToTaxInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const proformaInvoiceId = req.params.id;
    const proformaInvoice = await ProformaInvoice.findById(proformaInvoiceId).session(session);
    if (!proformaInvoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Proforma Invoice not found' });
    }

    const invoiceNumber = await generateDocumentNumber('INV', proformaInvoice.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const invoiceData = {
      ...proformaInvoice.toObject(),
      _id: newId,
      invoiceNumber,
      isTaxInvoice: proformaInvoice.items.some(item => item.hsn && item.hsn.trim() !== ''),
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete invoiceData.performaInvoiceNumber;

    const requiredFields = ['deal', 'invoiceNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(invoiceData, requiredFields, invoiceData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const invoice = new Invoice(invoiceData);
    await invoice.save({ session });

    await ProformaInvoice.findByIdAndDelete(proformaInvoiceId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Tax Invoice successfully', invoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert proforma invoice: ${error.message}` });
  }
};

// Proforma Invoice to Quotation
exports.convertProformaToQuotation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const proformaInvoiceId = req.params.id;
    const proformaInvoice = await ProformaInvoice.findById(proformaInvoiceId).session(session);
    if (!proformaInvoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Proforma Invoice not found' });
    }

    const quotationNumber = await generateDocumentNumber('QUO', proformaInvoice.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const quotationData = {
      ...proformaInvoice.toObject(),
      _id: newId,
      quotationNumber,
      isTaxQuotation: proformaInvoice.items.some(item => item.hsn && item.hsn.trim() !== ''),
      status: 'Draft',
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete quotationData.performaInvoiceNumber;

    const requiredFields = ['deal', 'quotationNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(quotationData, requiredFields, quotationData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const quotation = new Quotation(quotationData);
    await quotation.save({ session });

    await ProformaInvoice.findByIdAndDelete(proformaInvoiceId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Quotation successfully', quotation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert proforma invoice: ${error.message}` });
  }
};

// Proforma Invoice to Delivery Challan
exports.convertProformaToDeliveryChallan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const proformaInvoiceId = req.params.id;
    const proformaInvoice = await ProformaInvoice.findById(proformaInvoiceId).session(session);
    if (!proformaInvoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Proforma Invoice not found' });
    }

    const deliveryChallanNumber = await generateDocumentNumber('DC', proformaInvoice.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const deliveryChallanData = {
      ...proformaInvoice.toObject(),
      _id: newId,
      deliveryChallanNumber,
      status: 'Draft',
      items: proformaInvoice.items.map(item => ({
        ...item,
        hsn: undefined, // Remove HSN for Delivery Challan
      })),
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete deliveryChallanData.performaInvoiceNumber;
    delete deliveryChallanData.receiverGSTIN;

    const requiredFields = ['deal', 'deliveryChallanNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    // const validationError = validateRequiredFields(deliveryChallanData, requiredFields, deliveryChallanData.items);
    // if (validationError) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: validationError });
    // }

    const deliveryChallan = new DeliveryChallan(deliveryChallanData);
    await deliveryChallan.save({ session });

    await ProformaInvoice.findByIdAndDelete(proformaInvoiceId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Delivery Challan successfully', deliveryChallan });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert proforma invoice: ${error.message}` });
  }
};

// Quotation to Tax Invoice
exports.convertQuotationToTaxInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const quotationId = req.params.id;
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Quotation not found' });
    }
    // if (quotation.status !== 'Accepted') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: 'Quotation must be accepted to convert to invoice' });
    // }

    const invoiceNumber = await generateDocumentNumber('INV', quotation.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const invoiceData = {
      ...quotation.toObject(),
      _id: newId,
      invoiceNumber,
      isTaxInvoice: quotation.isTaxQuotation,
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete invoiceData.quotationNumber;

    const requiredFields = ['deal', 'invoiceNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(invoiceData, requiredFields, invoiceData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const invoice = new Invoice(invoiceData);
    await invoice.save({ session });

    quotation.status = 'Void';
    await quotation.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Tax Invoice successfully', invoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert quotation: ${error.message}` });
  }
};

// Quotation to Proforma Invoice
exports.convertQuotationToProforma = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const quotationId = req.params.id;
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Quotation not found' });
    }
    // if (quotation.status !== 'Accepted') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: 'Quotation must be accepted to convert to proforma invoice' });
    // }

    const performaInvoiceNumber = await generateDocumentNumber('PI', quotation.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const proformaInvoiceData = {
      ...quotation.toObject(),
      _id: newId,
      performaInvoiceNumber,
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete proformaInvoiceData.quotationNumber;
    delete proformaInvoiceData.isTaxQuotation;

    const requiredFields = ['deal', 'performaInvoiceNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(proformaInvoiceData, requiredFields, proformaInvoiceData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const proformaInvoice = new ProformaInvoice(proformaInvoiceData);
    await proformaInvoice.save({ session });

    quotation.status = 'Void';
    await quotation.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Proforma Invoice successfully', proformaInvoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert quotation: ${error.message}` });
  }
};

// Quotation to Delivery Challan
exports.convertQuotationToDeliveryChallan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const quotationId = req.params.id;
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Quotation not found' });
    }
    // if (quotation.status !== 'Accepted') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: 'Quotation must be accepted to convert to delivery challan' });
    // }

    const deliveryChallanNumber = await generateDocumentNumber('DC', quotation.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const deliveryChallanData = {
      ...quotation.toObject(),
      _id: newId,
      deliveryChallanNumber,
      status: 'Draft',
      items: quotation.items.map(item => ({
        ...item,
        hsn: undefined, // Remove HSN for Delivery Challan
      })),
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete deliveryChallanData.quotationNumber;
    delete deliveryChallanData.isTaxQuotation;
    delete deliveryChallanData.receiverGSTIN;

    const requiredFields = ['deal', 'deliveryChallanNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    // const validationError = validateRequiredFields(deliveryChallanData, requiredFields, deliveryChallanData.items);
    // if (validationError) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: validationError });
    // }

    const deliveryChallan = new DeliveryChallan(deliveryChallanData);
    await deliveryChallan.save({ session });

    quotation.status = 'Void';
    await quotation.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Delivery Challan successfully', deliveryChallan });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert quotation: ${error.message}` });
  }
};

// Delivery Challan to Tax Invoice
exports.convertDeliveryChallanToTaxInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deliveryChallanId = req.params.id;
    const deliveryChallan = await DeliveryChallan.findById(deliveryChallanId).session(session);
    if (!deliveryChallan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Delivery Challan not found' });
    }
    // if (deliveryChallan.status !== 'Delivered') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: 'Delivery Challan must be delivered to convert to invoice' });
    // }

    const invoiceNumber = await generateDocumentNumber('INV', deliveryChallan.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const invoiceData = {
      ...deliveryChallan.toObject(),
      _id: newId,
      invoiceNumber,
      isTaxInvoice: false,
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete invoiceData.deliveryChallanNumber;

    const requiredFields = ['deal', 'invoiceNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(invoiceData, requiredFields, invoiceData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const invoice = new Invoice(invoiceData);
    await invoice.save({ session });

    deliveryChallan.status = 'Cancelled';
    await deliveryChallan.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Tax Invoice successfully', invoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert delivery challan: ${error.message}` });
  }
};

// Delivery Challan to Proforma Invoice
exports.convertDeliveryChallanToProforma = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deliveryChallanId = req.params.id;
    const deliveryChallan = await DeliveryChallan.findById(deliveryChallanId).session(session);
    if (!deliveryChallan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Delivery Challan not found' });
    }
    // if (deliveryChallan.status !== 'Delivered') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: 'Delivery Challan must be delivered to convert to proforma invoice' });
    // }

    const performaInvoiceNumber = await generateDocumentNumber('PI', deliveryChallan.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const proformaInvoiceData = {
      ...deliveryChallan.toObject(),
      _id: newId,
      performaInvoiceNumber,
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete proformaInvoiceData.deliveryChallanNumber;

    const requiredFields = ['deal', 'performaInvoiceNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(proformaInvoiceData, requiredFields, proformaInvoiceData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const proformaInvoice = new ProformaInvoice(proformaInvoiceData);
    await proformaInvoice.save({ session });

    deliveryChallan.status = 'Cancelled';
    await deliveryChallan.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Proforma Invoice successfully', proformaInvoice });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert delivery challan: ${error.message}` });
  }
};

// Delivery Challan to Quotation
exports.convertDeliveryChallanToQuotation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deliveryChallanId = req.params.id;
    const deliveryChallan = await DeliveryChallan.findById(deliveryChallanId).session(session);
    if (!deliveryChallan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Delivery Challan not found' });
    }
    // if (deliveryChallan.status !== 'Delivered') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ message: 'Delivery Challan must be delivered to convert to quotation' });
    // }

    const quotationNumber = await generateDocumentNumber('QUO', deliveryChallan.organization, session);

    const newId = new mongoose.Types.ObjectId();
    const quotationData = {
      ...deliveryChallan.toObject(),
      _id: newId,
      quotationNumber,
      isTaxQuotation: false,
      status: 'Draft',
      createdAt: undefined,
      updatedAt: undefined,
    };
    delete quotationData.deliveryChallanNumber;

    const requiredFields = ['deal', 'quotationNumber', 'date', 'amount', 'user', 'organization', 'status', 'discount'];
    const validationError = validateRequiredFields(quotationData, requiredFields, quotationData.items);
    if (validationError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: validationError });
    }

    const quotation = new Quotation(quotationData);
    await quotation.save({ session });

    deliveryChallan.status = 'Cancelled';
    await deliveryChallan.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Converted to Quotation successfully', quotation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: `Failed to convert delivery challan: ${error.message}` });
  }
};