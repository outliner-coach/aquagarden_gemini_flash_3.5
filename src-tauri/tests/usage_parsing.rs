//! 골든 픽스처로 사용량 파서를 단언한다 (TDD, ADR-009 실패 격리).
//! 잘린 줄·누락 필드·알 수 없는 모델·빈 파일·없는 파일에서 panic 없이
//! 합리적 출력을 내는지 검증한다.

use aquagarden_lib::usage::{context_limit, parse_session_file};
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name)
}

#[test]
fn normal_session_uses_last_assistant_occupancy_and_sums_output() {
    let snap = parse_session_file(&fixture("normal.jsonl")).expect("normal fixture has usage");
    // 컨텍스트 점유 = 마지막 assistant 메시지의 input + cache_creation + cache_read.
    assert_eq!(snap.context_tokens, 6000);
    assert_eq!(snap.context_limit, Some(1_000_000));
    // 6000 / 1_000_000 * 100 = 0.6
    let pct = snap.context_pct.expect("opus has a limit -> pct");
    assert!((pct - 0.6).abs() < 1e-9, "pct was {pct}");
    // 누적 output = 50 + 75.
    assert_eq!(snap.cumulative_output_tokens, 125);
    assert_eq!(snap.model.as_deref(), Some("claude-opus-4-7"));
}

#[test]
fn truncated_last_line_is_skipped_without_panic() {
    let snap = parse_session_file(&fixture("truncated.jsonl")).expect("first line is valid");
    // 잘린 마지막 줄은 무시하고 직전 유효 줄을 사용.
    assert_eq!(snap.context_tokens, 60);
    assert_eq!(snap.cumulative_output_tokens, 5);
    assert_eq!(snap.model.as_deref(), Some("claude-opus-4-7"));
}

#[test]
fn missing_fields_degrade_to_zero_and_skip_usage_less_lines() {
    let snap = parse_session_file(&fixture("missing_fields.jsonl")).expect("third line has usage");
    // usage 없는 assistant 줄은 건너뛰고, 누락 필드는 0으로 처리.
    assert_eq!(snap.context_tokens, 5);
    assert_eq!(snap.cumulative_output_tokens, 10);
    assert_eq!(snap.model.as_deref(), Some("claude-opus-4-7"));
}

#[test]
fn unknown_model_omits_limit_and_pct() {
    let snap = parse_session_file(&fixture("unknown_model.jsonl")).expect("has usage");
    assert_eq!(snap.context_tokens, 100);
    assert_eq!(snap.context_limit, None);
    assert_eq!(snap.context_pct, None); // 0 나눗셈/근거 없는 % 생략.
    assert_eq!(snap.cumulative_output_tokens, 20);
    assert_eq!(snap.model.as_deref(), Some("claude-haiku-4-5-20251001"));
}

#[test]
fn empty_file_yields_no_snapshot() {
    assert!(parse_session_file(&fixture("empty.jsonl")).is_none());
}

#[test]
fn missing_file_yields_no_snapshot_without_panic() {
    assert!(parse_session_file(&fixture("does_not_exist.jsonl")).is_none());
}

#[test]
fn context_limit_maps_opus_family_only() {
    assert_eq!(context_limit("claude-opus-4-7"), Some(1_000_000));
    // CC 로그는 "[1m]" 접미사 변형을 쓰기도 한다 (step0 산출).
    assert_eq!(context_limit("claude-opus-4-7[1m]"), Some(1_000_000));
    assert_eq!(context_limit("claude-haiku-4-5-20251001"), None);
    assert_eq!(context_limit(""), None);
}
