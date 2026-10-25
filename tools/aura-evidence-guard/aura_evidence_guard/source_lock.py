from __future__ import annotations

import hashlib
import hmac
import os
import re
import subprocess
import urllib.parse
from pathlib import Path, PurePosixPath
from typing import Any


class SourceLockError(ValueError):
    pass


def _git_env() -> dict[str, str]:
    env = os.environ.copy()
    # Environment overrides can redirect Git to another repository or alter its object/config view.
    for key in tuple(env):
        if key.startswith("GIT_"):
            env.pop(key, None)
    env["GIT_CONFIG_NOSYSTEM"] = "1"
    env["GIT_TERMINAL_PROMPT"] = "0"
    return env


def _git(root: Path, *args: str, timeout: int = 30) -> str:
    result = subprocess.run(
        ["git", "-c", "core.fsmonitor=false", "-c", f"core.hooksPath={os.devnull}", "-C", str(root), *args],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=timeout, env=_git_env(),
    )
    if result.returncode:
        raise SourceLockError("git_read_only_check_failed:" + (args[0] if args else "unknown"))
    return result.stdout.decode("utf-8", errors="strict").strip()


def _git_config_exists(root: Path, key: str) -> bool:
    result = subprocess.run(
        ["git", "-c", "core.fsmonitor=false", "-c", f"core.hooksPath={os.devnull}", "-C", str(root), "config", "--get", key],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, env=_git_env(),
    )
    return result.returncode == 0


def _git_blob_sha1(data: bytes) -> str:
    digest = hashlib.sha1(usedforsecurity=False)
    digest.update(b"blob " + str(len(data)).encode("ascii") + b"\0")
    digest.update(data)
    return digest.hexdigest()


def verify_git_source(
    repo_root: Path,
    expected_commit: str,
    manifest_path: str,
    expected_blob_sha1: str,
    expected_sha256: str,
    expected_bytes: int,
    expected_origin: str = "https://github.com/vaidt/aura-specification.git",
) -> dict[str, Any]:
    """Verify a pinned Git object entirely offline; never fetches or mutates refs."""
    root = repo_root.expanduser().resolve(strict=True)
    if not re.fullmatch(r"[0-9a-f]{40}", expected_commit) or not re.fullmatch(r"[0-9a-f]{40}", expected_blob_sha1):
        raise SourceLockError("commit_and_blob_oids_must_be_40_lowercase_hex")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise SourceLockError("expected_sha256_must_be_64_lowercase_hex")
    if isinstance(expected_bytes, bool) or not isinstance(expected_bytes, int) or expected_bytes < 0:
        raise SourceLockError("expected_bytes_must_be_nonnegative_integer")
    rel = PurePosixPath(manifest_path)
    if not manifest_path or rel.is_absolute() or "\\" in manifest_path or "\x00" in manifest_path or any(p in ("", ".", "..") for p in rel.parts):
        raise SourceLockError("manifest_path_must_be_safe_relative_path")
    git_dir = root / ".git"
    if git_dir.is_symlink() or not git_dir.is_dir():
        raise SourceLockError("standard_git_metadata_directory_required")
    if _git(root, "rev-parse", "--show-object-format") != "sha1":
        raise SourceLockError("unsupported_git_object_format")
    if _git(root, "rev-parse", "--is-shallow-repository") != "false":
        raise SourceLockError("shallow_checkout_not_allowed")
    if _git_config_exists(root, "extensions.partialClone") or _git_config_exists(root, "remote.origin.promisor") or _git_config_exists(root, "remote.origin.partialclonefilter"):
        raise SourceLockError("partial_clone_not_allowed")
    for rel_meta, error in (("objects/info/alternates", "external_git_object_alternates_not_allowed"),
                            ("info/grafts", "legacy_git_grafts_not_allowed")):
        metadata = git_dir / rel_meta
        if metadata.is_symlink():
            raise SourceLockError(error)
        if metadata.is_file() and metadata.read_text(encoding="utf-8", errors="replace").strip():
            raise SourceLockError(error)
    if _git(root, "for-each-ref", "--format=%(refname)", "refs/replace"):
        raise SourceLockError("git_replace_refs_not_allowed")
    head = _git(root, "rev-parse", "--verify", "HEAD")
    if not hmac.compare_digest(head, expected_commit):
        raise SourceLockError("head_does_not_match_pinned_commit")
    resolved = _git(root, "rev-parse", "--verify", f"{expected_commit}^{{commit}}")
    if not hmac.compare_digest(resolved, expected_commit):
        raise SourceLockError("pinned_commit_resolution_mismatch")
    origin = _git(root, "remote", "get-url", "origin")
    parsed = urllib.parse.urlsplit(origin)
    expected = expected_origin.removesuffix(".git").rstrip("/").lower()
    actual = origin.removesuffix(".git").rstrip("/").lower()
    if parsed.username or parsed.password or parsed.query or parsed.fragment or actual != expected:
        raise SourceLockError("origin_does_not_match_expected_repository")
    if _git(root, "status", "--porcelain", "--untracked-files=all"):
        raise SourceLockError("working_tree_not_clean")
    _git(root, "fsck", "--connectivity-only", "--no-reflogs", "--no-progress", expected_commit, timeout=180)
    blob = _git(root, "rev-parse", f"{expected_commit}:{manifest_path}")
    if not hmac.compare_digest(blob, expected_blob_sha1):
        raise SourceLockError("manifest_git_blob_oid_mismatch")
    proc = subprocess.run(
        ["git", "-c", "core.fsmonitor=false", "-c", f"core.hooksPath={os.devnull}", "-C", str(root),
         "cat-file", "blob", f"{expected_commit}:{manifest_path}"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, env=_git_env(), timeout=30,
    )
    if proc.returncode:
        raise SourceLockError("git_cat_file_failed")
    data = proc.stdout
    actual_sha256 = hashlib.sha256(data).hexdigest()
    if len(data) != expected_bytes or not hmac.compare_digest(actual_sha256, expected_sha256):
        raise SourceLockError("manifest_byte_length_or_sha256_mismatch")
    actual_blob = _git_blob_sha1(data)
    if not hmac.compare_digest(actual_blob, expected_blob_sha1):
        raise SourceLockError("manifest_git_blob_recalculation_mismatch")
    return {
        "schema": "AURA-GIT-SOURCE-LOCK/1.0", "result": "PASS", "repo_root": str(root), "origin": origin,
        "git_object_format": "sha1", "shallow": False, "partial_clone": False, "working_tree_clean": True,
        "pinned_commit": expected_commit, "resolved_commit": resolved, "manifest_path": manifest_path,
        "manifest_git_blob_sha1": actual_blob, "manifest_bytes": len(data), "manifest_sha256": actual_sha256,
        "network_used": False, "authority": "NONE", "governance_effect": "NONE",
        "authorization_effect": "NONE", "release_effect": "NONE",
    }
