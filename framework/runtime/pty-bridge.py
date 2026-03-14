#!/usr/bin/env python3

import argparse
import errno
import fcntl
import json
import os
import pty
import selectors
import struct
import sys
import termios


def send(message):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def set_winsize(fd, rows, cols):
    try:
        payload = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, payload)
    except OSError:
        return


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shell", required=True)
    parser.add_argument("--cols", type=int, default=120)
    parser.add_argument("--rows", type=int, default=32)
    parser.add_argument("shell_args", nargs=argparse.REMAINDER)
    return parser.parse_args()


def reap_child(child_pid):
    try:
        waited_pid, status = os.waitpid(child_pid, os.WNOHANG)
    except ChildProcessError:
        return {"done": True, "code": 0, "signal": None}

    if waited_pid == 0:
        return {"done": False, "code": None, "signal": None}

    if os.WIFEXITED(status):
        return {"done": True, "code": os.WEXITSTATUS(status), "signal": None}

    if os.WIFSIGNALED(status):
        return {"done": True, "code": None, "signal": os.WTERMSIG(status)}

    return {"done": True, "code": None, "signal": None}


def main():
    args = parse_args()
    shell_args = list(args.shell_args)
    if shell_args and shell_args[0] == "--":
        shell_args = shell_args[1:]

    child_pid, master_fd = pty.fork()
    if child_pid == 0:
        os.execvpe(args.shell, [args.shell] + shell_args, os.environ.copy())
        return

    set_winsize(master_fd, args.rows, args.cols)
    send({"type": "ready", "pid": child_pid})

    selector = selectors.DefaultSelector()
    selector.register(master_fd, selectors.EVENT_READ, "pty")
    selector.register(sys.stdin.buffer, selectors.EVENT_READ, "stdin")

    while True:
        child_state = reap_child(child_pid)
        if child_state["done"]:
            send({"type": "exit", "code": child_state["code"], "signal": child_state["signal"]})
            break

        for key, _mask in selector.select(0.1):
            if key.data == "pty":
                try:
                    chunk = os.read(master_fd, 65536)
                except OSError as err:
                    if err.errno == errno.EIO:
                        chunk = b""
                    else:
                        raise

                if not chunk:
                    continue

                send({
                    "type": "output",
                    "data": chunk.decode("utf-8", "replace"),
                })
                continue

            if key.data == "stdin":
                line = sys.stdin.buffer.readline()
                if not line:
                    continue

                try:
                    message = json.loads(line.decode("utf-8"))
                except json.JSONDecodeError:
                    send({"type": "error", "message": "Expected JSON lines on stdin."})
                    continue

                if message.get("type") == "input":
                    data = message.get("data", "")
                    if isinstance(data, str):
                        os.write(master_fd, data.encode("utf-8", "replace"))
                    continue

                if message.get("type") == "resize":
                    cols = int(message.get("cols", args.cols))
                    rows = int(message.get("rows", args.rows))
                    args.cols = cols
                    args.rows = rows
                    set_winsize(master_fd, rows, cols)
                    continue

                send({"type": "error", "message": f"Unsupported bridge message type: {message.get('type')}"})


if __name__ == "__main__":
    main()
