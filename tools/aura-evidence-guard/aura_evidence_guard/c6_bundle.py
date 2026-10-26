from __future__ import annotations

import hashlib
import hmac
import json
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

from .hashing import git_blob_sha1_bytes, sha256_file
from .manifest import GOVERNANCE_FIELDS


class C6BundleError(ValueError):
    """Raised when a C6 evidence bundle cannot be safely validated."""


def _strict_json(raw: bytes, label: str) -> Any:
    def no_duplicate_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate_json_key:{key}")
            result[key] = value
        return result

    try:
        return json.loads(
            raw.decode("utf-8", errors="strict"),
            object_pairs_hook=no_duplicate_keys,
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"nonstandard_json_constant:{value}")),
        )
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise C6BundleError(f"invalid_or_ambiguous_json:{label}:{type(exc).__name__}") from exc


def _safe_member_name(name: str, *, is_dir: bool = False) -> bool:
    if not name or "\\" in name or "\x00" in name or name.startswith("/"):
        return False
    raw = name[:-1] if is_dir and name.endswith("/") else name
    parts = raw.split("/")
    if not raw or any(part in ("", ".", "..") for part in parts):
        return False
    if any(":" in part for part in parts):
        return False
    return not PurePosixPath(raw).is_absolute()


def verify_c6_evidence_bundle(
    archive: Path,
    expected_sha256: str | None = None,
    expected_run_id: int | None = None,
    expected_candidate_sha: str | None = None,
) -> dict[str, Any]:
    """Verify C6 Candidate Lab ZIP bytes and its internal integrity manifest.

    PASS means only that the archive and its internally bound files/metadata are intact.
    It deliberately does not assert conformance, contract ratification, authority, or release readiness.
    """
    if expected_candidate_sha is not None and (
        not isinstance(expected_candidate_sha, str)
        or re.fullmatch(r"[0-9a-f]{40}", expected_candidate_sha) is None
    ):
        raise C6BundleError("expected_candidate_sha_must_be_40_lowercase_hex_chars")
    archive = archive.expanduser().absolute()
    if archive.is_symlink():
        raise C6BundleError("archive_must_not_be_symlink")
    archive = archive.resolve(strict=True)
    size = archive.stat().st_size
    if size > 512 * 1024**2:
        raise C6BundleError("archive_exceeds_512_MiB_safety_limit")

    actual_archive_sha = sha256_file(archive)
    failures: list[dict[str, Any]] = []
    if expected_sha256 is not None:
        if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256):
            raise C6BundleError("expected_sha256_must_be_64_hex_chars")
        if not hmac.compare_digest(actual_archive_sha, expected_sha256.lower()):
            failures.append({"check": "archive_sha256", "result": "FAIL", "expected": expected_sha256.lower(), "actual": actual_archive_sha})

    file_results: list[dict[str, Any]] = []
    zip_crc = "FAIL"
    manifest_schema = None
    file_count = None
    run_id = None
    candidate_sha = None
    technical = {"c6_conformance": "NOT_ESTABLISHED", "contract_binding_status": "NOT_ASSESSED"}

    try:
        with zipfile.ZipFile(archive, "r") as zf:
            infos = zf.infolist()
            if len(infos) > 20_000:
                raise C6BundleError(f"zip_member_limit_exceeded:{len(infos)}")
            if sum(item.file_size for item in infos) > 2 * 1024**3:
                raise C6BundleError("zip_uncompressed_limit_exceeded")
            if any(item.file_size > 128 * 1024**2 for item in infos):
                raise C6BundleError("zip_single_member_size_limit_exceeded")
            names = [item.filename for item in infos]
            if len(names) != len(set(names)):
                failures.append({"check": "unique_zip_member_names", "result": "FAIL"})
            for info in infos:
                if not _safe_member_name(info.filename, is_dir=info.is_dir()):
                    failures.append({"check": "safe_zip_member_path", "path": info.filename, "result": "FAIL"})
                mode = (info.external_attr >> 16) & 0xFFFF
                file_kind = stat.S_IFMT(mode)
                if stat.S_ISLNK(mode) or file_kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                    failures.append({"check": "regular_zip_member_type", "path": info.filename, "result": "FAIL"})
                if file_kind == stat.S_IFDIR and not info.is_dir():
                    failures.append({"check": "directory_type_matches_name", "path": info.filename, "result": "FAIL"})
            bad_member = zf.testzip()
            zip_crc = "FAIL" if bad_member else "PASS"
            if bad_member:
                failures.append({"check": "zip_crc", "result": "FAIL", "member": bad_member})

            manifest_names = [n for n in names if n == "integrity-manifest.json"]
            if len(manifest_names) != 1:
                raise C6BundleError(f"expected_single_root_integrity_manifest:{len(manifest_names)}")
            manifest = _strict_json(zf.read("integrity-manifest.json"), "integrity-manifest.json")
            if not isinstance(manifest, dict):
                raise C6BundleError("integrity_manifest_not_object")
            manifest_schema = manifest.get("schema")
            if manifest_schema != "AURA-C6-CANDIDATE-LAB-INTEGRITY-MANIFEST/0.1":
                failures.append({"check": "integrity_manifest_schema", "result": "FAIL", "actual": manifest_schema})
            if manifest.get("self_hash_included") is not False:
                failures.append({"check": "manifest_self_hash_policy", "result": "FAIL"})
            if manifest.get("hash_algorithm") != "SHA-256":
                failures.append({"check": "manifest_hash_algorithm", "result": "FAIL", "actual": manifest.get("hash_algorithm")})
            if manifest.get("status") != "COMPLETE":
                failures.append({"check": "manifest_status", "result": "FAIL", "actual": manifest.get("status")})
            for field in ("authority", "governance_effect", "authorization_effect", "release_effect"):
                if manifest.get(field) != "NONE":
                    failures.append({"check": "integrity_manifest_effect_boundary", "result": "FAIL",
                                     "field": field, "actual": manifest.get(field)})

            entries = manifest.get("files")
            file_count = manifest.get("file_count")
            if not isinstance(entries, list) or not isinstance(file_count, int) or isinstance(file_count, bool) or file_count != len(entries):
                raise C6BundleError("integrity_manifest_file_count_mismatch")
            if file_count > 20_000:
                raise C6BundleError("integrity_manifest_entry_limit_exceeded")

            expected: dict[str, dict[str, Any]] = {}
            for index, entry in enumerate(entries):
                if not isinstance(entry, dict):
                    failures.append({"check": "manifest_entry_shape", "result": "FAIL", "index": index})
                    continue
                path = entry.get("path")
                size_expected = entry.get("bytes")
                digest_expected = entry.get("sha256")
                if not isinstance(path, str) or not _safe_member_name(path) or path == "integrity-manifest.json":
                    failures.append({"check": "manifest_path_safety", "result": "FAIL", "index": index, "path": path})
                    continue
                if path in expected:
                    failures.append({"check": "manifest_unique_path", "result": "FAIL", "path": path})
                    continue
                if not isinstance(size_expected, int) or isinstance(size_expected, bool) or size_expected < 0:
                    failures.append({"check": "manifest_byte_length_shape", "result": "FAIL", "path": path})
                    continue
                if not isinstance(digest_expected, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", digest_expected):
                    failures.append({"check": "manifest_sha256_shape", "result": "FAIL", "path": path})
                    continue
                expected[path] = {"bytes": size_expected, "sha256": digest_expected.lower()}

            actual_regular = {item.filename for item in infos if not item.is_dir() and item.filename != "integrity-manifest.json"}
            expected_paths = set(expected)
            if expected_paths != actual_regular:
                failures.append({
                    "check": "manifest_exact_inventory", "result": "FAIL",
                    "missing": sorted(expected_paths - actual_regular),
                    "unlisted": sorted(actual_regular - expected_paths),
                })

            for path in sorted(expected_paths & actual_regular):
                raw = zf.read(path)
                actual_digest = hashlib.sha256(raw).hexdigest()
                exp = expected[path]
                valid_size = len(raw) == exp["bytes"]
                valid_digest = hmac.compare_digest(actual_digest, exp["sha256"])
                file_results.append({"path": path, "bytes": len(raw), "sha256": actual_digest,
                                     "size_match": valid_size, "sha256_match": valid_digest,
                                     "result": "PASS" if valid_size and valid_digest else "FAIL"})
                if not valid_size or not valid_digest:
                    failures.append({"check": "file_integrity", "result": "FAIL", "path": path,
                                     "expected_bytes": exp["bytes"], "actual_bytes": len(raw),
                                     "expected_sha256": exp["sha256"], "actual_sha256": actual_digest})

            # Cross-file checks prevent a valid file manifest from masking inconsistent report references.
            report_objects: dict[str, dict[str, Any]] = {}
            required_reports = ["disposition-report.json", "differential-report.json", "ri-py-report.json",
                                "ri-rs-report.json", "source-lock.json", "materialization-index.json",
                                "baseline-regression-report.json", "inventory-snapshot.json",
                                "supporting-evidence/baseline-manifest.raw"]
            missing_required = [report_path for report_path in required_reports if report_path not in actual_regular]
            if missing_required:
                raise C6BundleError("required_c6_members_missing:" + ",".join(missing_required))
            for report_path in required_reports:
                if report_path not in actual_regular or not report_path.endswith(".json"):
                    continue
                doc = _strict_json(zf.read(report_path), report_path)
                if not isinstance(doc, dict):
                    failures.append({"check": "report_shape", "result": "FAIL", "path": report_path})
                    continue
                report_objects[report_path] = doc
                for field in ("authority", "governance_effect", "authorization_effect", "release_effect"):
                    if field in doc and doc[field] != "NONE":
                        failures.append({"check": "governance_effect_boundary", "result": "FAIL", "path": report_path,
                                         "field": field, "actual": doc[field]})

            disposition = report_objects.get("disposition-report.json", {})
            differential = report_objects.get("differential-report.json", {})
            py_report = report_objects.get("ri-py-report.json", {})
            rs_report = report_objects.get("ri-rs-report.json", {})
            source_lock = report_objects.get("source-lock.json", {})

            technical = {
                "c6_conformance": "NOT_ESTABLISHED",
                "disposition_status": disposition.get("status"),
                "contract_binding_status": disposition.get("contract_binding_status"),
                "candidate_materialization": disposition.get("candidate_materialization"),
                "baseline_regression": disposition.get("baseline_regression"),
                "differential_status": differential.get("status"),
                "pilot_case_count": differential.get("pilot_case_count"),
                "agreement_count": differential.get("agreement_count"),
                "mismatch_count": differential.get("mismatch_count"),
                "expected_outcomes_assigned": disposition.get("expected_outcomes_assigned"),
                "authority": disposition.get("authority"),
                "governance_effect": disposition.get("governance_effect"),
                "authorization_effect": disposition.get("authorization_effect"),
                "release_effect": disposition.get("release_effect"),
            }
            if disposition.get("contract_binding_status") != "UNRESOLVED" or disposition.get("expected_outcomes_assigned") is not False:
                failures.append({"check": "observation_only_contract_boundary", "result": "FAIL"})
            if disposition.get("status") != "CONTRACT_UNRESOLVED" or differential.get("status") != "CONTRACT_UNRESOLVED":
                failures.append({"check": "unresolved_contract_status_preserved", "result": "FAIL"})
            if disposition.get("authority") != "NONE" or disposition.get("governance_effect") != "NONE" or disposition.get("authorization_effect") != "NONE" or disposition.get("release_effect") != "NONE":
                failures.append({"check": "disposition_has_no_effect", "result": "FAIL"})
            if differential.get("ri_py_report_sha256") != hashlib.sha256(zf.read("ri-py-report.json")).hexdigest():
                failures.append({"check": "ri_py_report_cross_digest", "result": "FAIL"})
            if differential.get("ri_rs_report_sha256") != hashlib.sha256(zf.read("ri-rs-report.json")).hexdigest():
                failures.append({"check": "ri_rs_report_cross_digest", "result": "FAIL"})
            if differential.get("materialization_index_sha256") != hashlib.sha256(zf.read("materialization-index.json")).hexdigest():
                failures.append({"check": "materialization_index_cross_digest", "result": "FAIL"})
            base_bytes = zf.read("supporting-evidence/baseline-manifest.raw")
            base = source_lock.get("baseline", {})
            if base.get("content_bytes") != len(base_bytes) or base.get("content_sha256") != hashlib.sha256(base_bytes).hexdigest():
                failures.append({"check": "source_lock_baseline_content_binding", "result": "FAIL"})
            actual_baseline_blob = git_blob_sha1_bytes(base_bytes)
            if base.get("git_blob_oid") != actual_baseline_blob:
                failures.append({"check": "source_lock_baseline_blob_binding", "result": "FAIL",
                                 "expected": base.get("git_blob_oid"), "actual": actual_baseline_blob})
            candidate_sha = source_lock.get("candidate_inventory", {}).get("checkout_commit")
            run_id = manifest.get("run_id")
            if expected_run_id is not None and str(run_id) != str(expected_run_id):
                failures.append({"check": "expected_run_id", "result": "FAIL", "expected": str(expected_run_id), "actual": str(run_id)})
            if expected_candidate_sha is not None and candidate_sha != expected_candidate_sha:
                failures.append({"check": "expected_candidate_source_sha", "result": "FAIL", "expected": expected_candidate_sha, "actual": candidate_sha})
            inventory_sha = source_lock.get("candidate_inventory", {}).get("content_sha256")
            if inventory_sha != hashlib.sha256(zf.read("inventory-snapshot.json")).hexdigest():
                failures.append({"check": "candidate_inventory_content_binding", "result": "FAIL"})
            inventory_blob = source_lock.get("candidate_inventory", {}).get("git_blob_oid")
            actual_inventory_blob = git_blob_sha1_bytes(zf.read("inventory-snapshot.json"))
            if inventory_blob != actual_inventory_blob:
                failures.append({"check": "candidate_inventory_blob_binding", "result": "FAIL",
                                 "expected": inventory_blob, "actual": actual_inventory_blob})
            parser_pins = source_lock.get("parser_source_pins", {})
            source_commits = {
                "ri_py_report": py_report.get("source_commit"),
                "ri_rs_report": rs_report.get("source_commit"),
                "ri_py_pin": parser_pins.get("ri_py_commit"),
                "ri_rs_pin": parser_pins.get("ri_rs_commit"),
                "integrated_harness_pin": parser_pins.get("integrated_harness_commit"),
                "candidate_checkout": candidate_sha,
                "candidate_origin": source_lock.get("candidate_inventory", {}).get("origin_commit"),
            }
            for label, commit in source_commits.items():
                if not isinstance(commit, str) or re.fullmatch(r"[0-9a-f]{40}", commit) is None:
                    failures.append({"check": "source_commit_shape", "result": "FAIL", "source": label})
            if py_report.get("source_commit") != parser_pins.get("ri_py_commit"):
                failures.append({"check": "ri_py_source_commit_cross_binding", "result": "FAIL",
                                 "report": py_report.get("source_commit"), "source_lock": parser_pins.get("ri_py_commit")})
            if rs_report.get("source_commit") != parser_pins.get("ri_rs_commit"):
                failures.append({"check": "ri_rs_source_commit_cross_binding", "result": "FAIL",
                                 "report": rs_report.get("source_commit"), "source_lock": parser_pins.get("ri_rs_commit")})
            active_candidates = source_lock.get("candidate_inventory", {}).get("active_candidates")
            material_index = report_objects.get("materialization-index.json", {})
            if material_index.get("candidate_count") != active_candidates:
                failures.append({"check": "candidate_count_cross_binding", "result": "FAIL",
                                 "materialization_index": material_index.get("candidate_count"),
                                 "source_lock": active_candidates})
            manifest_run_id = manifest.get("run_id")
            for report_label, report_doc in (("disposition", disposition), ("differential", differential)):
                report_run_id = report_doc.get("run_id")
                if report_run_id is not None and str(manifest_run_id) != str(report_run_id):
                    failures.append({"check": "run_id_cross_binding", "result": "FAIL",
                                     "manifest_run_id": str(manifest_run_id),
                                     "report": report_label,
                                     "report_run_id": str(report_run_id)})

    except zipfile.BadZipFile as exc:
        raise C6BundleError("invalid_zip_archive") from exc
    except (OSError, RuntimeError, KeyError, TypeError) as exc:
        raise C6BundleError(f"bundle_validation_error:{type(exc).__name__}") from exc

    return {
        "schema": "AURA-C6-EVIDENCE-BUNDLE-VERIFICATION/1.0",
        "archive": str(archive),
        "archive_bytes": size,
        "archive_sha256": actual_archive_sha,
        "expected_archive_sha256": expected_sha256,
        "zip_crc": zip_crc,
        "integrity_manifest_schema": manifest_schema,
        "integrity_manifest_file_count": file_count,
        "verified_files": len(file_results),
        "file_results": file_results,
        "workflow_run_id": run_id,
        "candidate_source_sha": candidate_sha,
        "expected_run_id": expected_run_id,
        "expected_candidate_sha": expected_candidate_sha,
        "result": "FAIL" if failures else "PASS",
        "integrity_result": "FAIL" if failures else "PASS",
        "checks_failed": failures,
        "technical_observations": technical,
        "conformance": "NOT_ESTABLISHED",
        **GOVERNANCE_FIELDS,
    }
