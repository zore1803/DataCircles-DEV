import { useAuth0 } from "@auth0/auth0-react";
import API, { configureAxios } from "../services/api";

export const fetchResourceById = async (id) => {
    const { getAccessTokenSilently } = useAuth0();
  if (!id) {
    console.error("fetchResourceById: Missing id");
    return null;
  }
  console.log(id)
  configureAxios(getAccessTokenSilently);
  const endpoints = ["contacts", "companies", "deals", "vendors", "auth"];

  for (const type of endpoints) {
    try {
      const response = await API.get(`/${type}/${id}`);
      if (response?.data) {
        return { type, data: response.data };
      }
    } catch (err) {
      // Continue to next endpoint silently if 404 or similar
      if (err?.response?.status !== 404) {
        console.warn(`Error checking ${type}:`, err.message);
      }
    }
  }

  // If no resource found in any endpoint
  return null;
};
