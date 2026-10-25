import type { UsersService } from "../service";
import {
	type UserProfileJobData,
	type UserProfileJobResult,
	userProfileJobSchema,
} from "./profile-read.contract";

export function createUserProfileProcessor({
	usersService,
}: {
	usersService: UsersService;
}) {
	return async (data: UserProfileJobData): Promise<UserProfileJobResult> => {
		const { userId } = userProfileJobSchema.parse(data);
		const profile = await usersService.getProfile(userId);
		return profile
			? {
					id: profile.id,
					name: profile.name,
					emailVerified: profile.emailVerified,
				}
			: null;
	};
}
