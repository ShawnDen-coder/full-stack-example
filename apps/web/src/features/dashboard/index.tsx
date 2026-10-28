import { Button } from "@full-stack-example/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@full-stack-example/ui/components/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@full-stack-example/ui/components/tabs";
import { toast } from "sonner";
import { Analytics } from "./components/analytics";
import { Overview } from "./components/overview";
import { RecentSales } from "./components/recent-sales";

export function Dashboard() {
	return (
		<>
			{/* ===== Top Heading ===== */}

			{/* ===== Main ===== */}
			<div>
				<div className="mb-2 flex items-center justify-between space-y-2">
					<h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
					<div className="flex items-center space-x-2">
						<Button
							onClick={() =>
								toast.info(
									"This dashboard displays sample data. Export is not connected yet.",
								)
							}
						>
							Download
						</Button>
					</div>
				</div>
				<p className="mb-4 text-muted-foreground text-xs">Sample data</p>
				<Tabs
					orientation="vertical"
					defaultValue="overview"
					className="space-y-4"
				>
					<div className="w-full overflow-x-auto pb-2">
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="analytics">Analytics</TabsTrigger>
							<TabsTrigger value="reports" disabled>
								Reports
							</TabsTrigger>
							<TabsTrigger value="notifications" disabled>
								Notifications
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="overview" className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Total Revenue
									</CardTitle>
									<svg
										aria-hidden="true"
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										className="h-4 w-4 text-muted-foreground"
									>
										<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
									</svg>
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">$45,231.89</div>
									<p className="text-muted-foreground text-xs">
										+20.1% from last month
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Subscriptions
									</CardTitle>
									<svg
										aria-hidden="true"
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										className="h-4 w-4 text-muted-foreground"
									>
										<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
									</svg>
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">+2350</div>
									<p className="text-muted-foreground text-xs">
										+180.1% from last month
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">Sales</CardTitle>
									<svg
										aria-hidden="true"
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										className="h-4 w-4 text-muted-foreground"
									>
										<rect width="20" height="14" x="2" y="5" rx="2" />
										<path d="M2 10h20" />
									</svg>
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">+12,234</div>
									<p className="text-muted-foreground text-xs">
										+19% from last month
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Active Now
									</CardTitle>
									<svg
										aria-hidden="true"
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										className="h-4 w-4 text-muted-foreground"
									>
										<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
									</svg>
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">+573</div>
									<p className="text-muted-foreground text-xs">
										+201 since last hour
									</p>
								</CardContent>
							</Card>
						</div>
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
							<Card className="col-span-1 lg:col-span-4">
								<CardHeader>
									<CardTitle>Overview</CardTitle>
								</CardHeader>
								<CardContent className="ps-2">
									<Overview />
								</CardContent>
							</Card>
							<Card className="col-span-1 lg:col-span-3">
								<CardHeader>
									<CardTitle>Recent Sales</CardTitle>
									<CardDescription>
										You made 265 sales this month.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<RecentSales />
								</CardContent>
							</Card>
						</div>
					</TabsContent>
					<TabsContent value="analytics" className="space-y-4">
						<Analytics />
					</TabsContent>
				</Tabs>
			</div>
		</>
	);
}
