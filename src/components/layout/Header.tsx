"use client";

import { Bell, Menu, Search, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [currentDate, setCurrentDate] = useState("2026-05-16");
  const { data: session } = useSession();

  const handleTimeTravel = () => {
    toast.success(`System date simulated to ${currentDate}`);
  };

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    : "U";

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Search employees or requests..." 
            className="pl-9 w-64 lg:w-80 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 text-indigo-700 text-sm">
          <Clock className="w-4 h-4" />
          <span className="font-medium">Time Travel Simulator:</span>
          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="bg-transparent border-none outline-none font-semibold w-[120px]"
          />
          <Button size="sm" variant="ghost" className="h-6 px-2 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-200" onClick={handleTimeTravel}>
            Apply
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="relative text-slate-600">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center font-semibold text-white text-xs hover:opacity-90 transition-opacity">
              {initials}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session?.user?.name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email || ""}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              Settings
            </DropdownMenuItem>
            {(session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MANAGER' ? (
              <DropdownMenuItem render={<Link href="/audit" />}>
                System Logs
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => signOut({ callbackUrl: '/login' })}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
