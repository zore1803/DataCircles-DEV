const axios = require("axios");

/**
 * Send a transactional SMS via Fast2SMS.
 * @param {object} opts
 * @param {string|string[]} opts.phone   - 10-digit mobile number(s), no country code
 * @param {string}           opts.message - plain text message (max ~160 chars for single SMS)
 */
async function sendSMS({ phone, message }) {
  const numbers = Array.isArray(phone) ? phone.join(",") : String(phone).replace(/^\+91/, "").replace(/\D/g, "");

  if (!numbers) throw new Error("Phone number is required for SMS");
  if (!process.env.FAST2SMS_KEY) throw new Error("FAST2SMS_KEY not set in environment");

  const response = await axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    {
      route: "q",          // quick transactional route
      message,
      language: "english",
      flash: 0,
      numbers,
    },
    {
      headers: {
        authorization: process.env.FAST2SMS_KEY,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );

  if (!response.data?.return) {
    // `message` is an array on the normal bulkV2 reject shape, but a plain
    // string on some account-level failures (e.g. Fast2SMS's "complete a 100
    // INR transaction" restriction) — indexing with [0] unconditionally would
    // silently truncate that string down to its first character.
    const msg = response.data?.message;
    throw new Error((Array.isArray(msg) ? msg[0] : msg) || "Fast2SMS returned failure");
  }

  return response.data;
}

module.exports = sendSMS;
