import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

type HorizontalSeparatorProps = HTMLAttributes<HTMLHRElement> & {
  readonly orientation?: "horizontal";
};

type VerticalSeparatorProps = HTMLAttributes<HTMLDivElement> & {
  readonly orientation: "vertical";
};

export function Separator(props: HorizontalSeparatorProps | VerticalSeparatorProps) {
  if (props.orientation === "vertical") {
    const { className, orientation: _orientation, ...rest } = props;
    return (
      <div
        aria-hidden="true"
        className={cn("h-full w-px shrink-0 bg-border", className)}
        {...rest}
      />
    );
  }

  const { className, orientation: _orientation, ...rest } = props;
  return <hr className={cn("m-0 h-px w-full shrink-0 border-0 bg-border", className)} {...rest} />;
}
