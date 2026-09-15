export type SignOutActions = {
  readonly requestSignOut: () => Promise<{ readonly error?: unknown | null }>;
  readonly clearTenantQueries: () => Promise<unknown>;
  readonly refreshSession: () => Promise<unknown>;
  readonly invalidateRouter: () => Promise<unknown>;
  readonly navigateToLogin: () => Promise<unknown>;
};

export async function performSignOut(actions: SignOutActions): Promise<boolean> {
  try {
    const result = await actions.requestSignOut();
    if (result.error) return false;
    await actions.clearTenantQueries();
    await actions.refreshSession();
    await actions.invalidateRouter();
    await actions.navigateToLogin();
    return true;
  } catch {
    return false;
  }
}



