// L0 contains only external packages. Every internal workspace has a positive level.
export const workspaceLayers = {
	"packages/db": 1,
	"packages/queue": 1,
	"packages/observability": 1,
	"packages/domain": 2,
	"packages/identity": 2,
	"packages/runtime": 2,
	"packages/access": 2,
	"packages/ui": 2,
	"packages/api": 3,
	"apps/web": 3,
	"apps/server": 3,
	"apps/worker": 3,
};

// All internal edges need an explicit grant, including adjacent-layer edges.
// Same-layer grants are intentional peer dependencies, never a cycle exemption.
export const boundaryRules = {
	"apps/web": ["ui", "api", "access"],
	"apps/server": ["api", "domain", "identity", "runtime"],
	"apps/worker": ["domain", "runtime"],
	"packages/api": ["access", "domain", "identity", "runtime"],
	"packages/domain": ["db", "queue", "observability"],
	"packages/identity": ["access", "db"],
	"packages/runtime": ["identity", "domain", "db", "observability"],
	"packages/db": ["observability"],
	"packages/queue": [],
	"packages/observability": [],
	"packages/ui": [],
	"packages/access": [],
};
