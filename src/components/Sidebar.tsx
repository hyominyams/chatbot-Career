"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createThread,
  listThreads,
  patchThread,
  type ThreadSummary,
} from "@/lib/api";

const STORAGE_KEY = "careerbuddy_login";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [klass, setKlass] = useState<string | null>(null);
  const [nick, setNick] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeThreadId = useMemo(() => {
    const parts = pathname?.split("/") ?? [];
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as {
        sessionId?: string;
        klass?: string;
        nick?: string;
        authed?: boolean;
      };
      if (!stored?.authed || !stored.sessionId) return;
      setSessionId(stored.sessionId ?? null);
      setKlass(stored.klass ?? null);
      setNick(stored.nick ?? null);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    if (!klass || !nick) return;
    setLoading(true);
    setError(null);
    try {
      const { threads: items } = await listThreads(klass, nick, {
        query: search.trim() || undefined,
        limit: 100,
      });
      setThreads(items.filter((item) => !item.deleted_at));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [klass, nick, search]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  const handleNewThread = async () => {
    if (!sessionId) {
      alert("먼저 입장해 주세요.");
      return;
    }
    try {
      const { threadId } = await createThread(sessionId);
      await refreshThreads();
      router.push(`/chat/${threadId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    }
  };

  const grouped = useMemo(() => {
    const pinned = threads.filter((thread) => thread.pinned);
    const regular = threads.filter((thread) => !thread.pinned);
    return { pinned, regular };
  }, [threads]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  return (
    <aside className="flex h-full w-72 flex-col gap-5 border-r border-slate-200 bg-gray-50 p-6">
      <header className="space-y-1">
        <div className="text-lg font-semibold text-slate-900">직업 조사 도우미</div>
        <div className="text-xs text-slate-500">
          {klass ? `${klass}반 · ${nick ?? ""}` : "입장이 필요해요"}
        </div>
      </header>

      <div className="space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="상담 찾기"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={handleNewThread}
          className="w-full rounded-lg bg-blue-400 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          새 진로상담
        </button>
        <button
          type="button"
          onClick={() => refreshThreads()}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-gray-100"
        >
          새로고침
        </button>
      </div>

  ***
