import {
	Avatar,
	AvatarFallback,
} from "@full-stack-example/ui/components/avatar";

export function RecentSales() {
	return (
		<div className="space-y-8">
			<div className="flex items-center gap-4">
				<Avatar className="h-9 w-9">
					<AvatarFallback>OM</AvatarFallback>
				</Avatar>
				<div className="flex flex-1 flex-wrap items-center justify-between">
					<div className="space-y-1">
						<p className="font-medium text-sm leading-none">Olivia Martin</p>
						<p className="text-muted-foreground text-sm">
							olivia.martin@email.com
						</p>
					</div>
					<div className="font-medium">+$1,999.00</div>
				</div>
			</div>
			<div className="flex items-center gap-4">
				<Avatar className="flex h-9 w-9 items-center justify-center space-y-0 border">
					<AvatarFallback>JL</AvatarFallback>
				</Avatar>
				<div className="flex flex-1 flex-wrap items-center justify-between">
					<div className="space-y-1">
						<p className="font-medium text-sm leading-none">Jackson Lee</p>
						<p className="text-muted-foreground text-sm">
							jackson.lee@email.com
						</p>
					</div>
					<div className="font-medium">+$39.00</div>
				</div>
			</div>
			<div className="flex items-center gap-4">
				<Avatar className="h-9 w-9">
					<AvatarFallback>IN</AvatarFallback>
				</Avatar>
				<div className="flex flex-1 flex-wrap items-center justify-between">
					<div className="space-y-1">
						<p className="font-medium text-sm leading-none">Isabella Nguyen</p>
						<p className="text-muted-foreground text-sm">
							isabella.nguyen@email.com
						</p>
					</div>
					<div className="font-medium">+$299.00</div>
				</div>
			</div>

			<div className="flex items-center gap-4">
				<Avatar className="h-9 w-9">
					<AvatarFallback>WK</AvatarFallback>
				</Avatar>
				<div className="flex flex-1 flex-wrap items-center justify-between">
					<div className="space-y-1">
						<p className="font-medium text-sm leading-none">William Kim</p>
						<p className="text-muted-foreground text-sm">will@email.com</p>
					</div>
					<div className="font-medium">+$99.00</div>
				</div>
			</div>

			<div className="flex items-center gap-4">
				<Avatar className="h-9 w-9">
					<AvatarFallback>SD</AvatarFallback>
				</Avatar>
				<div className="flex flex-1 flex-wrap items-center justify-between">
					<div className="space-y-1">
						<p className="font-medium text-sm leading-none">Sofia Davis</p>
						<p className="text-muted-foreground text-sm">
							sofia.davis@email.com
						</p>
					</div>
					<div className="font-medium">+$39.00</div>
				</div>
			</div>
		</div>
	);
}
