export interface ApiErrorShape {
  readonly status: number;
  readonly message: string;
  readonly requestId?: string;
}

export class ApiError extends Error implements ApiErrorShape {
  readonly status: number;
  readonly requestId?: string;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = "ApiError";
    this.status = shape.status;
    if (shape.requestId) this.requestId = shape.requestId;
  }
}

/** Throw a normalized error for a non-successful HTTP response. */
export async function throwApiError(response: Response): Promise<never> {
  let message = `Request failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    )
      message = body.error;
  } catch {}
  const requestId = response.headers.get("X-Request-ID");
  throw new ApiError({ status: response.status, message, ...(requestId ? { requestId } : {}) });
}
