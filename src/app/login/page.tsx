"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CLASS_OPTIONS = ["5-1", "5-2", "6-1", "6-2"] as const;

type LoginResponse = {
  sessionId: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [klass, setKlass] = useState<(typeof CLASS_OPTIONS)[number]>(CLASS_OPTIONS[0]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!nickname.trim() || !password.trim()) {
      setError("학급과 암호를 입력해 줘.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klass, nickname, password }),
      });
      const payload: LoginResponse & { error?: string } = await response.json();
      if (!response.ok || !payload.sessionId) {
        throw new Error(payload.error || "로그인에 실패했어.");
      }

      window.localStorage.setItem(
        "careerbuddy_login",
        JSON.stringify({ klass, nick: nickname, sessionId: payload.sessionId, authed: true }),
      );
      router.push("/chat");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "예상치 못한 오류가 발생했어.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <div className="mb-6 text-center space-y-1">
          <div className="text-4xl">🤖</div>
          <h1 className="text-xl font-bold text-blue-500">직업 조사 챗봇</h1>
          <p className="text-sm text-slate-500">학급·닉네임·암호를 입력하면 바로 대화를 시작할 수 있어.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm text-slate-700">
          <label className="block space-y-1">
            <span className="font-semibold">학급</span>
            <select
              value={klass}
              onChange={(event) => setKlass(event.target.value as (typeof CLASS_OPTIONS)[number])}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-hidden"
            >
              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-semibold">닉네임</span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="닉네임을 입력해 줘"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-hidden"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold">암호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="선생님이 알려준 암호를 입력해 줘"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-hidden"
            />
          </label>

          {error ? <p className="text-xs font-semibold text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-400 py-2 text-sm font-bold text-white shadow transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "잠시만 기다려 줘..." : "대화 시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
