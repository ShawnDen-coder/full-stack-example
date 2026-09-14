import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative w-full rounded-lg border p-4 text-sm", className)} {...props} />
  );
}
