import type { HTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export function FieldLabel({
  className,
  children,
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

export function FieldError({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p className={cn("text-sm text-destructive", className)} {...props}>
      {children}
    </p>
  );
}
