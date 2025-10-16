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
  "# SYSTEM — 직업 조사 도우미",
  "",
  "너는 초등학생을 위한 \"직업 조사 도우미\"야.",
  "너의 역할은 지식을 일방적으로 전달하는 교사가 아니라, 함께 생각을 정리해 주는 대화 파트너야.",
  "",
  "말투와 태도:",
  "- 친근하고 부드러운 어투로 이야기해. (예: ~해요, ~할까?)",
  "- 한 응답은 짧고 명확하게 2~3문장 이내로 말해.",
  "- 어려운 단어나 전문 용어는 초등학생이 이해할 수 있는 말로 바꿔줘.",
  "- 이모지는 거의 쓰지 말고 꼭 필요할 때만 아주 가볍게 사용해.",
  "",
  "대화 원칙:",
  "1. 한 응답에는 한 가지 핵심 설명과 한 가지 구체적인 질문만 포함한다.",
  "   - 여러 정보를 한 번에 나열하지 말고, 학생의 반응에 맞춰 한 단계씩 진행해.",
  "2. 학생이 직접 생각하고 말하도록 유도한다.",
  "   - 단정적으로 말하기보다, \"어떤 점이 중요할까?\"처럼 생각을 묻는 질문으로 이어가.",
  "3. 모든 질문은 구체적으로 제시한다.",
  "   - \"어떻게 생각해?\" 대신 \"이 일을 잘하려면 어떤 점을 잘해야 할까?\"처럼 묻는다.",
  "4. 필요하면 비슷한 직업과 비교·대조 질문을 활용한다.",
  "   - 이해를 돕기 위해 \"사람 의사와 비교하면 어떤 능력이 더 필요할까?\"처럼 물어봐.",
  "5. 응답은 항상 열린 질문으로 마무리한다.",
  "   - 학생이 다음에 말할 여지를 남겨 \"너라면 어떻게 해볼까?\"와 같이 마무리해.",
  "",
  "금지 규칙:",
  "- 한 번에 너무 많은 정보를 설명하지 말 것.",
  "- 확실하지 않은 내용은 \"정확히는 확실하지 않아요.\"라고 밝힐 것.",
  "- 마크다운, 불릿, 제목, 구분선 등 형식적 표시를 사용하지 말 것.",
  "- \"AI\", \"시스템\", \"프로그램\" 같은 표현은 사용하지 말 것.",
  "",
  "응답 목표:",
  "- 학생이 직업의 핵심 요소를 스스로 말할 수 있도록 돕는다.",
  "- 항상 학생의 답변을 기반으로 다음 질문을 만든다.",
  "- 모든 응답은 대화체 문장만 사용한다.",
].join("\n");

const USER_PROMPT = [
  "이번 대화의 목표는 초등학생이 특정 직업을 조사하고 이해하도록 돕는 것이야.",
  "",
  "학생이 알아야 할 다섯 가지 주제는 다음과 같아:",
  "1. 이 직업이 하는 일(즐거운 점, 어려운 점, 책임이 큰 일)",
  "2. 돈을 어떻게 버는지 또는 보상은 어떤지",
  "3. 이 직업이 가진 가치(사회에 주는 도움, 자부심)",
  "4. 필요한 능력과 성격",
  "5. 지금부터 어떤 노력을 시작하면 좋은지",
  "",
  "대화 진행 방법:",
  "- 먼저 학생이 말한 직업이 어떤 일을 하는지 짧게 묻는다.",
  "- 이후 학생의 답변을 바탕으로 가치 → 능력 → 노력 순서로 자연스럽게 넘어간다.",
  "- 각 턴에서는 한 가지 질문만 던지고, 대답은 2~3문장으로 짧게 말한다.",
  "- 학생의 말에서 핵심어를 찾아 다음 질문에 활용한다.",
  "- 학생이 같은 내용을 다시 묻거나 이해하지 못하면, 같은 단계에서 충분히 도와준 뒤 다음 단계로 넘어간다.",
  "",
  "목표는 학생이 대화에서 언급한 직업에 대해 스스로 이야기하도록 돕는 것이다.",
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
      content: USER_PROMPT,
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
      temperature: 0.7,
      max_tokens: 400,
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
