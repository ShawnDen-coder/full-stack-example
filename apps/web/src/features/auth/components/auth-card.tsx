import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { ThemeSelect } from "../../../app/theme-provider.js";

export function AuthCard({
  children,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <ThemeSelect className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <Card className="w-full max-w-md border-border/80 shadow-lg shadow-foreground/5">
        <CardHeader className="gap-3 pb-3">
          <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">F</div>
          <div className="grid gap-1">
            <CardTitle className="text-2xl">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">{children}</CardContent>
      </Card>
    </main>
  );
}
