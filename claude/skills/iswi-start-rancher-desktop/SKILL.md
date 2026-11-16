---
name: iswi-start-rancher-desktop
description: Start Rancher Desktop and get Docker ready for testcontainers-backed sbt integration tests on this macOS ARM laptop — launches the app, waits for the daemon, and refreshes the drifting Lima VM bridge IP in ~/.testcontainers.properties and dev/.env.local. Use when Docker isn't running, someone says "start docker" or "start rancher desktop", a testcontainers connection times out despite Docker being up, or before running sbt integration/test.
---

<objective>
Get a working Docker daemon for this project's testcontainers-backed integration tests
(`sbt integration/test`, `ParityDynamoSuite`, `ConfigTableRepoSuite`, etc.) on this machine's
Rancher Desktop install. One-time machine setup (admin access, the `/var/run/docker.sock` symlink,
`~/.docker-java.properties`) is already done and should not need repeating. The part that recurs
is: Rancher Desktop's Lima VM hands out a different bridge IP (`rd0`) across restarts, and
`~/.testcontainers.properties` / `dev/.env.local` both pin that IP explicitly (to bypass Lima's slow
port-forwarding) — so a restart silently breaks testcontainers even though `docker info` succeeds.
</objective>

<process>

1. **Check whether Docker is already reachable:**
   ```zsh
   docker info >/dev/null 2>&1 && echo UP || echo DOWN
   ```
   Even if UP, still run step 4 (IP sync) — don't assume the pinned IP is still correct just
   because the daemon answers.

2. **Launch Rancher Desktop if it isn't running:**
   ```zsh
   pgrep -f "Rancher Desktop" >/dev/null || open -a "Rancher Desktop"
   ```

3. **Wait for the daemon.** The Lima VM typically takes 30–90s to come up after a cold launch.
   Poll instead of guessing a fixed sleep — this is the "poll until a condition is met" case, so
   use a backgrounded Bash call (`run_in_background: true`) with a generous timeout so the
   conversation isn't blocked while waiting:
   ```zsh
   until docker info >/dev/null 2>&1; do sleep 3; done
   ```

4. **Re-detect the `rd0` bridge IP and sync it into both files:**
   ```zsh
   rdctl shell ip addr show rd0
   ```
   Extract the IPv4 address from the `inet X.X.X.X/24` line.

   - `~/.testcontainers.properties`: replace the `host.override=` line in place
     (`sed -i '' 's/^host.override=.*/host.override=<ip>/' ~/.testcontainers.properties` on macOS,
     or the Edit tool). This file has no secrets — read/edit it normally.
   - `dev/.env.local`: replace the `TESTCONTAINERS_HOST_OVERRIDE=` line with the same blind,
     anchored substitution (`sed -i '' 's/^export TESTCONTAINERS_HOST_OVERRIDE=.*/export TESTCONTAINERS_HOST_OVERRIDE=<ip>/' dev/.env.local`).
     **Never `cat`, `Read`, or otherwise display this file's contents** — it also holds
     AWS-sourced secrets (`SMS_US_CLIENT_SECRET`, `CONTENTFUL_ACCESS_TOKEN`, `SIERRA_ACCESS_TOKEN`,
     etc.). A blind anchored `sed -i` substitution never needs to see those other lines. If the
     harness denies Bash access to this path outright, don't fight it — report the new IP and
     hand the user the exact one-line `sed` command to run themselves (suggest `! sed ...`, since
     the `!` prefix runs a command directly in their own shell).

5. **Verify the docker socket symlink is still correct** (cheap sanity check, not expected to need
   fixing):
   ```zsh
   ls -la /var/run/docker.sock
   ```
   Should point at `~/.rd/docker.sock`. If missing or wrong, this needs `sudo` — **never run sudo
   automatically**, it will hang waiting for a password prompt in a non-interactive tool call.
   Instead give the user the exact command:
   ```zsh
   sudo ln -sf ~/.rd/docker.sock /var/run/docker.sock
   ```

6. **Report the final state:** Docker daemon status, the IP now configured in both files (and
   whether it changed from before), and confirmation that `sbt integration/test` is safe to run
   from `dev/`.

</process>

<scope>
This skill's job stops at "the daemon is reachable and the pinned IP is current." It does not
decide which test suites should run, does not start containers itself, and does not touch anything
in `dev/.env.local` beyond the single `TESTCONTAINERS_HOST_OVERRIDE=` line.
</scope>
