/**
 * @file        botStats.ts
 * @description In-memory bot command and source statistics with atomic disk persistence.
 *              Stats loaded synchronously at module import (once per bot startup).
 *              Increments are in-memory; disk write is async (fire-and-forget, atomic).
 * @dependencies fs (sync read at import, async write), path
 * @rule        Load stats synchronously at module level — prevents race condition on first increment.
 * @rule        Write atomically: writeFileSync to .tmp path, then renameSync — never write directly.
 *              Violation: corrupt JSON if process dies mid-write.
 * @lastModified 2026-04-10
 */

import fs from 'fs';
import path from 'path';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type CommandStat = 'calc' | 'customs' | 'auction' | 'noscut' | 'catalog';
export type SourceStat = 'web_encar' | 'web_auction' | 'direct';

export interface BotStats {
  commands: Record<CommandStat, number>;
  sources: Record<SourceStat, number>;
  webAuthCount: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATS_FILE = '/var/www/jckauto/storage/bot-stats.json';
const STATS_TMP  = '/var/www/jckauto/storage/bot-stats.tmp.json';

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

function defaultStats(): BotStats {
  return {
    commands: { calc: 0, customs: 0, auction: 0, noscut: 0, catalog: 0 },
    sources:  { web_encar: 0, web_auction: 0, direct: 0 },
    webAuthCount: 0,
  };
}

// ─── MODULE-LEVEL INIT (synchronous — runs once at import) ───────────────────

let stats: BotStats;
try {
  const raw = fs.readFileSync(STATS_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<BotStats>;
  // Merge with defaults to handle missing keys in older file versions
  stats = {
    commands: { ...defaultStats().commands, ...parsed.commands },
    sources:  { ...defaultStats().sources,  ...parsed.sources  },
    webAuthCount: parsed.webAuthCount ?? 0,
  };
} catch {
  stats = defaultStats();
}

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────

async function persist(): Promise<void> {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_TMP, JSON.stringify(stats, null, 2), 'utf-8');
    fs.renameSync(STATS_TMP, STATS_FILE);
  } catch (err) {
    console.error('[botStats] persist error:', err);
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

/**
 * Increment a command usage counter and persist.
 * Call after successful command execution (fire-and-forget: no need to await).
 */
export function incrementCommand(cmd: CommandStat): void {
  stats.commands[cmd]++;
  persist().catch(() => {});
}

/**
 * Increment a traffic source counter and persist.
 * Call when /start web_{source} deep link is detected.
 */
export function incrementSource(src: SourceStat): void {
  stats.sources[src]++;
  persist().catch(() => {});
}

/**
 * Increment web auth counter and persist.
 * Call when deep link branch fires in start.ts.
 */
export function incrementWebAuth(): void {
  stats.webAuthCount++;
  persist().catch(() => {});
}

/**
 * Return current stats snapshot (in-memory, no file read).
 */
export function getBotStats(): BotStats {
  return {
    ...stats,
    commands: { ...stats.commands },
    sources:  { ...stats.sources  },
  };
}
