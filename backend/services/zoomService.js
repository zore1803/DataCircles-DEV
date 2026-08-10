// Zoom Server-to-Server OAuth integration. Creates a real Zoom meeting and
// returns its join URL, so the CRM's meeting "location" field can hold a
// working video-call link instead of the client-side Jitsi fallback.
//
// Requires three env vars (Zoom Marketplace > your app > App Credentials):
//   ZOOM_ACCOUNT_ID
//   ZOOM_CLIENT_ID
//   ZOOM_CLIENT_SECRET
// If any are missing, isZoomConfigured() returns false and callers should
// fall back to the client-side link generator rather than erroring.

const axios = require("axios");

const {
  ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET,
} = process.env;

function isZoomConfigured() {
  return Boolean(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);
}

// Server-to-Server OAuth tokens are short-lived (1hr); cache and refresh
// slightly before expiry rather than fetching one per meeting created.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const basicAuth = Buffer.from(
    `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  const res = await axios.post(
    "https://zoom.us/oauth/token",
    null,
    {
      params: {
        grant_type: "account_credentials",
        account_id: ZOOM_ACCOUNT_ID,
      },
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    }
  );

  cachedToken = res.data.access_token;
  // Refresh 60s before actual expiry to avoid a request landing right on
  // the boundary.
  cachedTokenExpiresAt = Date.now() + (res.data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Creates a Zoom meeting and returns its join URL.
 * @param {{ topic: string, startTime: Date|string, durationMinutes: number }} params
 * @returns {Promise<{ joinUrl: string, meetingId: string }>}
 */
async function createZoomMeeting({ topic, startTime, durationMinutes }) {
  const token = await getAccessToken();

  const res = await axios.post(
    "https://api.zoom.us/v2/users/me/meetings",
    {
      topic: topic || "Meeting",
      type: 2, // scheduled meeting
      start_time: startTime ? new Date(startTime).toISOString() : undefined,
      duration: durationMinutes || 30,
      settings: {
        join_before_host: true,
        waiting_room: false,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return {
    joinUrl: res.data.join_url,
    meetingId: String(res.data.id),
  };
}

module.exports = { isZoomConfigured, createZoomMeeting };
