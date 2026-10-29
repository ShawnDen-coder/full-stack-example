// Adapted from Better Auth UI (MIT); see third-party/better-auth-ui.md.
import { validateStringLength } from "@better-auth-ui/core";
import type { OrganizationRolesAuthClient } from "@better-auth-ui/core/plugins/organization";
import { useAuth, useAuthPlugin } from "@better-auth-ui/react";
import {
	useCreateRole,
	useHasPermission,
	useUpdateRole,
} from "@better-auth-ui/react/plugins/organization";
import { Button } from "@full-stack-example/ui/components/button";
import { Checkbox } from "@full-stack-example/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@full-stack-example/ui/components/dialog";
import { Input } from "@full-stack-example/ui/components/input";
import { useEffect } from "react";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/auth/field";
import { organizationPlugin } from "@/lib/auth/organization-plugin";
import { isAuthFormFieldInvalid, useAuthForm } from "../auth-form";
export type Role = {
	id: string;
	role: string;
	permission: Record<string, string[]>;
};
export function RoleDialog({
	onOpenChange,
	open,
	organizationId,
	registry,
	role,
	onCloseAutoFocus,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	organizationId: string;
	registry: Record<string, { label?: string; actions: Record<string, string> }>;
	role?: Role;
	onCloseAutoFocus?: React.ComponentProps<
		typeof DialogContent
	>["onCloseAutoFocus"];
}) {
	const { authClient, localization: authLocalization } =
		useAuth<OrganizationRolesAuthClient>();
	const { localization } = useAuthPlugin(organizationPlugin);
	const createRole = useCreateRole(authClient, organizationId, {
		onError: (error) => toast.error(error.message),
		onSuccess: () => {
			toast.success(localization.roleCreated);
			onOpenChange(false);
		},
	});
	const updateRole = useUpdateRole(authClient, organizationId, {
		onError: (error) => toast.error(error.message),
		onSuccess: () => {
			toast.success(localization.roleUpdated);
			onOpenChange(false);
		},
	});

	const form = useAuthForm({
		defaultValues: {
			name: role?.role ?? "",
			permission: role?.permission ?? ({} as Record<string, string[]>),
		},
		onSubmit: async ({ value }) => {
			const roleName = value.name.trim();
			if (!roleName) return;

			try {
				if (
					Object.values(value.permission).some((actions) => actions.length > 0)
				) {
					const access = await authClient.organization.hasPermission({
						organizationId,
						permissions: value.permission as Parameters<
							OrganizationRolesAuthClient["organization"]["hasPermission"]
						>[0]["permissions"],
					});

					if (access.error || !access.data?.success) {
						toast.error(localization.permissionsLimitedDescription);
						return;
					}
				}

				if (role) {
					await updateRole.mutateAsync({
						organizationId,
						roleId: role.id,
						data: {
							permission: value.permission,
						},
					});
				} else {
					await createRole.mutateAsync({
						organizationId,
						role: roleName,
						permission: value.permission,
					});
				}
			} catch {
				// The mutation reports the error through its configured handler.
			}
		},
	});

	useEffect(() => {
		if (!open) return;
		form.reset({
			name: role?.role ?? "",
			permission: role?.permission ?? {},
		});
	}, [form, open, role?.permission, role?.role]);

	const pending = createRole.isPending || updateRole.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
				onCloseAutoFocus={onCloseAutoFocus}
			>
				<form.AppForm>
					<form.AuthFormRoot className="flex flex-col gap-6">
						<DialogHeader>
							<DialogTitle>
								{role ? localization.editRole : localization.createRole}
							</DialogTitle>
							<DialogDescription>
								{localization.rolesDescription}
							</DialogDescription>
						</DialogHeader>

						<form.AppField
							name="name"
							validators={{
								onChange: ({ value }) =>
									validateStringLength(value, {
										requiredMessage: authLocalization.auth.fieldRequired,
										trim: true,
									}),
							}}
						>
							{(field) => {
								const isInvalid = isAuthFormFieldInvalid(field.state.meta);
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="organization-role-name">
											{localization.roleName}
										</FieldLabel>
										<Input
											aria-invalid={isInvalid}
											disabled={pending || !!role}
											id="organization-role-name"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder={localization.roleNamePlaceholder}
											value={field.state.value}
										/>
										<field.AuthFormFieldError />
									</Field>
								);
							}}
						</form.AppField>

						<form.AppField name="permission">
							{(field) => (
								<fieldset className="flex flex-col gap-4">
									<legend className="font-medium text-sm">
										{localization.permissions}
									</legend>
									{Object.entries(registry).map(([resource, definition]) => (
										<div className="flex flex-col gap-2" key={resource}>
											<p className="font-medium text-sm">
												{definition.label ?? resource}
											</p>
											<div className="grid gap-3 sm:grid-cols-2">
												{Object.entries(definition.actions).map(
													([action, label]) => (
														<RolePermissionCheckbox
															action={action}
															checked={
																field.state.value[resource]?.includes(action) ??
																false
															}
															key={action}
															label={label}
															onCheckedChange={(selected) =>
																field.handleChange({
																	...field.state.value,
																	[resource]: selected
																		? [
																				...(field.state.value[resource] ?? []),
																				action,
																			]
																		: (
																				field.state.value[resource] ?? []
																			).filter((entry) => entry !== action),
																})
															}
															organizationId={organizationId}
															pending={pending}
															resource={resource}
														/>
													),
												)}
											</div>
										</div>
									))}
								</fieldset>
							)}
						</form.AppField>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={pending}
								onClick={() => onOpenChange(false)}
							>
								{authLocalization.settings.cancel}
							</Button>
							<form.AuthFormSubmitButton disabled={pending}>
								{authLocalization.settings.saveChanges}
							</form.AuthFormSubmitButton>
						</DialogFooter>
					</form.AuthFormRoot>
				</form.AppForm>
			</DialogContent>
		</Dialog>
	);
}

function RolePermissionCheckbox({
	action,
	checked,
	label,
	onCheckedChange,
	organizationId,
	pending,
	resource,
}: {
	action: string;
	checked: boolean;
	label: string;
	onCheckedChange: (checked: boolean) => void;
	organizationId: string;
	pending: boolean;
	resource: string;
}) {
	const { authClient } = useAuth<OrganizationRolesAuthClient>();
	const canAssign = useHasPermission(authClient, {
		organizationId,
		permissions: { [resource]: [action] } as Parameters<
			OrganizationRolesAuthClient["organization"]["hasPermission"]
		>[0]["permissions"],
	});
	const id = `role-permission-${resource}-${action}`;
	const disabled =
		pending || canAssign.isPending || (!checked && !canAssign.data?.success);

	return (
		<label
			className="flex items-center gap-2 text-sm"
			data-disabled={disabled || undefined}
			htmlFor={id}
		>
			<Checkbox
				checked={checked}
				disabled={disabled}
				id={id}
				onCheckedChange={(selected) => onCheckedChange(selected === true)}
			/>
			{label}
		</label>
	);
}
