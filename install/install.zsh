#!/bin/zsh

# Deploys the dual-agent adhoc-platform-task Claude Code artifacts (two agents,
# one skill, one context template) into one or more Claude Code config
# directories, and registers the vexp MCP server in each. The repository under
# dev/claude/ is the single source of truth; this script is the
# only supported deploy path. Idempotent: a second run against the same
# targets reports everything unchanged/already-registered and exits zero.

if [[ $# -lt 1 ]]; then
    print -u2 -r -- "Usage: $0 <config-dir> [<config-dir> ...]"
    print -u2 -r -- "  Deploys the adhoc-platform-task skill and its two agents into each named"
    print -u2 -r -- "  Claude Code config directory (the value CLAUDE_CONFIG_DIR would point at),"
    print -u2 -r -- "  and registers the vexp MCP server there via 'claude mcp add'."
    print -u2 -r -- "  Example (two profiles): $0 <path/to/first-config-dir> <path/to/second-config-dir>"
    print -u2 -r -- "  This installer indexes nothing: run 'vexp index' once per repository you want indexed."
    exit 1
fi

# --- Prerequisite checks, fail closed before touching anything ---

if ! command -v node &>/dev/null; then
    print -u2 -r -- "Error: 'node' is required"
    exit 1
fi
NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
if (( NODE_MAJOR < 20 )); then
    print -u2 -r -- "Error: node >= 20 required, found $(node --version)"
    exit 1
fi

if ! command -v vexp &>/dev/null; then
    print -u2 -r -- "Error: 'vexp' is required on PATH"
    exit 1
fi

# Resolve the claude binary without hardcoding this machine's path: an
# explicit override env var first, then the standard user-local install
# location, then whatever PATH resolves it to. whence -p only considers real
# executables on PATH, never aliases or shell functions.
CLAUDE_BIN=""
if [[ -n "$ADHOC_CLAUDE_BIN" && -x "$ADHOC_CLAUDE_BIN" ]]; then
    CLAUDE_BIN="$ADHOC_CLAUDE_BIN"
elif [[ -x "$HOME/.local/bin/claude" ]]; then
    CLAUDE_BIN="$HOME/.local/bin/claude"
elif CLAUDE_BIN=$(whence -p claude 2>/dev/null) && [[ -n "$CLAUDE_BIN" ]]; then
    :
else
    CLAUDE_BIN=""
fi
if [[ -z "$CLAUDE_BIN" || ! -x "$CLAUDE_BIN" ]]; then
    print -u2 -r -- "Error: could not resolve an executable claude binary (searched \$ADHOC_CLAUDE_BIN, \$HOME/.local/bin/claude, PATH via whence -p)"
    exit 1
fi

SCRIPT_DIR=${0:A:h}
AGENT_INVESTIGATOR_SRC="$SCRIPT_DIR/../claude/agents/adhoc-investigator.md"
AGENT_EXECUTOR_SRC="$SCRIPT_DIR/../claude/agents/adhoc-executor.md"
SKILL_SRC="$SCRIPT_DIR/../claude/skills/adhoc-platform-task/SKILL.md"
TEMPLATE_SRC="$SCRIPT_DIR/../claude/skills/adhoc-platform-task/assets/adhoc_context_template.txt"
for f in "$AGENT_INVESTIGATOR_SRC" "$AGENT_EXECUTOR_SRC" "$SKILL_SRC" "$TEMPLATE_SRC"; do
    if [[ ! -f "$f" ]]; then
        print -u2 -r -- "Error: canonical source file not found: $f"
        exit 1
    fi
done

# Every target config directory must already exist; a typo must not silently
# create a new profile. Checked for all targets before deploying to any.
for CFG_DIR in "$@"; do
    if [[ ! -d "$CFG_DIR" ]]; then
        print -u2 -r -- "Error: config directory not found: $CFG_DIR"
        exit 1
    fi
done

# --- Deploy into each target config directory ---

for CFG_DIR in "$@"; do
    CFG_DIR_ABS=${CFG_DIR:A}
    print -r -- "--- $CFG_DIR_ABS ---"

    mkdir -p "$CFG_DIR_ABS/agents"
    mkdir -p "$CFG_DIR_ABS/skills/adhoc-platform-task/assets"

    # Placeholder-bearing files: substitute the token with this profile's own
    # absolute config directory, then compare against the existing deployed
    # copy before writing. SKILL.md belongs here too — it cites the template by
    # absolute path, so a verbatim copy would leave the token unresolved.
    for pair in \
        "$AGENT_INVESTIGATOR_SRC:$CFG_DIR_ABS/agents/adhoc-investigator.md" \
        "$AGENT_EXECUTOR_SRC:$CFG_DIR_ABS/agents/adhoc-executor.md" \
        "$SKILL_SRC:$CFG_DIR_ABS/skills/adhoc-platform-task/SKILL.md"
    do
        SRC="${pair%%:*}"
        DEST="${pair#*:}"
        TMP=$(mktemp)
        sed "s|@@CLAUDE_CONFIG_DIR@@|${CFG_DIR_ABS}|g" "$SRC" > "$TMP"
        if [[ -f "$DEST" ]] && cmp -s "$TMP" "$DEST"; then
            print -r -- "unchanged: $DEST"
            rm -f "$TMP"
        else
            if [[ -f "$DEST" ]]; then
                print -r -- "replacing (content differs): $DEST"
            else
                print -r -- "writing: $DEST"
            fi
            mv "$TMP" "$DEST"
        fi
    done

    # Template: copied verbatim, same diff-before-write rule.
    for pair in \
        "$TEMPLATE_SRC:$CFG_DIR_ABS/skills/adhoc-platform-task/assets/adhoc_context_template.txt"
    do
        SRC="${pair%%:*}"
        DEST="${pair#*:}"
        if [[ -f "$DEST" ]] && cmp -s "$SRC" "$DEST"; then
            print -r -- "unchanged: $DEST"
        else
            if [[ -f "$DEST" ]]; then
                print -r -- "replacing (content differs): $DEST"
            else
                print -r -- "writing: $DEST"
            fi
            cp "$SRC" "$DEST"
        fi
    done

    # MCP registration: skip if already present, never hand-edit the JSON.
    ALREADY_REGISTERED=$(CFG_JSON="$CFG_DIR_ABS/.claude.json" node -e '
        const fs = require("fs");
        const p = process.env.CFG_JSON;
        try {
            const j = JSON.parse(fs.readFileSync(p, "utf8"));
            process.stdout.write(j.mcpServers && j.mcpServers.vexp ? "yes" : "no");
        } catch (e) {
            process.stdout.write("no");
        }
    ' 2>/dev/null)
    if [[ "$ALREADY_REGISTERED" == "yes" ]]; then
        print -r -- "already registered: vexp MCP server in $CFG_DIR_ABS"
    else
        if CLAUDE_CONFIG_DIR="$CFG_DIR_ABS" "$CLAUDE_BIN" mcp add -s user vexp -- vexp mcp >/dev/null 2>&1; then
            print -r -- "registered: vexp MCP server in $CFG_DIR_ABS"
        else
            print -u2 -r -- "Error: failed to register vexp MCP server in $CFG_DIR_ABS"
            exit 1
        fi
    fi
done

print -r -- "Done."
