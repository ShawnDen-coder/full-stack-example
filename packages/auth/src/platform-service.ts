import type { PlatformAuthService } from "./contracts.js";

export type { PlatformAuthService } from "./contracts.js";

export function asPlatformAuthService(service: PlatformAuthService): PlatformAuthService {
  return service;
}
