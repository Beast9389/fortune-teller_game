# My Fortune 🔮

A free, no-account, client-side collection of fortune-telling and compatibility games — built with Astro, React, and Tailwind CSS.

**Live demo:** _(add your deployed link here, if you have one)_

## What it does

My Fortune is a small arcade of playful, algorithm-driven games:

- **AI Fortune Teller** — an AI-generated fortune reading
- **Digital Tarot** — a cryptographically fair tarot card draw
- **Palm Reader** — real hand detection via MediaPipe's HandLandmarker, running fully client-side (no photos ever leave your browser), with a playful reading derived from actual finger/palm proportions
- **Astro Matcher** — zodiac/compatibility matching based on real astrological pairing logic
- **Soulmate Quiz** — a compatibility quiz
- **Paper Fortune Teller** — a digital version of the classic paper fortune-teller game

Everything is entertainment, clearly labeled as such — no real predictions, no accounts, and no backend collecting your data. Where the site claims something is "cryptographically fair" or "based on real algorithms," it actually is (see `src/components/`).

## Built with Claude

This project was built with the help of **Claude Code**. A `CLAUDE.md` file in this repo captures development conventions Claude followed while working on the codebase (e.g., running the dev server in background mode, and docs to consult before touching routing, components, or styling).

Claude helped with:
- Scaffolding and building out individual game components (`ArcaneArcade.jsx`, `PalmReader.jsx`, `AstroMatcher.jsx`)
- Integrating MediaPipe's hand-landmark detection for the Palm Reader feature
- Writing page content, SEO metadata, and FAQ copy
- General debugging and iteration across the Astro + React + Tailwind stack

## Tech stack

- [Astro](https://astro.build) — site framework
- [React](https://react.dev) — interactive game components
- [Tailwind CSS](https://tailwindcss.com) — styling
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) — real-time hand detection for the Palm Reader

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:4321`.

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production to `./dist/` |
| `npm run preview` | Preview the production build locally |

## Project structure

```
/
├── src/
│   ├── components/   # Game components (Palm Reader, Astro Matcher, Arcane Arcade, etc.)
│   ├── layouts/       # Page layouts
│   ├── pages/         # Routes (fortune-teller, palm-reader, soulmate-quiz, etc.)
│   ├── styles/        # Global styles
│   └── assets/
└── public/
```