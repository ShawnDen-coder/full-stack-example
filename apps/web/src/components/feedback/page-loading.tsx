export function PageLoading({ label = "正在加载" }: { readonly label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-base-200">
      <span className="loading loading-spinner loading-lg" role="status" aria-label={label} />
    </main>
  );
}
