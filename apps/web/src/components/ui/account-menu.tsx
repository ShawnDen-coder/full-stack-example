import { useState } from "react";
import type { ThemeMode } from "../../app/theme-provider.js";
import { useTheme } from "../../app/theme-provider.js";
import { Avatar, AvatarFallback } from "./avatar.js";
import { buttonVariants } from "./button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

const itemClass =
  "flex min-h-10 cursor-default items-center justify-between gap-4 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";
const popupClass =
  "min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none";

export function AccountMenu({
  defaultOpen = false,
  email,
  onSignOut,
  signingOut = false,
  signOutError = false,
}: {
  readonly email?: string | undefined;
  readonly defaultOpen?: boolean;
  readonly onSignOut: () => Promise<boolean>;
  readonly signingOut?: boolean;
  readonly signOutError?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { changeTheme, theme } = useTheme();
  const initials = email?.slice(0, 1).toLocaleUpperCase() ?? "U";

  async function handleSignOut() {
    if (await onSignOut()) setOpen(false);
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        aria-label="打开账户菜单"
        className={buttonVariants({ size: "sm", variant: "outline" })}
      >
        <Avatar className="size-6">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        账号菜单
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner align="end" className="z-50" side="bottom" sideOffset={6}>
          <DropdownMenuContent className={popupClass}>
            {email ? (
              <div className="truncate px-3 py-2 text-sm text-muted-foreground">{email}</div>
            ) : null}
            <DropdownMenuSeparator className="my-1 h-px bg-border" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={itemClass}>
                <span>外观</span>
                <span aria-hidden="true" className="text-muted-foreground">
                  {themeLabel(theme)}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuPositioner align="start" className="z-50" side="right" sideOffset={4}>
                  <DropdownMenuContent className={popupClass}>
                    <DropdownMenuRadioGroup
                      onValueChange={(value) => changeTheme(String(value))}
                      value={theme}
                    >
                      {(["system", "light", "dark"] as const).map((mode) => (
                        <DropdownMenuRadioItem className={itemClass} key={mode} value={mode}>
                          <span>{themeLabel(mode)}</span>
                          <span aria-hidden="true">{mode === theme ? "✓" : ""}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenuPositioner>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem
              className={itemClass}
              closeOnClick={false}
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? "正在退出…" : "退出登录"}
            </DropdownMenuItem>
            {signOutError ? (
              <p className="px-3 py-2 text-sm text-destructive" role="alert">
                退出失败，请重试。
              </p>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function themeLabel(theme: ThemeMode) {
  return { system: "跟随系统", light: "浅色", dark: "深色" }[theme];
}
