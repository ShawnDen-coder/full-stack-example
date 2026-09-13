import { throwApiError } from "../../lib/api-error.js";
import { systemApi } from "./client.js";

export async function getHealth() {
  const response = await systemApi.health.$get();
  if (response.status === 200 || response.status === 503) return response.json();
  return throwApiError(response);
}
