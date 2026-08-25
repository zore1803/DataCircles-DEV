import API from './api';

let cachedSettings = null;
let fetchPromise = null;

/**
 * Fetches the organization's document settings.
 * Caches the result in-memory so subsequent calls across different
 * pages or components in the same session return instantly without
 * a network round-trip.
 *
 * (The cache resets on full page reload, which is sufficient since
 * this is mainly used by download handlers that just need the latest
 * saved format).
 */
export const getDocumentSettings = async (forceRefresh = false) => {
  if (forceRefresh) {
    cachedSettings = null;
    fetchPromise = null;
  }

  if (cachedSettings) {
    return cachedSettings;
  }

  if (!fetchPromise) {
    fetchPromise = API.get('/document-settings')
      .then((res) => {
        cachedSettings = res.data;
        return cachedSettings;
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }

  return fetchPromise;
};
