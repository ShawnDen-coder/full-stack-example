import type { Task } from "./schema";
import data from "./tasks.json";

// Snapshot of upstream demo data (Faker seed 12345); not user-owned records.
export const tasks: Task[] = data;
