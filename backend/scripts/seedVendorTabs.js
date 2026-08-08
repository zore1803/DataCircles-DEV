// Seeds 50 field-complete records per tab (Payments / Notes / Tasks / Meetings)
// for ONE vendor, so the vendor detail page (/vendors-new/:id) can be checked
// with a realistic amount of data in every tab.
//
// Unlike scripts/vendorseed.js (1-3 records per vendor, sparse by design) and
// scripts/seed_single_vendor.js (50 per tab but leaves many rendered fields
// empty), every field the UI actually reads is populated here, and values are
// distributed deterministically so each filter/summary tile has something in it.
//
// Usage:
//   node scripts/seedVendorTabs.js <vendorId|vendorName> [email] [--count=50] [--replace]
//
//   <vendorId|vendorName>  24-char ObjectId, or an exact vendor name (e.g. "Acme Corp")
//   [email]                owning user; defaults to the vendor's own `user`, else the org's first user
//   --count=N              records per tab (default 50)
//   --replace              DELETE this vendor's existing payments/notes/tasks/meetings first
//                          (off by default — the script appends unless you ask otherwise)

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const https = require("https");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Payment = require("../models/Payment");
const VendorNote = require("../models/VendorNote");
const Task = require("../models/Task");
const Meeting = require("../models/Meeting");

dotenv.config({ quiet: true });

/* ─────────────────────────── args ─────────────────────────── */

const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter((a) => a.startsWith("--"));
const positional = rawArgs.filter((a) => !a.startsWith("--"));

const TARGET_VENDOR = positional[0];
const TARGET_EMAIL = positional[1] || null;
const REPLACE = flags.includes("--replace");
const COUNT = (() => {
  const f = flags.find((a) => a.startsWith("--count="));
  const n = f ? parseInt(f.split("=")[1], 10) : 50;
  return Number.isFinite(n) && n > 0 ? n : 50;
})();

/* ──────────────── SRV resolution (Windows local dev) ──────────────── */
// Same helper the existing seed scripts use: Windows dev boxes frequently fail
// the SRV lookup that mongodb+srv:// needs, so resolve it over DNS-over-HTTPS.

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

/* ─────────────────────────── helpers ─────────────────────────── */

const cycle = (arr, i) => arr[i % arr.length];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const DAY = 24 * 60 * 60 * 1000;

// Spread `i` of `n` items across [monthsBack months ago, monthsForward months ahead],
// oldest first, with a stable time-of-day so the UI's time column varies.
function spreadDate(i, n, monthsBack, monthsForward) {
  const now = Date.now();
  const start = now - monthsBack * 30 * DAY;
  const end = now + monthsForward * 30 * DAY;
  const t = start + ((end - start) * i) / Math.max(n - 1, 1);
  const d = new Date(t);
  d.setHours(9 + (i % 9), (i * 7) % 60, 0, 0);
  return d;
}

const BANKS = ["HDFC", "SBI", "ICICI", "Axis", "Citi", "Kotak"];
const PAYMENT_TYPES = ["Card", "Cash", "Cheque", "EMI", "Net Banking", "UPI"];
const TASK_STATUSES = ["Pending", "In Progress", "Completed"];
const PRIORITIES = ["low", "medium", "high"];
const MEETING_STATUSES = ["scheduled", "completed", "cancelled", "no-show"];
const MEETING_TYPES = ["in-person", "video-call", "phone-call"];
const MEETING_OUTCOMES = ["successful", "needs-followup", "cancelled", "no-show"];
const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai"];

const TASK_TITLES = [
  "Review invoice", "Chase pending delivery", "Renew supply contract",
  "Verify GSTIN details", "Reconcile payment", "Collect signed PO",
  "Audit last quarter shipments", "Update banking details",
  "Negotiate revised rate card", "Schedule quality inspection",
];

const MEETING_TITLES = [
  "Quarterly performance review", "Contract renewal discussion",
  "Pricing negotiation", "Delivery schedule sync", "Escalation call",
  "Onboarding walkthrough", "Compliance check-in", "Annual business review",
];

const NOTE_BODIES = [
  "Confirmed the revised rate card. New pricing takes effect from the next billing cycle.",
  "Vendor flagged a delay on the current shipment; revised ETA shared over email.",
  "Discussed contract renewal terms. They asked for a two-year lock-in at current rates.",
  "Quality inspection passed with no major findings. Minor packaging note raised.",
  "Payment reconciliation done for the quarter. One invoice still unmatched.",
  "Escalated the repeated late deliveries. Vendor committed to a corrective plan.",
  "Updated primary contact and banking details after their internal restructure.",
  "Reviewed GSTIN and compliance documents. All current, next review in 12 months.",
];

/* ─────────────────────────── main ─────────────────────────── */

async function main() {
  if (!TARGET_VENDOR) {
    console.error("Please provide a vendor ID or exact vendor name.");
    console.error('Usage: node scripts/seedVendorTabs.js <vendorId|vendorName> [email] [--count=50] [--replace]');
    process.exit(1);
  }

  const uri = await resolveSrvUri(process.env.MONGO_URI);
  if (!uri) {
    console.error("MONGO_URI is not set in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  // ── Resolve vendor (by id or exact name) ──
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(TARGET_VENDOR);
  const vendor = isObjectId
    ? await Vendor.findById(TARGET_VENDOR)
    : await Vendor.findOne({ name: TARGET_VENDOR });

  if (!vendor) {
    console.error(`No vendor found for "${TARGET_VENDOR}".`);
    process.exit(1);
  }

  // ── Resolve owning user. Everything the UI reads is scoped to the vendor's
  //    organization, so the user MUST belong to the same org or the records
  //    will be invisible in the app (this is the classic "seeded but nothing
  //    shows up" trap).
  let user;
  if (TARGET_EMAIL) {
    user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
      console.error(`No user found with email: ${TARGET_EMAIL}`);
      process.exit(1);
    }
    if (String(user.organization) !== String(vendor.organization)) {
      console.error(
        `Refusing to seed: ${TARGET_EMAIL} is in organization ${user.organization},\n` +
        `but vendor "${vendor.name}" belongs to organization ${vendor.organization}.\n` +
        `The records would be created where you cannot see them.`
      );
      process.exit(1);
    }
  } else {
    user =
      (vendor.user && (await User.findById(vendor.user))) ||
      (await User.findOne({ organization: vendor.organization }));
    if (!user) {
      console.error(`No user found in organization ${vendor.organization}.`);
      process.exit(1);
    }
  }

  const org = vendor.organization;
  console.log(`Vendor:       ${vendor.name} (${vendor._id})`);
  console.log(`Organization: ${org}`);
  console.log(`Acting user:  ${user.email}`);
  console.log(`Records/tab:  ${COUNT}`);

  // ── Optional cleanup (explicit opt-in only) ──
  if (REPLACE) {
    const [p, n, t, m] = await Promise.all([
      Payment.countDocuments({ vendor: vendor._id }),
      VendorNote.countDocuments({ vendor: vendor._id }),
      Task.countDocuments({ "relatedEntities.entityId": vendor._id, "relatedEntities.entityModel": "Vendor" }),
      Meeting.countDocuments({ vendor: vendor._id, linkedTo: "vendor" }),
    ]);
    console.log(`--replace: deleting existing ${p} payments, ${n} notes, ${t} tasks, ${m} meetings for this vendor.`);
    await Promise.all([
      Payment.deleteMany({ vendor: vendor._id }),
      VendorNote.deleteMany({ vendor: vendor._id }),
      Task.deleteMany({ "relatedEntities.entityId": vendor._id, "relatedEntities.entityModel": "Vendor" }),
      Meeting.deleteMany({ vendor: vendor._id, linkedTo: "vendor" }),
    ]);
  }

  /* ── PAYMENTS ──
     Read by: PaymentsTable (date/time, direction, paymentType, amount) and
     venerPaymentPreview (notes, reference, bank). Directions alternate so the
     Total In / Total Out / Net Balance tiles are all non-zero. */
  const payments = Array.from({ length: COUNT }, (_, i) => {
    const paymentDate = spreadDate(i, COUNT, 12, 0);
    const direction = i % 2 === 0 ? "IN" : "OUT";
    return {
      vendor: vendor._id,
      amount: rand(500, 75000),
      paymentDate,
      bank: cycle(BANKS, i),
      paymentType: cycle(PAYMENT_TYPES, i),
      direction,
      reference: `${direction === "IN" ? "RCPT" : "PAYT"}-${paymentDate.getFullYear()}-${String(i + 1).padStart(5, "0")}`,
      notes: `${direction === "IN" ? "Received from" : "Paid to"} ${vendor.name} against invoice INV-${1000 + i}.`,
      user: user._id,
      organization: org,
      createdAt: paymentDate,
      updatedAt: paymentDate,
    };
  });

  /* ── NOTES ──
     Read by: vendor/NoteSection. Content is HTML because the editor is ReactQuill
     and the card/viewer render it via dangerouslySetInnerHTML. createdAt/updatedAt
     are spread so the list (sorted by updatedAt desc) isn't 50 identical timestamps. */
  const notes = Array.from({ length: COUNT }, (_, i) => {
    const at = spreadDate(i, COUNT, 10, 0);
    return {
      vendor: vendor._id,
      note:
        `<h3>${cycle(["Follow-up", "Call summary", "Contract", "Delivery", "Compliance"], i)} — note #${i + 1}</h3>` +
        `<p>${cycle(NOTE_BODIES, i)}</p>` +
        `<p>Owner: ${user.name || user.email}. Reviewed on ${at.toLocaleDateString("en-IN")}.</p>`,
      user: user._id,
      organization: org,
      createdAt: at,
      updatedAt: at,
    };
  });

  /* ── TASKS ──
     Read by: VendorTasksTable (title, description, status, dueDate, users[].name)
     and TaskDetailsModal (priority, selectedDate, relatedEntities, createdBy,
     createdAt). Statuses cycle over all 3 so the status filter and the
     Pending/Completed summary tiles are all populated. */
  const tasks = Array.from({ length: COUNT }, (_, i) => {
    const dueDate = spreadDate(i, COUNT, 2, 2);
    const createdAt = new Date(dueDate.getTime() - rand(2, 20) * DAY);
    return {
      title: `${cycle(TASK_TITLES, i)} — ${vendor.name} #${i + 1}`,
      description: `Seeded task ${i + 1} of ${COUNT}. Verify order #${1000 + i} and confirm the outcome with the vendor contact.`,
      dueDate,
      selectedDate: dueDate,
      status: cycle(TASK_STATUSES, i),
      priority: cycle(PRIORITIES, i),
      relatedEntities: [{ entityId: vendor._id, entityModel: "Vendor" }],
      users: [user._id],
      createdBy: user._id,
      organization: org,
      createdAt,
      updatedAt: createdAt,
    };
  });

  /* ── MEETINGS ──
     Read by: VendorMeetingsTable (title, description, status, scheduledAt,
     duration, meetingType, priority) and MeetingDetailsModal (participants,
     vendor, createdBy). Statuses cycle over all 4 so every summary tile
     (Scheduled / Completed / Cancelled / No Show) has a non-zero count. */
  const meetings = Array.from({ length: COUNT }, (_, i) => {
    const scheduledAt = spreadDate(i, COUNT, 3, 2);
    const status = cycle(MEETING_STATUSES, i);
    const type = cycle(MEETING_TYPES, i);
    return {
      title: `${cycle(MEETING_TITLES, i)} — ${vendor.name} #${i + 1}`,
      description: `Seeded meeting ${i + 1} of ${COUNT}. Agenda: pricing, delivery SLA, and open escalations.`,
      scheduledAt,
      duration: cycle([30, 45, 60, 90], i),
      priority: cycle(PRIORITIES, i),
      status,
      meetingType: type,
      location:
        type === "in-person"
          ? `${vendor.address?.city || cycle(CITIES, i)} office, Meeting Room ${(i % 6) + 1}`
          : type === "video-call"
            ? `https://meet.example.com/${vendor._id.toString().slice(-6)}-${i + 1}`
            : vendor.phone || "+91-00000-00000",
      notes: `Discussion points captured for session ${i + 1}.`,
      outcome: status === "completed" ? cycle(MEETING_OUTCOMES, i) : undefined,
      linkedTo: "vendor",
      vendor: vendor._id,
      participants: [],
      reminderAt: new Date(scheduledAt.getTime() - 60 * 60 * 1000),
      reminderSent: scheduledAt < new Date(),
      createdBy: user._id,
      organization: org,
      createdAt: new Date(scheduledAt.getTime() - rand(3, 25) * DAY),
      updatedAt: scheduledAt,
    };
  });

  // `timestamps: false` so our explicit createdAt/updatedAt survive — otherwise
  // Mongoose stamps every document with "now" and the lists show 50 identical dates.
  const opts = { timestamps: false };
  await Payment.insertMany(payments, opts);
  console.log(`Created ${payments.length} payments.`);
  await VendorNote.insertMany(notes, opts);
  console.log(`Created ${notes.length} notes.`);
  await Task.insertMany(tasks, opts);
  console.log(`Created ${tasks.length} tasks.`);
  await Meeting.insertMany(meetings, opts);
  console.log(`Created ${meetings.length} meetings.`);

  /* ── Reconcile vendor.balance ──
     addPaymentForVendor keeps vendor.balance in step with each payment, but bulk
     inserts bypass that. VendorDetailsPageNew's Net Balance tile prefers
     vendor.balance over the computed total, so without this the tile would
     contradict the Total Received / Total Paid tiles right next to it. */
  const all = await Payment.find({ vendor: vendor._id, organization: org }).select("amount direction").lean();
  const balance = all.reduce((sum, p) => sum + (p.direction === "IN" ? p.amount : -p.amount), 0);
  await Vendor.updateOne({ _id: vendor._id }, { $set: { balance } });
  console.log(`Recomputed vendor.balance across ${all.length} payments: ${balance}`);

  console.log("\nDone. Open the vendor at /vendors-new/" + vendor._id);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
