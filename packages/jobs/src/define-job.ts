import type { z } from "zod";
import type { JobDefinition, JobExecutionContext } from "./contracts.js";

export function defineJob<const Name extends string, Input extends z.ZodType, Result>(definition: {
  readonly name: Name;
  readonly input: Input;
  readonly process: (context: JobExecutionContext<z.output<Input>>) => Promise<Result> | Result;
}): JobDefinition<Name, Input, Result> {
  return definition;
}
