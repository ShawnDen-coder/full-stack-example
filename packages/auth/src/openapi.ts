type OpenApiValue = Record<string, unknown>;

export type AuthOpenApiDocument = {
  readonly paths?: Record<string, OpenApiValue>;
  readonly components?: OpenApiValue;
  readonly [key: string]: unknown;
};

const documentedAuthPaths = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  "/organization/list",
  "/organization/create",
  "/organization/set-active",
]);
const publicAuthPaths = new Set(["/sign-up/email", "/sign-in/email"]);
const httpMethods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

function record(value: unknown): OpenApiValue {
  return value && typeof value === "object" ? (value as OpenApiValue) : {};
}

function collectComponentRefs(value: unknown, refs: Map<string, Set<string>>) {
  if (typeof value === "string") {
    const match = value.match(/^#\/components\/([^/]+)\/([^/]+)$/);
    if (match) {
      const section = match[1];
      const name = match[2];
      if (!section || !name) return;
      const sectionRefs = refs.get(section) ?? new Set<string>();
      sectionRefs.add(name);
      refs.set(section, sectionRefs);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectComponentRefs(item, refs);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectComponentRefs(item, refs);
  }
}

function pruneComponents(document: AuthOpenApiDocument, paths: Record<string, OpenApiValue>) {
  const source = record(document.components);
  const refs = new Map<string, Set<string>>();
  collectComponentRefs(paths, refs);
  const result: OpenApiValue = {};
  const pending = [...refs.entries()].flatMap(([section, names]) =>
    [...names].map((name) => ({ section, name })),
  );
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    const key = `${current.section}/${current.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const value = record(source[current.section])[current.name];
    if (value === undefined) continue;
    const section = record(result[current.section]);
    section[current.name] = value;
    result[current.section] = section;
    const nested = new Map<string, Set<string>>();
    collectComponentRefs(value, nested);
    for (const [nestedSection, names] of nested) {
      for (const name of names) pending.push({ section: nestedSection, name });
    }
  }
  const securitySchemes = record(source.securitySchemes);
  if (securitySchemes.apiKeyCookie !== undefined)
    result.securitySchemes = { apiKeyCookie: securitySchemes.apiKeyCookie };
  return result;
}

export function normalizeAuthOpenApiDocument(document: AuthOpenApiDocument): AuthOpenApiDocument {
  const paths: Record<string, OpenApiValue> = {};
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (!documentedAuthPaths.has(path)) continue;
    const security = publicAuthPaths.has(path) ? [] : [{ apiKeyCookie: [] }];
    const operations: OpenApiValue = {};
    for (const [method, operation] of Object.entries(item)) {
      if (!httpMethods.has(method) || !operation || typeof operation !== "object") continue;
      operations[method] = { ...record(operation), security };
    }
    paths[`/api/auth${path}`] = operations;
  }
  return {
    paths,
    components: pruneComponents(document, paths),
  };
}
