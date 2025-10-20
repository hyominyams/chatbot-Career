"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "careerbuddy_login";
const classes = ["5-1", "5-2", "6-1", "6-2"];

type StoredSession = {
  klass: string;
  nick: string;
  sessionId: string;
  authed: boolean;
};

export default function Home() {
  const router = useRouter();
  const [klass, setKlass] = useState(classes[0]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredSession;
      if (stored?.authed && stored.sessionId) {
        router.replace("/chat");
      }
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!klass || !nickname || !password) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klass, password, nickname }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "로그인에 실패했습니다.");
      }

      const session: StoredSession = {
        klass,
        nick: nickname,
        sessionId: payload.sessionId as string,
        authed: true,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      router.push("/chat");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white/90 shadow-xl backdrop-blur-sm p-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">
          직업 조사 챗봇
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          반과 닉네임, 비밀번호를 입력하면 직업 탐구 대화를 시작할 수 있어요.
        </p>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            <span className="mb-2 block">학급 선택</span>
            <select
              value={klass}
              onChange={(event) => setKlass(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {classes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="mb-2 block">닉네임</span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="닉네임을 입력하세요"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="mb-2 block">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="반 비밀번호를 입력하세요"
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-400 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "확인 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

