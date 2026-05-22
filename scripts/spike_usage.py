#!/usr/bin/env python3
"""Spike A (throwaway): verify Claude Code usage parsing assumptions.

Reads ~/.claude/projects/**/*.jsonl, extracts token aggregates from
assistant messages' message.usage, and approximates context occupancy
and context-window % so the numbers can be eyeballed against the real
Claude Code /usage display.

PRIVACY: prints only numbers, model ids, session ids. Never message bodies.
Best-effort: skips unreadable files / truncated lines / missing fields.
Never raises on bad data.
"""

import glob
import json
import os

# claude-opus-4-7 family => 1M context window. Everything else: unknown.
def context_limit(model):
    if not model:
        return None
    if model.startswith("claude-opus-4-7"):
        return 1_000_000
    return None


def occupancy(usage):
    """Approx context occupancy = input + cache_creation + cache_read."""
    return (
        usage.get("input_tokens", 0)
        + usage.get("cache_creation_input_tokens", 0)
        + usage.get("cache_read_input_tokens", 0)
    )


def parse_session(path):
    """Return per-session aggregate, or None if nothing usable."""
    last_model = None
    last_occupancy = None
    total_output = 0
    seen = False
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)  # truncated last line -> skip
                except (json.JSONDecodeError, ValueError):
                    continue
                if not isinstance(rec, dict) or rec.get("type") != "assistant":
                    continue
                msg = rec.get("message")
                if not isinstance(msg, dict):
                    continue
                usage = msg.get("usage")
                if not isinstance(usage, dict):
                    continue
                seen = True
                last_model = msg.get("model")
                last_occupancy = occupancy(usage)
                out = usage.get("output_tokens", 0)
                if isinstance(out, int):
                    total_output += out
    except OSError:
        return None
    if not seen:
        return None
    return {
        "session": os.path.splitext(os.path.basename(path))[0],
        "model": last_model,
        "occupancy": last_occupancy,
        "total_output": total_output,
        "mtime": os.path.getmtime(path),
    }


def main():
    root = os.path.expanduser("~/.claude/projects")
    paths = glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True)
    rows = []
    for p in paths:
        r = parse_session(p)
        if r:
            rows.append(r)

    rows.sort(key=lambda r: r["mtime"], reverse=True)

    print(f"\n  ~/.claude/projects  —  {len(rows)} session(s) with usage data\n")
    header = f"  {'SESSION':<14} {'MODEL':<22} {'OCCUPANCY':>11} {'CTX %':>8} {'OUT TOK':>11}"
    print(header)
    print("  " + "-" * (len(header) - 2))

    for r in rows[:30]:
        sid = r["session"][:12]
        model = (r["model"] or "unknown")[:22]
        occ = r["occupancy"]
        limit = context_limit(r["model"])
        if occ is not None and limit:
            pct = f"{occ / limit * 100:6.1f}%"
        else:
            pct = "   n/a"
        occ_s = f"{occ:,}" if occ is not None else "n/a"
        print(f"  {sid:<14} {model:<22} {occ_s:>11} {pct:>8} {r['total_output']:>11,}")

    if rows:
        latest = rows[0]
        limit = context_limit(latest["model"])
        occ = latest["occupancy"]
        print("\n  LATEST SESSION (most recently modified):")
        print(f"    session     : {latest['session']}")
        print(f"    model       : {latest['model'] or 'unknown'}")
        print(f"    limit       : {limit:,} tokens" if limit else "    limit       : unknown")
        print(f"    occupancy   : {occ:,} tokens" if occ is not None else "    occupancy   : n/a")
        if occ is not None and limit:
            print(f"    context %   : {occ / limit * 100:.1f}%")
        else:
            print("    context %   : n/a")
        print(f"    out tokens  : {latest['total_output']:,} (cumulative this session)")
    else:
        print("\n  No usage data found (HUD would show 'no data').")
    print()


if __name__ == "__main__":
    main()
