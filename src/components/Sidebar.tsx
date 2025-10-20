/* eslint-disable no-alert */
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
const NEW_THREAD_LABEL = "새 진로 상담 시작";
const UNKNOWN_TITLE = "제목 없는 상담";

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

  const handleNewThread = async () => {
    if (!sessionId) {
      alert("먼저 로그인해주세요.");
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

  const handleSelectThread = (threadId: string) => {
    router.push(`/chat/${threadId}`);
  };

  const handleRename = async (thread: ThreadSummary) => {
    const next = prompt("새 제목을 입력해 주세요.", thread.title ?? "");
    if (next === null) return;
    const title = next.trim();
    if (!title) {
      alert("제목은 비워둘 수 없어요.");
      return;
    }
    try {
      await patchThread(thread.id, { title });
      await refreshThreads();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    }
  };

  const handleTogglePinned = async (thread: ThreadSummary) => {
    try {
      await patchThread(thread.id, { pinned: !thread.pinned });
      await refreshThreads();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    }
  };

  const handleDelete = async (thread: ThreadSummary) => {
    if (!window.confirm("정말로 이 상담을 숨길까요?")) return;
    try {
      await patchThread(thread.id, { deleted: true });
      await refreshThreads();
      if (activeThreadId === thread.id) {
        router.push("/chat");
      }
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

  const renderThread = (thread: ThreadSummary) => {
    const isActive = activeThreadId === thread.id;
    const title = thread.title?.trim() || UNKNOWN_TITLE;
    const subtitle = formatter.format(new Date(thread.updated_at));

    return (
      <li key={thread.id}>
        <div
          className={`group flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
            isActive
              ? "border-blue-400 bg-blue-50 text-blue-700"
              : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
          }`}
        >
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => handleSelectThread(thread.id)}
          >
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="text-xs text-slate-400">{subtitle}</div>
          </button>
          <div className="ml-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="rounded px-1 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              onClick={() => handleRename(thread)}
              aria-label="제목 수정"
            >
              수정
            </button>
            <button
              type="button"
              className="rounded px-1 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              onClick={() => handleTogglePinned(thread)}
              aria-label={thread.pinned ? "고정 해제" : "상단 고정"}
            >
              {thread.pinned ? "고정 해제" : "고정"}
            </button>
            <button
              type="button"
              className="rounded px-1 text-xs text-red-400 hover:bg-red-100 hover:text-red-600"
              onClick={() => handleDelete(thread)}
              aria-label="삭제"
            >
              삭제
            </button>
          </div>
        </div>
      </li>
    );
  };

  const renderSection = (title: string, items: ThreadSummary[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-400">{title}</h2>
        <ul className="space-y-2">{items.map(renderThread)}</ul>
      </section>
    );
  };

  return (
    <aside className="flex h-full w-72 flex-col gap-5 border-r border-slate-200 bg-gray-50 p-6">
      <header className="space-y-1">
        <div className="text-lg font-semibold text-slate-900">직업 조사 챗봇</div>
        <div className="text-xs text-slate-500">
          {klass ? `${klass} · ${nick ?? ""}` : "로그인이 필요해요"}
        </div>
      </header>

      <div className="space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="대화 찾기"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNewThread}
            className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
          >
            {NEW_THREAD_LABEL}
          </button>
          <button
            type="button"
            onClick={() => refreshThreads()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-gray-100"
          >
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2 text-sm text-slate-400">불러오는 중...</div>
        ) : (
          <>
            {renderSection("상단 고정", grouped.pinned)}
            {renderSection("지난 상담", grouped.regular)}
            {grouped.pinned.length === 0 && grouped.regular.length === 0 ? (
              <div className="text-sm text-slate-400">
                아직 상담 기록이 없어요. 새 상담을 시작해 볼까요?
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

