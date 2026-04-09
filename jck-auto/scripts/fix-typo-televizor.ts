/**
 * @file fix-typo-televizor.ts
 * @description One-time fix: replace "телевзор" with "телевизор" in noscut-catalog.json
 * @run npx tsx scripts/fix-typo-televizor.ts
 */

import fs from "fs";

const PATH = "/var/www/jckauto/storage/noscut/noscut-catalog.json";
const raw = fs.readFileSync(PATH, "utf-8");
const fixed = raw.replace(/телевзор/g, "телевизор");
fs.writeFileSync(PATH, fixed, "utf-8");
console.log("[fix] Done. Replaced 'телевзор' → 'телевизор'");
