// Google Meet integration via the Calendar API — a Meet link only exists as
// a side-effect of a Calendar event with conferencing enabled, there's no
// standalone "create a Meet link" endpoint.
//
// Two ways to configure the shared Google account this runs under:
//
//   1. Static refresh token (simplest — use this if you already have one,
//      e.g. from Google's OAuth Playground): set
//        GOOGLE_OAUTH_CLIENT_ID
//        GOOGLE_OAUTH_CLIENT_SECRET
//        GOOGLE_OAUTH_REFRESH_TOKEN
//      and every meeting uses it immediately — no "Connect Google Account"
//      click needed, isGoogleConnected() reports true right away.
//
//   2. Per-organization OAuth consent flow (GET /api/auth/google/connect +
//      /callback in authController.js): set
//        GOOGLE_CLIENT_ID
//        GOOGLE_CLIENT_SECRET
//        GOOGLE_REDIRECT_URI
//      A user clicks "Connect Google Account" once; the refresh token that
//      flow gets back is stored per-organization in GoogleIntegration.
//
// The static token takes priority when present, since it needs no consent
// step from anyone.

const { google } = require("googleapis");
const GoogleIntegration = require("../models/GoogleIntegration");

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
} = process.env;

const hasStaticToken = Boolean(
  (GOOGLE_OAUTH_CLIENT_ID || GOOGLE_CLIENT_ID) &&
  (GOOGLE_OAUTH_CLIENT_SECRET || GOOGLE_CLIENT_SECRET) &&
  GOOGLE_OAUTH_REFRESH_TOKEN
);

// Whichever client id/secret pair is present — static-token setups often
// use a different Google Cloud project than the per-org consent flow, so
// these intentionally aren't assumed to match.
const staticClientId = GOOGLE_OAUTH_CLIENT_ID || GOOGLE_CLIENT_ID;
const staticClientSecret = GOOGLE_OAUTH_CLIENT_SECRET || GOOGLE_CLIENT_SECRET;

function isGoogleConfigured() {
  return hasStaticToken || Boolean(staticClientId && staticClientSecret && GOOGLE_REDIRECT_URI);
}

// Used by GET /api/auth/google/status so the frontend can hide "Connect
// Google Account" when a static token already makes the connect flow
// unnecessary.
function isGoogleConnectedByDefault() {
  return hasStaticToken;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    staticClientId,
    staticClientSecret,
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
    // calendar.events creates the Meet-enabled events; userinfo.email is
    // needed separately because connectAccount() below calls the Google
    // OAuth2 userinfo endpoint (a different API) to show which account got
    // connected — without this scope that call 401s even though the
    // Calendar scope was granted fine.
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
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
  // Static token short-circuits the per-org DB lookup entirely.
  if (hasStaticToken) {
    const oauth2Client = new google.auth.OAuth2(staticClientId, staticClientSecret);
    oauth2Client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
    return oauth2Client;
  }

  const integration = await GoogleIntegration.findOne({ organization: organizationId });
  if (!integration) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: integration.refreshToken });
  return oauth2Client;
}

/**
 * Creates a Calendar event with Google Meet conferencing and returns the
 * join link. Returns null if this organization hasn't connected a Google
 * account yet (and no static token is set), rather than throwing — callers
 * should treat that the same as "not configured" and fall back to another
 * link source.
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
  isGoogleConnectedByDefault,
  getAuthUrl,
  connectAccount,
  createGoogleMeetEvent,
};
