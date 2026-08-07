/*
 * Drops the retired `documentSigned` field from every Company document.
 *
 * The field (and its "Accepted"/"Pending" column, search shortcut, and form
 * checkbox) has been removed from the app; this clears the leftover data so
 * it doesn't linger in the collection or get exported/read by anything that
 * still expects it.
 *
 *   node scripts/removeDocumentSignedField.js            # dry run
 *   node scripts/removeDocumentSignedField.js --apply
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  // Raw collection, not the Mongoose model: the model no longer declares this
  // field, so $unset has to be issued directly against the collection.
  const companies = mongoose.connection.collection('companies');

  const count = await companies.countDocuments({
    documentSigned: { $exists: true },
  });
  console.log(`${count} compan${count === 1 ? "y has" : "ies have"} documentSigned set.`);

  if (APPLY) {
    const result = await companies.updateMany(
      { documentSigned: { $exists: true } },
      { $unset: { documentSigned: "" } }
    );
    console.log(`Removed the field from ${result.modifiedCount} document(s).`);
  } else {
    console.log('DRY RUN — re-run with --apply to remove it.');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
