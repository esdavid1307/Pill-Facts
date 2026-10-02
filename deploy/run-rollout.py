#!/usr/bin/env python3
"""Roll IMAGE out to the backend instance over SSM Run Command, and wait for it.

    run-rollout.py ghcr.io/esdavid1307/pill-facts-backend:<sha>

The deploy workflow runs this. It sends deploy/ec2/rollout.sh to the instance, base64 in
the command, polls until Run Command says it finished, prints what it printed, and fails
if it failed. The built-in waiter gives up after 100 seconds, too soon for a Spring start
on a t3.micro.

PILLFACTS_AWS_REGION and PILLFACTS_BACKEND_INSTANCE say where the instance is.
PILLFACTS_POLL_SECONDS and PILLFACTS_POLL_LIMIT override the polling, for tests.
"""

import base64
import json
import os
import pathlib
import shlex
import subprocess
import sys
import time


ROLLOUT = pathlib.Path(__file__).parent / "ec2" / "rollout.sh"
UNFINISHED = {"Pending", "InProgress", "Delayed", "Cancelling"}


def aws(*args):
    return subprocess.run(["aws", *args], capture_output=True, text=True, check=False)


def main():
    image = sys.argv[1]
    region = os.environ["PILLFACTS_AWS_REGION"]
    instance = os.environ["PILLFACTS_BACKEND_INSTANCE"]
    poll_seconds = float(os.environ.get("PILLFACTS_POLL_SECONDS", "5"))
    poll_limit = int(os.environ.get("PILLFACTS_POLL_LIMIT", "180"))

    # The commands stay in Run Command's history, so they hold the script and the image
    # and never a secret. rollout.sh reads those from Parameter Store on the instance.
    script = base64.b64encode(ROLLOUT.read_bytes()).decode()
    commands = [
        f"echo {script} | base64 -d > /tmp/rollout.sh",
        f"bash /tmp/rollout.sh {shlex.quote(image)}",
    ]
    sent = aws(
        "ssm", "send-command", "--region", region, "--instance-ids", instance,
        # Run Command refuses a comment over 100 characters.
        "--document-name", "AWS-RunShellScript", "--comment", f"Deploy {image}"[:100],
        "--parameters", json.dumps({"commands": commands}),
        "--query", "Command.CommandId", "--output", "text",
    )
    if sent.returncode != 0:
        print(sent.stderr, end="")
        print(f"::error::Couldn't send the rollout to {instance}. aws said why, above.")
        return 1
    command_id = sent.stdout.strip()

    for _ in range(poll_limit):
        time.sleep(poll_seconds)
        polled = aws(
            "ssm", "get-command-invocation", "--region", region,
            "--command-id", command_id, "--instance-id", instance, "--output", "json",
        )
        # Run Command takes a moment to register a command it has just accepted.
        if "InvocationDoesNotExist" in polled.stderr:
            continue
        if polled.returncode != 0:
            print(polled.stderr, end="")
            print(f"::error::Couldn't read Run Command {command_id}. aws said why, above.")
            return 1
        invocation = json.loads(polled.stdout)
        if invocation["Status"] not in UNFINISHED:
            break
    else:
        waited = round(poll_limit * poll_seconds / 60)
        print(
            f"::error::Gave up on Run Command {command_id} after {waited} minutes. Its "
            f"output is in the Systems Manager console, under Run Command → Command history."
        )
        return 1

    print(invocation["StandardOutputContent"], end="")
    print(invocation["StandardErrorContent"], end="")
    if invocation["Status"] != "Success":
        # The ::error:: prefix puts the line on the run's summary page.
        print(f"\n::error::The rollout of {image} ended {invocation['Status']}. Its output is above.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
