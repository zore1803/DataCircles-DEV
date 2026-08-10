// Google Meet integration via the Calendar API — a Meet link only exists as
// a side-effect of a Calendar event with conferencing enabled, there's no
// standalone "create a Meet link" endpoint.
//
// Shared-account model: one Google account (whoever completes the one-time
// OAuth consent at GET /api/auth/google/connect) owns every generated
// meeting. Its refresh token is stored in GoogleIntegration, keyed by
// organization, and reused to mint short-lived access tokens on demand.
//
// Requires in backend/.env:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI   (e.g. http://localhost:5000/api/auth/google/callback)

const { google } = require("googleapis");
const GoogleIntegration = require("../models/GoogleIntegration");

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

function isGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

// Step 1 of the one-time consent flow — where GET /api/auth/google/connect
// sends the browser. access_type: "offline" + prompt: "consent" are both
// required to actually get a refresh_token back (Google only issues one on
// the first consent, or when explicitly re-prompted).
function getAuthUrl(state) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });
}

// Step 2 — the callback exchanges the one-time code for tokens and persists
// the refresh token so future meeting creation needs no further login.
async function connectAccount({ code, organizationId, userId }) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke this app's access at " +
      "https://myaccount.google.com/permissions and try connecting again " +
      "(Google only issues a refresh token on first consent)."
    );
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();

  await GoogleIntegration.findOneAndUpdate(
    { organization: organizationId },
    {
      organization: organizationId,
      connectedEmail: profile.email,
      refreshToken: tokens.refresh_token,
      connectedBy: userId,
    },
    { upsert: true, new: true },
  );

  return { email: profile.email };
}

async function getAuthorizedClientForOrg(organizationId) {
  const integration = await GoogleIntegration.findOne({ organization: organizationId });
  if (!integration) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: integration.refreshToken });
  return oauth2Client;
}

/**
 * Creates a Calendar event with Google Meet conferencing and returns the
 * join link. Returns null if this organization hasn't connected a Google
 * account yet, rather than throwing — callers should treat that the same
 * as "not configured" and fall back to another link source.
 */
async function createGoogleMeetEvent({ organizationId, title, startTime, durationMinutes }) {
  const oauth2Client = await getAuthorizedClientForOrg(organizationId);
  if (!oauth2Client) return null;

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const start = startTime ? new Date(startTime) : new Date();
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60000);

  const { data: event } = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: title || "Meeting",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  return {
    joinUrl: event.hangoutLink,
    eventId: event.id,
  };
}

module.exports = {
  isGoogleConfigured,
  getAuthUrl,
  connectAccount,
  createGoogleMeetEvent,
};
