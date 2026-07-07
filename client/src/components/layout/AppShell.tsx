import { CalendarDays, Footprints, LayoutDashboard, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { Logo, LogoMark } from "@/components/Logo";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/log", label: "Run log", icon: Footprints },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user } = useAuth();

  return (
    <div className="min-h-dvh">
      {/* Sidebar — md and up */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card/50 md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="border-t px-5 py-4">
            <p className="truncate text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </p>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
        <Logo markClassName="size-7" />
      </header>

      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:pb-12 md:pt-8 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar — below md */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Primary"
      >
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <LogoMark className="size-12 animate-pulse" />
      <p className="text-sm font-medium text-muted-foreground">Pacemaker</p>
    </div>
  );
}
