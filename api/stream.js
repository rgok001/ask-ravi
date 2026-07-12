// api/stream.js — streams chat answers token by token so the reply starts
// appearing almost immediately. Runs on the edge runtime (required for
// response streaming on Vercel). /api/ask remains the buffered fallback
// and the JD-assessment endpoint.
export const config = { runtime: "edge" };

import { neon } from "@neondatabase/serverless";
import { CV_CONTEXT, PERSONA_NOTES } from "./ask.js";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

const RATE = { WINDOW_MS: 60_000, MAX: 12 };
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, start: now };
  if (now - rec.start > RATE.WINDOW_MS) { rec.count = 0; rec.start = now; }
  rec.count++;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.count > RATE.MAX;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const jsonRes = (obj, status) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return jsonRes({ error: "Server missing ANTHROPIC_API_KEY" }, 500);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return jsonRes({ text: "You're asking a lot of questions very quickly, give it a moment and try again." }, 429);
  }

  let body;
  try { body = await req.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
  const { messages, sessionId, referrer, pagePath, persona } = body || {};
  const personaKey = Object.prototype.hasOwnProperty.call(PERSONA_NOTES, persona) ? persona : null;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonRes({ error: "messages[] required" }, 400);
  }
  const trimmed = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 1500),
  }));
  const lastUser = [...trimmed].reverse().find((m) => m.role === "user");

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      stream: true,
      system: personaKey
        ? CV_CONTEXT + "\n\n=== VISITOR CONTEXT ===\n" + PERSONA_NOTES[personaKey]
        : CV_CONTEXT,
      messages: trimmed,
    }),
  });
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    return jsonRes({ error: "Upstream error", detail }, 502);
  }

  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let ev;
            try { ev = JSON.parse(line.slice(6)); } catch { continue; }
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta" && ev.delta.text) {
              full += ev.delta.text;
              controller.enqueue(enc.encode(ev.delta.text));
            }
          }
        }
      } catch (e) {
        // upstream broke mid-stream; deliver what we have
      }
      try {
        if (sql && lastUser?.content) {
          const intent = /\[\[INTENT\]\]/.test(full);
          await sql`
            INSERT INTO questions (session_id, question, referrer, page_path, persona, intent)
            VALUES (${sessionId || null}, ${lastUser.content}, ${referrer || null}, ${pagePath || null}, ${personaKey || null}, ${intent})
          `;
        }
      } catch (e) {
        console.error("[log] stream insert failed:", e);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
