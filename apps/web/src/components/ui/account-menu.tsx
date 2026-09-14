import { Menu } from "@base-ui/react/menu";
import { buttonVariants } from "./button.js";

export function AccountMenu({
  disabled = false,
  email,
  onSignOut,
}: {
  readonly disabled?: boolean;
  readonly email?: string | undefined;
  readonly onSignOut: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className={buttonVariants({ size: "sm", variant: "outline" })}>
        账号菜单
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" className="z-50" side="bottom" sideOffset={6}>
          <Menu.Popup className="min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            {email ? (
              <div className="truncate px-3 py-2 text-sm text-muted-foreground">{email}</div>
            ) : null}
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              className="flex min-h-10 cursor-default items-center rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              disabled={disabled}
              onClick={onSignOut}
            >
              退出登录
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
