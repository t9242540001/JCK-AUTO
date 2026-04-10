# JCK AUTO — Repository Root

## Working Directory

Git root (`app/`) and project code (`app/jck-auto/`) are at different levels.
This is a legacy structure. The correct fix is flattening (moving jck-auto/ contents
to git root), but that requires updating deploy.yml, cron scripts, PM2 config,
MCP connectors, and nginx paths — deferred to a dedicated session.

Until flattening is done, this file exists as a redirect so Claude Code knows
where the code lives.

**Before doing anything:**
cd jck-auto

All project files, scripts, source code, and knowledge base are inside `jck-auto/`.
The full project CLAUDE.md is at `jck-auto/CLAUDE.md`.

**NEVER create files in the git root. Everything goes inside `jck-auto/`.**
