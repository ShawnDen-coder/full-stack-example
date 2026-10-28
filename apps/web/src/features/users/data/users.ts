import { userSchema } from "./schema";
import data from "./users.json";
export const users = userSchema.array().parse(data);
