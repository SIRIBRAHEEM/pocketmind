// PocketMind core logic: note store helpers, hybrid routing decisions,
// badge mapping and flashcard parsing. Everything here is pure and testable
// without Firebase, a browser or a network connection.

export const STORAGE_KEY = 'pocketmind-notes-v1'
export const SETTINGS_KEY = 'pocketmind-settings-v1'

export const MODES = {
  PREFER_ON_DEVICE: 'prefer_on_device',
  ONLY_ON_DEVICE: 'only_on_device',
  PREFER_IN_CLOUD: 'prefer_in_cloud',
  ONLY_IN_CLOUD: 'only_in_cloud',
}

export const MODE_LABELS = {
  prefer_on_device: 'On-device first',
  only_on_device: 'On-device only',
  prefer_in_cloud: 'Cloud first',
  only_in_cloud: 'Cloud only',
}

// On-device Gemini Nano has a small context window. Notes longer than this
// are routed to the cloud model on purpose, and the UI says why.
export const ON_DEVICE_MAX_CHARS = 6000

export function makeId(now = Date.now(), rand = Math.random()) {
  return `n${now.toString(36)}${Math.floor(rand * 1e6).toString(36)}`
}

export function emptyNote(now = Date.now()) {
  return {
    id: makeId(now),
    title: 'Untitled note',
    body: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function sortNotes(notes) {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function searchNotes(notes, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return notes
  return notes.filter(
    (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
  )
}

export function noteStats(note) {
  const body = note?.body || ''
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  return { chars: body.length, words }
}

// Decide which inference mode to hand to Firebase AI Logic for one request.
// This mirrors the SDK modes: the SDK itself does the availability check and
// the fallback, PocketMind only picks the mode and explains the choice.
export function routeDecision({ mode, noteChars, online, deviceStatus }) {
  const longNote = noteChars > ON_DEVICE_MAX_CHARS
  if (mode === MODES.ONLY_ON_DEVICE) {
    return {
      mode,
      reason: 'On-device only is switched on. Nothing leaves this device.',
      blocked: deviceStatus === 'unavailable',
      blockedReason:
        deviceStatus === 'unavailable'
          ? 'On-device AI is not available in this browser, and on-device only is on. Switch to On-device first to allow cloud fallback.'
          : '',
    }
  }
  if (mode === MODES.ONLY_IN_CLOUD) {
    return {
      mode,
      reason: 'Cloud only is switched on.',
      blocked: online === false,
      blockedReason: online === false ? 'You are offline, and cloud only is on.' : '',
    }
  }
  if (longNote && mode === MODES.PREFER_ON_DEVICE) {
    return {
      mode: MODES.PREFER_IN_CLOUD,
      reason: `This note is ${Math.round(noteChars / 1000)}k characters, over the on-device window, so PocketMind asks the cloud first and falls back to the device when offline.`,
      blocked: false,
      blockedReason: '',
    }
  }
  if (mode === MODES.PREFER_IN_CLOUD) {
    return {
      mode,
      reason: 'Cloud first. If the cloud is unreachable, the on-device model answers.',
      blocked: false,
      blockedReason: '',
    }
  }
  return {
    mode: MODES.PREFER_ON_DEVICE,
    reason: 'On-device first. Gemini Nano answers locally when available, otherwise the cloud model steps in.',
    blocked: false,
    blockedReason: '',
  }
}

// Map whatever the SDK reports to the badge the UI shows. The web docs say
// the value is ON_DEVICE or IN_CLOUD; some SDK builds use lowercase. Accept
// both, and never guess: unknown stays unknown.
export function badgeForSource(source) {
  const s = String(source || '').toLowerCase()
  if (s === 'on_device') return { kind: 'device', label: 'On-device' }
  if (s === 'in_cloud') return { kind: 'cloud', label: 'Cloud' }
  if (s === 'demo') return { kind: 'demo', label: 'Demo mode' }
  return { kind: 'unknown', label: 'Unknown path' }
}

export function buildAskPrompt(note, question) {
  return [
    'You are PocketMind, a study helper. Answer the question using only the note below.',
    'If the note does not contain the answer, say so plainly. Keep the answer short and clear.',
    '',
    `Note title: ${note.title}`,
    '---',
    note.body,
    '---',
    `Question: ${question}`,
  ].join('\n')
}

export function buildSummaryPrompt(note) {
  return [
    'Summarize the note below for a student revising before an exam.',
    'Give a short overview sentence, then the key points as a plain list.',
    '',
    `Note title: ${note.title}`,
    '---',
    note.body,
  ].join('\n')
}

export function buildFlashcardPrompt(note, count = 6) {
  return [
    `Make ${count} flashcards from the note below.`,
    'Reply with one card per line in exactly this format: Q: question | A: answer',
    'No extra text before or after the cards.',
    '',
    `Note title: ${note.title}`,
    '---',
    note.body,
  ].join('\n')
}

// Parse "Q: ... | A: ..." lines. Lines that do not match are skipped so a
// chatty model cannot break the flashcard view.
export function parseFlashcards(text) {
  const cards = []
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim().replace(/^[-*\d.)\s]+/, '')
    const m = line.match(/^Q:\s*(.+?)\s*\|\s*A:\s*(.+)$/i)
    if (m) cards.push({ q: m[1].trim(), a: m[2].trim() })
  }
  return cards
}

// A small extractive fallback used only in demo mode (no Firebase config).
// It never pretends to be a model answer; the UI labels it Demo mode.
export function demoAnswer(note, kind, question = '') {
  const sentences = (note.body || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (kind === 'summary') {
    const top = sentences.slice(0, 3)
    return top.length
      ? `Demo summary of "${note.title}": ${top.join(' ')}`
      : 'This note is empty, so there is nothing to summarize yet.'
  }
  if (kind === 'flashcards') {
    return sentences
      .slice(0, 4)
      .map((s, i) => `Q: What does point ${i + 1} in "${note.title}" say? | A: ${s}`)
      .join('\n')
  }
  const q = question.toLowerCase()
  const hit = sentences.find((s) =>
    q.split(/\s+/).some((w) => w.length > 3 && s.toLowerCase().includes(w)),
  )
  return hit
    ? `From your note: ${hit}`
    : 'Demo mode could not find that in the note. Connect Firebase AI Logic for real answers.'
}
