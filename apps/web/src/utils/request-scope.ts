let identity: string | null | undefined;
let workspace: string | undefined;
let generation = 0;

export const scopeTicket = () => generation;
export const isScopeCurrent = (userId: string | null, ticket: number) =>
	identity === userId && ticket === generation;

export function updateWorkspaceScope(workspaceId: string | undefined) {
	if (workspace === workspaceId) return false;
	workspace = workspaceId;
	generation++;
	return true;
}

export function updateIdentityScope(userId: string | null) {
	if (identity === userId) return false;
	identity = userId;
	generation++;
	return true;
}

export function invalidateIdentityScope() {
	identity = undefined;
}
