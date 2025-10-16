"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

export default function ChatLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  return (
    <div className="relative flex h-screen bg-white text-slate-900">
      <aside
        className={`absolute inset-y-0 left-0 z-40 w-72 overflow-hidden border-r border-slate-200 bg-gray-50 shadow-lg transition-all duration-300 ease-in-out md:relative md:z-0 md:flex md:h-full md:w-72 md:flex-shrink-0 md:shadow-none ${
          sidebarOpen
            ? "translate-x-0 opacity-100 md:translate-x-0"
            : "-translate-x-full opacity-0 md:w-0 md:border-transparent md:pointer-events-none"
        }`}
      >
        <div className="relative flex h-full flex-col">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 md:-right-3 md:top-1/2"
            aria-label="대화 창 닫기"
          >
            <span className="text-lg">◀</span>
          </button>
          <Sidebar />
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
        {!sidebarOpen ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-3 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow transition hover:bg-slate-100 md:left-4 md:top-1/2"
            aria-label="대화 창 열기"
          >
            <span className="text-lg">▶</span>
          </button>
        ) : null}

        <div className="absolute right-6 top-6 z-20">
          <LogoutButton />
        </div>

        <div className="flex h-full flex-col">{children}</div>
      </div>
    </div>
  );
}
