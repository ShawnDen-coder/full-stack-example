export class JobBackendUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Job backend unavailable", { cause });
    this.name = "JobBackendUnavailableError";
  }
}
