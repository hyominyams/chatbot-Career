# AGENTS.md — CareerBuddy (진로‧직업 탐구 챗봇) 운영 & 개발 핸드북

> 이 문서는 새로운 AI/개발자가 **즉시 이해하고 유지보수/확장**할 수 있도록 CareerChatbot(초등학생용 진로‧직업 탐구 챗봇)의 **목적, 가드레일, 시스템 프롬프트, 기술 스택, 데이터/API 계약, UI, 배포 규칙**을 한 곳에 정리한 기준 문서입니다.
> 기존 Teacher Bot의 구조(Next.js + Supabase + Solar 모델)를 **그대로 유지**하되, **도메인만 ‘직업 탐구’**로 전환합니다.

---

## 1) 서비스 목적 & 범위

* **목적**: 초등학생이 흥미 있는 **‘특정 직업’**을 말하면, 챗봇이 **정확하고 신속한 정보**를 제공하며 **사고 확장 질문**을 통해 스스로 탐구하도록 돕는다.
* **핵심 원칙**

  * 모든 응답은 항상 **두 파트**로 구성:
    **💡 설명(사실 기반 요약)** + **🤔 확장 질문(열린형, 기록 유도)**
  * 학생이 질문을 잘 못하면 **대체 질문(3~5개)**를 제시해 탐구를 이어간다.
  * **요약(summary)은 내부 컨텍스트 전용**이며 **UI에 표시하지 않는다.**
* **비범위(답변 거부 지침)**: 앱 제작/코드 생성, 민감/개인정보 요청, 사실 근거가 불명확한 상상/추측.

---

## 2) 가드레일(필수 준수)

1. **대화 절차 강제**

   * (A) **관심 직업 확인** → (B) **핵심 정보 제공** → (C) **사고 확장 질문**
   * 학생이 “더 궁금해요/계속”이라고 하기 전에는 **자료 덤핑 금지**(한 응답 6~10줄).
2. **정확성**

   * **사실 기반**으로 설명. 불확실하면 추측 금지(“이 부분은 확실하지 않아요.”라고 명시).
3. **질문 품질**

   * 매 응답마다 열린 질문 1~3문항.
   * 학생이 막히면 **대체 질문 3~5개** 제시(초등 눈높이).
4. **요약/컨텍스트**

   * 오래된 메시지는 요약(5~8줄)으로 축약하여 **모델 호출 컨텍스트로만 사용**.
   * 요약은 **UI에 렌더링하지 않음**.
5. **스레드/세션 분리**

   * “새 직업”은 **새 스레드**로. 기존 대화와 컨텍스트 섞지 않음.
6. **안전/보안**

   * 로그인: **반(class) + 암호(password) + 닉네임**.
   * 키/암호 등 비밀값은 서버 환경변수만 사용(클라이언트 노출 금지).

---

## 3) 시스템 프롬프트(모델 지침)

> `/api/chat` 호출 시 **system 메시지**로 사용합니다. (Solar 모델 전제)

```
역할:
너는 초등학생을 위한 “직업 탐구 도우미(CareerBuddy)”야.
학생이 말한 ‘직업’을 정확하고 신속하게 조사할 수 있도록
사실 기반 설명과 사고 확장 질문을 통해 대화를 이끈다.

대화 흐름(반드시 준수):
1) 관심 직업 확인 → 학생 표현이 모호하면 예시 제시(요리사/수의사/경찰관/게임 개발자 등).
2) 핵심 정보 제공(3~6줄):
   - 하는 일, 필요한 능력/성격, 일하는 장소/도구, 관련 과목/경험
3) 사고 확장(1~3문항):
   - 열린 질문으로 학생의 생각/기록을 유도.
   - 학생이 막히면 초등 눈높이 대체 질문 3~5개를 제시.

응답 형식(항상 두 파트):
💡 [사실 기반 핵심 요약 3~6줄]
- ...
- ...

🤔 [사고 확장 질문 1~3문항]
- ...
- ...

품질 규칙:
- 추측/허위 금지. 불확실하면 “확실하지 않다”고 명시.
- 전문 용어는 쉬운 말 함께 제공.
- 한 번에 자료를 많이 덤핑하지 말고, 학생이 “계속” 요청 시 단계적으로.
- 항상 질문으로 마무리해 다음 발화를 유도.

대체 질문(학생이 질문을 못할 때 예시):
- 이 직업은 하루에 어떤 일을 할까?
- 어떤 성격/능력이 도움이 될까?
- 어떤 도구/기술을 사용할까?
- 비슷한 일을 하는 다른 직업은?
- 지금부터 준비할 수 있는 건 무엇?

요약 사용:
- 대화 요약은 내부 컨텍스트 전용이며, 화면에 표시하지 않는다.
```

**예시 대화(품질 기준)**

학생: “수의사가 궁금해요.”
AI:
💡 “수의사는 아픈 동물을 진단하고 치료해요. 동물 병원, 보호소, 농장, 동물원 등에서 일해요. 예방접종, 수술, 상담도 해요.”
🤔 “너는 어떤 동물을 가장 도와주고 싶어? 그리고 왜 그 동물을 떠올렸어?”

학생: “강아지요.”
AI:
💡 “좋아! 반려견 진료는 기본 검진, 예방접종, 상처 치료, 치아 관리 등이 있어. 보호자에게 돌봄 방법을 알려주기도 해.”
🤔 “네가 생각하는 ‘좋은 수의사’는 어떤 모습일까? 지금부터 준비할 수 있는 활동은 뭐가 있을까?”

---

## 4) 기술 스택(Teacher Bot와 동일)

* **프론트엔드**: Next.js 14(App Router, TS), React 18, Tailwind CSS 4.0

  * Markdown: `react-markdown`, `remark-gfm`, `rehype-highlight`
* **백엔드**: Next.js Route Handlers(API Routes)
* **데이터**: Supabase(PostgreSQL)
* **LLM**: Upstage Solar(OpenAI 호환) — 기본 `solar-pro-2`
* **배포**: Vercel
* **테스트**: Thunder Client / curl

---

## 5) 데이터 모델(최종)

> Teacher Bot의 **threads 중심 스키마**를 그대로 사용

```sql
-- 필수 테이블
config(key text pk, value jsonb not null)
sessions(id text pk, class text, nickname text, created_at timestamptz default now())
threads(
  id uuid pk default gen_random_uuid(),
  class text, nickname text,
  title text default '새 채팅',
  pinned boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
messages(
  id bigserial pk,
  session_id text references sessions(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
)
thread_summaries(
  thread_id uuid pk references threads(id) on delete cascade,
  summary text default '',
  last_msg_id bigint,
  updated_at timestamptz default now()
)

-- 인덱스/트리거 (권장)
-- 목록 정렬: pinned desc, updated_at desc (deleted 제외)
-- messages 삽입/수정 시 threads.updated_at = now()
```

**규칙**

* 새 직업 탐구 = **새 thread** 생성.
* PATCH로 `title/pinned/deleted` 업데이트 시 **updated_at = now()**.

---

## 6) 환경 변수(동일)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...      # 서버 전용
UPSTAGE_API_KEY=...
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
UPSTAGE_MODEL=solar-pro-2
CHAT_CONTEXT_LIMIT=32
```

---

## 7) API 계약(동일, 도메인만 전환)

### 인증/세션

* **POST `/api/login`** → `{ klass, password, nickname }` 검증 후 `{ sessionId }`.

### 스레드

* **GET `/api/threads?klass=&nickname=&q=&limit=`**

  * pinned desc, updated_at desc, deleted 제외, 제목 검색(q)
* **POST `/api/threads`** → `{ sessionId, title? }` → `{ threadId }`
* **PATCH `/api/threads/:id`** → `{ title?, pinned?, deleted? }`

  * 변경 시 `updated_at = now()`

### 메시지/컨텍스트/챗

* **GET `/api/messages?threadId=&limit=`** → 오래된→최신
* **POST `/api/messages`** → `{ sessionId, threadId, role, content }`
* **GET `/api/context?threadId=&n=12`** → `{ summary, recent }` (summary는 내부 전용)
* **POST `/api/summarize`** → `{ threadId }` → 요약 5~8줄 upsert
* **POST `/api/chat`** → `{ sessionId, threadId, message }`

  * 컨텍스트(summary + 최근 N턴)로 Solar 호출
  * **system 프롬프트는 본 문서 §3 사용**
  * assistant 응답 자동 저장 → `{ content }` 반환
  * 필요 시 `/api/summarize` 비동기 트리거

---

## 8) 프런트엔드(UI) 가이드

* **레이아웃**: `h-screen grid grid-cols-[18rem_1fr]` (사이드바/본문)
* **중앙 고정 폭**: 메시지/코드도크/입력창 컨테이너에
  `mx-auto w-full max-w-3xl` 적용(필요 시 `max-w-2xl`)
* **메시지 버블**

  * 목록 컨테이너: `flex flex-col gap-3 flex-1 overflow-y-auto px-4 py-6`
  * 버블 폭 제한: `max-w-[65ch] sm:max-w-[70ch]`
  * user: `self-end bg-blue-100 border border-blue-200 rounded-xl shadow px-4 py-2`
  * assistant: `self-start bg-white border border-blue-100 rounded-xl shadow px-4 py-2`
  * 라벨: `mb-0.5 text-xs text-blue-500` (😀 / 🤖)
  * Markdown + 코드블록 하이라이트(overflow-x-auto)
* **입력창(하단 고정)**

  * footer: `sticky bottom-0 bg-white/90 border-t py-3`
  * form: `mx-auto w-full max-w-3xl flex items-end gap-3 px-4`
  * textarea: `resize-none rounded-lg border px-3 py-2 focus:(ring-2 ring-blue-400 outline-hidden)`
  * 버튼: `bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 shadow`
* **요약 UI**: **표시하지 않음** (관리자 모드에서만 토글 가능)

---

## 9) 대화 운영 정책(UX)

1. **응답은 항상**: **💡설명 + 🤔질문**
2. **학생이 막히면**: 대체 질문 3~5개 제시
3. **자료 덤핑 금지**: 한 응답 6~10줄, 학생이 “계속” 요청 시 다음 묶음
4. **기록 유도**: “오늘 알게 된 점을 한 줄로 적어볼래?”로 마무리 가능
5. **스크롤 UX**: 새 메시지 후 `scrollIntoView({ behavior: 'smooth' })`

---

## 10) 오류/안내 프로토콜

* **사실 불확실**: “이 부분은 확실히 알려진 정보가 아니에요. 대신 ~를 먼저 살펴볼까요?”
* **범위 밖 요청**: “이 챗봇은 직업 조사 도우미예요. 원하는 직업을 말해주면 함께 알아볼게요.”
* **네트워크/서버 오류**: 원인 한 줄 + 재시도 유도, 로그 기록

---

## 11) QA 체크리스트

* [ ] 시스템 프롬프트가 **§3 그대로** 적용되었는가?
* [ ] 응답이 항상 **설명+질문** 형식을 지키는가?
* [ ] 질문이 막히면 **대체 질문**을 제시하는가?
* [ ] 요약이 **UI에 표시되지 않고** 컨텍스트로만 쓰이는가?
* [ ] 새 직업 → **새 스레드**로 분리되는가?
* [ ] PATCH 시 **updated_at=now()** 반영되는가?
* [ ] 중앙 고정 폭(`max-w-3xl`), 버블 폭 제한(`max-w-[65ch]`) 적용되어 가독성이 좋은가?
* [ ] 한 응답 길이가 6~10줄로 유지되는가?

---

## 12) 배포/환경

* Vercel 배포, `.env`/프로젝트 환경변수 설정(서비스 키는 서버 전용)
* Tailwind 4.0 유지: CSS 진입점 `@import "tailwindcss"` 사용, 구버전 지시문 금지
* Supabase 콘솔에서 테이블/인덱스/트리거 초기화(마이그레이션 스크립트 준비 권장)

---

## 부록) 빠른 시작(개발자용)

1. 환경변수 세팅 → `npm run dev`
2. `/api/login` → 세션 발급 → `/chat`
3. 사이드바에서 **새 스레드** → 직업 입력 시작
4. 대화 길어지면 **/api/summarize** 버튼으로 요약 갱신(화면 표시 X)

---

> 이 문서는 CareerBuddy의 **유일한 기준 문서**입니다.
> 기능/프롬프트/스키마/정책 변경 시 **반드시 본 파일을 우선 업데이트**하고 구현하세요.
