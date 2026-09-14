import { Skeleton } from "../ui/skeleton.js";

export function PageLoading({ label = "正在加载" }: { readonly label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div aria-label={label} className="grid place-items-center" role="status">
        <Skeleton className="size-9 rounded-full bg-primary/20" />
      </div>
    </main>
  );
}
