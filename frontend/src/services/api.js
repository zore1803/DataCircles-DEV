// services/api.js
import axios from "axios";

const API = axios.create({
  baseURL: `${import.meta.env.VITE_APP_API_URL}/api`,
  timeout: 30000, // 30 second timeout for production
  // Required so the dc_session HttpOnly cookie (DataCircles application
  // session — see backend/services/sessionService.js) is sent on
  // cross-site requests; frontend and backend are on different domains in
  // every environment this app deploys to.
  withCredentials: true,
});

// Token refresh management
let getAccessTokenSilently = null;
let isRefreshing = false;
let failedQueue = [];

// In-memory only — never localStorage. This is the double-submit CSRF
// token derived server-side from the session's csrfSecret
// (backend/services/sessionService.js deriveCsrfToken); it authorizes
// mutating requests once a DataCircles session cookie is set.
let csrfToken = null;

export const setCsrfToken = (token) => {
  csrfToken = token;
};

/**
 * Establishes a DataCircles application session after Auth0 login or phone
 * OTP verification succeeds. Sets the dc_session HttpOnly cookie and
 * returns the CSRF token for mutating requests. Surfaces a
 * SESSION_LIMIT_REACHED error distinctly so callers can show the
 * "maximum 2 active sessions" message instead of a generic failure.
 */
export const establishSession = async () => {
  try {
    const res = await API.post("/session/establish");
    setCsrfToken(res.data.csrfToken);
    return res.data;
  } catch (error) {
    if (error.response?.data?.code === "SESSION_LIMIT_REACHED") {
      const limitError = new Error(error.response.data.message);
      limitError.code = "SESSION_LIMIT_REACHED";
      throw limitError;
    }
    throw error;
  }
};

/**
 * Process the queue of failed requests after token refresh
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Configure Axios with Auth0 token getter function
 */
export const configureAxios = (tokenFunction) => {
  getAccessTokenSilently = tokenFunction;
};

/**
 * Request Interceptor - Add authentication tokens to headers
 */
API.interceptors.request.use(
  async (config) => {
    try {
      // Attach the CSRF token on mutating requests once a DataCircles
      // session has been established (see establishSession above). Safe
      // methods don't need it; the backend's csrfCheck middleware only
      // enforces it on routes that opt into sessionAuth.
      const method = (config.method || "get").toLowerCase();
      if (csrfToken && !["get", "head", "options"].includes(method)) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }

      // If Authorization header is already set (e.g., tempToken), don't override it
      if (config.headers.Authorization) {
        return config;
      }

      // Priority 1: Check for phone token
      const phoneToken = localStorage.getItem("token");
      if (phoneToken) {
        config.headers["x-phone-token"] = phoneToken;
        return config;
      }

      // Priority 2: Check for super admin token
      const superAdminToken = localStorage.getItem("superAdminToken");
      if (superAdminToken) {
        config.headers.Authorization = `Bearer ${superAdminToken}`;
        return config;
      }

      // Priority 3: Use Auth0 token
      if (getAccessTokenSilently) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_APP_AUTH0_AUDIENCE,
            scope: "openid profile email",
          },
        });

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error("Error getting access token:", error);
      // Don't throw - let the request proceed and fail at the server level
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor - Handle 401 errors and retry with fresh token
 */
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry for specific endpoints to avoid infinite loops
      const noRetryEndpoints = ["/auth/me", "/auth/login", "/auth/logout"];
      const shouldSkipRetry = noRetryEndpoints.some((endpoint) =>
        originalRequest.url?.includes(endpoint)
      );

      if (shouldSkipRetry) {
        return Promise.reject(error);
      }

      // Check authentication type
      const phoneToken = localStorage.getItem("token");
      const superAdminToken = localStorage.getItem("superAdminToken");

      // Phone auth and super admin can't be refreshed - fail immediately
      if (phoneToken || superAdminToken) {
        return Promise.reject(error);
      }

      // Handle Auth0 token refresh with queue
      if (getAccessTokenSilently) {
        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return API(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        // Mark this request as a retry to prevent infinite loops
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Get fresh token from Auth0
          const newToken = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_APP_AUTH0_AUDIENCE,
              scope: "openid profile email",
            },
            cacheMode: "off", // Force fresh token, bypass cache
          });

          if (newToken) {
            // Update the failed request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;

            // Process all queued requests with new token
            processQueue(null, newToken);

            // Retry the original request
            return API(originalRequest);
          }
        } catch (refreshError) {
          // Token refresh failed - reject all queued requests
          processQueue(refreshError, null);

          // Clear tokens and redirect to login
          console.error("Token refresh failed:", refreshError);
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          // Only redirect if not already on login page
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    // Handle other errors or non-401 responses
    return Promise.reject(error);
  }
);

/**
 * Optional: Add request retry logic for network errors
 */
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;

    // Retry on network errors (not 4xx/5xx)
    if (!error.response && config && !config.__isRetryRequest) {
      config.__isRetryRequest = true;
      config.__retryCount = config.__retryCount || 0;

      // Retry up to 2 times with exponential backoff
      if (config.__retryCount < 2) {
        config.__retryCount += 1;
        const delayMs = Math.pow(2, config.__retryCount) * 1000; // 2s, 4s

        console.log(
          `Network error, retrying request (${config.__retryCount}/2)...`
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return API(config);
      }
    }

    return Promise.reject(error);
  }
);

export default API;
