import type { HealthResponse } from "./schemas.js";

export async function getHealth(checkDatabase: () => Promise<void>): Promise<HealthResponse> {
  const timestamp = new Date().toISOString();
  try {
    await checkDatabase();
    return { status: "ok", services: { database: { status: "up" } }, timestamp };
  } catch {
    return { status: "degraded", services: { database: { status: "down" } }, timestamp };
  }
}
