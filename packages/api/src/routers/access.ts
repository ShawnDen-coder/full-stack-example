import { workspaceToolKeys } from "@full-stack-example/access";
import { z } from "zod";
import { protectedProcedure } from "../procedures";

const workspaceId = z.string().min(1).max(100);
const logo = z.string().max(44_000).nullable();
export const accessRouter = {
	me: protectedProcedure
		.input(z.object({ workspaceId: workspaceId.optional() }).optional())
		.handler(({ context, input }) =>
			context.services.accessService.getAccess(
				context.headers,
				input?.workspaceId,
			),
		),
	mine: protectedProcedure.handler(({ context }) =>
		context.services.accessService.workspaces.mine(context.headers),
	),
	workspaces: protectedProcedure
		.input(z.object({ offset: z.number().int().min(0).default(0) }))
		.handler(({ context, input }) =>
			context.services.accessService.workspaces.list(
				context.headers,
				input.offset,
			),
		),
	createWorkspace: protectedProcedure
		.input(
			z
				.object({
					name: z.string().trim().min(1).max(80),
					slug: z
						.string()
						.min(1)
						.max(80)
						.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
					ownerEmail: z.email().trim(),
					tools: z
						.array(z.enum(workspaceToolKeys))
						.max(workspaceToolKeys.length),
					logo: logo.optional(),
				})
				.strict(),
		)
		.handler(({ context, input }) =>
			context.services.accessService.workspaces.create(context.headers, input),
		),
	workspaceLogo: protectedProcedure
		.input(z.strictObject({ workspaceId }))
		.handler(({ context, input }) =>
			context.services.accessService.workspaces.logo(
				context.headers,
				input.workspaceId,
			),
		),
	updateWorkspaceBasics: protectedProcedure
		.input(
			z.strictObject({
				workspaceId,
				name: z.string().trim().min(1).max(80),
				logo,
			}),
		)
		.handler(({ context, input }) =>
			context.services.accessService.workspaces.updateBasics(
				context.headers,
				input,
			),
		),
	setTool: protectedProcedure
		.input(
			z.object({
				workspaceId,
				tool: z.enum(workspaceToolKeys),
				enabled: z.boolean(),
			}),
		)
		.handler(({ context, input }) =>
			context.services.accessService.workspaces.setTool(context.headers, input),
		),
	addMember: protectedProcedure
		.input(z.object({ workspaceId, email: z.email().trim() }))
		.handler(({ context, input }) =>
			context.services.accessService.workspaces.addMember(
				context.headers,
				input,
			),
		),
};
