# PocketMind

PocketMind is a personal AI notebook for students. You paste or write your
lecture notes, then ask questions about them, get a one-tap summary, and
generate flashcards. Every AI answer carries a badge showing which model
produced it: **On-device** when Gemini Nano answered locally in Chrome
(private, free, works offline) or **Cloud** when Firebase AI Logic routed
the request to the cloud Gemini model.

Built for #BuildHybridAI 2026 (Firebase Hybrid AI Hackathon), Web platform.

## How the hybrid inference works

PocketMind uses the Firebase AI Logic JavaScript SDK (`firebase/ai`):

- `getAI(app, { backend: new GoogleAIBackend() })` creates the service.
- `getGenerativeModel(ai, { mode })` creates the model with one of the four
  `InferenceMode` values: `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`,
  `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD`. The routing mode picker in the app
  maps directly to these.
- `model.initializeDeviceModel(progress)` runs on the first Ask, Summary or
  Flashcards click, which is the user gesture Chrome requires before the
  on-device model can download.
- `model.generateContent(prompt)` sends the request. The SDK itself checks
  whether Gemini Nano is available on the device and falls back to the
  cloud model when it is not (or the other way round in cloud-first mode).
- `result.response.inferenceSource` tells the app which path actually ran
  (`ON_DEVICE` or `IN_CLOUD`). That value drives the badge on every answer,
  so the UI never guesses.
- Long notes (over about 6,000 characters) are routed cloud-first on
  purpose, because the on-device context window is small. The app says why
  in the Hybrid status panel.
- `LanguageModel.availability()` (the Chrome Prompt API) powers the live
  on-device status in the header.
- Firebase App Check is initialized with the app. AI Logic enforces App
  Check, which protects the cloud Gemini quota. Locally, PocketMind uses
  the App Check debug provider; in production you can add a reCAPTCHA v3
  site key in the config file.

On-device inference supports single-turn text generation, so every PocketMind
request is a single prompt that includes the note text. There is no
multi-turn chat session sent to the on-device model.

## Features

- Notes library with search, saved on the device (localStorage), 3 sample
  notes included.
- Ask: question and answer over the selected note, with a source badge on
  every answer.
- Summary: one-tap revision summary of the selected note.
- Flashcards: generated cards with a tap-to-flip view.
- Hybrid status panel: live on-device availability, online state, model
  download progress, and the routing mode picker.
- Graceful fallbacks: clear messages when a chosen mode cannot run (for
  example on-device only in a browser without the model, or cloud only
  while offline).

## Demo mode (honest note)

If no Firebase config is filled in, PocketMind still runs so anyone can try
the interface. Answers then come from a small local extractive fallback and
are labelled **Demo mode** in the UI. The screenshots in `docs/` were taken
in demo mode, because this build environment has no Firebase project
attached. With a config filled in (steps below), the same screens run real
hybrid inference and the badges read On-device or Cloud.

## Setup: connect your own free Firebase project

1. Go to the Firebase console (console.firebase.google.com) and create a
   new project. You do not need Google Analytics.
2. In the console, open **AI Services > AI Logic** and click **Get started**.
   Choose the **Gemini Developer API** when asked (free to start). The
   guided workflow enables the APIs and enforces App Check for AI Logic.
3. Register a **Web app** in the project (Project settings > Your apps) and
   copy the `firebaseConfig` values it shows.
4. In this repo, copy `src/firebase-config.example.js` to
   `src/firebase-config.js` and paste your values in.
5. Run `npm install`, then `npm run dev`, and open the local URL.
6. App Check debug token: open the browser console. You will see a line
   like `AppCheck debug token: "..."`. In the Firebase console go to
   **Security > App Check > Apps**, open your web app's overflow menu,
   choose **Manage debug tokens**, and register that token. Reload the app.
7. For the on-device path you need Chrome on desktop, version 139 or
   higher. Enable the flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`,
   restart Chrome, and the first AI request will download Gemini Nano in
   the background (progress shows in the Hybrid status panel).
8. For production, create a reCAPTCHA v3 site key, register it in App Check
   for your web app, and put the site key in `recaptchaSiteKey` in the
   config file.

No API keys or secrets are committed in this repo. The committed
`src/firebase-config.js` is an empty placeholder so the app builds and runs
in demo mode out of the box.

## Run locally

```
npm install
npm run dev
```

Other scripts: `npm run build` (production build, base './'), `npm test`
(unit tests for the routing, badge and parsing logic), `npm run lint`,
`node scripts/e2e.mjs` (end-to-end checks plus the docs screenshots, run
after a build).

## Built with

React, Vite, Tailwind CSS with hand-built shadcn-style components, Lucide
icons, Manrope and IBM Plex Mono (self-hosted), Firebase AI Logic
(`firebase/ai`) with hybrid inference, Firebase App Check.

## License

Apache-2.0. See LICENSE.
