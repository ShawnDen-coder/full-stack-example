import { getRouteApi } from "@tanstack/react-router";
import { UsersDialogs } from "./components/users-dialogs";
import { UsersPrimaryButtons } from "./components/users-primary-buttons";
import { UsersProvider } from "./components/users-provider";
import { UsersTable } from "./components/users-table";
import { users } from "./data/users";

const route = getRouteApi("/_auth/users");

export function Users() {
	const search = route.useSearch();
	const navigate = route.useNavigate();

	return (
		<UsersProvider>
			<div className="flex flex-1 flex-col gap-4 sm:gap-6">
				<p className="text-muted-foreground text-xs">
					Sample users · Changes are not saved
				</p>
				<div className="flex flex-wrap items-end justify-between gap-2">
					<div>
						<h2 className="font-bold text-2xl tracking-tight">User List</h2>
						<p className="text-muted-foreground">
							Manage your users and their roles here.
						</p>
					</div>
					<UsersPrimaryButtons />
				</div>
				<UsersTable data={users} search={search} navigate={navigate} />
			</div>

			<UsersDialogs />
		</UsersProvider>
	);
}
