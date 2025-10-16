import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { llm } from "@/lib/llm";

type ChatRecord = {
  role: string;
  content: string;
};

const MODEL = process.env.UPSTAGE_MODEL ?? "solar-pro2";
const CONTEXT_N = Number(process.env.CHAT_CONTEXT_LIMIT ?? 32);

const SYSTEM_PROMPT = [
  "# SYSTEM PROMPT — CareerBuddy Career Guide",
  "",
  "역할:",
  "너는 초등학생을 위한 “직업 탐구 도우미(CareerBuddy)”야.",
  "학생이 말한 ‘직업’을 정확하고 신속하게 조사할 수 있도록",
  "사실 기반 설명과 사고 확장 질문을 통해 대화를 이끈다.",
  "",
  "대화 흐름(반드시 준수):",
  "1) 관심 직업 확인 → 학생 표현이 모호하면 예시 제시(요리사/수의사/경찰관/게임 개발자 등).",
  "2) 핵심 정보 제공(3~6줄):",
  "   - 하는 일/주요 역할, 필요한 역량/성격, 선호하는 환경/도구, 관련 과목/경험, 하루 일과",
  "3) 사고 확장(1~3문항):",
  "   - 열린 질문으로 학생 기록/생각을 돕는다.",
  "   - 학생이 막히면 초등 눈높이 추가 질문 3~5개 제시.",
  "",
  "답변 형식(마크다운 템플릿):",
  "💡 [사실 기반 핵심 요약 3~6줄]",
  "- ...",
  "- ...",
  "",
  "🤔 [사고 확장 질문 1~3문항]",
  "- ...",
  "- ...",
  "",
  "질의 규칙:",
  "- 추측/허위 금지. 불확실하면 확실하지 않다고 명시.",
  "- 쉬운 어휘로 설명.",
  "- 한 번에 정보 많이 덤핑하지 말고, 학생의 요청/반응에 맞춰 나누어 전달.",
  "- 마지막은 질문으로 마무리해 다음 발화를 유도.",
  "",
  "대체 질문(학생이 질문을 못할 때 제시):",
  "- 이 직업은 사람들이 어떤 일을 도울까?",
  "- 어떤 성격/역량이 중요할까?",
  "- 어떤 도구/기술을 사용할까?",
  "- 비슷한 일을 하는 다른 직업은?",
  "- 지금부터 준비할 수 있는 일은 무엇?",
  "",
  "요약 활용:",
  "- 요약 문장은 내부 컨텍스트 용도로만 사용하며, 화면에는 표시하지 않는다.",
].join("\n");

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 형식입니다." }, { status: 400 });
  }

  const sessionId =
    typeof (payload as { sessionId?: unknown }).sessionId === "string"
      ? ((payload as { sessionId?: string }).sessionId ?? "").trim()
      : "";
  const threadId =
    typeof (payload as { threadId?: unknown }).threadId === "string"
      ? ((payload as { threadId?: string }).threadId ?? "").trim()
      : "";
  const message =
    typeof (payload as { message?: unknown }).message === "string"
      ? ((payload as { message?: string }).message ?? "").trim()
      : "";

  if (!sessionId || !threadId || !message) {
    return NextResponse.json(
      { error: "sessionId/threadId/message 필요" },
      { status: 400 }
    );
  }

  const [{ data: session, error: sessionError }, { data: thread, error: threadError }] =
    await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("class, nickname")
        .eq("id", sessionId)
        .maybeSingle(),
      supabaseAdmin
        .from("threads")
        .select("class, nickname")
        .eq("id", threadId)
        .maybeSingle(),
    ]);

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션이 존재하지 않습니다." }, { status: 401 });
  }

  if (threadError || !thread) {
    return NextResponse.json({ error: "스레드를 찾을 수 없습니다." }, { status: 400 });
  }

  if (thread.class !== session.class || thread.nickname !== session.nickname) {
    return NextResponse.json({ error: "스레드 접근 권한이 없습니다." }, { status: 401 });
  }

  const { error: userInsertError } = await supabaseAdmin.from("messages").insert({
    session_id: sessionId,
    thread_id: threadId,
    role: "user",
    content: message,
  });

  if (userInsertError) {
    return NextResponse.json({ error: userInsertError.message }, { status: 400 });
  }

  const [{ data: summaryRow }, { data: recentMessages, error: recentError }] =
    await Promise.all([
      supabaseAdmin
        .from("thread_summaries")
        .select("summary")
        .eq("thread_id", threadId)
        .maybeSingle(),
      supabaseAdmin
        .from("messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("id", { ascending: false })
        .limit(CONTEXT_N),
    ]);

  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 400 });
  }

  const recent = (recentMessages ?? []).reverse();
  const summaryText = summaryRow?.summary ? `\n[요약]\n${summaryRow.summary}\n` : "";

  const historyText = recent
    .map((record: ChatRecord) =>
      `${record.role === "assistant" ? "어시스턴트" : record.role === "system" ? "시스템" : "학생"}: ${record.content}`
    )
    .join("\n");

  const prompt = [
    {
      role: "system" as const,
      content: SYSTEM_PROMPT + summaryText,
    },
    {
      role: "user" as const,
      content: historyText
        ? `최근 대화\n${historyText}\n\n새 메시지: ${message}`
        : `새 메시지: ${message}`,
    },
  ];

  try {
    const completion = await llm.chat.completions.create({
      model: MODEL,
      messages: prompt,
      temperature: 0.5,
      max_tokens: 16384,
    });

    const content = completion.choices[0]?.message?.content ?? "(응답 없음)";

    await supabaseAdmin.from("messages").insert({
      session_id: sessionId,
      thread_id: threadId,
      role: "assistant",
      content,
    });

    return NextResponse.json({ content });
  } catch (error: unknown) {
    console.error("[api/chat] Upstage request failed:", error);
    const messageText =
      error instanceof Error && error.message
        ? error.message
        : "예상치 못한 오류가 발생했습니다.";

    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
