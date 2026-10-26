import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from aura_evidence_guard.c6_bundle import verify_c6_evidence_bundle
from aura_evidence_guard.cli import make_parser
from aura_evidence_guard.github_api import GitHubReadOnlyClient
from aura_evidence_guard.hashing import git_blob_sha1_bytes

SHA = "a" * 40


class RevisionTests(unittest.TestCase):
    def audit(self, run_sha, pr_sha=SHA, pr_number=49, latest_sha=None):
        client = GitHubReadOnlyClient(token="unused")
        with (
            patch.object(client, "repository", return_value={}),
            patch.object(client, "branch", return_value={"commit": {"sha": SHA}}),
            patch.object(
                client,
                "pull_request",
                side_effect=[
                    {"head": {"sha": pr_sha}},
                    {"head": {"sha": latest_sha or pr_sha}},
                ],
            ),
            patch.object(
                client,
                "workflow_run",
                return_value={
                    "head_sha": run_sha,
                    "status": "completed",
                    "conclusion": "success",
                },
            ),
            patch.object(client, "workflow_jobs", return_value=[]),
            patch.object(client, "workflow_artifacts", return_value=[]),
        ):
            return client.audit(
                "vaidt/aura-specification", pr_number=pr_number, run_id=40203268967
            )

    def test_historical_run_cannot_pass_current_pr(self):
        result = self.audit(
            "6d7511c52dae79a58b80dfbabe594141abbb980d",
            "14fddc76298deb3bcb9968525c021f729de63678",
        )
        self.assertEqual(result["result"], "FAIL")
        self.assertIn(
            "workflow_run_bound_to_pr_head", [r["check"] for r in result["failures"]]
        )

    def test_matching_sha_passes(self):
        self.assertEqual(self.audit(SHA)["result"], "PASS")

    def test_missing_sha_and_missing_pr_fail(self):
        for run, pr in [(None, None), ("short", "short")]:
            with self.subTest(run=run):
                self.assertEqual(self.audit(run, pr)["result"], "FAIL")
        self.assertEqual(self.audit(SHA, pr_number=None)["result"], "FAIL")

    def test_pr_movement_fails(self):
        self.assertEqual(self.audit(SHA, latest_sha="b" * 40)["result"], "FAIL")

    def test_unsupported_passphrase_flag_removed(self):
        with self.assertRaises(SystemExit):
            make_parser().parse_args(
                [
                    "sign-evidence",
                    "--message",
                    "x",
                    "--private-key",
                    "k",
                    "--signature-output",
                    "s",
                    "--passphrase-env",
                    "SECRET",
                ]
            )


class C6PinTests(unittest.TestCase):
    def bundle(self, path, value):
        effects = {
            k: "NONE"
            for k in (
                "authority",
                "governance_effect",
                "authorization_effect",
                "release_effect",
            )
        }
        raw = b"baseline"
        inventory = b"{}"
        source = {
            "baseline": {
                "content_bytes": len(raw),
                "content_sha256": hashlib.sha256(raw).hexdigest(),
                "git_blob_oid": git_blob_sha1_bytes(raw),
            },
            "candidate_inventory": {
                "checkout_commit": value,
                "origin_commit": SHA,
                "content_sha256": hashlib.sha256(inventory).hexdigest(),
                "git_blob_oid": git_blob_sha1_bytes(inventory),
                "active_candidates": 0,
            },
            "parser_source_pins": {
                "ri_py_commit": value,
                "ri_rs_commit": SHA,
                "integrated_harness_commit": SHA,
            },
        }
        docs = {
            "source-lock.json": source,
            "ri-py-report.json": {"source_commit": value},
            "ri-rs-report.json": {"source_commit": SHA},
            "materialization-index.json": {"candidate_count": 0},
            "disposition-report.json": {
                **effects,
                "status": "CONTRACT_UNRESOLVED",
                "contract_binding_status": "UNRESOLVED",
                "expected_outcomes_assigned": False,
                "run_id": "1",
            },
            "baseline-regression-report.json": {},
        }
        data = {name: json.dumps(obj).encode() for name, obj in docs.items()}
        data["inventory-snapshot.json"] = inventory
        data["supporting-evidence/baseline-manifest.raw"] = raw
        diff = {"status": "CONTRACT_UNRESOLVED", "run_id": "1"}
        for field, name in [
            ("ri_py_report_sha256", "ri-py-report.json"),
            ("ri_rs_report_sha256", "ri-rs-report.json"),
            ("materialization_index_sha256", "materialization-index.json"),
        ]:
            diff[field] = hashlib.sha256(data[name]).hexdigest()
        data["differential-report.json"] = json.dumps(diff).encode()
        manifest = {
            **effects,
            "schema": "AURA-C6-CANDIDATE-LAB-INTEGRITY-MANIFEST/0.1",
            "status": "COMPLETE",
            "self_hash_included": False,
            "hash_algorithm": "SHA-256",
            "run_id": "1",
            "file_count": len(data),
            "files": [
                {"path": k, "bytes": len(v), "sha256": hashlib.sha256(v).hexdigest()}
                for k, v in data.items()
            ],
        }
        with zipfile.ZipFile(path, "w") as z:
            for name, raw in data.items():
                z.writestr(name, raw)
            z.writestr("integrity-manifest.json", json.dumps(manifest))

    def test_valid_source_pins_pass(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "bundle.zip"
            self.bundle(p, SHA)
            self.assertEqual(verify_c6_evidence_bundle(p)["integrity_result"], "PASS")

    def test_matching_missing_or_malformed_pins_fail(self):
        for value in [None, "", "abc", "g" * 40, 123]:
            with self.subTest(value=value), tempfile.TemporaryDirectory() as td:
                p = Path(td) / "bundle.zip"
                self.bundle(p, value)
                self.assertEqual(
                    verify_c6_evidence_bundle(p)["integrity_result"], "FAIL"
                )
