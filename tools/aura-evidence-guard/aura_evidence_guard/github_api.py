from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shutil
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from email.message import Message

from .manifest import GOVERNANCE_FIELDS, write_json_atomic


class GitHubAPIError(RuntimeError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_json(raw: bytes, context: str) -> Any:
    try:
        return json.loads(raw.decode("utf-8", errors="strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GitHubAPIError(f"invalid_json_response:{context}") from exc


def _repo_parts(repo: str) -> tuple[str, str]:
    parts = repo.split("/")
    if len(parts) != 2 or not all(parts) or any(p in (".", "..") for p in parts):
        raise GitHubAPIError("repo_must_be_owner_slash_name")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", parts[0]) or not re.fullmatch(r"[A-Za-z0-9_.-]+", parts[1]):
        raise GitHubAPIError("repo_contains_invalid_characters")
    return parts[0], parts[1]


def _url_path(path: str) -> str:
    if path.startswith("/") or "://" in path:
        raise GitHubAPIError("API endpoint must be a relative path")
    return path


class GitHubReadOnlyClient:
    """Minimal GitHub REST client with GET-only API surface.

    There are deliberately no create/update/delete/merge/dispatch methods.
    """

    API_ROOT = "https://api.github.com"

    def __init__(self, token: str | None = None, timeout: int = 30, max_artifact_bytes: int = 2 * 1024**3):
        self.token = token or os.environ.get("AURA_GITHUB_READ_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        self.timeout = timeout
        self.max_artifact_bytes = max_artifact_bytes
        self._opener = urllib.request.build_opener(_NoRedirect)

    def _headers(self, accept: str = "application/vnd.github+json", include_auth: bool = True) -> dict[str, str]:
        headers = {
            "Accept": accept,
            "User-Agent": "AURA-Evidence-Guard/1.0 (read-only audit)",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if include_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _api_get(self, path: str) -> tuple[Any, Message]:
        path = _url_path(path)
        parsed = urllib.parse.urlsplit(path)
        # Endpoint builders quote untrusted path parameters before calling this method.
        # Preserve those encodings (notably %2F in a branch name) and leave query parameters intact.
        url = self.API_ROOT + "/" + parsed.path.lstrip("/")
        if parsed.query:
            url += "?" + parsed.query
        req = urllib.request.Request(url, method="GET", headers=self._headers())
        try:
            with self._opener.open(req, timeout=self.timeout) as response:
                raw = response.read()
                return _parse_json(raw, path), response.headers
        except urllib.error.HTTPError as exc:
            body = b""
            try:
                body = exc.read(2048)
            except Exception:
                pass
            # Never include headers, token, or unbounded upstream payload in exception text.
            detail = body.decode("utf-8", errors="replace").replace("\n", " ")[:400]
            # A proxy or test endpoint might echo request data; defensively redact the
            # active bearer token before exception text can reach CI logs or reports.
            if self.token:
                detail = detail.replace(self.token, "[REDACTED]")
            detail = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._~+/-]+=*", r"\1[REDACTED]", detail)
            raise GitHubAPIError(f"github_api_get_failed:status={exc.code}:endpoint={path}:detail={detail}") from None
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise GitHubAPIError(f"github_api_network_error:endpoint={path}:type={type(exc).__name__}") from None

    def _get_all(self, path: str, collection_key: str) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        page = 1
        while page <= 100:
            separator = "&" if "?" in path else "?"
            payload, _ = self._api_get(f"{path}{separator}per_page=100&page={page}")
            current = payload.get(collection_key)
            if not isinstance(current, list):
                raise GitHubAPIError(f"github_api_shape_error:{path}:{collection_key}")
            records.extend(item for item in current if isinstance(item, dict))
            if len(current) < 100:
                return records
            page += 1
        raise GitHubAPIError(f"github_api_pagination_limit_exceeded:{path}")

    def repository(self, repo: str) -> dict[str, Any]:
        owner, name = _repo_parts(repo)
        payload, _ = self._api_get(f"repos/{owner}/{name}")
        return payload

    def branch(self, repo: str, ref: str) -> dict[str, Any]:
        owner, name = _repo_parts(repo)
        if not ref or ref.startswith("-"):
            raise GitHubAPIError("invalid_ref")
        payload, _ = self._api_get(f"repos/{owner}/{name}/branches/{urllib.parse.quote(ref, safe='')}")
        return payload

    def pull_request(self, repo: str, number: int) -> dict[str, Any]:
        owner, name = _repo_parts(repo)
        if number < 1:
            raise GitHubAPIError("invalid_pull_request_number")
        payload, _ = self._api_get(f"repos/{owner}/{name}/pulls/{number}")
        return payload

    def workflow_run(self, repo: str, run_id: int) -> dict[str, Any]:
        owner, name = _repo_parts(repo)
        if run_id < 1:
            raise GitHubAPIError("invalid_workflow_run_id")
        payload, _ = self._api_get(f"repos/{owner}/{name}/actions/runs/{run_id}")
        return payload

    def workflow_jobs(self, repo: str, run_id: int) -> list[dict[str, Any]]:
        owner, name = _repo_parts(repo)
        return self._get_all(f"repos/{owner}/{name}/actions/runs/{run_id}/jobs", "jobs")

    def workflow_artifacts(self, repo: str, run_id: int) -> list[dict[str, Any]]:
        owner, name = _repo_parts(repo)
        return self._get_all(f"repos/{owner}/{name}/actions/runs/{run_id}/artifacts", "artifacts")

    def audit(
        self,
        repo: str,
        ref: str = "main",
        expected_head: str | None = None,
        pr_number: int | None = None,
        run_id: int | None = None,
        artifact_dir: Path | None = None,
    ) -> dict[str, Any]:
        repo_meta = self.repository(repo)
        branch_payload = self.branch(repo, ref)
        commit = branch_payload.get("commit") if isinstance(branch_payload, dict) else {}
        observed_sha = commit.get("sha") if isinstance(commit, dict) else None
        ref_match = expected_head is None or (isinstance(observed_sha, str) and hmac.compare_digest(observed_sha, expected_head))
        branch_report = {
            "ref": ref,
            "observed_sha": observed_sha,
            "expected_sha": expected_head,
            "sha_match": ref_match if expected_head else None,
        }

        pr_payload = None
        if pr_number is not None:
            raw_pr = self.pull_request(repo, pr_number)
            pr_head = ((raw_pr.get("head") or {}).get("sha"))
            pr_base = ((raw_pr.get("base") or {}).get("sha"))
            pr_payload = {
                "number": raw_pr.get("number"),
                "state": raw_pr.get("state"),
                "draft": raw_pr.get("draft"),
                "merged": raw_pr.get("merged"),
                "head_ref": (raw_pr.get("head") or {}).get("ref"),
                "head_repo": ((raw_pr.get("head") or {}).get("repo") or {}).get("full_name"),
                "head_sha": pr_head,
                "base_ref": (raw_pr.get("base") or {}).get("ref"),
                "base_sha": pr_base,
                "url": raw_pr.get("html_url"),
            }

        run_report = None
        artifacts_report: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []
        if not ref_match:
            failures.append({"check": "branch_head_pin", "result": "FAIL",
                             "expected": expected_head, "actual": observed_sha})
        if run_id is not None:
            run = self.workflow_run(repo, run_id)
            run_sha = run.get("head_sha")
            jobs = self.workflow_jobs(repo, run_id)
            artifacts = self.workflow_artifacts(repo, run_id)
            run_matches_expected = expected_head is None or (
                isinstance(run_sha, str) and hmac.compare_digest(run_sha, expected_head)
            )
            run_matches_pr = pr_payload is None or (
                isinstance(run_sha, str) and hmac.compare_digest(run_sha, pr_payload.get("head_sha") or "")
            )
            if run.get("status") != "completed" or run.get("conclusion") != "success":
                failures.append({"check": "workflow_run_success", "result": "FAIL",
                                 "status": run.get("status"), "conclusion": run.get("conclusion")})
            for job in jobs:
                if job.get("conclusion") in ("failure", "cancelled", "timed_out", "action_required", "startup_failure"):
                    failures.append({"check": "workflow_job_success", "result": "FAIL",
                                     "job_id": job.get("id"), "job": job.get("name"),
                                     "conclusion": job.get("conclusion")})
            run_report = {
                "id": run.get("id"),
                "name": run.get("name"),
                "event": run.get("event"),
                "status": run.get("status"),
                "conclusion": run.get("conclusion"),
                "head_branch": run.get("head_branch"),
                "head_sha": run_sha,
                "html_url": run.get("html_url"),
                "created_at": run.get("created_at"),
                "updated_at": run.get("updated_at"),
                "expected_sha_match": run_matches_expected if expected_head else None,
                "pull_request_head_sha_match": run_matches_pr if pr_payload else None,
                "jobs": [{
                    "id": j.get("id"), "name": j.get("name"), "status": j.get("status"),
                    "conclusion": j.get("conclusion"), "html_url": j.get("html_url"),
                } for j in jobs],
            }
            if expected_head and not run_matches_expected:
                failures.append({"check": "workflow_run_exact_sha", "result": "FAIL",
                                 "expected": expected_head, "actual": run_sha})
            if pr_payload and not run_matches_pr:
                failures.append({"check": "workflow_run_bound_to_pr_head", "result": "FAIL",
                                 "expected": pr_payload.get("head_sha"), "actual": run_sha})
            for artifact in artifacts:
                item = {
                    "id": artifact.get("id"),
                    "name": artifact.get("name"),
                    "size_in_bytes": artifact.get("size_in_bytes"),
                    "digest": artifact.get("digest"),
                    "expired": artifact.get("expired"),
                    "created_at": artifact.get("created_at"),
                    "expires_at": artifact.get("expires_at"),
                    "workflow_run_id": ((artifact.get("workflow_run") or {}).get("id")),
                    "workflow_run_head_sha": ((artifact.get("workflow_run") or {}).get("head_sha")),
                }
                artifact_sha = ((artifact.get("workflow_run") or {}).get("head_sha"))
                if artifact_sha and run_sha and artifact_sha != run_sha:
                    item["binding"] = "FAIL_RUN_SHA_MISMATCH"
                    failures.append({"check": "artifact_bound_to_run_sha", "result": "FAIL",
                                     "artifact_id": artifact.get("id"), "run_sha": run_sha, "artifact_sha": artifact_sha})
                else:
                    item["binding"] = "PASS" if artifact_sha else "NOT_EXPOSED_BY_API"
                if artifact_dir is not None:
                    try:
                        item["download"] = self.download_artifact(repo, artifact, artifact_dir, expected_run_id=run_id)
                        if item["download"].get("result") != "PASS":
                            failures.append({"check": "artifact_integrity", "result": "FAIL", "artifact_id": artifact.get("id")})
                    except GitHubAPIError as exc:
                        item["download"] = {"result": "FAIL", "error": str(exc)}
                        failures.append({"check": "artifact_integrity", "result": "FAIL",
                                         "artifact_id": artifact.get("id"), "error": str(exc)})
                artifacts_report.append(item)

        status = "FAIL" if failures else "PASS"
        return {
            "schema": "AURA-GITHUB-READONLY-AUDIT/1.0",
            "checked_at_utc": _iso_now(),
            "mode": "READ_ONLY",
            "api_root": self.API_ROOT,
            "repository": repo,
            "repository_metadata": {
                "full_name": repo_meta.get("full_name"),
                "private": repo_meta.get("private"),
                "archived": repo_meta.get("archived"),
                "default_branch": repo_meta.get("default_branch"),
                "permissions": repo_meta.get("permissions"),
                "html_url": repo_meta.get("html_url"),
            },
            "branch": branch_report,
            "pull_request": pr_payload,
            "workflow_run": run_report,
            "artifacts": artifacts_report,
            "failures": failures,
            "result": status,
            "limitation": "An API read does not prove branch-protection configuration unless the relevant ruleset endpoints and permissions are separately queried. A cryptographic PASS does not establish signer competence or normative effect.",
            **GOVERNANCE_FIELDS,
        }

    def _artifact_metadata(self, repo: str, artifact_id: int) -> dict[str, Any]:
        owner, name = _repo_parts(repo)
        if artifact_id < 1:
            raise GitHubAPIError("invalid_artifact_id")
        payload, _ = self._api_get(f"repos/{owner}/{name}/actions/artifacts/{artifact_id}")
        return payload

    def download_artifact(
        self, repo: str, artifact_metadata: dict[str, Any] | int, destination_dir: Path,
        expected_run_id: int | None = None
    ) -> dict[str, Any]:
        """Download one Actions ZIP; compare bytes to the GitHub API digest.

        Authentication is sent only to api.github.com. On a signed download redirect,
        the GitHub token is never forwarded to the object-storage host.
        """
        if isinstance(artifact_metadata, int):
            artifact = self._artifact_metadata(repo, artifact_metadata)
        else:
            artifact = artifact_metadata
            artifact_id = artifact.get("id")
            if not isinstance(artifact_id, int):
                raise GitHubAPIError("artifact_metadata_missing_id")
            # Refresh metadata when the caller passes a stale listing record.
            artifact = self._artifact_metadata(repo, artifact_id)

        artifact_id = artifact.get("id")
        if artifact.get("expired") is True:
            raise GitHubAPIError(f"artifact_expired:{artifact_id}")
        run_id = ((artifact.get("workflow_run") or {}).get("id"))
        if expected_run_id is not None and run_id != expected_run_id:
            raise GitHubAPIError(f"artifact_run_id_mismatch_or_unavailable:{artifact_id}")
        expected_digest = artifact.get("digest")
        if not isinstance(expected_digest, str) or not re.fullmatch(r"sha256:[0-9a-fA-F]{64}", expected_digest):
            raise GitHubAPIError(f"artifact_digest_missing_or_unsupported:{artifact_id}")
        expected_sha = expected_digest.split(":", 1)[1].lower()
        size_limit = artifact.get("size_in_bytes")
        if isinstance(size_limit, int) and size_limit > self.max_artifact_bytes:
            raise GitHubAPIError(f"artifact_exceeds_configured_size_limit:{artifact_id}:{size_limit}")

        owner, name = _repo_parts(repo)
        api_url = f"{self.API_ROOT}/repos/{owner}/{name}/actions/artifacts/{artifact_id}/zip"
        req = urllib.request.Request(api_url, method="GET", headers=self._headers("application/vnd.github+json"))
        try:
            response = self._opener.open(req, timeout=self.timeout)
        except urllib.error.HTTPError as exc:
            if exc.code not in (301, 302, 303, 307, 308):
                raise GitHubAPIError(f"artifact_download_request_failed:status={exc.code}:artifact={artifact_id}") from None
            location = exc.headers.get("Location")
            if not location:
                raise GitHubAPIError(f"artifact_redirect_missing_location:{artifact_id}") from None
            # Critical: the API token is never reused for signed object-storage URLs.
            response = None
            for redirect_count in range(3):
                parsed = urllib.parse.urlparse(location)
                if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                    raise GitHubAPIError(f"unsafe_artifact_redirect:{artifact_id}") from None
                redirect_req = urllib.request.Request(location, method="GET", headers={
                    "Accept": "application/octet-stream",
                    "User-Agent": "AURA-Evidence-Guard/1.0 (read-only audit)",
                })
                try:
                    response = self._opener.open(redirect_req, timeout=self.timeout)
                    break
                except urllib.error.HTTPError as redir_exc:
                    if redir_exc.code not in (301, 302, 303, 307, 308) or not redir_exc.headers.get("Location"):
                        raise GitHubAPIError(f"artifact_signed_download_failed:status={redir_exc.code}") from None
                    location = redir_exc.headers["Location"]
            if response is None:
                raise GitHubAPIError(f"artifact_redirect_limit_exceeded:{artifact_id}") from None
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise GitHubAPIError(f"artifact_download_network_error:{type(exc).__name__}") from None

        destination_dir = destination_dir.expanduser().absolute()
        destination_dir.mkdir(parents=True, exist_ok=True)
        name = str(artifact.get("name") or f"artifact-{artifact_id}")
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or f"artifact-{artifact_id}"
        final_path = destination_dir / f"{artifact_id}-{safe_name}.zip"
        if final_path.exists() or final_path.is_symlink():
            raise GitHubAPIError(f"refusing_to_overwrite_existing_artifact:{artifact_id}")
        part_path = final_path.with_name(final_path.name + ".part")
        digest = hashlib.sha256()
        total = 0
        try:
            with response, part_path.open("wb") as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > self.max_artifact_bytes:
                        raise GitHubAPIError(f"download_exceeds_configured_size_limit:{artifact_id}")
                    digest.update(chunk)
                    output.write(chunk)
                output.flush()
                os_fsync = getattr(output, "fileno", None)
                if os_fsync:
                    import os
                    os.fsync(output.fileno())
            actual_sha = digest.hexdigest()
            if not hmac.compare_digest(actual_sha, expected_sha):
                part_path.unlink(missing_ok=True)
                raise GitHubAPIError(f"artifact_digest_mismatch:{artifact_id}:expected={expected_sha}:actual={actual_sha}")
            if isinstance(size_limit, int) and total != size_limit:
                part_path.unlink(missing_ok=True)
                raise GitHubAPIError(f"artifact_size_mismatch:{artifact_id}:expected={size_limit}:actual={total}")
            try:
                with zipfile.ZipFile(part_path) as zf:
                    infos = zf.infolist()
                    if len(infos) > 50000 or sum(i.file_size for i in infos) > 5 * 1024**3:
                        raise GitHubAPIError(f"artifact_zip_uncompressed_limit_exceeded:{artifact_id}")
                    names = [i.filename for i in infos]
                    from pathlib import PurePosixPath
                    import stat
                    def safe_name(name: str, is_dir: bool) -> bool:
                        if not name or "\\" in name or "\x00" in name or name.startswith("/"):
                            return False
                        raw = name[:-1] if is_dir and name.endswith("/") else name
                        parts = raw.split("/")
                        return bool(raw) and all(part not in ("", ".", "..") and ":" not in part for part in parts)

                    if len(names) != len(set(names)) or any(
                        not safe_name(name, info.is_dir())
                        or stat.S_ISLNK((info.external_attr >> 16) & 0xffff)
                        or stat.S_IFMT((info.external_attr >> 16) & 0xffff) not in (0, stat.S_IFREG, stat.S_IFDIR)
                        for name, info in zip(names, infos)
                    ):
                        raise GitHubAPIError(f"artifact_zip_path_safety_failure:{artifact_id}")
                    bad = zf.testzip()
                    if bad:
                        raise GitHubAPIError(f"artifact_zip_crc_failure:{artifact_id}:{bad}")
            except zipfile.BadZipFile as exc:
                raise GitHubAPIError(f"artifact_not_valid_zip:{artifact_id}") from exc
            os.replace(part_path, final_path)
        except Exception:
            part_path.unlink(missing_ok=True)
            raise

        return {
            "result": "PASS",
            "artifact_id": artifact_id,
            "artifact_name": artifact.get("name"),
            "path": str(final_path),
            "size_bytes": total,
            "expected_sha256": expected_sha,
            "actual_sha256": actual_sha,
            "digest_match": True,
            "zip_integrity": "PASS",
            "workflow_run_id": run_id,
            "note": "Integrity/digest verification only; no conformance or governance result implied.",
            **GOVERNANCE_FIELDS,
        }
