require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const startReminderJob = require('./utils/reminderJob');
require('./jobs/subscriptionLifecycleJobs');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const YAML = require('yaml');
const swaggerDocument = YAML.parse(fs.readFileSync('./swagger.yaml', 'utf8'));
const axios = require('axios');

const app = express();

console.log("JWT Secret Check:", process.env.SUPER_ADMIN_JWT_SECRET ? "LOADED" : "MISSING");

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    "https://crm-frontend-flax-tau.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174", // Add this
    "https://bejewelled-unicorn-7909b8.netlify.app",
    "https://datacircles.netlify.app",
    "https://app.datacircles.in",
    "https://data-circles-crm-dev.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-phone-token",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  preflightContinue: false,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Explicit OPTIONS handler for all routes
app.options(/.*/, cors(corsOptions)); // Enable pre-flight for all routes


const subscriptionRoutes = require("./routes/subscription");
app.use("/api/subscription", subscriptionRoutes)
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/json', limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

app.use('/api/doc', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Import routes
const companyRoutes = require('./routes/CompanyRoutes');
app.use('/api/companies', companyRoutes);

const contactRoutes = require('./routes/contactRoutes');
app.use('/api/contacts', contactRoutes);

// PUBLIC, unauthenticated form-submission surface (FORMS_ARCHITECTURE.md §2.9) — org resolved from the
// URL slug inside the service, never from req.user (there is none here). Kept as its own router so the
// absence of requireAuth is intentional and obvious, not an oversight.
const publicFormRoutes = require('./routes/publicFormRoutes');
app.use('/api/public/forms', publicFormRoutes);

const dealRoutes = require('./routes/dealRoutes');
app.use('/api/deals', dealRoutes);

const taskRoutes = require('./routes/taskRoutes');
app.use('/api/tasks', taskRoutes);

const invoiceRoutes = require('./routes/invoiceRoutes');
app.use('/api/invoices', invoiceRoutes);

const performaInvoiceRoutes = require('./routes/perfomainvoice');
app.use('/api/performa-invoices', performaInvoiceRoutes);

const quotationRoutes = require('./routes/quotationRoutes');
app.use('/api/quotations', quotationRoutes);

const deliveryChallanRoutes = require('./routes/deliveryChallanRoutes');
app.use('/api/delivery-challans', deliveryChallanRoutes);

const invoiceConverter = require('./routes/converterRoutes');
app.use('/api/converter', invoiceConverter);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const brandingRoutes = require('./routes/brandingRoutes');
app.use('/api/branding', brandingRoutes);

const bankDetailsRoutes = require("./routes/bankDetails");
app.use("/api/bank-details", bankDetailsRoutes);

const kanbanBoardRoutes = require('./routes/kanbanBoard');
app.use('/api/kanban', kanbanBoardRoutes);

const companyFields = require('./routes/companyFields');
app.use('/api/company-fields', companyFields);

const folderRoutes = require('./routes/folders');
app.use('/api/folders', folderRoutes);

const noteRoutes = require('./routes/notes');
app.use('/api/notes', noteRoutes);

const contactFolderRoutes = require('./routes/contactFolderRoutes');
app.use('/api/contact-folders', contactFolderRoutes);

const contactFieldsRoutes = require('./routes/contactFields');
app.use('/api/contact-fields', contactFieldsRoutes);

const companyFolderRoutes = require('./routes/companyFolderRoutes');
app.use('/api/company-folders', companyFolderRoutes);

const kanbanName = require('./routes/kanbanName');
app.use('/api/kanban-name', kanbanName);

const dealFieldsRoutes = require('./routes/dealFields');
app.use('/api/deal-fields', dealFieldsRoutes);

const callLogRoutes = require("./routes/callLogRoutes");
app.use("/api/call-logs", callLogRoutes);

const vendorRoutes = require("./routes/vendorRoutes");
app.use("/api/vendors", vendorRoutes);

const meetingRoutes = require('./routes/meetings');
app.use('/api/meetings', meetingRoutes);

const vendorFieldsRoutes = require('./routes/vendorFields');
app.use('/api/vendor-fields', vendorFieldsRoutes);

const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
app.use("/api/purchase-orders", purchaseOrderRoutes);

const purchaseRoutes = require("./routes/purchase");
app.use("/api/purchases", purchaseRoutes);

const itemRoutes = require("./routes/itemRoutes");
app.use("/api/items", itemRoutes);

const organizationRoutes = require("./routes/organisation");
app.use("/api/organisation", organizationRoutes);

const vendorNotesRoutes = require("./routes/vendorNotes");
app.use("/api/vendor-notes", vendorNotesRoutes);

const emailRoutes = require("./routes/emailRoutes");
app.use("/api/email", emailRoutes);

const notificationRoutes = require("./routes/notificationRoutes");
app.use("/api/notification", notificationRoutes);

const superAdminRoutes = require('./routes/superAdminRoutes');
app.use('/api/super-admin', superAdminRoutes);

const dealSettingsRoutes = require('./routes/dealSettings');
app.use('/api/deal-settings', dealSettingsRoutes);

const emailTemplateRoutes = require("./routes/emailTemplateRoutes");
app.use("/api/email-templates", emailTemplateRoutes);

const companyIndustryRoutes = require("./routes/industryRoutes");
app.use("/api/company-industries", companyIndustryRoutes);

const globalSearch = require("./routes/globalSearch");
// const { Axios } = require('axios');
app.use('/api/search', globalSearch);

app.post("/api/gstin-details", async (req, res) => {
  try {
    const { gstin } = req.body;

    if (!gstin) {
      return res.status(400).json({ error: "gstin is required" });
    }

    const response = await axios.post(
      "https://in.staging.decentro.tech/kyc/public_registry/validate",
      {
        reference_id: "GSTIN-Detailed Document Verification",
        document_type: "GSTIN_DETAILED",
        id_number: gstin,
        consent: "Y",
        consent_purpose: "To verify GSTIN document",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "client-id": process.env.DECENTRO_CLIENT_ID,
          "client-secret": process.env.DECENTRO_CLIENT_SECRET,
          "module-id": process.env.DECENTRO_MODULE_SECRET, // or module-id if that’s what your account uses
          env: "staging",
        },
      }
    );

    // Pass Decentro response back to frontend
    return res.status(200).json(response.data);
  } catch (err) {
    console.error("Decentro GSTIN error:", err.response?.data || err.message);
    return res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: "Something went wrong" });
  }
});


app.get('/health', (req, res) => {
  res.status(200).json({ message: "server is running..." })
})

// MongoDB connect
// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
//   .then(() => console.log('MongoDB connected'))
//   .catch(err => console.log(err));

mongoose.connect(process.env.MONGO_URI) 
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// startReminderJob();

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
