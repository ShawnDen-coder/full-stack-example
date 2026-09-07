import { useQuery } from "@tanstack/react-query";
import { createApiClient, parseResponse } from "@full-stack-example/api-client";

const api = createApiClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

async function getHealth() {
  const response = await api.health.$get();
  if (response.status === 200 || response.status === 503) return response.json();
  return parseResponse(response);
}

export function Home() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });
  return (
    <main className="min-h-screen bg-base-200 p-6 text-base-content sm:p-12">
      <section className="card mx-auto max-w-xl bg-base-100 shadow-xl">
        <div className="card-body gap-5">
          <h1 className="card-title text-3xl">Full Stack Example</h1>
          {health.isLoading ? (
            <span
              className="loading loading-spinner loading-lg"
              role="status"
              aria-label="正在检查服务"
            />
          ) : null}
          {health.isError ? (
            <div className="alert alert-error">无法连接 API，请稍后重试。</div>
          ) : null}
          {health.data ? (
            <div
              className={health.data.status === "ok" ? "alert alert-success" : "alert alert-error"}
            >
              <span>API：{health.data.status}</span>
              <span>PostgreSQL：{health.data.services.database.status}</span>
            </div>
          ) : null}
          <div className="card-actions justify-end">
            <button className="btn btn-primary" type="button" onClick={() => void health.refetch()}>
              重新检查
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
