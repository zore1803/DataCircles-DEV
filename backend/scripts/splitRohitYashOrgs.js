// Splits rohit.zore@datacircles.in and yash.mishra@datacircles.in into two
// separate organizations so their plans can differ independently (previously
// they shared one org/subscription — see revertOrgToBusiness.js).
// yash.mishra stays in the existing org on Business; rohit.zore is moved to
// a brand-new organization with its own Starter subscription.

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const https = require("https");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Subscription = require("../models/Subscription");

dotenv.config({ quiet: true });

function dohQuery(name, type) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    https
      .get(url, { headers: { accept: "application/dns-json" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
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
  const urlObj = new URL(uri.replace("mongodb+srv://", "http://"));
  const host = urlObj.hostname;
  const srv = await dohQuery(`_mongodb._tcp.${host}`, "SRV");
  const txt = await dohQuery(host, "TXT");
  const hosts = (srv.Answer || []).map((a) => {
    const p = a.data.split(" ");
    return `${p[3].replace(/\.$/, "")}:${p[2]}`;
  });
  const authSourceTxt = (txt.Answer || []).find((a) => a.data.includes("authSource"));
  const additionalParams = authSourceTxt ? "&" + authSourceTxt.data.replace(/"/g, "") : "";
  const credentials = urlObj.username ? `${urlObj.username}:${urlObj.password}@` : "";
  return `mongodb://${credentials}${hosts.join(",")}/?ssl=true&retryWrites=true&w=majority${additionalParams}`;
}

async function main() {
  const uri = await resolveSrvUri(process.env.MONGO_URI);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const rohit = await User.findOne({ email: "rohit.zore@datacircles.in" });
  const yash = await User.findOne({ email: "yash.mishra@datacircles.in" });
  if (!rohit) throw new Error("rohit.zore user not found");
  if (!yash) throw new Error("yash.mishra user not found");

  const sharedOrgId = yash.organization;
  console.log("Shared org (kept for yash):", sharedOrgId?.toString());
  console.log("Rohit currently in org:", rohit.organization?.toString());

  // Ensure yash's (shared) org stays on Business.
  const yashSub = await Subscription.findOne({ organization: sharedOrgId });
  if (!yashSub) throw new Error("No subscription found for shared org");
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  yashSub.planName = "business";
  yashSub.status = "active";
  yashSub.appStatus = "active";
  yashSub.billingCycle = "monthly";
  yashSub.pricePerUser = 650;
  yashSub.currentPeriodStart = now;
  yashSub.currentPeriodEnd = periodEnd;
  yashSub.nextBillingDate = periodEnd;
  yashSub.isTrialActive = false;
  yashSub.paymentStatus = "payment_completed";
  yashSub.isPaymentConfirmed = true;
  yashSub.totalAmount = yashSub.pricePerUser * (yashSub.userCount || 1);
  await yashSub.save();
  console.log(`yash's org ${sharedOrgId} subscription set to Business.`);

  // Create a brand-new organization for rohit.
  const code = `ROHIT-TEST-${Date.now().toString(36).toUpperCase()}`;
  const newOrg = await Organization.create({
    name: "Rohit Zore Test Org",
    code,
  });
  console.log("Created new organization for rohit:", newOrg._id.toString());

  rohit.organization = newOrg._id;
  await rohit.save();
  console.log(`Moved rohit.zore user to new organization ${newOrg._id}.`);

  const rohitSub = await Subscription.create({
    organization: newOrg._id,
    planName: "starter",
    status: "active",
    appStatus: "active",
    billingCycle: "monthly",
    pricePerUser: 250,
    userCount: 1,
    totalAmount: 250,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    isTrialActive: false,
    paymentStatus: "payment_completed",
    isPaymentConfirmed: true,
  });
  console.log(`Created Starter subscription ${rohitSub._id} for rohit's new org.`);

  console.log("Done. rohit.zore -> new org, Starter. yash.mishra -> existing org, Business.");
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
