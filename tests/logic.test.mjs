import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MODES,
  ON_DEVICE_MAX_CHARS,
  badgeForSource,
  buildAskPrompt,
  buildFlashcardPrompt,
  buildSummaryPrompt,
  demoAnswer,
  emptyNote,
  noteStats,
  parseFlashcards,
  routeDecision,
  searchNotes,
  sortNotes,
} from '../src/lib/hybrid.js'

const note = {
  id: 'n1',
  title: 'Photosynthesis',
  body: 'Plants make glucose from sunlight. Chlorophyll traps light. Oxygen is released.',
  createdAt: 1,
  updatedAt: 1,
}

test('noteStats counts words and chars', () => {
  assert.deepEqual(noteStats(note), { chars: note.body.length, words: 11 })
  assert.deepEqual(noteStats({ body: '' }), { chars: 0, words: 0 })
})

test('emptyNote has the expected shape', () => {
  const n = emptyNote(1234)
  assert.equal(n.title, 'Untitled note')
  assert.equal(n.body, '')
  assert.equal(n.createdAt, 1234)
  assert.ok(n.id.length > 2)
})

test('sortNotes puts newest first without mutating input', () => {
  const a = { id: 'a', updatedAt: 1 }
  const b = { id: 'b', updatedAt: 5 }
  const input = [a, b]
  assert.deepEqual(sortNotes(input).map((n) => n.id), ['b', 'a'])
  assert.deepEqual(input.map((n) => n.id), ['a', 'b'])
})

test('searchNotes matches title and body, empty query returns all', () => {
  const notes = [note, { id: 'n2', title: 'Circuits', body: 'Voltage equals current times resistance.' }]
  assert.equal(searchNotes(notes, '').length, 2)
  assert.deepEqual(searchNotes(notes, 'glucose').map((n) => n.id), ['n1'])
  assert.deepEqual(searchNotes(notes, 'VOLTAGE').map((n) => n.id), ['n2'])
  assert.equal(searchNotes(notes, 'zzz').length, 0)
})

test('routeDecision: prefer on-device stays for short notes', () => {
  const d = routeDecision({ mode: MODES.PREFER_ON_DEVICE, noteChars: 500, online: true, deviceStatus: 'available' })
  assert.equal(d.mode, MODES.PREFER_ON_DEVICE)
  assert.equal(d.blocked, false)
})

test('routeDecision: long notes go cloud-first with a reason', () => {
  const d = routeDecision({
    mode: MODES.PREFER_ON_DEVICE,
    noteChars: ON_DEVICE_MAX_CHARS + 1000,
    online: true,
    deviceStatus: 'available',
  })
  assert.equal(d.mode, MODES.PREFER_IN_CLOUD)
  assert.match(d.reason, /on-device window/)
})

test('routeDecision: only-on-device blocks when the device model is unavailable', () => {
  const d = routeDecision({ mode: MODES.ONLY_ON_DEVICE, noteChars: 10, online: true, deviceStatus: 'unavailable' })
  assert.equal(d.blocked, true)
  assert.match(d.blockedReason, /not available/)
  const ok = routeDecision({ mode: MODES.ONLY_ON_DEVICE, noteChars: 10, online: false, deviceStatus: 'available' })
  assert.equal(ok.blocked, false)
})

test('routeDecision: only-in-cloud blocks while offline', () => {
  const d = routeDecision({ mode: MODES.ONLY_IN_CLOUD, noteChars: 10, online: false, deviceStatus: 'available' })
  assert.equal(d.blocked, true)
  const ok = routeDecision({ mode: MODES.ONLY_IN_CLOUD, noteChars: 10, online: true, deviceStatus: 'unavailable' })
  assert.equal(ok.blocked, false)
})

test('badgeForSource maps SDK values, case-insensitive, never guesses', () => {
  assert.equal(badgeForSource('ON_DEVICE').label, 'On-device')
  assert.equal(badgeForSource('on_device').kind, 'device')
  assert.equal(badgeForSource('IN_CLOUD').label, 'Cloud')
  assert.equal(badgeForSource('in_cloud').kind, 'cloud')
  assert.equal(badgeForSource('demo').kind, 'demo')
  assert.equal(badgeForSource('').kind, 'unknown')
  assert.equal(badgeForSource(undefined).kind, 'unknown')
  assert.equal(badgeForSource('something-else').kind, 'unknown')
})

test('prompt builders include the note and the task', () => {
  const ask = buildAskPrompt(note, 'What traps light?')
  assert.match(ask, /Photosynthesis/)
  assert.match(ask, /What traps light\?/)
  assert.match(ask, /using only the note/)
  const sum = buildSummaryPrompt(note)
  assert.match(sum, /Summarize/)
  assert.match(sum, /Chlorophyll traps light/)
  const fc = buildFlashcardPrompt(note, 6)
  assert.match(fc, /6 flashcards/)
  assert.match(fc, /Q: question \| A: answer/)
})

test('parseFlashcards reads clean lines and skips junk', () => {
  const text = [
    'Here are your cards:',
    'Q: What traps light? | A: Chlorophyll',
    '- Q: What is released? | A: Oxygen',
    '2. Q: What is made? | A: Glucose',
    'random closing line',
    'Q: missing answer |',
  ].join('\n')
  const cards = parseFlashcards(text)
  assert.equal(cards.length, 3)
  assert.deepEqual(cards[0], { q: 'What traps light?', a: 'Chlorophyll' })
  assert.deepEqual(cards[2], { q: 'What is made?', a: 'Glucose' })
  assert.equal(parseFlashcards('').length, 0)
  assert.equal(parseFlashcards(null).length, 0)
})

test('demoAnswer stays honest and grounded in the note', () => {
  const sum = demoAnswer(note, 'summary')
  assert.match(sum, /Demo summary/)
  assert.match(sum, /glucose/)
  const ask = demoAnswer(note, 'ask', 'What traps light?')
  assert.match(ask, /Chlorophyll/)
  const miss = demoAnswer(note, 'ask', 'Who won the football match?')
  assert.match(miss, /Demo mode could not find/)
  const cards = parseFlashcards(demoAnswer(note, 'flashcards'))
  assert.ok(cards.length >= 2)
})
