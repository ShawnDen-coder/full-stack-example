import { z } from "zod";

export const USER_PROFILE_TASK = "profile";
export const profileReadJobOptions = {
	attempts: 3,
	backoff: { type: "exponential", delay: 1000 },
	removeOnComplete: { age: 3600, count: 1000 },
	removeOnFail: { age: 86400, count: 1000 },
};
export const USER_PROFILE_QUEUE = "user-profile";
export const userProfileJobSchema = z.object({
	userId: z.string().min(1),
	requestId: z.string().max(128).optional(),
});
export type UserProfileJobData = z.infer<typeof userProfileJobSchema>;
export type UserProfileJobResult = {
	id: string;
	name: string;
	emailVerified: boolean;
} | null;
