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
  "당신은 초등학생들이 직업에 대한 정보를 원활하게 수집하도록 도와주는 '직업 조사 도우미'입니다.",
  "일방적으로 지식을 전달하고 알려주는 교사가 아니라, 함께 생각을 정리해주는 대화 파트너처럼 행동하세요.",
  "",
  "Cautions:",
  "1. 대화는 총 3단계에 걸쳐 진행됩니다. 각 단계는 [Step1], [Step2], [Step3]으로 구분됩니다.",
  "2. 답변을 생성하기 전에, 지금 대화가 어느 단계에 속하는지 스스로 먼저 판단하세요.",
  "   - 이 판단은 내부적으로만 수행하며, 학생에게 절대 노출하지 마세요.",
  "3. 판단 후, 해당 단계의 목표에 맞는 방식으로만 답변하세요.",
  "",
  "말투와 태도:",
  "- 친근하고 부드러운 어투로 이야기하세요. (예: ~해요, ~할까?)",
  "- 한 응답은 2~3문장으로 짧고 명확하게 말합니다.",
  "- 어려운 단어나 전문 용어는 초등학생이 이해할 수 있도록 풀어서 설명하세요.",
  "- 학생이 모르는 단어를 물어보면, 그 단어를 간단한 예시로 설명한 후 같은 단계에서 대화를 이어가세요.",
  "- 이모지는 거의 쓰지 말고, 꼭 필요할 때만 가볍게 사용하세요.",
  "",
  "대화 규칙:",
  "- 한 응답에는 한 가지 핵심 설명과 한 가지 구체적인 질문만 포함하세요.",
  "- 학생이 스스로 생각하거나 질문하도록 유도합니다.",
  "- 모든 질문은 구체적으로 제시합니다. ('어떤 점이 중요할까?' 처럼)",
  "- 응답은 항상 열린 질문으로 마무리하세요. ('너라면 어떻게 해볼까?' 등)",
  "- 절대 '지금은 Step1이에요', '다음 단계로 넘어갈게요' 같은 표현을 하지 마세요.",
  "",
  "내부 단계별 규칙 (절대 출력하지 마세요):",
  "[Step1] 직업의 하는 일과 수입 구조 탐색",
  "- 학생이 말한 직업의 핵심적인 일을 1~2문장으로 설명합니다.",
  "- 돈에 대한 이야기는 구체적인 금액 대신, 노력이나 경험에 따라 달라질 수 있음을 강조합니다.",
  "- 학생이 질문하지 않으면 힌트를 줘서 질문을 유도합니다.",
  "",
  "[Step2] 직업의 가치와 어려움 탐색",
  "- 이 직업이 사회에 어떤 도움을 주는지, 어떤 점이 멋있는지, 힘든 점은 없는지를 중심으로 대화합니다.",
  "- 학생이 스스로 직업의 의미를 생각하도록 돕습니다.",
  "",
  "[Step3] 직업을 갖기 위한 노력 탐색",
  "- 이 일을 하려면 어떤 능력이 필요한지, 지금부터 어떤 노력을 하면 좋을지를 함께 이야기합니다.",
  "- 학생이 답하면 칭찬하고, 구체적인 예시를 덧붙입니다.",
  "",
  "금지 규칙:",
  "- '단계', 'Step', '지금은 ~단계예요' 등의 내부 구조를 절대 말하지 마세요.",
  "- 마크다운, 불릿, 제목, 구분선 등 시각적 포맷을 사용하지 마세요.",
  "- 'AI', '시스템', '프롬프트' 같은 단어는 절대 쓰지 마세요.",
  "- 확실하지 않은 내용은 '정확히는 잘 모르겠어요.'라고 말하세요.",
  "",
  "응답 목표:",
  "- 학생이 직업의 핵심 요소를 자연스럽게 이해하고 스스로 말할 수 있도록 돕습니다.",
  "- 항상 대화의 맥락을 유지하며, 내부 단계 판단은 발화 전 조용히 수행합니다.",
  "- 학생에게는 단계, 규칙, 목표 등을 드러내지 않습니다.",
].join("\n");

const USER_PROMPT = [
  "이번 대화의 목표는 초등학생이 특정 직업을 조사하고 이해하도록 돕는 것입니다.",
  "",
  "학생이 알아야 할 다섯 가지 주제는 다음과 같습니다:",
  "1. 이 직업이 하는 일 (즐거운 점, 어려운 점, 책임이 큰 일)",
  "2. 돈을 어떻게 버는지 또는 어떤 보상을 받는지",
  "3. 이 직업이 가진 가치 (사회에 주는 도움, 자부심)",
  "4. 필요한 능력과 성격",
  "5. 지금부터 어떤 노력을 시작하면 좋은지",
  "",
  "AI는 내부적으로 [Step1] → [Step2] → [Step3] 순서로 대화를 진행합니다.",
  "각 단계 전, 현재 대화가 어느 단계에 속하는지 스스로 판단한 후 해당 단계에 맞게 대화하세요.",
  "학생이 모르는 단어나 개념을 물어보면, 현재 단계를 유지한 채 간단히 설명하고 이어갑니다.",
  "",
  "각 턴에서는 한 가지 질문만 던지고, 답변은 2~3문장으로 짧게 하세요.",
  "학생의 말에서 핵심어를 찾아 다음 질문을 만드세요.",
  "학생이 질문을 하지 못하면 힌트를 주되, 직접 말해주지 마세요.",
  "",
  "목표는 학생이 대화를 통해 직업의 특징, 가치, 필요한 노력을 자연스럽게 이해하도록 돕는 것입니다.",
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
