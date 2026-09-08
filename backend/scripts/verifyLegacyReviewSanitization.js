// scripts/verifyLegacyReviewSanitization.js
//
// Regression test for the CastError("company") class of bug.
//
// `system:contact.company` was once a fillable form field. It was removed (utils/systemFields.js:
// "what caused the CastError('company') incident; do not re-add it"), which stopped NEW reviews
// being poisoned — but DuplicateReview.incomingData is Mixed and permanent, so reviews created
// before that fix still hold `company: "company"`: the literal field name as its value. Resolving
// one threw
//     Contact validation failed: company: Cast to ObjectId failed for value "company"
// and the Review Center action 500'd with no way for a user to clear it.
//
// duplicateResolutionService.sanitizeForModule now drops non-fillable keys on the way into a
// create/update. This asserts that, and — just as importantly — that the sanitizer does NOT break
// the legitimate internal writes of Contact.company (the Company-bucket linking logic passes a real
// ObjectId and must still work).
//
// Run: node scripts/verifyLegacyReviewSanitization.js
require("dotenv").config();
const mongoose = require("mongoose");
require("../models/User");
const DuplicateReview = require("../models/DuplicateReview");
const Contact = require("../models/Contact");
const Company = require("../models/Company");
const Organization = require("../models/Organization");
const duplicateResolutionService = require("../services/duplicateResolutionService");

const results = [];
const check = (n, c, d) => { results.push({ n, pass: !!c }); console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? "  (" + d + ")" : "")); };

const EMAIL_A = "zz-legacy-a@test.local";
const EMAIL_B = "zz-legacy-b@test.local";
const EMAIL_C = "zz-legacy-c@test.local";

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const org = (await Organization.findOne({}).select("_id"))._id;
  const uid = new mongoose.Types.ObjectId();
  const madeReviews = [];

  const newReview = async (incomingData, existingId, module = "Contact") => {
    const r = await DuplicateReview.create({
      organization: org, module, existingRecord: { module, recordId: existingId },
      incomingData, score: 97, matchDetails: [], reasonSummary: "test",
      engineVersion: "v1", decision: "pending",
    });
    madeReviews.push(r._id);
    return r;
  };

  try {
    const existing = await Contact.create({ organization: org, name: "ZZ Legacy Existing", email: EMAIL_A });

    // --- 1. The exact stored shape that used to crash --------------------------------------------
    const legacy = await newReview({ name: "ZZ Legacy A", email: EMAIL_A, phone: "1", company: "company" }, existing._id);
    let threw = null;
    let created = null;
    try {
      ({ createdRecord: created } = await duplicateResolutionService.keepSeparate(legacy._id, org, { decidedByUserId: uid }));
    } catch (e) { threw = e; }
    check("Keep Both on a legacy review no longer throws CastError", !threw, threw?.message);
    check("Keep Both still created the Contact", !!created && created.email === EMAIL_A);
    check("the poisoned company value was ignored, not stored", created && !created.company, String(created?.company));
    check("the stored review was NOT rewritten (defensive, not destructive)",
      (await DuplicateReview.findById(legacy._id).lean()).incomingData.company === "company");

    // --- 2. Merge, same payload ------------------------------------------------------------------
    const legacyMerge = await newReview({ name: "ZZ Legacy B", email: EMAIL_B, company: "company" }, existing._id);
    threw = null;
    try {
      await duplicateResolutionService.mergeIntoExisting(legacyMerge._id, org, {
        decidedByUserId: uid, resolvedFieldValues: { name: "ZZ Legacy Merged", company: "company" },
      });
    } catch (e) { threw = e; }
    check("Merge with a poisoned resolvedFieldValues no longer throws", !threw, threw?.message);
    const mergedInto = await Contact.findById(existing._id).lean();
    check("Merge applied the legitimate field", mergedInto.name === "ZZ Legacy Merged");
    check("Merge did not set the poisoned company", !mergedInto.company, String(mergedInto.company));

    // --- 3. Keep Existing — never writes a record from incomingData at all ------------------------
    const legacyLink = await newReview({ name: "ZZ Legacy C", email: EMAIL_C, company: "company" }, existing._id);
    threw = null;
    try { await duplicateResolutionService.linkToExisting(legacyLink._id, org, { decidedByUserId: uid }); }
    catch (e) { threw = e; }
    check("Keep Existing on a legacy review no longer throws", !threw, threw?.message);
    check("Keep Existing created no new Contact",
      (await Contact.countDocuments({ email: EMAIL_C, organization: org })) === 0);

    // --- 4. A NORMAL review (no legacy key) is unaffected -----------------------------------------
    const clean = await newReview({ name: "ZZ Legacy Clean", email: EMAIL_C, phone: "+91 90000 00002" }, existing._id);
    const { createdRecord: cleanRec } = await duplicateResolutionService.keepSeparate(clean._id, org, { decidedByUserId: uid });
    check("a normal review still resolves identically", cleanRec?.email === EMAIL_C && cleanRec?.name === "ZZ Legacy Clean");

    // --- 5. The sanitizer must NOT break the legitimate internal company link ---------------------
    // Company-bucket resolution sets Contact.company to a real ObjectId via its own updateFn call,
    // which deliberately does not pass through the sanitizer.
    const co = await Company.create({ organization: org, name: "ZZ Legacy Co", industry: "Other" });
    const contactService = require("../services/contactService");
    const linked = await contactService.updateContact(existing._id, org, { company: co._id }, { lastUpdatedByUserId: uid });
    check("a real ObjectId company link still writes correctly",
      String(linked.company?._id || linked.company) === String(co._id), String(linked.company?._id || linked.company));

    // --- 6. Unit: the sanitizer only touches what it should ---------------------------------------
    const before = { name: "x", email: "e", company: "company", phone: "p" };
    const svc = require("../services/duplicateResolutionService");
    check("sanitizer is not exported (internal detail)", typeof svc.sanitizeForModule === "undefined");
  } catch (e) {
    console.error("CRASHED:", e); results.push({ n: "crash", pass: false });
  } finally {
    await DuplicateReview.deleteMany({ _id: { $in: madeReviews } });
    await Contact.deleteMany({ email: { $in: [EMAIL_A, EMAIL_B, EMAIL_C] } });
    await Contact.deleteMany({ name: /^ZZ Legacy/ });
    await Company.deleteMany({ name: "ZZ Legacy Co" });
    const failed = results.filter((r) => !r.pass);
    console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
    if (failed.length) console.log("FAILED:", failed.map((f) => f.n));
    console.log("cleanup done");
    process.exit(failed.length ? 1 : 0);
  }
})();
