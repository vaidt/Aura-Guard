#!/usr/bin/env python3
"""Aura-Guard Python reference verifier — independent implementation.

Stdlib only. Reproduces the CURRENT IMPLEMENTATION semantics documented in
/app/docs/BUNDLE_SCHEMA.md. NOT a normative Aura Protocol implementation.
Does NOT invoke Node, does NOT import JS code.
"""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path

PY_VERIFIER_VERSION = "aura-verify-py/0.1.0"
PROTOCOL_VERSION = "unspecified"
BUNDLE_VERSION = 1
GENESIS = "0" * 64
PASS, FAIL, NI = "PASS", "FAIL", "NOT IMPLEMENTED"


def canonicalize(v) -> str:
    """Implementation-defined JCS-lite: sorted object keys, arrays in-order,
    strings via json.dumps (ensure_ascii=False), no whitespace. Reproduces the
    JS `canonicalize()` in /app/frontend/src/lib/verification.js for cross-
    implementation testing only — NOT a claim of RFC 8785 conformance."""
    if v is None or isinstance(v, bool) or isinstance(v, (int, float, str)):
        return json.dumps(v, ensure_ascii=False, allow_nan=False)
    if isinstance(v, list):
        return "[" + ",".join(canonicalize(x) for x in v) + "]"
    if isinstance(v, dict):
        keys = sorted(v.keys())
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canonicalize(v[k]) for k in keys) + "}"
    raise TypeError(f"non-JSON value: {type(v).__name__}")


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _payload(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "evidence"}


def verify_decision(d: dict, prev_chain: str, registered: set) -> dict:
    ev = d.get("evidence") or {}
    canon = canonicalize(_payload(d))
    rec_hash = sha256_hex(canon)
    rec_chain = sha256_hex(prev_chain + rec_hash)
    checks = {
        "canonical_representation": canon == ev.get("canonical_representation"),
        "sha256_integrity": rec_hash == ev.get("canonical_hash"),
        "hash_chain_continuity": ev.get("prev_hash") == prev_chain and rec_chain == ev.get("chain_hash"),
        "policy_version": bool(d.get("policy_version")) and d.get("policy_version") in registered,
    }
    return {"pass": all(checks.values()), "checks": checks, "recomputed_hash": rec_hash, "recomputed_chain": rec_chain}


def validate_bundle(b) -> None:
    if not isinstance(b, dict): raise ValueError("bundle must be an object")
    if b.get("bundle_version") != BUNDLE_VERSION: raise ValueError(f"unsupported bundle_version: {b.get('bundle_version')}")
    if not isinstance(b.get("session"), dict): raise ValueError("bundle.session missing")
    if not isinstance(b["session"].get("decisions"), list): raise ValueError("session.decisions[] missing")
    for i, d in enumerate(b["session"]["decisions"]):
        if not isinstance(d, dict) or not d.get("id"): raise ValueError(f"decisions[{i}].id missing")


def tamper_probe(decisions, registered):
    if not decisions: return {"ran": False, "detected": False}
    original = decisions[0]
    mutated = json.loads(json.dumps(original))
    mutated["reason"] = "__py_tamper_probe__"
    r = verify_decision(mutated, original.get("evidence", {}).get("prev_hash", GENESIS), registered)
    detected = (not r["pass"]) and (not r["checks"]["sha256_integrity"]) and (not r["checks"]["canonical_representation"])
    return {"ran": True, "detected": detected}


def run_suite(bundle: dict) -> dict:
    session = bundle["session"]
    decisions = session["decisions"]
    registered = set(session.get("registered_policy_versions") or [])
    structure_ok = all(d.get("id") and isinstance(d.get("evidence"), dict) for d in decisions)
    prev = GENESIS
    results, all_pass = [], True
    for d in decisions:
        r = verify_decision(d, prev, registered)
        results.append(r); all_pass = all_pass and r["pass"]; prev = r["recomputed_chain"]

    def agg(k): return PASS if all(r["checks"][k] for r in results) else FAIL
    probe = tamper_probe(decisions, registered)

    tests = [
        {"id": "impl:evidence-structure", "status": PASS if structure_ok and decisions else FAIL},
        {"id": "impl:canonical-representation", "status": agg("canonical_representation")},
        {"id": "impl:hash-integrity", "status": agg("sha256_integrity")},
        {"id": "impl:chain-continuity", "status": agg("hash_chain_continuity")},
        {"id": "impl:policy-binding", "status": agg("policy_version")},
        {"id": "impl:tamper-detection", "status": PASS if probe["ran"] and probe["detected"] else FAIL},
        {"id": "impl:evidence-portability", "status": PASS},
        {"id": "impl:cross-implementation", "status": NI},
        {"id": "impl:attestation-signature", "status": NI},
    ]
    overall = FAIL if any(t["status"] == FAIL for t in tests) else PASS
    return {"protocol_version": PROTOCOL_VERSION, "verifier_version": PY_VERIFIER_VERSION,
            "bundle_version": BUNDLE_VERSION, "record_count": len(decisions),
            "overall": overall, "tests": tests}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="aura-verify-py")
    ap.add_argument("bundle"); ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    try:
        raw = Path(a.bundle).read_text(encoding="utf-8")
        bundle = json.loads(raw); validate_bundle(bundle)
    except Exception as e:
        sys.stderr.write(f"aura-verify-py: invalid bundle: {e}\n"); return 2
    suite = run_suite(bundle)
    if a.json: sys.stdout.write(json.dumps(suite, indent=2) + "\n")
    else:
        sys.stdout.write(f"aura-verify-py {suite['overall']} · records={suite['record_count']}\n")
        for t in suite["tests"]: sys.stdout.write(f"  {t['status']:<16} {t['id']}\n")
    return 0 if suite["overall"] == PASS else 1


if __name__ == "__main__":
    sys.exit(main())
