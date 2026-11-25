// Firebase AI Logic wiring for PocketMind.
//
// Hybrid inference in one place: getGenerativeModel with an InferenceMode.
// The SDK checks on-device availability (Chrome Prompt API, Gemini Nano)
// and falls back to the cloud Gemini model by itself. Every response
// carries inferenceSource, which is what the On-device / Cloud badge reads.
//
// If no Firebase config is filled in, nothing here throws: the app runs in
// demo mode with local extractive answers, clearly labelled as such.

import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai'
import { firebaseConfig, recaptchaSiteKey, cloudModel } from '../firebase-config.js'
import { MODES, demoAnswer, routeDecision } from './hybrid.js'

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app = null
let ai = null
const models = new Map()
let deviceInitDone = false

function ensureFirebase() {
  if (app) return true
  if (!isConfigured) return false
  app = initializeApp(firebaseConfig)
  // App Check: reCAPTCHA v3 when a site key is provided, otherwise the
  // debug provider for local development (register the printed token in
  // the Firebase console under Security > App Check > Apps).
  if (recaptchaSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } else {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
    initializeAppCheck(app, { isTokenAutoRefreshEnabled: true })
  }
  ai = getAI(app, { backend: new GoogleAIBackend() })
  return true
}

const SDK_MODES = {
  [MODES.PREFER_ON_DEVICE]: InferenceMode.PREFER_ON_DEVICE,
  [MODES.ONLY_ON_DEVICE]: InferenceMode.ONLY_ON_DEVICE,
  [MODES.PREFER_IN_CLOUD]: InferenceMode.PREFER_IN_CLOUD,
  [MODES.ONLY_IN_CLOUD]: InferenceMode.ONLY_IN_CLOUD,
}

function getModel(mode) {
  if (!models.has(mode)) {
    const params = { mode: SDK_MODES[mode] }
    if (cloudModel) params.inCloudParams = { model: cloudModel }
    models.set(mode, getGenerativeModel(ai, params))
  }
  return models.get(mode)
}

// Ask Chrome's Prompt API whether the on-device model can run here.
// Returns: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown'
export async function checkDeviceStatus() {
  try {
    if (typeof LanguageModel === 'undefined') return 'unavailable'
    const status = await LanguageModel.availability()
    return status || 'unknown'
  } catch {
    return 'unknown'
  }
}

// initializeDeviceModel must run on a user gesture before the first query.
// PocketMind calls this from the first Ask / Summarize / Flashcards click.
export function initDeviceModel(onProgress) {
  if (!ensureFirebase() || deviceInitDone) return
  deviceInitDone = true
  try {
    const model = getModel(MODES.PREFER_ON_DEVICE)
    model.initializeDeviceModel((val) => {
      if (onProgress) onProgress(Math.round(val * 100))
    })
  } catch {
    // On-device init failing is fine: PREFER modes fall back to the cloud.
  }
}

// One hybrid request. Returns { text, source } where source is the SDK's
// inferenceSource ('ON_DEVICE' or 'IN_CLOUD'), or 'demo' in demo mode.
export async function runHybrid({ mode, prompt, note, kind, question, deviceStatus, online }) {
  const decision = routeDecision({
    mode,
    noteChars: note.body.length,
    online,
    deviceStatus,
  })
  if (decision.blocked) {
    throw new Error(decision.blockedReason)
  }
  if (!ensureFirebase()) {
    return { text: demoAnswer(note, kind, question), source: 'demo', reason: decision.reason }
  }
  const model = getModel(decision.mode)
  const result = await model.generateContent(prompt)
  return {
    text: result.response.text(),
    source: result.response.inferenceSource || '',
    reason: decision.reason,
  }
}
