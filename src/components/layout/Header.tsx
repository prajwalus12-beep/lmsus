"use client";

import { Bell, Menu, Search, Clock, FlaskConical } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession, useSignOut } from "@/components/providers/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [currentDate, setCurrentDate] = useState("2026-05-16");
  const [isSystemTestMode, setIsSystemTestMode] = useState(false);
  const [systemOverrideDate, setSystemOverrideDate] = useState<string | null>(null);
  const { data: session } = useSession();
  const signOut = useSignOut();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/leave/test-mode');
        const data = await res.json();
        setIsSystemTestMode(data.isTestMode);
        if (data.isTestMode && data.overrideDate) {
          const formattedDate = new Date(data.overrideDate).toISOString().split('T')[0];
          setSystemOverrideDate(new Date(data.overrideDate).toLocaleDateString());
          setCurrentDate(formattedDate);
        } else {
          setSystemOverrideDate(null);
          setCurrentDate(new Date().toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error("Failed to load test mode status", err);
      }
    };
    fetchStatus();
  }, []);

  const handleTimeTravel = async () => {
    try {
      const res = await fetch('/api/leave/test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, date: currentDate }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`System date simulated to ${currentDate}`);
        window.location.reload();
      } else {
        toast.error("Failed to apply time travel. Make sure you are an Admin.");
      }
    } catch (err) {
      toast.error("Network error applying time travel");
    }
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

      {isSystemTestMode && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-3 py-1 rounded-full text-xs animate-pulse">
          <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
          <span>Test Mode Active (Simulated Date: {systemOverrideDate})</span>
        </div>
      )}

      <div className="flex items-center gap-4">
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
            {(session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MANAGER' ? (
              <>
                <DropdownMenuItem render={<Link href="/settings" />}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/audit" />}>
                  System Logs
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => signOut()}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
