#!/usr/bin/env python3
"""One-shot patch for /opt/ai-knowledge-system/server/mcp_server.py on VDS.

Adds DENY_PATHS / DENY_GLOBS constants and extends _validate_fs_path with
deny-list checks. Idempotent — re-running on already-patched file is safe.

Usage on VDS:
    python3 /var/www/jckauto/app/jck-auto/scripts/infra-patch-mcp-deny.py

Pre-condition: /opt/ai-knowledge-system/server/mcp_server.py.bak-<date> exists.
Post-condition: file is patched OR error message printed and file untouched.

@oneshot — applied 2026-05-02 for NEW-1.X-pre1B. Idempotent re-runs are no-op.
@target  — /opt/ai-knowledge-system/server/mcp_server.py (NOT in this repo)
"""
import re
import sys
from pathlib import Path

SRC = Path("/opt/ai-knowledge-system/server/mcp_server.py")

if not SRC.exists():
    print(f"FAIL: target file not found: {SRC}")
    sys.exit(1)

text = SRC.read_text()

# === Patch 1: import fnmatch ===
if "import fnmatch" in text:
    print("[1/3] fnmatch already imported, skipping")
else:
    text = text.replace("import os\n", "import os\nimport fnmatch\n", 1)
    print("[1/3] Added import fnmatch")

# === Patch 2: DENY_PATHS + DENY_GLOBS block ===
deny_block = '''
# --- Deny-list for secrets and system pseudo-FS ---
# Even if a path falls inside an allow-root above, these paths/globs are blocked.
# DENY_PATHS = exact paths or directory prefixes (resolve()-safe).
# DENY_GLOBS = fnmatch-style glob patterns matched against the resolved path string.

_DENY_PATHS_RAW = [
    # System secrets
    "/etc/shadow",
    "/etc/gshadow",
    "/etc/sudoers",
    "/etc/sudoers.d",
    "/root/.ssh",
    # SSL private keys
    "/etc/letsencrypt/archive",
    "/etc/letsencrypt/keys",
    # System pseudo-FS
    "/proc",
    "/sys",
    "/dev",
    # Project secrets
    "/var/www/jckauto/app/jck-auto/.env.local",
    "/var/www/jckauto/app/jck-auto/.env",
    "/var/www/jckauto/.env.local",
    "/var/www/jckauto/.env",
    # LightRAG secrets
    "/opt/ai-knowledge-system/.env",
]
DENY_PATHS: list[Path] = [Path(p).resolve(strict=False) for p in _DENY_PATHS_RAW]

DENY_GLOBS: list[str] = [
    "**/.env",
    "**/.env.*",
    "**/.env.local",
    "**/.env.production",
    "/etc/letsencrypt/live/*/privkey.pem",
    "**/*.pem",
    "**/*.key",
    "**/id_rsa",
    "**/id_ed25519",
]

logger.info("DENY_PATHS: %d paths, DENY_GLOBS: %d patterns", len(DENY_PATHS), len(DENY_GLOBS))

'''

anchor_p2 = 'logger.info("FILESYSTEM_ROOTS: empty (filesystem access disabled)")\n'
if "DENY_PATHS:" in text:
    print("[2/3] DENY_PATHS already present, skipping")
elif anchor_p2 not in text:
    print("[2/3] FAIL: anchor for DENY block not found — file structure may have changed")
    sys.exit(2)
else:
    text = text.replace(anchor_p2, anchor_p2 + deny_block, 1)
    print("[2/3] Added DENY_PATHS + DENY_GLOBS block")

# === Patch 3: replace _validate_fs_path ===
new_validate = '''def _validate_fs_path(path: str) -> Path | dict:
    """Resolve path, check it lies inside FS_ROOTS, and is not denied.

    Returns a resolved Path on success, or {"error": "..."} on failure.

    Order of checks:
    1. FS_ROOTS configured at all.
    2. Path string non-empty.
    3. Path resolves without OSError.
    4. Resolved path is inside one of FS_ROOTS (allow-list).
    5. Resolved path is NOT inside DENY_PATHS or matched by DENY_GLOBS.

    Symlinks are followed by Path.resolve() — the resolved target must still
    lie inside FS_ROOTS, so symlinks pointing outside are rejected automatically.
    Deny-list applies to the resolved target — symlinks that point at a denied
    secret are also blocked.
    """
    if not FS_ROOTS:
        return {"error": "Filesystem access disabled — FILESYSTEM_ROOTS is empty"}
    if not path or not path.strip():
        return {"error": "Path must be non-empty"}
    try:
        resolved = Path(path).resolve(strict=False)
    except OSError as e:
        return {"error": f"Failed to resolve path: {e}"}

    # Step 1 — must be inside an allow-root
    inside_allow = False
    for root in FS_ROOTS:
        if resolved.is_relative_to(root):
            inside_allow = True
            break
    if not inside_allow:
        return {"error": f"Path '{resolved}' is outside allowed roots"}

    # Step 2 — must NOT be inside a deny-path
    for deny in DENY_PATHS:
        try:
            if resolved == deny:
                logger.warning("fs deny (exact path): %s", resolved)
                return {"error": f"Path '{resolved}' is denied (matches secret-list)"}
            if deny.is_dir() and resolved.is_relative_to(deny):
                logger.warning("fs deny (under dir %s): %s", deny, resolved)
                return {"error": f"Path '{resolved}' is denied (under {deny})"}
        except (OSError, ValueError):
            continue

    # Step 3 — must NOT match a deny-glob
    resolved_str = str(resolved)
    for glob_pattern in DENY_GLOBS:
        if fnmatch.fnmatch(resolved_str, glob_pattern):
            logger.warning("fs deny (glob %r): %s", glob_pattern, resolved)
            return {"error": f"Path '{resolved}' is denied (matches secret pattern)"}

    return resolved
'''

old_pattern = re.compile(
    r"def _validate_fs_path\(path: str\) -> Path \| dict:\n"
    r"(?:    .*\n|\n)*?"
    r"    return \{\"error\": f\"Path '\{resolved\}' is outside allowed roots\"\}\n",
)

if "Step 1 — must be inside an allow-root" in text:
    print("[3/3] _validate_fs_path already extended, skipping")
else:
    new_text, n = old_pattern.subn(new_validate, text, count=1)
    if n != 1:
        print(f"[3/3] FAIL: expected exactly 1 _validate_fs_path match, got {n}")
        sys.exit(3)
    text = new_text
    print("[3/3] Replaced _validate_fs_path with extended version")

SRC.write_text(text)
print("OK: file written")
