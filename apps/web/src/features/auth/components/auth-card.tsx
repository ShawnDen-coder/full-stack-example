import type { ReactNode } from "react";

export function AuthCard({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <main className="min-h-screen bg-base-200 p-6 text-base-content sm:p-12">
      <section className="card card-border mx-auto max-w-md bg-base-100">
        <div className="card-body gap-5">
          <h1 className="card-title text-3xl">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
