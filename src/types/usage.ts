/**
 * Rust `UsageSnapshot`(usage.rs)와 1:1 대응하는 IPC 페이로드 타입.
 *
 * 숫자 집계·모델 id만 담는다 — 메시지 본문/프롬프트는 절대 포함되지 않는다 (CLAUDE.md, ADR-008).
 * 필드명은 Rust serde 직렬화(snake_case)를 그대로 따른다.
 */
export interface UsageSnapshot {
  /** 현재 세션 컨텍스트 점유 토큰(input + cache_creation + cache_read). */
  context_tokens: number;
  /** 모델별 컨텍스트 한도. 알 수 없는 모델이면 null. */
  context_limit: number | null;
  /** 컨텍스트 점유율(%). 한도 미상이거나 0이면 null. */
  context_pct: number | null;
  /** 이 세션의 누적 output 토큰 합. */
  cumulative_output_tokens: number;
  /** 마지막으로 관측된 모델 id. 데이터 없으면 null( = 데이터 없음 상태). */
  model: string | null;
}
