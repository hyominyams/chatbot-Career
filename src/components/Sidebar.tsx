"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createThread } from "@/lib/api";

const STORAGE_KEY = "careerbuddy_login";

const TIPS = [
  "처음에는 직업 이름과 왜 궁금한지 한마디로 알려 줘.",
  "모르는 단어나 내용이 나오면 바로 물어봐도 돼.",
  "답을 말할 때 느낀 점이나 이유를 함께 말해주면 이야기가 깊어져.",
  "AI가 던지는 선택형 질문은 마음에 드는 걸 골라서 솔직하게 말해 봐.",
  "대화가 끝날 땐 다음에 궁금한 걸 메모해 두면 더 쉽게 이어갈 수 있어."
];

export default function Sidebar() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [klass, setKlass] = useState<string | null>(null);
  const [nick, setNick] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { sessionId?: string; klass?: string; nick?: string; authed?: boolean };
      if (!stored?.authed || !stored.sessionId) return;
      setSessionId(stored.sessionId ?? null);
      setKlass(stored.klass ?? null);
      setNick(stored.nick ?? null);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleNewThread = async () => {
    if (!sessionId) {
      alert("먼저 입장해 주세요.");
      return;
    }
    setCreating(true);
    try {
      const { threadId } = await createThread(sessionId);
      router.push(`/chat/${threadId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col justify-between gap-8 bg-gray-50 p-6">
      <header className="space-y-1">
        <div className="text-lg font-bold text-slate-900">직업 조사 도우미</div>
        <p className="text-xs text-slate-500">
          {klass ? `${klass}반 · ${nick ?? ""}` : "입장이 필요해요"}
        </p>
      </header>

      <button
        type="button"
        onClick={handleNewThread}
        disabled={!sessionId || creating}
        className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {creating ? "새 상담 준비 중..." : "새 진로 상담 시작하기"}
      </button>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-blue-600">대화 팁</h2>
        <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
          {TIPS.map((tip) => (
            <li key={tip}>- {tip}</li>
          ))}
        </ul>
      </section>

      <footer className="rounded-lg border border-blue-100 bg-white/80 p-4 text-[11px] leading-relaxed text-slate-500">
        궁금한 점이 떠오르면 바로 말해 줘.
        모르는 단어는 "이게 무슨 뜻이야?"라고 물어봐도 좋아.
        천천히 이야기해도 충분히 기다려 줄게.
      </footer>
    </div>
  );
}
