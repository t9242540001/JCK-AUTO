/**
 * @file        ecosystem.config.js
 * @project     JCK AUTO
 * @purpose     Single source of truth for all PM2-managed processes on VDS.
 *              Replaces the previous "hand-typed pm2 start … flags" pattern
 *              that lived only in deploy.yml, infrastructure.md prose, and
 *              ~/.pm2/dump.pm2 on the server. Drift between those three
 *              copies caused the 2026-04-22 PM2 cwd inheritance incident
 *              (duplicate jckauto-bot processes) and Б-11 (mcp-gateway
 *              FILESYSTEM_ROOTS env loss after raw `pm2 restart`).
 *
 * @rule        deploy.yml MUST start/reload via
 *                  pm2 startOrReload ecosystem.config.js --only jckauto,jckauto-bot
 *              and NEVER via raw `pm2 start <bash> --name … -- -c "…"`.
 *              Manual restarts on VDS use the same file:
 *                  pm2 startOrReload /var/www/jckauto/app/jck-auto/ecosystem.config.js --only <name>
 *              `pm2 restart <name>` remains forbidden for jckauto-bot and
 *              mcp-gateway — it does NOT reload .env.local / declared env.
 *              See infrastructure.md → PM2 Processes.
 *
 * @rule        Any change to a process's startup command, cwd, or env MUST
 *              land in THIS file in the same prompt as the change.
 *              `infrastructure.md` and `rules.md` are descriptive; this
 *              file is executable. They must agree.
 *
 * @rule        Each entry MUST set `cwd` explicitly. PM2's cwd inheritance
 *              from the daemon / shell is unreliable — it caused the
 *              2026-04-22 incident. Bash wrapper apps additionally
 *              `cd <cwd>` inside `-c "…"` as defense in depth.
 *
 * @updated     2026-04-22
 */

const PROJECT_DIR = '/var/www/jckauto/app/jck-auto';

module.exports = {
  apps: [
    // ─── jckauto (Next.js site) ──────────────────────────────────────────────
    // Restart-safe: `pm2 restart jckauto` is fine — Next.js does not depend on
    // .env.local being re-read at runtime (env is baked at build time).
    {
      name: 'jckauto',
      cwd: PROJECT_DIR,
      script: 'npm',
      args: 'start',
      max_restarts: 10,
      autorestart: true,
    },

    // ─── jckauto-bot (Telegram bot) ──────────────────────────────────────────
    // Five protective layers (see ADR [2026-04-22] PM2 cwd inheritance incident):
    //   1. explicit `cwd: PROJECT_DIR` for the daemon;
    //   2. `cd ${PROJECT_DIR}` inside bash -c — defense in depth;
    //   3. `exec` so PM2's PID == tsx PID (correct restart metrics);
    //   4. `--max-restarts 5` to cap any future crash-loop;
    //   5. dump cleanup on every deploy (`pm2 delete` is implicit in
    //      `pm2 startOrReload`'s reload semantics for this entry).
    // tsx binary is `node_modules/.bin/tsx`, NOT `npx tsx` — see
    // telegram-bot.md / infrastructure.md "Why node_modules/.bin/tsx".
    {
      name: 'jckauto-bot',
      cwd: PROJECT_DIR,
      script: 'bash',
      interpreter: 'none',
      args: [
        '-c',
        `cd ${PROJECT_DIR} && exec node_modules/.bin/tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local`,
      ],
      max_restarts: 5,
      autorestart: true,
    },

    // ─── mcp-gateway (JCK AUTO Files MCP connector) ──────────────────────────
    // Proxied via nginx at /mcp. Closes Б-11 (FILESYSTEM_ROOTS env loss):
    // by declaring env here, every `pm2 startOrReload ecosystem.config.js
    // --only mcp-gateway` re-applies the env vars. Raw `pm2 restart
    // mcp-gateway` was dropping FILESYSTEM_ROOTS because PM2 restart does
    // not re-read process env from anywhere — it only re-spawns the
    // pm_exec_path with the env snapshot saved at start time.
    //
    // NOTE: the `args` script command below documents the canonical form.
    // If the operational command on VDS differs, update it here in the
    // same commit that changes it on the server — never let the two
    // diverge (this is exactly what caused Б-11). After updating, run
    // `pm2 startOrReload ecosystem.config.js --only mcp-gateway` on VDS
    // to apply.
    //
    // mcp-gateway is intentionally NOT included in the deploy.yml
    // `--only` list — it lives outside the site/bot deploy cycle. This
    // file is its source of truth for the next manual restart, NOT a
    // trigger for automatic redeploy.
    {
      name: 'mcp-gateway',
      cwd: PROJECT_DIR,
      script: 'bash',
      interpreter: 'none',
      args: [
        '-c',
        'exec npx -y @modelcontextprotocol/server-filesystem "$FILESYSTEM_ROOTS"',
      ],
      env: {
        FILESYSTEM_ROOTS: '/var/www/jckauto',
      },
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
