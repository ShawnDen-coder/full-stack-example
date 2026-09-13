import type { z } from "zod";

export type ExampleJobInput = z.input<typeof import("./schemas.js").exampleJobSchema>;
export type ExampleJobData = z.output<typeof import("./schemas.js").exampleJobSchema>;
export type ExampleJobOutput = { readonly message: string; readonly completedAt: string };

export interface JobReference<Name extends string = string> {
  readonly id: string;
  readonly name: Name;
  readonly queueName: string;
}

export interface JobDefinition<
  Name extends string = string,
  Input extends z.ZodType = z.ZodType,
  Result = unknown,
> {
  readonly name: Name;
  readonly input: Input;
  readonly process: (context: JobExecutionContext<z.output<Input>>) => Promise<Result> | Result;
}

export type AnyJobDefinition = Omit<JobDefinition<string, z.ZodType, unknown>, "process"> & {
  readonly process: (context: JobExecutionContext<never>) => unknown;
};
export type JobInput<Definition extends AnyJobDefinition> = z.input<Definition["input"]>;
export type JobResult<Definition extends AnyJobDefinition> = Awaited<
  ReturnType<Definition["process"]>
>;

export interface JobProducer {
  enqueue<Definition extends AnyJobDefinition>(
    definition: Definition,
    data: JobInput<Definition>,
  ): Promise<JobReference<Definition["name"]>>;
}

export interface JobService {
  enqueueExample(input: ExampleJobInput): Promise<JobReference>;
}

export interface JobExecutionContext<Data> {
  readonly id: string;
  readonly data: Data;
  readonly attempt?: number;
  updateProgress(progress: number | object): Promise<void>;
  log(message: string): Promise<void>;
}

export interface JobsLogger {
  info(message: string, properties?: Readonly<Record<string, unknown>>): void;
  warn(message: string, properties?: Readonly<Record<string, unknown>>): void;
  error(message: string, properties?: Readonly<Record<string, unknown>>): void;
}

declare const jobsBoardSourceBrand: unique symbol;

/** Opaque source consumed by the Bull Board adapter; no BullMQ type crosses this boundary. */
export interface JobsBoardSource {
  readonly [jobsBoardSourceBrand]: true;
  readonly queue: unknown;
}

export interface JobsRuntime {
  readonly service: JobService;
  readonly producer: JobProducer;
  readonly board: JobsBoardSource;
  close(): Promise<void>;
}
