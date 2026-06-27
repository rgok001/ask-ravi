<div align="center">

# RAVI-OS · Ask Ravi

### A CV that talks back.

Don't read a résumé. **Interrogate it.** RAVI-OS is a conversational AI that knows
Ravi Gokal's career and answers questions about it in real time — on the record,
grounded in 13 years of real work.

`Senior Business Analyst` · `Delivery Lead` · `built with Claude`

</div>

---

## What it is

Most CVs are a wall of bullet points read in seven seconds and forgotten. This one
is a live system. A visitor types a question — *"What's his biggest cost saving?"*,
*"Has he worked in security?"*, *"Why should I hire him?"* — and an AI answers
conversationally, citing the specific programme it's drawing from so every claim
reads as evidence rather than spin.

It's a small idea executed end-to-end: a single-page front end, a serverless
backend that keeps the API key secret, and a carefully written system prompt that
turns a career into something you can hold a conversation with.

## How it works

```
Browser ──ask──▶  /api/ask  ──▶  Claude (Anthropic API)
   ▲   (no key)   (key lives here,        │
   └────────────  server-side only)  ◀────┘ grounded answer
```

- **Front end** (`public/index.html`) — a stark, single-screen terminal interface.
  No build step, no framework, no dependencies. Vanilla HTML/CSS/JS.
- **Back end** (`api/ask.js`) — a serverless function that holds the Anthropic key
  in an environment variable, injects Ravi's dossier as the system prompt, trims
  conversation history to control cost, and returns the model's answer.
- **The key never touches the browser**, so it can't be scraped from page source.

## Tech

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Vanilla HTML/CSS/JS | Zero build, loads instantly, hosts anywhere |
| Backend | Vercel serverless function (Node 18+) | Keeps the API key private; scales to zero |
| Model | Claude (Anthropic API) | Grounded, on-the-record answers |
| Hosting | Vercel Hobby (free) | One-click deploy from GitHub |

## Run it yourself

Full step-by-step (GitHub → Vercel → live link in ~15 minutes) is in
**[`DEPLOY.md`](./DEPLOY.md)**. The short version:

1. Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com).
2. Push this repo to GitHub.
3. Import it into [Vercel](https://vercel.com) and add an environment variable
   `ANTHROPIC_API_KEY`.
4. Deploy. You get a public URL like `https://ask-ravi.vercel.app`.

## Project structure

```
ask-ravi/
├── api/
│   └── ask.js          # serverless backend — holds the key, calls Claude
├── public/
│   └── index.html      # the RAVI-OS interface
├── vercel.json         # routing
├── package.json
├── DEPLOY.md           # full deployment walkthrough
└── README.md           # you are here
```

## Make it your own

All career facts live in the `CV_CONTEXT` string at the top of `api/ask.js`.
Edit that text, push to GitHub, and Vercel redeploys automatically. The AI's tone
and rules are the first paragraph of that same string — rewrite it to change the
personality (third-person, first-person, formal, playful, whatever fits).

## Notes

- Each question costs a fraction of a cent on Claude Sonnet; set a spend cap in the
  Anthropic console for peace of mind.
- Conversation history is trimmed and message length capped server-side to keep
  costs predictable.
- Respects `prefers-reduced-motion`; keyboard accessible.

## License

MIT — use it, fork it, build your own talking CV. Attribution appreciated but not required.

<div align="center">
<br>
<sub>Built by Ravi Gokal · turning ambiguity into things that ship.</sub>
</div>
