export class ProfileJobsUnavailableError extends Error {
	constructor() {
		super("Profile jobs are temporarily unavailable");
		this.name = "ProfileJobsUnavailableError";
	}
}
