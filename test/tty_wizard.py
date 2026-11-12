#!/usr/bin/env python3
"""Drives the setup wizard in a real pseudo-terminal: arrow keys, space, 'a', typing, Ctrl+U, Enter.
Unlike ADS_ANSWERS runs, this exercises the raw-mode key handling and the screen redraws.
Usage: python3 -I test/tty_wizard.py <repo> <fake-home>   (macOS/Linux; exits non-zero on failure)
"""
import os
import pty
import re
import select
import subprocess
import sys
import time

REPO, HOME = sys.argv[1], sys.argv[2]
UP, DOWN, ENTER, SPACE, CTRL_U = "\x1b[A", "\x1b[B", "\r", " ", "\x15"
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")

os.makedirs(os.path.join(HOME, "projects", "demo"), exist_ok=True)
subprocess.run(["git", "init", "-q"], cwd=os.path.join(HOME, "projects", "demo"), check=True)
env = {k: v for k, v in os.environ.items() if k not in ("NO_COLOR", "ADS_ANSWERS", "ADS_YES", "CI")}
env.update(ADS_HOME=HOME, ADS_SKIP_INSTALLS="1", LANG="en_US.UTF-8", LC_ALL="en_US.UTF-8", TERM="xterm-256color", NO_UPDATE_NOTIFIER="1")

pid, fd = pty.fork()
if pid == 0:
    os.execvpe("node", ["node", os.path.join(REPO, "bin", "cli.mjs")], env)

buf = ""
transcript = []


def read_until(pattern, timeout=20):
    """Wait until `pattern` shows up in the screen output after the last match."""
    global buf
    end = time.time() + timeout
    while time.time() < end:
        m = re.search(pattern, ANSI.sub("", buf))
        if m:
            buf = ANSI.sub("", buf)[m.end():]
            return
        r, _, _ = select.select([fd], [], [], 0.2)
        if r:
            try:
                chunk = os.read(fd, 65536).decode("utf8", "replace")
            except OSError:
                break
            if not chunk:
                break
            buf += chunk
            transcript.append(chunk)
    fail(f"timeout waiting for {pattern!r}")


def fail(msg):
    sys.exit(f"{msg}\n--- terminal output (tail) ---\n{ANSI.sub('', ''.join(transcript))[-2500:]}")


def send(*keys):
    for k in keys:
        os.write(fd, k.encode())
        time.sleep(0.08)


read_until(r"Language for this setup")
send(ENTER)                                   # English
read_until(r"How much do you want to install\?")
send(DOWN, DOWN, ENTER)                       # Custom
read_until(r"Pick the components")
send("a", "a")                                # all on, then all off (core stays: locked)
send(DOWN, SPACE, ENTER)                      # only caveman
read_until(r"caveman default intensity")
send(DOWN, ENTER)                             # megacave
read_until(r"Timezone")
send(CTRL_U, "U", "T", "C", ENTER)            # typed text
read_until(r"Where do your projects live\?")
send(ENTER)
read_until(r"Language of the blocks")
send(ENTER)
read_until(r"Wire which projects now\?")
send(ENTER)                                   # demo is pre-checked on a first run
read_until(r"Your git email")
send(CTRL_U, *"tty@example.com", ENTER)
read_until(r"Install now\?")
send(ENTER)
read_until(r"All set", timeout=60)

# keep draining the terminal until the process exits (a full pty buffer would block the child forever)
end = time.time() + 60
status = None
while time.time() < end:
    done, st = os.waitpid(pid, os.WNOHANG)
    if done:
        status = st
        break
    if select.select([fd], [], [], 0.2)[0]:
        try:
            transcript.append(os.read(fd, 65536).decode("utf8", "replace"))
        except OSError:
            pass
if status is None:
    os.kill(pid, 9)
    fail("wizard did not exit after finishing")
cfg = open(os.path.join(HOME, ".config", "agentic-dev-stack", "stack.env")).read()
expect = ["WITH_CAVEMAN=1", "WITH_SPECKIT=0", "WITH_GRAPHIFY=0", "WITH_OPENCODE=0", 'CAVEMAN_MODE="megacave"', 'TIMEZONE="UTC"', 'GIT_AUTHOR_EMAIL="tty@example.com"']
missing = [e for e in expect if e not in cfg]
if missing:
    fail(f"stack.env is missing {missing}")
# the picked project reaches the wiring step (it needs alethe, which this minimal pick does not install)
if "projects/demo" not in open(os.path.join(HOME, ".config", "agentic-dev-stack", "projects.list")).read():
    fail("picked project was not saved")
if os.waitstatus_to_exitcode(status) != 0:
    fail(f"wizard exited with {os.waitstatus_to_exitcode(status)}")
print("tty wizard ok")
