# Step 5: usage-core-basic (Rust, TDD)

로컬 Claude Code 세션에서 **현재 세션 컨텍스트%·토큰만** 안전하게 읽어 프론트에 숫자로 전달한다. (한도 근사·연동은 v2.)

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL — FS는 Rust만, 숫자만 IPC, 호출자 경로 금지, 실패해도 어항 무중단)
- `/docs/ADR.md` (ADR-002 소스, 008 보안, 009 실패 격리)
- `/docs/ARCHITECTURE.md` (데이터 흐름, `usage.rs` 위치)
- `phases/0-mvp/spike-usage.py` 또는 step0 산출(파싱 로직 참고)
- step1 산출(`src-tauri/`, capabilities)

## 작업

`src-tauri/src/usage.rs`:
- `~/.claude/projects/**/*.jsonl`에서 **현재(cwd 매칭) 세션의 최신 assistant 메시지** 토큰으로 컨텍스트 점유 = `input + cache_creation + cache_read`, 누적 `output_tokens` 합 계산.
- `model` → 컨텍스트 한도 매핑(`claude-opus-4-7*`=1_000_000, 그 외 `unknown`→% 생략). 한도 0/누락 시 0 나눗셈 가드.
- `UsageSnapshot { context_tokens, context_limit: Option, context_pct: Option, cumulative_output_tokens, model }` 를 interval(예: 3s)로 Tauri 이벤트 emit.
- capabilities에 `~/.claude/**` **읽기 전용** 권한만 추가.
- **견고성**: 잘린 마지막 줄/누락 필드/알 수 없는 모델/빈 디렉토리/권한 오류 → 해당 줄·파일만 skip, panic/`unwrap` 금지, 파일별 실패 격리.

골든 픽스처 `src-tauri/tests/fixtures/`: 정상, 잘린 줄, 누락 필드, 알 수 없는 모델, 빈 파일. `cargo test`로 파서 출력 단언.

## Acceptance Criteria

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
- 픽스처 케이스 전부 통과(잘린 줄/누락 필드/알 수 없는 모델에서도 panic 없이 합리적 출력).

## 검증 절차

1. AC 통과.
2. IPC 페이로드가 **숫자/모델 id만**이고 메시지 본문이 일절 없는지 확인.
3. Rust command가 호출자 경로 인자를 받지 않는지(경로 내부 유도) 확인.
4. `phases/0-mvp/index.json` step 5 업데이트.

## 금지사항

- 메시지 본문/프롬프트 텍스트를 IPC·로그·영속화 금지. 이유: 민감 내용 비유출(ADR-008).
- 프론트에서 받은 경로로 파일 읽기 금지(path traversal). 이유: 보안.
- `unwrap`/`expect`로 인한 panic 금지. 이유: 어항 무중단(ADR-009).
- 한도 근사(롤링5h)·사용량↔어항 연동 구현 금지. 이유: v2 범위.
