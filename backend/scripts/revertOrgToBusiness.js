// Reverts the shared organization (rohit.zore@datacircles.in /
// yash.mishra@datacircles.in) back to an active Business plan — undoes
// createStarterLoginUser.js's org-level plan change now that testing on
// Starter is done. Subscriptions are per-organization, not per-user, so
// that earlier change affected every user in the org, not just the one
// being tested.

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const https = require("https");
const Subscription = require("../models/Subscription");

dotenv.config({ quiet: true });

const ORG_ID = "6a5703d82dd9d4270cc7ee59";

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

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const sub = await Subscription.findOne({ organization: ORG_ID });
  if (!sub) {
    console.error(`No subscription found for organization ${ORG_ID}`);
    process.exit(1);
  }

  sub.planName = "business";
  sub.status = "active";
  sub.appStatus = "active";
  sub.billingCycle = "monthly";
  sub.pricePerUser = 650; // matches seedPlans.js's business planId monthlyPrice
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = periodEnd;
  sub.nextBillingDate = periodEnd;
  sub.isTrialActive = false;
  sub.paymentStatus = "payment_completed";
  sub.isPaymentConfirmed = true;
  sub.totalAmount = sub.pricePerUser * (sub.userCount || 1);
  await sub.save();

  console.log(`Organization ${ORG_ID} subscription ${sub._id} reverted to active Business plan.`);
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
