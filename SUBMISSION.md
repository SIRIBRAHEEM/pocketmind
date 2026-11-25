# PocketMind - Devpost submission text (copy-ready)

Platform: Web (Chrome)

## What it does

PocketMind is a personal AI notebook for students. You paste or write your
lecture notes, then ask questions about them, get a one-tap summary, and
generate flashcards for revision. Every AI answer carries a badge showing
which model produced it: "On-device" when Gemini Nano answered locally in
Chrome (private, free, works offline) or "Cloud" when Firebase AI Logic
routed the request to the cloud Gemini model. A Hybrid status panel shows
live whether the on-device model is ready on your device, and a routing
mode picker lets you choose on-device first, on-device only, cloud first,
or cloud only.

## How I used Firebase AI Logic hybrid inference

PocketMind is built on the Firebase AI Logic JavaScript SDK hybrid API:

- The model is created with `getGenerativeModel(ai, { mode })` using
  `InferenceMode.PREFER_ON_DEVICE` by default, so the SDK tries Gemini Nano
  on the device first and falls back to the cloud Gemini model by itself.
- `model.initializeDeviceModel()` runs on the first Ask, Summary or
  Flashcards click (the user gesture Chrome requires) and reports the
  on-device model download progress in the UI.
- Every response reads `result.response.inferenceSource`, which reports
  `ON_DEVICE` or `IN_CLOUD`. That value drives the badge on each answer, so
  the app always shows the path that really ran, never a guess.
- The routing mode picker maps one-to-one to the four SDK inference modes,
  so a judge can force on-device only (nothing leaves the device) or cloud
  only and watch the badges change.
- Long notes (over about 6,000 characters) are routed cloud-first on
  purpose because the on-device context window is small, and the app
  explains why. This is the kind of per-request routing hybrid inference
  is made for.
- `LanguageModel.availability()` from the Chrome Prompt API powers the live
  on-device status in the header.
- Firebase App Check is initialized with the app (debug provider for local
  development, reCAPTCHA v3 supported for production), as AI Logic requires.

On-device inference supports single-turn text generation, so each PocketMind
request is a single prompt containing the note text. Notes themselves live
in localStorage on the device; only the prompts the user sends go to the
model they routed to.

## Features

- Notes library with search, saved on the device, 3 sample notes included
- Ask: questions answered from the selected note, badged by inference path
- Summary: one-tap revision summary
- Flashcards: generated flip cards
- Hybrid status panel: on-device availability, online state, download
  progress, routing mode picker
- Clear fallback messages when a chosen mode cannot run

## Value proposition

Students revise from messy lecture notes on phones and shared laptops, often
with poor or expensive data. PocketMind answers from their own notes, keeps
those notes on the device, and runs the AI on the device whenever Chrome
can, so revision keeps working offline and costs nothing. When the device
cannot run the model, or the note is long, the cloud model answers instead,
with the same interface. The badge on every answer makes the hybrid
behaviour visible and trustworthy: you always know where your notes went.

## Built with

React, Vite, Tailwind CSS (shadcn-style components built by hand), Lucide
icons, Manrope and IBM Plex Mono, Firebase AI Logic (firebase/ai) hybrid
inference with Gemini Nano on-device and Gemini in the cloud, Firebase
App Check.

## Disclosure

PocketMind was built new during the #BuildHybridAI 2026 contest period. I
used an AI coding assistant to help write and test the code. The idea,
design and final product are mine. No pre-existing project code was reused;
the app was written from scratch for this contest. The repo ships with an
empty Firebase config placeholder (no keys committed), so it runs in a
clearly labelled demo mode until a Firebase project is connected; the
README has the full setup steps, and the demo video shows the real hybrid
badges with a connected project.
