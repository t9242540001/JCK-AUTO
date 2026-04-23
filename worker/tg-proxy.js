/**
 * @file        worker/tg-proxy.js
 * @description Cloudflare Worker that proxies four distinct traffic
 *              flows for the JCK AUTO project: Telegram inbound
 *              webhooks (→ VDS), photo fetch for Telegram (← VDS),
 *              Anthropic API calls (→ api.anthropic.com), and all
 *              remaining paths as Telegram outbound Bot API calls
 *              (→ api.telegram.org).
 * @rule        This file is the single source of truth for the
 *              Worker. Do NOT edit the Worker in Cloudflare
 *              Dashboard — every deploy via wrangler overwrites
 *              whatever is live. Changes go through git, pushed to
 *              main, deployed via .github/workflows/deploy-worker.yml.
 * @rule        Placement is pinned to EU via wrangler.toml
 *              [placement] region = "eu". Do NOT switch to Smart
 *              Placement (see decisions.md regarding Smart Placement
 *              drift on low-traffic single-source Workers).
 * @updated     2026-04-23
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Incoming webhook from Telegram → forward to VDS
    if (url.pathname.startsWith("/webhook/")) {
      const vdsUrl = "https://jckauto.ru/bot-webhook/" + url.pathname.slice("/webhook/".length);
      return fetch(vdsUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }

    // Photo proxy → fetch from VDS, try multiple extensions
    if (url.pathname.startsWith("/photo/")) {
      const photoPath = url.pathname.slice("/photo/".length);
      const baseUrl = "https://jckauto.ru/" + photoPath;

      let resp = await fetch(baseUrl);

      if (!resp.ok) {
        const extMap = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
        const pathNoExt = baseUrl.replace(/\.[^.]+$/, "");

        for (const ext of extMap) {
          const altUrl = pathNoExt + ext;
          if (altUrl === baseUrl) continue;
          resp = await fetch(altUrl);
          if (resp.ok) break;
        }
      }

      if (!resp.ok) {
        return new Response("Photo not found", { status: 404 });
      }

      const contentType = resp.headers.get("Content-Type") || "image/jpeg";
      return new Response(resp.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // Anthropic API proxy → forward to api.anthropic.com
    if (url.pathname.startsWith("/anthropic/")) {
      const anthropicPath = url.pathname.slice("/anthropic".length);
      const anthropicUrl = "https://api.anthropic.com" + anthropicPath;

      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      // Read body as text to fully detach from original request
      const body = await request.text();

      // @rule: Only forward the four Anthropic-specific headers listed
      //   below. Do NOT forward request.headers wholesale — upstream
      //   Anthropic API is sensitive to unexpected headers (CF-*,
      //   X-Forwarded-*, etc.) and may return 403. Keep this branch
      //   distinct from the Telegram default branch at the bottom.
      const apiKey = request.headers.get("x-api-key") || "";
      const anthropicVersion = request.headers.get("anthropic-version") || "2023-06-01";
      const anthropicBeta = request.headers.get("anthropic-beta") || "";

      const headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
      };

      if (anthropicBeta) {
        headers["anthropic-beta"] = anthropicBeta;
      }

      // Create a completely new request — no inherited headers
      const resp = await fetch(new Request(anthropicUrl, {
        method: "POST",
        headers: headers,
        body: body,
      }));

      return new Response(resp.body, {
        status: resp.status,
        headers: {
          "Content-Type": resp.headers.get("Content-Type") || "application/json",
        },
      });
    }

    // Outgoing bot requests → forward to Telegram API
    url.host = "api.telegram.org";
    url.protocol = "https:";

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return fetch(newRequest);
  }
};
