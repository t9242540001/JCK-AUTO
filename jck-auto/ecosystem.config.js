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
    {
      name: 'mcp-gateway',
      script: '/opt/ai-knowledge-system/server/start.sh',
      interpreter: 'bash',
      env: {
        FILESYSTEM_ROOTS: '/var/www/jckauto/app/jck-auto',
      },
      max_restarts: 10,
      // @rule: FILESYSTEM_ROOTS is the env variable the MCP server reads
      //   (see /opt/ai-knowledge-system/server/mcp_server.py line 31).
      //   It points to the directory tree the JCK AUTO Files MCP
      //   connector serves to Claude. Losing this value means Claude
      //   can no longer read project files via MCP.
    },
  ],
};
