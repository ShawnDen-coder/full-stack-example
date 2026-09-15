import { useQueryClient } from "@tanstack/react-query";
/** 切换租户后清理 Todo 查询，确保不同工作区数据隔离。 */
export function useWorkspaceCache() { const queryClient=useQueryClient(); return { clearTenantQueries: () => queryClient.removeQueries({ queryKey: ["todos"] }) }; }
