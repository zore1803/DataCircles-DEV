// One-off: creates a new Organization + admin User + active Growth
// Subscription for jivesh.singhasane@datacircles.in.
// Idempotent: if the user already exists it just updates the
// password/subscription instead of erroring on the unique index.
//
// Usage: node scripts/createJiveshGrowthUser.js

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const https = require("https");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Subscription = require("../models/Subscription");

dotenv.config({ quiet: true });

const EMAIL = "jivesh.singhasane@datacircles.in";
const PASSWORD = "Data@721";

function dohQuery(name, type) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    https
      .get(url, { headers: { accept: "application/dns-json" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function resolveSrvUri(uri) {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try {
    const urlObj = new URL(uri.replace("mongodb+srv://", "http://"));
    const host = urlObj.hostname;
    const srv = await dohQuery(`_mongodb._tcp.${host}`, "SRV");
    const txt = await dohQuery(host, "TXT");
    const hosts = (srv.Answer || []).map((a) => {
      const parts = a.data.split(" ");
      return `${parts[3].replace(/\.$/, "")}:${parts[2]}`;
    });
    const authSourceTxt = (txt.Answer || []).find((a) => a.data.includes("authSource"));
    const additionalParams = authSourceTxt ? "&" + authSourceTxt.data.replace(/"/g, "") : "";
    if (hosts.length > 0) {
      const credentials = urlObj.username ? `${urlObj.username}:${urlObj.password}@` : "";
      return `mongodb://${credentials}${hosts.join(",")}/?ssl=true&retryWrites=true&w=majority${additionalParams}`;
    }
  } catch (e) {
    console.error("Failed to resolve SRV record:", e.message);
  }
  return uri;
}

async function main() {
  const uri = await resolveSrvUri(process.env.MONGO_URI);
  if (!uri) {
    console.error("MONGO_URI is not set in backend/.env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  let user = await User.findOne({ email: EMAIL });
  let org;

  if (user) {
    console.log(`User already exists (${user._id}) — updating password and organization's subscription.`);
    user.password = hashedPassword;
    user.role = "admin";
    await user.save();
    org = await Organization.findById(user.organization);
  } else {
    org = await Organization.create({
      name: "Jivesh Singhasane Growth Org",
      code: `JS-${Date.now().toString(36).toUpperCase()}`,
    });
    user = await User.create({
      email: EMAIL,
      password: hashedPassword,
      role: "admin",
      organization: org._id,
      name: "Jivesh Singhasane",
    });
    console.log(`Created organization ${org._id} and user ${user._id}.`);
  }

  if (!org) {
    console.error("Could not resolve an organization for this user.");
    process.exit(1);
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subFields = {
    planName: "growth",
    status: "active",
    appStatus: "active",
    billingCycle: "monthly",
    pricePerUser: 450, // matches seedPlans.js's growth planId monthlyPrice
    userCount: 1,
    totalAmount: 450,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    isTrialActive: false,
    trialUsed: true,
    paymentStatus: "payment_completed",
    isPaymentConfirmed: true,
  };

  let subscription = await Subscription.findOne({ organization: org._id });
  if (subscription) {
    Object.assign(subscription, subFields);
    await subscription.save();
    console.log(`Updated existing subscription ${subscription._id} for organization ${org._id} to active Growth.`);
  } else {
    subscription = await Subscription.create({ organization: org._id, ...subFields });
    console.log(`Created active Growth subscription ${subscription._id} for organization ${org._id}.`);
  }
  console.log("\nLogin with:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
