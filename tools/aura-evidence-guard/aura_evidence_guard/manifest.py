from __future__ import annotations

import hmac
import json
import os
import stat
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from .hashing import git_blob_sha1_file, sha256_file

SCHEMA = "AURA-EVIDENCE-MANIFEST/1.0"
GOVERNANCE_FIELDS = {
    "authority": "NONE",
    "governance_effect": "NONE",
    "authorization_effect": "NONE",
    "release_effect": "NONE",
}


class ManifestError(ValueError):
    pass


def _safe_relpath(value: Any) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise ManifestError("manifest_path_invalid")
    p = PurePosixPath(value)
    if p.is_absolute() or any(part in ("", ".", "..") for part in p.parts) or p.parts[0].endswith(":"):
        raise ManifestError("manifest_path_unsafe")
    return p.as_posix()


def _scan_files(root: Path, excluded: set[Path]) -> list[Path]:
    result: list[Path] = []
    for current, dirs, names in os.walk(root, topdown=True, followlinks=False):
        here = Path(current)
        kept = []
        for name in sorted(dirs):
            child = here / name
            if name == ".git":
                continue
            if child.is_symlink():
                raise ManifestError("symlink_directory_not_allowed:" + child.relative_to(root).as_posix())
            kept.append(name)
        dirs[:] = kept
        for name in sorted(names):
            path = here / name
            if path.resolve() in excluded:
                continue
            if path.is_symlink():
                raise ManifestError("symlink_not_allowed:" + path.relative_to(root).as_posix())
            if not stat.S_ISREG(path.lstat().st_mode):
                raise ManifestError("non_regular_file_not_allowed:" + path.relative_to(root).as_posix())
            result.append(path)
    return sorted(result, key=lambda p: p.relative_to(root).as_posix())


def create_manifest(root: Path, output: Path | None = None) -> dict[str, Any]:
    root = root.expanduser().resolve(strict=True)
    excluded = {output.expanduser().resolve()} if output is not None and output.exists() else set()
    entries = []
    for path in _scan_files(root, excluded):
        entries.append({
            "path": path.relative_to(root).as_posix(),
            "size_bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "git_blob_sha1": git_blob_sha1_file(path),
        })
    return {
        "schema": SCHEMA,
        "created_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "hash_algorithms": {"content": "SHA-256", "git_blob": "Git blob SHA-1"},
        "source_root": ".",
        "file_count": len(entries),
        "files": entries,
        **GOVERNANCE_FIELDS,
    }


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out = {}
    for key, value in pairs:
        if key in out:
            raise ManifestError("duplicate_json_key:" + key)
        out[key] = value
    return out


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        obj = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates,
                         parse_constant=lambda c: (_ for _ in ()).throw(ManifestError("invalid_json_constant:" + c)))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ManifestError("manifest_json_invalid") from exc
    if not isinstance(obj, dict) or obj.get("schema") != SCHEMA:
        raise ManifestError("manifest_schema_invalid")
    if not isinstance(obj.get("files"), list) or obj.get("file_count") != len(obj["files"]):
        raise ManifestError("manifest_file_inventory_invalid")
    for name, expected in GOVERNANCE_FIELDS.items():
        if obj.get(name) != expected:
            raise ManifestError("governance_boundary_violation:" + name)
    return obj


def verify_manifest(root: Path, manifest_path: Path) -> dict[str, Any]:
    root = root.expanduser().resolve(strict=True)
    manifest_path = manifest_path.expanduser()
    doc = load_manifest(manifest_path)
    manifest_abs = manifest_path.resolve() if manifest_path.exists() else None
    expected: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, Any]] = []
    for entry in doc["files"]:
        if not isinstance(entry, dict):
            failures.append({"check": "entry_shape", "result": "FAIL"})
            continue
        try:
            rel = _safe_relpath(entry.get("path"))
        except ManifestError:
            failures.append({"check": "entry_path", "result": "FAIL"})
            continue
        if rel in expected:
            failures.append({"check": "unique_path", "path": rel, "result": "FAIL"})
        else:
            expected[rel] = entry
    actual_files = _scan_files(root, {manifest_abs} if manifest_abs else set())
    actual = {p.relative_to(root).as_posix() for p in actual_files}
    for rel, entry in expected.items():
        path = root / rel
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(root)
        except (OSError, ValueError):
            failures.append({"check": "file_present_and_contained", "path": rel, "result": "FAIL"})
            continue
        if path.is_symlink() or not path.is_file():
            failures.append({"check": "regular_file", "path": rel, "result": "FAIL"})
            continue
        size = path.stat().st_size
        if type(entry.get("size_bytes")) is not int or size != entry["size_bytes"]:
            failures.append({"check": "size_bytes", "path": rel, "result": "FAIL"})
        actual_sha = sha256_file(path)
        wanted_sha = entry.get("sha256")
        if not isinstance(wanted_sha, str) or not hmac.compare_digest(actual_sha, wanted_sha):
            failures.append({"check": "sha256", "path": rel, "result": "FAIL"})
        actual_git_blob = git_blob_sha1_file(path)
        wanted_blob = entry.get("git_blob_sha1")
        if not isinstance(wanted_blob, str) or not hmac.compare_digest(actual_git_blob, wanted_blob):
            failures.append({"check": "git_blob_sha1", "path": rel, "result": "FAIL"})
    if actual - set(expected):
        failures.append({"check": "no_unlisted_files", "paths": sorted(actual - set(expected)), "result": "FAIL"})
    if set(expected) - actual:
        failures.append({"check": "all_manifest_files_present", "paths": sorted(set(expected) - actual), "result": "FAIL"})
    return {
        "schema": "AURA-EVIDENCE-MANIFEST-VERIFICATION/1.0",
        "result": "FAIL" if failures else "PASS",
        "root": str(root),
        "manifest_path": str(manifest_path),
        "expected_file_count": doc["file_count"],
        "actual_file_count": len(actual),
        "checks_failed": failures,
        **GOVERNANCE_FIELDS,
    }


def write_json_atomic(path: Path, value: Any) -> None:
    path = path.expanduser().absolute()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
    fd, name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    tmp = Path(name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
