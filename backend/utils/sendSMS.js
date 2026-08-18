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
    throw new Error(response.data?.message?.[0] || "Fast2SMS returned failure");
  }

  return response.data;
}

module.exports = sendSMS;
