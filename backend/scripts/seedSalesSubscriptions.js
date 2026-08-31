const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });

const User = require("../models/User");
const Deal = require("../models/Deal");
const Item = require("../models/Item");
const SalesSubscription = require("../models/SalesSubscription");

const Company = require("../models/Company");

const EMAIL = process.argv[2] || "rohit.zore@datacircles.in";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({ email: EMAIL });
    if (!user || !user.organization) {
      console.error("❌ User/org not found for", EMAIL);
      process.exit(1);
    }
    const org = user.organization;
    const uid = user._id;

    // Fallback: Create dependencies if they don't exist
    let company = await Company.findOne({ organization: org });
    if (!company) {
      company = await Company.create({
        name: "Acme Corp",
        email: "contact@acme.com",
        phone: "+1-555-0199",
        industry: "Technology",
        organization: org,
        user: uid
      });
      console.log("Created fallback Company");
    }

    // Only Won deals are billable (see salesSubscriptionController.isWonDeal),
    // so the seed picks one — falling back to creating a Won deal below rather
    // than attaching demo subscriptions to an Open/Lost deal the UI would then
    // refuse to let anyone recreate.
    let deal = await Deal.findOne({ organization: org, status: /^won$/i });
    if (!deal) {
      deal = await Deal.create({
        title: "Annual Services Contract",
        amount: 50000,
        status: "Won",
        company: company._id,
        organization: org,
        user: uid,
        createdBy: uid,
        lastUpdatedBy: uid
      });
      console.log("Created fallback Deal");
    }

    let item = await Item.findOne({ organization: org });
    if (!item) {
      item = await Item.create({
        type: "service",
        name: "Standard Maintenance",
        description: "Monthly maintenance and support",
        purchasePrice: 0,
        sellingPrice: 5000,
        hsnSac: "998311",
        organization: org,
        user: uid
      });
      console.log("Created fallback Item");
    }

    const today = new Date();
    
    // Clear existing for this org (optional, but good for fresh seeding)
    await SalesSubscription.deleteMany({ organization: org });

    const N = parseInt(process.argv[3], 10) || 50;
    const subscriptions = [];

    const statuses = ["Active", "Draft", "Expired", "Cancelled", "Error"];
    const intervals = [
      { value: 1, unit: "month" },
      { value: 1, unit: "year" },
      { value: 1, unit: "week" },
      { value: 3, unit: "month" }
    ];

    for (let i = 0; i < N; i++) {
      const status = statuses[i % statuses.length];
      const interval = intervals[i % intervals.length];
      
      const startDate = new Date(today.getFullYear(), today.getMonth() - (i % 12), today.getDate() - (i % 28));
      
      let endDate = null;
      let nextInvoiceDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      
      if (status === "Expired") {
        endDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        nextInvoiceDate = null;
      } else if (status === "Cancelled") {
        nextInvoiceDate = null;
      } else if (status === "Draft") {
        nextInvoiceDate = new Date(startDate.getTime() + 86400000 * 5); // 5 days after start
      }

      subscriptions.push({
        deal: deal._id,
        subscriptionNumber: `SUB-${String(i + 1).padStart(3, '0')}`,
        items: [{
          itemId: item._id,
          name: item.name,
          description: `Subscription service ${i + 1}`,
          rate: 1000 * (i % 5 + 1),
          quantity: 1,
          discountType: "amount",
          discount: 0,
          gstRate: 18,
          taxInclusive: false
        }],
        amount: 1000 * (i % 5 + 1) * 1.18,
        billingInterval: interval,
        startDate,
        endDate,
        nextInvoiceDate,
        status,
        invoiceCount: i % 10,
        organization: org,
        user: uid
      });
    }

    await SalesSubscription.insertMany(subscriptions);
    console.log(`✅ Seeded ${subscriptions.length} Sales Subscriptions for ${EMAIL}`);
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed error:", e);
    process.exit(1);
  }
}

run();
