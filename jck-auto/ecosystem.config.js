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
 * @rule: All PM2 processes write logs to /var/log/pm2/{name}-{out,error}.log
 *        (NOT to PM2 default /root/.pm2/logs/). This path is inside the
 *        mcp-gateway FILESYSTEM_ROOTS, so Claude (strategic partner)
 *        reads them directly via MCP. See ADR [2026-05-04] INFRA-1.
 *
 * @updated 2026-05-04
 * @changed 2026-04-22 — mcp-gateway entry corrected: script now
 *   points to real start.sh on VDS, speculative args removed.
 *   Б-11 close remains valid (env unchanged).
 * @changed 2026-05-02 — added yandex-metrika-mcp entry for
 *   NEW-1.1 (Streamable HTTP wrapper for Yandex Metrika OAuth
 *   API access).
 * @changed 2026-05-02 — extended mcp-gateway FILESYSTEM_ROOTS
 *   to include /opt/ai-knowledge-system, /etc/nginx,
 *   /var/log/nginx (NEW-1.X-pre1A). DENY_PATHS deny-list added
 *   in mcp_server.py manually on VDS as paired manual-ops step.
 * @changed 2026-05-04 — INFRA-1: out_file/error_file paths added
 *   to all entries; FILESYSTEM_ROOTS extended to /var/log/pm2.
 */
module.exports = {
  apps: [
    {
      name: 'jckauto',
      cwd: '/var/www/jckauto/app/jck-auto',
      out_file: '/var/log/pm2/jckauto-out.log',
      error_file: '/var/log/pm2/jckauto-error.log',
      script: 'npm',
      args: 'run start',
      max_restarts: 10,
      // Site process — restart is safe without env reload; pm2 restart jckauto works.
    },
    {
      name: 'jckauto-bot',
      cwd: '/var/www/jckauto/app/jck-auto',
      out_file: '/var/log/pm2/jckauto-bot-out.log',
      error_file: '/var/log/pm2/jckauto-bot-error.log',
      script: 'node_modules/.bin/tsx',
      args: '-r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local',
      interpreter: 'none',
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
      out_file: '/var/log/pm2/mcp-gateway-out.log',
      error_file: '/var/log/pm2/mcp-gateway-error.log',
      script: '/opt/ai-knowledge-system/server/start.sh',
      interpreter: 'bash',
      env: {
        FILESYSTEM_ROOTS: '/var/www/jckauto:/opt/ai-knowledge-system:/etc/nginx:/var/log/nginx:/var/log/pm2',
      },
      max_restarts: 10,
      autorestart: true,
    },
    // ─── yandex-metrika-mcp (Yandex Metrika MCP for Claude.ai Custom Connector) ───
    // Wraps atomkraft/yandex-metrika-mcp (stdio-based) in Streamable HTTP transport
    // via locally-installed supergateway. Listens on internal port 8765. Exposed
    // to Anthropic cloud via nginx /mcp/metrika/ proxy (configured separately, see
    // NEW-1.2 prompt). Source for OAuth token (YANDEX_API_KEY) is .env.local on
    // VDS — Vasily places it there manually via SSH; it MUST NOT enter git or chat.
    //
    // First-time install steps live in knowledge/infrastructure.md → "Yandex Metrika
    // MCP — install steps" section.
    //
    // @rule: Token rotation requires full restart cycle:
    //   1. Edit .env.local with new value.
    //   2. `set -a; source .env.local; set +a` to load into shell env.
    //   3. `pm2 delete yandex-metrika-mcp`
    //   4. `pm2 startOrReload ecosystem.config.js --only yandex-metrika-mcp`
    //   `pm2 restart` does NOT re-read env, same trap as bot/.env.local rule.
    //
    // @rule: This entry is NOT included in deploy.yml `--only` list — it lives
    //   outside the site/bot deploy cycle. Manual reload on VDS only.
    {
      name: 'yandex-metrika-mcp',
      cwd: '/var/www/jckauto/mcp-servers/yandex-metrika-mcp',
      out_file: '/var/log/pm2/yandex-metrika-mcp-out.log',
      error_file: '/var/log/pm2/yandex-metrika-mcp-error.log',
      script: 'node_modules/.bin/supergateway',
      args: '--port 8765 --outputTransport streamableHttp --stdio "node /var/www/jckauto/mcp-servers/yandex-metrika-mcp/build/index.js"',
      interpreter: 'none',
      env: {
        YANDEX_API_KEY: process.env.YANDEX_API_KEY,
      },
      max_restarts: 5,
      autorestart: true,
    },
  ],
};
