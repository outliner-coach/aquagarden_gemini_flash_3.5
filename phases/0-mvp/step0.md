# Step 0: spikes (verify before build)

본 구현 전에 가장 리스크 큰 두 가정을 **버리는(throwaway) 스파이크**로 검증한다. 코드 자산을 만드는 단계가 아니다.

## 읽어야 할 파일

- `/docs/ADR.md` (ADR-002 사용량 소스, ADR-011 verify-before-build, ADR-008 보안)
- `/CLAUDE.md` (CRITICAL 규칙 — 특히 민감 내용 비유출)
- 실제 세션 샘플: `~/.claude/projects/` 하위 임의의 `*.jsonl` 한두 개의 구조

## 작업

### Spike A — 사용량 파싱 대조 (핵심)
`scripts/spike_usage.py`(throwaway) 작성:
- `~/.claude/projects/**/*.jsonl`를 읽어 `type == "assistant"` 메시지의 `message.usage`에서 토큰을 추출.
- **최신 세션의 컨텍스트 점유 근사** = 가장 마지막 assistant 메시지의 `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
- **모델→컨텍스트 한도 매핑**: `claude-opus-4-7` 계열 = 1,000,000(1M), 그 외는 best-effort/`unknown`.
- **컨텍스트 %** = 점유 / 한도.
- 누적 `output_tokens` 합도 출력.
- 결과를 사람이 읽기 좋게 표로 stdout 출력(세션 id, 모델, 점유 토큰, 컨텍스트%, 누적 출력 토큰).

### Spike B — Tauri 능력 확인 (문서 검증)
Tauri v2 공식 문서(context7 우선, 없으면 web)로 다음 API가 macOS에서 지원됨을 확인하고 한 줄씩 근거와 함께 메모:
- 투명 창(`transparent: true`), `alwaysOnTop`, `decorations: false`, `skipTaskbar`
- 클릭 통과: `setIgnoreCursorEvents` (또는 동등 API)
- 트레이/메뉴바 아이콘(`tray-icon`)
- `tauri-plugin-store`(설정 영속화)
확인 결과로 step1에서 쓸 `tauri.conf.json` 창 블록 초안을 `phases/0-mvp/spike-tauri.md`에 적는다(스캐폴드 금지).

## Acceptance Criteria

```bash
python3 scripts/spike_usage.py   # 에러 없이 표 출력
```

## 검증 절차

1. 위 커맨드로 수치 표가 출력되는지 확인.
2. Spike B 메모(`spike-tauri.md`)에 4개 능력 모두 "지원됨" 근거가 적혔는지 확인.
3. 이 step은 **사람의 눈 대조가 필요**하다. `phases/0-mvp/index.json`의 step 0을 다음으로 설정하고 **즉시 중단**한다:
   - `"status": "blocked"`, `"blocked_reason": "Spike A 출력 수치(컨텍스트%·토큰)를 사용자가 실제 Claude Code /usage 표시와 눈으로 대조 확인해야 함. 일치하면 step0를 completed로 바꾸고 재실행."`

## 금지사항

- 본 구현(Tauri 스캐폴드, src/ 코드) 시작 금지. 이 step은 throwaway 검증만. 이유: 가정이 틀리면 설계를 먼저 고쳐야 한다.
- 로그의 **메시지 본문/프롬프트 텍스트를 출력·저장 금지**. 숫자·모델 id·세션 id만. 이유: 민감 내용 비유출(ADR-008).
- 스스로 `completed`로 표시하지 마라. 반드시 `blocked`로 끝낸다. 이유: 사람 대조 게이트.
