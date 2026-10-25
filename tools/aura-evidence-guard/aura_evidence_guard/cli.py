from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from .github_api import GitHubAPIError, GitHubReadOnlyClient
from .c6_bundle import C6BundleError, verify_c6_evidence_bundle
from .manifest import ManifestError, create_manifest, verify_manifest, write_json_atomic
from .preservation import PreservationError, verify_preservation_zip
from .source_lock import SourceLockError, verify_git_source
from .ssh_sig import SignatureError, sign_evidence_sshsig, verify_sshsig


def _emit(obj: Any, output: Path | None = None) -> None:
    if output is not None:
        write_json_atomic(output, obj)
        print(json.dumps({"output": str(output), "result": obj.get("result", obj.get("cryptographic_result", "RECORDED"))},
                         indent=2, ensure_ascii=False))
    else:
        print(json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False))


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="aura-evidence-guard",
        description="AURA evidence-integrity and read-only GitHub API toolkit. No governance status changes.",
    )
    subs = parser.add_subparsers(dest="command", required=True)

    p = subs.add_parser("create-manifest", help="Create a SHA-256 + Git-blob manifest for a directory.")
    p.add_argument("--root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)

    p = subs.add_parser("verify-manifest", help="Verify exact file inventory, byte lengths and digests.")
    p.add_argument("--root", required=True, type=Path)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--output", type=Path)

    p = subs.add_parser("verify-preservation-zip", help="Verify preservation ZIP digest, CRC and SHA256SUMS.txt.")
    p.add_argument("--archive", required=True, type=Path)
    p.add_argument("--expected-sha256")
    p.add_argument("--output", type=Path)

    p = subs.add_parser("verify-c6-bundle", help="Verify a C6 Candidate Lab ZIP and its internal integrity manifest.")
    p.add_argument("--archive", required=True, type=Path)
    p.add_argument("--expected-sha256", help="Optional SHA-256 from the trusted GitHub artifact API metadata.")
    p.add_argument("--expected-run-id", type=int, help="Refuse the bundle if its internal run ID differs.")
    p.add_argument("--expected-candidate-sha", help="Optional exact parser/inventory checkout SHA to bind.")
    p.add_argument("--output", type=Path)

    p = subs.add_parser("verify-sshsig", help="Verify an OpenSSH SSHSIG over exact message bytes.")
    p.add_argument("--message", required=True, type=Path)
    p.add_argument("--signature", required=True, type=Path)
    p.add_argument("--allowed-signers", required=True, type=Path)
    p.add_argument("--identity", required=True)
    p.add_argument("--namespace", required=True)
    p.add_argument("--output", type=Path)

    p = subs.add_parser("sign-evidence", help="Sign a non-normative evidence file in the aura-evidence namespace.")
    p.add_argument("--message", required=True, type=Path)
    p.add_argument("--private-key", required=True, type=Path)
    p.add_argument("--signature-output", required=True, type=Path)
    p.add_argument("--passphrase-env", help="Environment variable containing an encrypted OpenSSH private-key passphrase; value is never logged.")
    p.add_argument("--output", type=Path)

    p = subs.add_parser("verify-git-source", help="Offline exact-SHA source-lock check; never runs fetch/checkout.")
    p.add_argument("--repo-root", required=True, type=Path)
    p.add_argument("--expected-commit", required=True)
    p.add_argument("--manifest-path", default="fixtures/corpus/STAGE-C-C6-STRICT-WIRE-MUTATION-CORPUS-v0.1-DRAFT.json")
    p.add_argument("--expected-blob-sha1", required=True)
    p.add_argument("--expected-sha256", required=True)
    p.add_argument("--expected-bytes", required=True, type=int)
    p.add_argument("--expected-origin", default="https://github.com/vaidt/aura-specification.git")
    p.add_argument("--output", type=Path)

    p = subs.add_parser("audit-github", help="Read-only GitHub REST audit of repo/ref, optional PR/run/artifacts.")
    p.add_argument("--repo", required=True, help="owner/repository")
    p.add_argument("--ref", default="main", help="Branch name (not a tag or arbitrary SHA)")
    p.add_argument("--expected-head", help="Exact SHA that the branch ref must point to")
    p.add_argument("--pr-number", type=int)
    p.add_argument("--run-id", type=int)
    p.add_argument("--download-artifacts-to", type=Path, help="Explicit opt-in: download every non-expired artifact in this run and verify API digest.")
    p.add_argument("--timeout", type=int, default=30)
    p.add_argument("--max-artifact-mib", type=int, default=2048)
    p.add_argument("--output", type=Path)

    p = subs.add_parser("verify-github-artifact", help="Download one Actions artifact, verify SHA-256 from GitHub API, and inspect ZIP.")
    p.add_argument("--repo", required=True, help="owner/repository")
    p.add_argument("--artifact-id", required=True, type=int)
    p.add_argument("--expected-run-id", type=int, help="Refuse artifact if its run binding is missing or different")
    p.add_argument("--download-to", required=True, type=Path)
    p.add_argument("--timeout", type=int, default=30)
    p.add_argument("--max-artifact-mib", type=int, default=2048)
    p.add_argument("--output", type=Path)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = make_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "create-manifest":
            args.output.parent.mkdir(parents=True, exist_ok=True)
            manifest = create_manifest(args.root, args.output)
            write_json_atomic(args.output, manifest)
            _emit({"result": "PASS", "output": str(args.output), "file_count": manifest["file_count"],
                   "authority": "NONE", "governance_effect": "NONE", "authorization_effect": "NONE", "release_effect": "NONE"})
            return 0

        if args.command == "verify-manifest":
            result = verify_manifest(args.root, args.manifest)
            _emit(result, args.output)
            return 0 if result["result"] == "PASS" else 1

        if args.command == "verify-preservation-zip":
            result = verify_preservation_zip(args.archive, args.expected_sha256)
            _emit(result, args.output)
            return 0 if result["result"] == "PASS" else 1

        if args.command == "verify-c6-bundle":
            result = verify_c6_evidence_bundle(args.archive, args.expected_sha256,
                                               args.expected_run_id, args.expected_candidate_sha)
            _emit(result, args.output)
            return 0 if result["integrity_result"] == "PASS" else 1

        if args.command == "verify-sshsig":
            result = verify_sshsig(args.message, args.signature, args.allowed_signers, args.identity, args.namespace)
            _emit(result, args.output)
            return 0 if result["cryptographic_result"] == "PASS" else 1

        if args.command == "sign-evidence":
            passphrase = None
            if args.passphrase_env:
                value = os.environ.get(args.passphrase_env)
                if value is None:
                    raise SignatureError(f"passphrase_environment_variable_not_set:{args.passphrase_env}")
                passphrase = value.encode("utf-8")
            result = sign_evidence_sshsig(args.message, args.private_key, args.signature_output, passphrase=passphrase)
            _emit(result, args.output)
            return 0

        if args.command == "verify-git-source":
            result = verify_git_source(args.repo_root, args.expected_commit, args.manifest_path,
                                       args.expected_blob_sha1, args.expected_sha256, args.expected_bytes,
                                       args.expected_origin)
            _emit(result, args.output)
            return 0 if result["result"] == "PASS" else 1

        if args.command == "audit-github":
            max_bytes = args.max_artifact_mib * 1024 * 1024
            if args.timeout < 1 or max_bytes < 1:
                parser.error("--timeout and --max-artifact-mib must be positive")
            client = GitHubReadOnlyClient(timeout=args.timeout, max_artifact_bytes=max_bytes)
            result = client.audit(args.repo, args.ref, args.expected_head, args.pr_number, args.run_id,
                                  args.download_artifacts_to)
            _emit(result, args.output)
            return 0 if result["result"] == "PASS" else 2

        if args.command == "verify-github-artifact":
            client = GitHubReadOnlyClient(timeout=args.timeout, max_artifact_bytes=args.max_artifact_mib * 1024 * 1024)
            result = client.download_artifact(args.repo, args.artifact_id, args.download_to, args.expected_run_id)
            _emit(result, args.output)
            return 0 if result["result"] == "PASS" else 2

        parser.error("unknown command")
    except (GitHubAPIError, ManifestError, PreservationError, SourceLockError, SignatureError, C6BundleError, OSError, ValueError) as exc:
        error = {"result": "ERROR", "error_type": type(exc).__name__, "error": str(exc),
                 "authority": "NONE", "governance_effect": "NONE",
                 "authorization_effect": "NONE", "release_effect": "NONE"}
        print(json.dumps(error, indent=2, ensure_ascii=False), file=sys.stderr)
        return 2
    return 2
