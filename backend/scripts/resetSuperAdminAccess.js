// Removes every existing SuperAdmin account and creates a single fresh one
// for rohit.zore@datacircles.in, per explicit user request.

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const https = require("https");
const SuperAdmin = require("../models/SuperAdmin");

dotenv.config({ quiet: true });

const EMAIL = "rohit.zore@datacircles.in";
const PASSWORD = "Data@721";
const NAME = "Super Admin";

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

  const existing = await SuperAdmin.find({}).select("email");
  const { deletedCount } = await SuperAdmin.deleteMany({});
  console.log(
    `Removed ${deletedCount} existing SuperAdmin account(s): ${existing.map((a) => a.email).join(", ") || "(none)"}`,
  );

  const admin = new SuperAdmin({ email: EMAIL, password: PASSWORD, name: NAME });
  await admin.save();
  console.log(`Created new SuperAdmin: ${admin.email}`);

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
