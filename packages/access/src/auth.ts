import {
	createAccessControl,
	type Statements,
} from "better-auth/plugins/access";
import { defaultStatements as adminStatements } from "better-auth/plugins/admin/access";
import { defaultStatements as organizationStatements } from "better-auth/plugins/organization/access";
import { pageKeys } from "./index";

export const pagePermissions = Object.fromEntries(
	pageKeys.map((key) => [key, ["read"]]),
);
const statements: Statements = {
	...organizationStatements,
	...pagePermissions,
};
export const ac = createAccessControl(statements);
// Identity roles are static; editable roles contain page permissions only.
export const organizationRoles = {
	owner: ac.newRole({
		...pagePermissions,
		member: ["update"],
		ac: ["create", "read", "update", "delete"],
	}),
	admin: ac.newRole({
		...pagePermissions,
		member: ["update"],
		ac: ["create", "read", "update", "delete"],
	}),
	member: ac.newRole({ ac: ["read"] }),
};
export const adminAccess = createAccessControl(adminStatements as Statements);
export const authRoles = {
	user: adminAccess.newRole({}),
	superadmin: adminAccess.newRole({
		user: ["list", "get", "ban"],
		session: ["list", "revoke"],
	}),
};
