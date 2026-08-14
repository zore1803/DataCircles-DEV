// Clones yash.mishra's organization's CRM data into jivesh.singhasane's new,
// separate organization (created by splitRohitYashOrgs.js) so jivesh's
// Starter-plan test account has the same data to test against, while
// keeping the two organizations (and therefore plans) independent.
//
// Strategy: two passes.
//   Pass 1 — for every included model, clone each document belonging to
//   the source org into a brand-new document (new _id, organization set
//   to the target org), and record oldId -> newId in a single shared map.
//   Pass 2 — walk every cloned document and rewrite any ObjectId (or
//   ObjectId-like string) value found anywhere in it that matches a key
//   in that map, so cross-references between cloned entities (e.g. a
//   cloned Deal's `company` field) point at the new cloned copies
//   instead of the originals.
// References to un-cloned entities (e.g. `createdBy`/`assignedTo` User
// ids) are intentionally left pointing at the original users, since
// Users are not duplicated.

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const https = require("https");

dotenv.config({ quiet: true });

const SOURCE_ORG_ID = "6a5703d82dd9d4270cc7ee59"; // yash.mishra's org
const TARGET_ORG_ID = "6a7d5ffea1889e3b675fc5a6"; // jivesh.singhasane's new org

const MODEL_NAMES = [
  "Industry",
  "MeetingType",
  "KanbanBoard",
  "KanbanName",
  "CompanyFields",
  "ContactFields",
  "DealFields",
  "ItemFields",
  "VendorFields",
  "DocumentSettings",
  "DocumentTemplateSettings",
  "DocumentFooterTemplate",
  "Branding",
  "BankDetails",
  "Company",
  "CompanyFolder",
  "Contact",
  "ContactFolder",
  "Vendor",
  "Item",
  "Deal",
  "Task",
  "Meeting",
  "Note",
  "VendorNote",
  "CallLog",
  "Invoice",
  "ProformaInvoice",
  "Payment",
  "Purchase",
  "PurchaseOrder",
  "quotation",
  "deliveryChallan",
];

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

function isObjectIdLike(v) {
  return v instanceof mongoose.Types.ObjectId;
}

// Deep-walks a plain object/array, replacing any ObjectId found in idMap.
function remapDeep(node, idMap) {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) {
    return node.map((item) => remapDeep(item, idMap));
  }
  if (isObjectIdLike(node)) {
    const mapped = idMap.get(node.toString());
    return mapped ? mapped : node;
  }
  if (node instanceof Date) return node;
  if (typeof node === "object") {
    for (const key of Object.keys(node)) {
      if (key === "_id" || key === "organization") continue;
      node[key] = remapDeep(node[key], idMap);
    }
    return node;
  }
  return node;
}

async function main() {
  const uri = await resolveSrvUri(process.env.MONGO_URI);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const idMap = new Map(); // oldId string -> new ObjectId
  const clonedByModel = {}; // modelName -> array of cloned lean docs (pre-remap)

  // Pass 1: clone every doc, assign new _id + organization, record mapping.
  for (const modelName of MODEL_NAMES) {
    let Model;
    try {
      Model = require(`../models/${modelName}`);
    } catch (e) {
      console.warn(`Skipping ${modelName}: could not load model (${e.message})`);
      continue;
    }
    const docs = await Model.find({ organization: SOURCE_ORG_ID }).lean();
    const clones = docs.map((doc) => {
      const oldId = doc._id.toString();
      const newId = new mongoose.Types.ObjectId();
      idMap.set(oldId, newId);
      const clone = { ...doc, _id: newId, organization: new mongoose.Types.ObjectId(TARGET_ORG_ID) };
      delete clone.__v;
      return clone;
    });
    clonedByModel[modelName] = clones;
    console.log(`${modelName}: found ${docs.length} doc(s) to clone.`);
  }

  // Pass 2: remap cross-references, then insert.
  let totalInserted = 0;
  for (const modelName of MODEL_NAMES) {
    const clones = clonedByModel[modelName];
    if (!clones || clones.length === 0) continue;
    const Model = require(`../models/${modelName}`);
    const remapped = clones.map((doc) => remapDeep(doc, idMap));
    // Some models (KanbanBoard, KanbanName, *Fields, DocumentSettings, ...)
    // are per-org singletons with a unique index on `organization` and may
    // already have an auto-created default for the target org — clear any
    // pre-existing docs for the target org first so the clone can insert.
    await Model.collection.deleteMany({ organization: new mongoose.Types.ObjectId(TARGET_ORG_ID) });
    const result = await Model.collection.insertMany(remapped, { ordered: false });
    totalInserted += result.insertedCount || remapped.length;
    console.log(`${modelName}: inserted ${remapped.length} clone(s).`);
  }

  console.log(`Done. Total documents cloned into org ${TARGET_ORG_ID}: ${totalInserted}`);
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
