"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  Settings,
  BriefcaseBusiness,
  LogOut,
  BookOpen,
  User,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "My Portal", href: "/portal", icon: BriefcaseBusiness },
  { name: "Leave Ledger", href: "/ledger", icon: BookOpen },
  { name: "Requests", href: "/requests", icon: FileText },
  { name: "Leave Register", href: "/requests/register", icon: BookOpen },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Holidays", href: "/holidays", icon: CalendarDays },
  { name: "Team Directory", href: "/team", icon: Users },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Opening Balances", href: "/settings/balances", icon: Settings },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Basic initials logic
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    : "U";

  const role = (session?.user as any)?.role || "EMPLOYEE";
  
  let visibleNavItems = navItems;
  if (role === "ADMIN") {
    visibleNavItems = navItems.filter(item => !["My Portal"].includes(item.name));
  } else if (role === "MANAGER") {
    visibleNavItems = navItems.filter(item => ["Dashboard", "My Portal", "Leave Ledger", "Requests", "Calendar", "Holidays", "Team Directory", "Profile"].includes(item.name));
  } else if (role === "EMPLOYEE") {
    visibleNavItems = navItems.filter(item => ["My Portal", "Leave Ledger", "Calendar", "Team Directory", "Profile"].includes(item.name));
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "w-64 bg-white text-slate-700 flex flex-col border-r border-slate-200 shadow-sm z-50 transition-transform duration-300 ease-in-out md:translate-x-0 md:static fixed inset-y-0 left-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xl tracking-tight">
          <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-lg">L</span>
          </div>
          LMS SaaS
        </div>
        <button onClick={onClose} className="md:hidden p-1 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-slate-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-700 border border-slate-200 shadow-sm shrink-0">
              {initials}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold text-slate-900 truncate">{session?.user?.name || "User"}</span>
              <span className="text-xs text-slate-500 truncate">{session?.user?.email || ""}</span>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
