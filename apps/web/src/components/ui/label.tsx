import type { LabelHTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

export function Label({
  children,
  className,
  htmlFor,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { readonly htmlFor: string }) {
  return (
    <label
      className={cn("text-sm font-medium leading-none", className)}
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </label>
  );
}
