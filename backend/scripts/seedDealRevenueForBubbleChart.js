// One-off: marks a handful of deals as "Won" with varied amounts for
// yash.mishra's org, so the Insights "Deal Velocity by Company" bubble
// chart (bubble size = Won-deal revenue) has visible size variation
// instead of every company sitting at zero Won revenue.

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const https = require("https");
const Deal = require("../models/Deal");

dotenv.config({ quiet: true });

const ORG_ID = "6a5703d82dd9d4270cc7ee59"; // yash.mishra's org

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

  const deals = await Deal.find({ organization: ORG_ID, company: { $ne: null } }).lean();

  const byCompany = {};
  deals.forEach((d) => {
    const cid = d.company.toString();
    if (!byCompany[cid]) byCompany[cid] = [];
    byCompany[cid].push(d);
  });

  const companiesByDealCount = Object.entries(byCompany).sort((a, b) => b[1].length - a[1].length);

  // Give the top 10 companies (by deal count) a Won deal with a varied
  // amount, so bubble sizes spread out meaningfully.
  const amounts = [
    25000, 60000, 120000, 45000, 900000, 1500000, 350000, 2200000, 80000, 4800000,
  ];

  let updated = 0;
  for (let i = 0; i < Math.min(10, companiesByDealCount.length); i++) {
    const [, companyDeals] = companiesByDealCount[i];
    const dealToWin = companyDeals[0];
    await Deal.updateOne(
      { _id: dealToWin._id },
      { $set: { status: "Won", amount: amounts[i % amounts.length] } },
    );
    updated++;
  }

  console.log(`Marked ${updated} deals as Won with varied amounts across top companies.`);
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
