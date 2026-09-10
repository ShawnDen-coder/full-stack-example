import type { HealthResponse } from "./schemas.js";

export async function getHealth(
  checkDatabase: () => Promise<void>,
  timeoutMs = 5_000,
): Promise<HealthResponse> {
  const timestamp = new Date().toISOString();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      checkDatabase(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Health probe timed out")), timeoutMs);
      }),
    ]);
    return { status: "ok", services: { database: { status: "up" } }, timestamp };
  } catch {
    return { status: "degraded", services: { database: { status: "down" } }, timestamp };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
