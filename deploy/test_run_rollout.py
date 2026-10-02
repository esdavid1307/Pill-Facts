#!/usr/bin/env python3
"""Tests for the CI rollout, run against a stand-in aws CLI on PATH.

The stand-in answers send-command with a fixed command ID and answers each
get-command-invocation with the next of the invocations a test lists, repeating the last.
An invocation given as a string is an error, which it prints and exits with. It records
every call, so a test can read what was sent to the instance.
"""

import base64
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import textwrap
import unittest


SCRIPT = pathlib.Path(__file__).with_name("run-rollout.py")
ROLLOUT = pathlib.Path(__file__).parent / "ec2" / "rollout.sh"
IMAGE = "ghcr.io/esdavid1307/pill-facts-backend:0123abc"

FAKE_AWS = textwrap.dedent(
    """\
    #!/usr/bin/env python3
    import json, os, pathlib, sys
    state = pathlib.Path(os.environ["FAKE_AWS_STATE"])
    with open(state / "calls.jsonl", "a") as calls:
        calls.write(json.dumps(sys.argv[1:]) + "\\n")
    if sys.argv[1:3] == ["ssm", "send-command"]:
        if (state / "send-fails").exists():
            print("An error occurred (AccessDeniedException) when calling SendCommand", file=sys.stderr)
            sys.exit(254)
        print("cmd-1")
    elif sys.argv[1:3] == ["ssm", "get-command-invocation"]:
        invocations = json.loads((state / "invocations.json").read_text())
        polled = len(list((state / "polls").iterdir()))
        (state / "polls" / str(polled)).touch()
        invocation = invocations[min(polled, len(invocations) - 1)]
        if isinstance(invocation, str):
            print(invocation, file=sys.stderr)
            sys.exit(254)
        print(json.dumps({"StandardOutputContent": "", "StandardErrorContent": "", **invocation}))
    else:
        sys.exit("unexpected aws call: " + " ".join(sys.argv[1:]))
    """
)


def pending():
    return {"Status": "InProgress"}


def not_registered_yet():
    return "An error occurred (InvocationDoesNotExist) when calling GetCommandInvocation"


class RunRollout(unittest.TestCase):
    def setUp(self):
        self.state = pathlib.Path(self.enterContext(tempfile.TemporaryDirectory()))
        (self.state / "polls").mkdir()
        bin_dir = self.state / "bin"
        bin_dir.mkdir()
        aws = bin_dir / "aws"
        aws.write_text(FAKE_AWS.replace("/usr/bin/env python3", sys.executable, 1))
        aws.chmod(0o755)
        self.path = f"{bin_dir}{os.pathsep}{os.environ['PATH']}"

    def rollout(self, *invocations, poll_limit=10):
        (self.state / "invocations.json").write_text(json.dumps(invocations))
        env = {
            **os.environ,
            "PATH": self.path,
            "FAKE_AWS_STATE": str(self.state),
            "PILLFACTS_AWS_REGION": "us-east-1",
            "PILLFACTS_BACKEND_INSTANCE": "i-0abc",
            "PILLFACTS_POLL_SECONDS": "0",
            "PILLFACTS_POLL_LIMIT": str(poll_limit),
        }
        return subprocess.run(
            [sys.executable, SCRIPT, IMAGE], env=env, capture_output=True, text=True, check=False
        )

    def calls(self):
        lines = (self.state / "calls.jsonl").read_text().splitlines()
        return [json.loads(line) for line in lines]

    def test_passes_and_prints_the_rollout_once_it_succeeds(self):
        result = self.rollout(
            pending(),
            {"Status": "Success", "StandardOutputContent": "pillfacts-backend is answering on port 80"},
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("pillfacts-backend is answering on port 80", result.stdout)

    def test_fails_showing_the_rollouts_output_when_it_fails(self):
        result = self.rollout(
            pending(),
            {
                "Status": "Failed",
                "StandardOutputContent": "Replacing pillfacts-backend",
                "StandardErrorContent": "pillfacts-backend did not answer on port 80",
            },
        )

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("Replacing pillfacts-backend", result.stdout)
        self.assertIn("did not answer on port 80", result.stdout)
        self.assertIn("::error::", result.stdout)
        self.assertIn("Failed", result.stdout)

    def test_waits_for_an_invocation_that_does_not_exist_yet(self):
        # Run Command takes a moment to register a command it has just accepted.
        result = self.rollout(
            not_registered_yet(),
            not_registered_yet(),
            {"Status": "Success", "StandardOutputContent": "answering"},
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("answering", result.stdout)

    def test_gives_up_naming_the_command_when_it_never_finishes(self):
        result = self.rollout(pending(), poll_limit=3)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("::error::", result.stdout)
        self.assertIn("cmd-1", result.stdout)
        self.assertEqual(len(list((self.state / "polls").iterdir())), 3)

    def test_sends_rollout_sh_and_the_image_to_the_instance(self):
        self.rollout({"Status": "Success"})

        send = self.calls()[0]
        self.assertEqual(send[:2], ["ssm", "send-command"])
        self.assertEqual(send[send.index("--instance-ids") + 1], "i-0abc")
        self.assertEqual(send[send.index("--region") + 1], "us-east-1")
        self.assertEqual(send[send.index("--document-name") + 1], "AWS-RunShellScript")
        decode, run = json.loads(send[send.index("--parameters") + 1])["commands"]
        encoded = decode.removeprefix("echo ").removesuffix(" | base64 -d > /tmp/rollout.sh")
        self.assertEqual(base64.b64decode(encoded), ROLLOUT.read_bytes())
        self.assertEqual(run, f"bash /tmp/rollout.sh {IMAGE}")

    def test_fails_showing_why_when_the_command_cannot_be_sent(self):
        (self.state / "send-fails").touch()

        result = self.rollout({"Status": "Success"})

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("AccessDeniedException", result.stdout + result.stderr)
        self.assertEqual(len(self.calls()), 1)

    def test_fails_showing_why_when_the_command_cannot_be_polled(self):
        result = self.rollout(
            pending(), "An error occurred (AccessDeniedException) when calling GetCommandInvocation"
        )

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("AccessDeniedException", result.stdout)
        self.assertIn("cmd-1", result.stdout)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
