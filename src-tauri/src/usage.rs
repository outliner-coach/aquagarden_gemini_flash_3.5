//! 사용량 코어 (v1 기본): 로컬 Claude Code 세션에서 현재 세션의
//! 컨텍스트 점유·토큰만 안전하게 읽어 프론트에 **숫자로만** 전달한다.
//!
//! 보안/안정성 (CLAUDE.md, ADR-002·008·009):
//! - FS 접근은 전부 여기(Rust)에서. 웹뷰는 IPC 이벤트만 구독한다.
//! - IPC 페이로드는 숫자 집계·모델 id만. 메시지 본문/프롬프트는 일절 읽지·내보내지 않는다.
//! - 경로는 내부에서만 유도한다(호출자 경로 인자 금지) → path traversal 차단.
//! - 로그 부재·포맷 드리프트·잘린 줄·알 수 없는 모델·권한 오류는 해당 줄/파일만 skip.
//!   파싱은 panic/unwrap 하지 않는다 — 어항은 멈추지 않는다.
//!
//! 한도 근사(롤링5h)·사용량↔어항 연동은 여기서 다루지 않는다(v2 범위).

use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::Serialize;
use serde_json::Value;

/// 프론트로 보내는 사용량 스냅샷. **숫자 집계와 모델 id만** 담는다(민감 내용 비유출).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct UsageSnapshot {
    /// 현재 세션 컨텍스트 점유 = 최신 assistant 메시지의 input + cache_creation + cache_read.
    pub context_tokens: u64,
    /// 모델별 컨텍스트 한도. 알 수 없는 모델이면 `None`.
    pub context_limit: Option<u64>,
    /// 컨텍스트 점유율(%). 한도를 모르거나 0이면 `None`(0 나눗셈 가드).
    pub context_pct: Option<f64>,
    /// 이 세션의 누적 output 토큰 합.
    pub cumulative_output_tokens: u64,
    /// 마지막으로 관측된 모델 id. 데이터 없으면 `None`.
    pub model: Option<String>,
}

impl UsageSnapshot {
    /// "데이터 없음" 상태 — HUD가 이 값을 받으면 빈 상태로 표시한다 (ADR-009).
    pub fn empty() -> Self {
        Self {
            context_tokens: 0,
            context_limit: None,
            context_pct: None,
            cumulative_output_tokens: 0,
            model: None,
        }
    }
}

/// 모델 id → 컨텍스트 한도. opus-4-7 계열만 1M, 그 외는 알 수 없음(`None`).
/// (haiku 등 다른 모델의 정밀 한도는 v2에서.)
pub fn context_limit(model: &str) -> Option<u64> {
    if model.starts_with("claude-opus-4-7") {
        Some(1_000_000)
    } else {
        None
    }
}

/// usage 객체에서 컨텍스트 점유를 계산. 누락 필드는 0으로 graceful degrade.
fn occupancy(usage: &Value) -> u64 {
    let f = |k: &str| usage.get(k).and_then(Value::as_u64).unwrap_or(0);
    f("input_tokens") + f("cache_creation_input_tokens") + f("cache_read_input_tokens")
}

/// 한 세션(.jsonl) 파일을 파싱해 스냅샷을 만든다. 사용 가능한 usage가 없으면 `None`.
///
/// 파일별로 실패를 격리한다: 열기 실패·잘린 줄·누락 필드·UTF-8 오류는 해당 줄/파일만
/// 건너뛰고 panic 하지 않는다.
pub fn parse_session_file(path: &Path) -> Option<UsageSnapshot> {
    let file = File::open(path).ok()?; // 권한 오류·없는 파일 → None
    let reader = BufReader::new(file);

    let mut last_model: Option<String> = None;
    let mut last_occupancy: u64 = 0;
    let mut cumulative_output: u64 = 0;
    let mut seen = false;

    for line in reader.lines() {
        // UTF-8 오류 등 읽기 실패한 줄은 건너뛴다.
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // 잘린(불완전) JSON 줄 → skip.
        let rec: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if rec.get("type").and_then(Value::as_str) != Some("assistant") {
            continue;
        }
        let msg = match rec.get("message") {
            Some(m) if m.is_object() => m,
            _ => continue,
        };
        let usage = match msg.get("usage") {
            Some(u) if u.is_object() => u,
            _ => continue, // usage 없는 assistant 줄은 무시.
        };

        seen = true;
        last_occupancy = occupancy(usage);
        last_model = msg
            .get("model")
            .and_then(Value::as_str)
            .map(str::to_string);
        cumulative_output += usage.get("output_tokens").and_then(Value::as_u64).unwrap_or(0);
    }

    if !seen {
        return None;
    }

    let limit = last_model.as_deref().and_then(context_limit);
    let pct = match limit {
        Some(l) if l > 0 => Some(last_occupancy as f64 / l as f64 * 100.0),
        _ => None, // 한도 미상 또는 0 → % 생략.
    };

    Some(UsageSnapshot {
        context_tokens: last_occupancy,
        context_limit: limit,
        context_pct: pct,
        cumulative_output_tokens: cumulative_output,
        model: last_model,
    })
}

/// `~/.claude/projects` 경로. HOME 미설정이면 `None`.
fn projects_root() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".claude").join("projects"))
}

/// 현재 작업 디렉토리를 Claude Code 프로젝트 폴더명 규칙으로 인코딩한다.
/// (영숫자가 아닌 모든 문자는 '-'. 예: /Users/wk/ai → -Users-wk-ai)
fn encode_cwd() -> Option<String> {
    let cwd = std::env::current_dir().ok()?;
    let encoded: String = cwd
        .to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    Some(encoded)
}

/// 디렉토리 내 가장 최근 수정된 `.jsonl` 파일을 찾는다(읽기 실패는 무시).
fn latest_jsonl_in(dir: &Path) -> Option<(PathBuf, SystemTime)> {
    let entries = fs::read_dir(dir).ok()?;
    let mut best: Option<(PathBuf, SystemTime)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let mtime = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        if best.as_ref().map_or(true, |(_, bt)| mtime > *bt) {
            best = Some((path, mtime));
        }
    }
    best
}

/// 현재 세션 파일을 내부에서 유도한다(호출자 입력 없음, path traversal 차단).
/// cwd 매칭 프로젝트 폴더를 우선하고, 없으면 전 프로젝트에서 가장 최근 세션으로 폴백.
fn current_session_file() -> Option<PathBuf> {
    let root = projects_root()?;

    // 1순위: 현재 cwd에 매칭되는 프로젝트 폴더의 최신 세션.
    if let Some(encoded) = encode_cwd() {
        let dir = root.join(&encoded);
        if dir.is_dir() {
            if let Some((path, _)) = latest_jsonl_in(&dir) {
                return Some(path);
            }
        }
    }

    // 폴백: 전 프로젝트 통틀어 가장 최근 수정된 세션(= 지금 작업 중인 세션 근사).
    let entries = fs::read_dir(&root).ok()?;
    let mut best: Option<(PathBuf, SystemTime)> = None;
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        if let Some((path, mtime)) = latest_jsonl_in(&dir) {
            if best.as_ref().map_or(true, |(_, bt)| mtime > *bt) {
                best = Some((path, mtime));
            }
        }
    }
    best.map(|(path, _)| path)
}

/// 현재 세션 스냅샷. 세션을 못 찾거나 비었으면 "데이터 없음"을 반환(어항은 무중단).
pub fn current_snapshot() -> UsageSnapshot {
    current_session_file()
        .and_then(|path| parse_session_file(&path))
        .unwrap_or_else(UsageSnapshot::empty)
}

/// 프론트가 구독하는 사용량 이벤트 이름.
pub const USAGE_EVENT: &str = "usage://snapshot";

/// 백그라운드 폴링 주기.
const POLL_INTERVAL: Duration = Duration::from_secs(3);

/// 백그라운드 스레드에서 주기적으로 스냅샷을 emit 한다.
/// 즉시 1회 emit 후 interval 반복 — HUD 초기 표시 지연을 줄인다.
pub fn start_usage_polling<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    use tauri::Emitter;
    std::thread::spawn(move || loop {
        let snapshot = current_snapshot();
        // emit 실패(웹뷰 미준비 등)는 무시 — best-effort 오버레이.
        let _ = app.emit(USAGE_EVENT, &snapshot);
        std::thread::sleep(POLL_INTERVAL);
    });
}
