from __future__ import annotations

import hashlib
import hmac
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

from .hashing import sha256_file
from .manifest import GOVERNANCE_FIELDS


class PreservationError(ValueError):
    pass


def _safe_member(name: str, is_dir: bool = False) -> bool:
    if not name or "\\" in name or "\x00" in name or name.startswith("/"):
        return False
    raw = name[:-1] if is_dir and name.endswith("/") else name
    parts = raw.split("/")
    return bool(raw) and not PurePosixPath(raw).is_absolute() and all(p not in ("", ".", "..") and ":" not in p for p in parts)


def verify_preservation_zip(archive: Path, expected_sha256: str | None = None) -> dict[str, Any]:
    archive = archive.expanduser().absolute()
    if archive.is_symlink() or not archive.is_file():
        raise PreservationError("archive_must_be_a_regular_non_symlink_file")
    size = archive.stat().st_size
    if size > 2 * 1024**3:
        raise PreservationError("archive_size_limit_exceeded")
    actual = sha256_file(archive)
    failures: list[dict[str, Any]] = []
    if expected_sha256 is not None:
        if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256):
            raise PreservationError("expected_sha256_must_be_64_hex_chars")
        if not hmac.compare_digest(actual, expected_sha256.lower()):
            failures.append({"check": "archive_sha256", "result": "FAIL", "expected": expected_sha256.lower(), "actual": actual})
    try:
        with zipfile.ZipFile(archive) as zf:
            infos = zf.infolist()
            if len(infos) > 50000 or sum(i.file_size for i in infos) > 5 * 1024**3:
                raise PreservationError("zip_member_or_uncompressed_size_limit_exceeded")
            names = [i.filename for i in infos]
            if len(names) != len(set(names)):
                failures.append({"check": "unique_member_names", "result": "FAIL"})
            for info in infos:
                mode = (info.external_attr >> 16) & 0xffff
                kind = stat.S_IFMT(mode)
                if not _safe_member(info.filename, info.is_dir()) or stat.S_ISLNK(mode) or kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                    failures.append({"check": "safe_regular_member", "path": info.filename, "result": "FAIL"})
            bad = zf.testzip()
            if bad:
                failures.append({"check": "zip_crc", "member": bad, "result": "FAIL"})
            if "SHA256SUMS.txt" in names:
                raw = zf.read("SHA256SUMS.txt")
                try:
                    lines = raw.decode("utf-8", errors="strict").splitlines()
                except UnicodeDecodeError as exc:
                    raise PreservationError("SHA256SUMS.txt_not_utf8") from exc
                listed = {}
                for line in lines:
                    match = re.fullmatch(r"([0-9a-fA-F]{64})  (.+)", line)
                    if not match or not _safe_member(match.group(2)):
                        failures.append({"check": "sha256sum_line", "line": line, "result": "FAIL"})
                        continue
                    if match.group(2) in listed:
                        failures.append({"check": "sha256sum_unique_path", "path": match.group(2), "result": "FAIL"})
                    listed[match.group(2)] = match.group(1).lower()
                payload_names = {n for n in names if not n.endswith("/") and n != "SHA256SUMS.txt"}
                if set(listed) != payload_names:
                    failures.append({"check": "sha256sum_exact_inventory", "result": "FAIL",
                                     "missing": sorted(payload_names - set(listed)), "extra": sorted(set(listed) - payload_names)})
                for name in sorted(payload_names & set(listed)):
                    if not hmac.compare_digest(hashlib.sha256(zf.read(name)).hexdigest(), listed[name]):
                        failures.append({"check": "sha256sum_digest", "path": name, "result": "FAIL"})
    except zipfile.BadZipFile as exc:
        raise PreservationError("invalid_zip_archive") from exc
    return {"schema": "AURA-PRESERVATION-ZIP-VERIFICATION/1.0", "archive": str(archive),
            "archive_bytes": size, "archive_sha256": actual, "result": "FAIL" if failures else "PASS",
            "checks_failed": failures, **GOVERNANCE_FIELDS}
