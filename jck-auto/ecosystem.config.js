/**
 * @file ecosystem.config.js
 * @purpose Single committed source of truth for all PM2-managed processes
 *   in this project. Replaces ad-hoc `pm2 start ...` invocations in
 *   shell and deploy.yml. After any edit here, apply with
 *   `pm2 startOrReload ecosystem.config.js` on VDS.
 *
 * @rule: Any change to a PM2 process — adding/removing/env change —
 *   MUST go through this file + git commit + deploy.yml. Never via
 *   direct `pm2 start`, `pm2 set`, or `pm2 restart --update-env` on
 *   the server. Emergency manual startup is allowed (see
 *   infrastructure.md Emergency block), but MUST be followed by
 *   `pm2 startOrReload ecosystem.config.js` as soon as the
 *   emergency passes, to restore the committed state.
 *
 * @updated 2026-04-22
 * @changed 2026-04-22 — mcp-gateway entry corrected: script now
 *   points to real start.sh on VDS, speculative args removed.
 *   Б-11 close remains valid (env unchanged).
 */
module.exports = {
  apps: [
    {
      name: 'jckauto',
      script: 'npm',
      args: 'run start',
      cwd: '/var/www/jckauto/app/jck-auto',
      max_restarts: 10,
      // Site process — restart is safe without env reload; pm2 restart jckauto works.
    },
    {
      name: 'jckauto-bot',
      script: 'node_modules/.bin/tsx',
      args: '-r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local',
      interpreter: 'none',
      cwd: '/var/www/jckauto/app/jck-auto',
      max_restarts: 5,
      // @rule: Bot reads .env.local via dotenv preload. To pick up
      //   .env.local changes, use `pm2 delete jckauto-bot && pm2
      //   startOrReload ecosystem.config.js --only jckauto-bot`.
      //   Plain `pm2 restart` does NOT reload .env.local.
    },
    // ─── mcp-gateway (JCK AUTO Files MCP connector) ──────────────────────────
    // Proxied via nginx at jckauto.ru/mcp (upstream: 127.0.0.1:8808).
    // Closes Б-11 (FILESYSTEM_ROOTS env loss): by declaring env here,
    // every `pm2 startOrReload ecosystem.config.js --only mcp-gateway`
    // re-applies the env vars. Raw `pm2 restart mcp-gateway` drops
    // FILESYSTEM_ROOTS because PM2 restart does not re-read process env
    // — it only re-spawns pm_exec_path with the env snapshot saved at
    // start time.
    //
    // start.sh lives at /opt/ai-knowledge-system/server/ and is
    // self-sufficient: it sources /root/ai-knowledge-system/.env,
    // activates the Python venv, and exec python3 mcp_server.py.
    // The script ignores positional args, so no `args` field is
    // declared here. If the server is ever re-implemented or its
    // startup command changes, update this entry in the same commit
    // that changes /opt/ai-knowledge-system/server/start.sh — never
    // let the two diverge (this class of drift is exactly what
    // caused Б-11).
    //
    // FILESYSTEM_ROOTS is set to /var/www/jckauto (the parent directory
    // of the jck-auto project) rather than to PROJECT_DIR itself,
    // intentionally: this allows MCP clients to also read
    // /var/www/jckauto/deploy-logs/ and /var/www/jckauto/storage/,
    // which is useful for deploy-log diagnostics and catalog debugging.
    //
    // mcp-gateway is intentionally NOT included in the deploy.yml
    // `--only` list — it lives outside the site/bot deploy cycle.
    // Manual reload on VDS: `pm2 startOrReload
    // /var/www/jckauto/app/jck-auto/ecosystem.config.js --only mcp-gateway`.
    {
      name: 'mcp-gateway',
      cwd: '/var/www/jckauto/app/jck-auto',
      script: '/opt/ai-knowledge-system/server/start.sh',
      interpreter: 'bash',
      env: {
        FILESYSTEM_ROOTS: '/var/www/jckauto',
      },
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
