import { z } from "zod";

export const USER_PROFILE_QUEUE = "user-profile";
export const userProfileJobSchema = z.object({ userId: z.string().min(1) });
export type UserProfileJobData = z.infer<typeof userProfileJobSchema>;
export type UserProfileJobResult = {
	id: string;
	name: string;
	emailVerified: boolean;
} | null;
