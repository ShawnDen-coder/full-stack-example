export function PageLoading({ label = "正在加载" }: { readonly label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <span className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" role="status" aria-label={label} />
    </main>
  );
}
