import type {
	ColumnFiltersState,
	OnChangeFn,
	PaginationState,
} from "@tanstack/react-table";
import { useMemo } from "react";

type SearchRecord = Record<string, unknown>;

export type NavigateFn = (opts: {
	search:
		| true
		| SearchRecord
		| ((prev: SearchRecord) => Partial<SearchRecord> | SearchRecord);
	replace?: boolean;
}) => void;

type UseTableUrlStateParams = {
	search: SearchRecord;
	navigate: NavigateFn;
	pagination?: {
		pageKey?: string;
		pageSizeKey?: string;
		defaultPage?: number;
		defaultPageSize?: number;
	};
	globalFilter?: {
		enabled?: boolean;
		key?: string;
		trim?: boolean;
	};
	columnFilters?: Array<
		| {
				columnId: string;
				searchKey: string;
				type?: "string";
				// Optional transformers for custom types
				serialize?: (value: unknown) => unknown;
				deserialize?: (value: unknown) => unknown;
		  }
		| {
				columnId: string;
				searchKey: string;
				type: "array";
				serialize?: (value: unknown) => unknown;
				deserialize?: (value: unknown) => unknown;
		  }
	>;
};

type UseTableUrlStateReturn = {
	// Global filter
	globalFilter?: string;
	onGlobalFilterChange?: OnChangeFn<string>;
	// Column filters
	columnFilters: ColumnFiltersState;
	onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
	// Pagination
	pagination: PaginationState;
	onPaginationChange: OnChangeFn<PaginationState>;
	// Helpers
	ensurePageInRange: (
		pageCount: number,
		opts?: { resetTo?: "first" | "last" },
	) => void;
};

export function decodeColumnFilters(
	search: SearchRecord,
	columnFiltersCfg: NonNullable<UseTableUrlStateParams["columnFilters"]>,
): ColumnFiltersState {
	const collected: ColumnFiltersState = [];
	for (const cfg of columnFiltersCfg) {
		const raw = (search as SearchRecord)[cfg.searchKey];
		const deserialize = cfg.deserialize ?? ((v: unknown) => v);
		if (cfg.type === "string") {
			const value = (deserialize(raw) as string) ?? "";
			if (typeof value === "string" && value.trim() !== "") {
				collected.push({ id: cfg.columnId, value });
			}
		} else {
			// default to array type
			const value = (deserialize(raw) as unknown[]) ?? [];
			if (Array.isArray(value) && value.length > 0) {
				collected.push({ id: cfg.columnId, value });
			}
		}
	}
	return collected;
}

export function encodeColumnFilters(
	next: ColumnFiltersState,
	columnFiltersCfg: NonNullable<UseTableUrlStateParams["columnFilters"]>,
) {
	const patch: Record<string, unknown> = {};

	for (const cfg of columnFiltersCfg) {
		const found = next.find((f) => f.id === cfg.columnId);
		const serialize = cfg.serialize ?? ((v: unknown) => v);
		if (cfg.type === "string") {
			const value =
				typeof found?.value === "string" ? (found.value as string) : "";
			patch[cfg.searchKey] = value.trim() !== "" ? serialize(value) : undefined;
		} else {
			const value = Array.isArray(found?.value)
				? (found?.value as unknown[])
				: [];
			patch[cfg.searchKey] = value.length > 0 ? serialize(value) : undefined;
		}
	}
	return patch;
}

export function decodePagination(
	search: SearchRecord,
	pageKey: string,
	pageSizeKey: string,
	defaultPage: number,
	defaultPageSize: number,
): PaginationState {
	const rawPage = search[pageKey];
	const rawPageSize = search[pageSizeKey];
	const pageNum = typeof rawPage === "number" ? rawPage : defaultPage;
	const pageSize =
		typeof rawPageSize === "number" ? rawPageSize : defaultPageSize;
	return { pageIndex: Math.max(0, pageNum - 1), pageSize };
}

export function encodePagination(
	next: PaginationState,
	pageKey: string,
	pageSizeKey: string,
	defaultPage: number,
	defaultPageSize: number,
): SearchRecord {
	const page = next.pageIndex + 1;
	return {
		[pageKey]: page <= defaultPage ? undefined : page,
		[pageSizeKey]:
			next.pageSize === defaultPageSize ? undefined : next.pageSize,
	};
}

export function useTableUrlState(
	params: UseTableUrlStateParams,
): UseTableUrlStateReturn {
	const {
		search,
		navigate,
		pagination: paginationCfg,
		globalFilter: globalFilterCfg,
		columnFilters: columnFiltersCfg = [],
	} = params;

	const pageKey = paginationCfg?.pageKey ?? ("page" as string);
	const pageSizeKey = paginationCfg?.pageSizeKey ?? ("pageSize" as string);
	const defaultPage = paginationCfg?.defaultPage ?? 1;
	const defaultPageSize = paginationCfg?.defaultPageSize ?? 10;

	const globalFilterKey = globalFilterCfg?.key ?? ("filter" as string);
	const globalFilterEnabled = globalFilterCfg?.enabled ?? true;
	const trimGlobal = globalFilterCfg?.trim ?? true;

	const columnFilters = useMemo(
		() => decodeColumnFilters(search, columnFiltersCfg),
		[columnFiltersCfg, search],
	);

	const pagination = useMemo(
		() =>
			decodePagination(
				search,
				pageKey,
				pageSizeKey,
				defaultPage,
				defaultPageSize,
			),
		[search, pageKey, pageSizeKey, defaultPage, defaultPageSize],
	);

	const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
		const next = typeof updater === "function" ? updater(pagination) : updater;
		const patch = encodePagination(
			next,
			pageKey,
			pageSizeKey,
			defaultPage,
			defaultPageSize,
		);
		navigate({ search: (prev) => ({ ...prev, ...patch }) });
	};

	const rawGlobalFilter = search[globalFilterKey];
	const globalFilter = !globalFilterEnabled
		? undefined
		: typeof rawGlobalFilter === "string"
			? rawGlobalFilter
			: "";

	const onGlobalFilterChange: OnChangeFn<string> | undefined =
		globalFilterEnabled
			? (updater) => {
					const next =
						typeof updater === "function"
							? updater(globalFilter ?? "")
							: updater;
					const value = trimGlobal ? next.trim() : next;
					navigate({
						search: (prev) => ({
							...(prev as SearchRecord),
							[pageKey]: undefined,
							[globalFilterKey]: value ? value : undefined,
						}),
					});
				}
			: undefined;

	const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
		const next =
			typeof updater === "function" ? updater(columnFilters) : updater;

		const patch = encodeColumnFilters(next, columnFiltersCfg);

		navigate({
			search: (prev) => ({
				...(prev as SearchRecord),
				[pageKey]: undefined,
				...patch,
			}),
		});
	};

	const ensurePageInRange = (
		pageCount: number,
		opts: { resetTo?: "first" | "last" } = { resetTo: "first" },
	) => {
		const currentPage = (search as SearchRecord)[pageKey];
		const pageNum = typeof currentPage === "number" ? currentPage : defaultPage;
		if (pageCount > 0 && pageNum > pageCount) {
			navigate({
				replace: true,
				search: (prev) => ({
					...(prev as SearchRecord),
					[pageKey]: opts.resetTo === "last" ? pageCount : undefined,
				}),
			});
		}
	};

	return {
		globalFilter: globalFilterEnabled ? (globalFilter ?? "") : undefined,
		onGlobalFilterChange,
		columnFilters,
		onColumnFiltersChange,
		pagination,
		onPaginationChange,
		ensurePageInRange,
	};
}
