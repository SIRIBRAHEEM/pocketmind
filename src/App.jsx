import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BrainCircuit,
  Cloud,
  Cpu,
  Download,
  FileText,
  Layers,
  MessageCircleQuestion,
  NotebookPen,
  Plus,
  RotateCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Badge, Button, Card, Input, Label, Textarea } from './components/ui.jsx'
import {
  MODES,
  MODE_LABELS,
  SETTINGS_KEY,
  STORAGE_KEY,
  badgeForSource,
  buildAskPrompt,
  buildFlashcardPrompt,
  buildSummaryPrompt,
  emptyNote,
  noteStats,
  parseFlashcards,
  searchNotes,
  sortNotes,
} from './lib/hybrid.js'
import { checkDeviceStatus, initDeviceModel, isConfigured, runHybrid } from './lib/ai.js'

const SAMPLE_NOTES = [
  {
    id: 'sample-photosynthesis',
    title: 'Photosynthesis (Biology)',
    body: 'Photosynthesis is how green plants make food. Chlorophyll in the leaves traps sunlight. The plant takes in carbon dioxide from the air and water from the soil. Using sunlight energy, it makes glucose and releases oxygen. The equation is 6CO2 + 6H2O -> C6H12O6 + 6O2. Light intensity, carbon dioxide concentration and temperature affect the rate. When one factor is in short supply, it becomes the limiting factor and the rate stops rising.',
    createdAt: 1,
    updatedAt: 3,
  },
  {
    id: 'sample-ohms-law',
    title: "Ohm's Law (Physics)",
    body: "Ohm's law says voltage equals current times resistance: V = IR. Voltage is measured in volts, current in amperes, resistance in ohms. In a series circuit, current is the same everywhere and resistances add up. In a parallel circuit, voltage is the same across each branch and the total current splits. Power is P = VI, and energy used is power times time. A fuse melts and breaks the circuit when current gets too high, which protects the wiring.",
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: 'sample-ww2-causes',
    title: 'Causes of World War II (History)',
    body: 'The Treaty of Versailles (1919) punished Germany with heavy reparations, loss of land and a small army, which caused deep resentment. The Great Depression after 1929 spread unemployment and poverty, and people turned to extreme parties. Hitler and the Nazi Party promised jobs and national pride and took power in 1933. Britain and France followed appeasement, allowing Germany to take Austria and part of Czechoslovakia. Germany invaded Poland on 1 September 1939, and Britain and France declared war two days later.',
    createdAt: 3,
    updatedAt: 1,
  },
]

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fall through to samples
  }
  return SAMPLE_NOTES
}

function loadMode() {
  try {
    return localStorage.getItem(SETTINGS_KEY) || MODES.PREFER_ON_DEVICE
  } catch {
    return MODES.PREFER_ON_DEVICE
  }
}

function SourceBadge({ source }) {
  const b = badgeForSource(source)
  if (b.kind === 'device')
    return (
      <Badge className="bg-chip-500/15 text-chip-300 border border-chip-500/50">
        <Cpu size={12} /> {b.label}
      </Badge>
    )
  if (b.kind === 'cloud')
    return (
      <Badge className="bg-cloud-500/15 text-cloud-300 border border-cloud-500/50">
        <Cloud size={12} /> {b.label}
      </Badge>
    )
  if (b.kind === 'demo')
    return (
      <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/50">
        <Sparkles size={12} /> {b.label}
      </Badge>
    )
  return <Badge className="bg-ink-700 text-mist-300 border border-ink-600">{b.label}</Badge>
}

const DEVICE_TEXT = {
  available: 'Gemini Nano is ready on this device',
  downloadable: 'Gemini Nano can be downloaded on this device',
  downloading: 'Gemini Nano is downloading',
  unavailable: 'No on-device model in this browser',
  unknown: 'On-device status unknown',
}

export default function App() {
  const [notes, setNotes] = useState(loadNotes)
  const [activeId, setActiveId] = useState(() => loadNotes()[0]?.id || '')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState(loadMode)
  const [deviceStatus, setDeviceStatus] = useState('unknown')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [downloadPct, setDownloadPct] = useState(null)
  const [tab, setTab] = useState('ask')
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState([])
  const [summary, setSummary] = useState(null)
  const [cards, setCards] = useState([])
  const [cardSource, setCardSource] = useState('')
  const [flipped, setFlipped] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const chatEndRef = useRef(null)

  const active = notes.find((n) => n.id === activeId) || notes[0]
  const visibleNotes = useMemo(() => searchNotes(sortNotes(notes), query), [notes, query])
  const stats = active ? noteStats(active) : { chars: 0, words: 0 }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    } catch {
      // storage full or blocked; notes still work for this session
    }
  }, [notes])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, mode)
    } catch {
      // ignore
    }
  }, [mode])

  useEffect(() => {
    checkDeviceStatus().then(setDeviceStatus)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  function updateActive(patch) {
    setNotes((prev) =>
      prev.map((n) => (n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    )
  }

  function addNote() {
    const note = emptyNote()
    setNotes((prev) => [note, ...prev])
    setActiveId(note.id)
    setChat([])
    setSummary(null)
    setCards([])
  }

  function deleteNote(id) {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      if (id === activeId && next[0]) setActiveId(next[0].id)
      return next
    })
  }

  async function run(kind, prompt, q = '') {
    if (!active) return null
    initDeviceModel((pct) => setDownloadPct(pct < 100 ? pct : null))
    setBusy(kind)
    setError('')
    try {
      const out = await runHybrid({
        mode,
        prompt,
        note: active,
        kind,
        question: q,
        deviceStatus,
        online,
      })
      setDownloadPct(null)
      return out
    } catch (err) {
      setError(
        err?.message ||
          'The AI request failed. Check your connection, or switch the routing mode and try again.',
      )
      return null
    } finally {
      setBusy('')
    }
  }

  async function ask(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q || busy) return
    setQuestion('')
    setChat((prev) => [...prev, { role: 'user', text: q }])
    const out = await run('ask', buildAskPrompt(active, q), q)
    if (out) setChat((prev) => [...prev, { role: 'ai', text: out.text, source: out.source }])
  }

  async function summarize() {
    if (busy) return
    const out = await run('summary', buildSummaryPrompt(active))
    if (out) setSummary(out)
  }

  async function makeCards() {
    if (busy) return
    const out = await run('flashcards', buildFlashcardPrompt(active))
    if (out) {
      const parsed = parseFlashcards(out.text)
      setCards(parsed)
      setCardSource(out.source)
      setFlipped({})
      if (parsed.length === 0) setError('The model did not return cards in the expected format. Try again.')
    }
  }

  const deviceReady = deviceStatus === 'available' || deviceStatus === 'downloadable'

  return (
    <div className="circuit-bg min-h-screen">
      <header className="border-b border-ink-600/60 bg-ink-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-chip-500/60 bg-ink-850 p-2 text-chip-400 shadow-glow">
              <BrainCircuit size={26} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">PocketMind</h1>
              <p className="font-mono text-[11px] uppercase tracking-widest text-mist-400">
                Hybrid AI notebook
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge
              className={
                deviceReady
                  ? 'bg-chip-500/15 text-chip-300 border border-chip-500/50'
                  : 'bg-ink-800 text-mist-400 border border-ink-600'
              }
            >
              <span className={`h-2 w-2 rounded-full ${deviceReady ? 'bg-chip-400 pulse-dot' : 'bg-mist-500'}`} />
              <Cpu size={12} /> {DEVICE_TEXT[deviceStatus] || DEVICE_TEXT.unknown}
            </Badge>
            <Badge className="bg-ink-800 text-mist-300 border border-ink-600">
              {online ? <Wifi size={12} /> : <WifiOff size={12} />} {online ? 'Online' : 'Offline'}
            </Badge>
            {!isConfigured && (
              <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/50">
                <TriangleAlert size={12} /> Demo mode
              </Badge>
            )}
          </div>
        </div>
        <div className="chip-pins mx-auto max-w-6xl opacity-40" />
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[300px_1fr]">
        {/* Notes library */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes"
                className="pl-9"
              />
            </div>
            <Button onClick={addNote} className="shrink-0">
              <Plus size={16} /> New
            </Button>
          </div>
          <div className="space-y-2">
            {visibleNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setActiveId(n.id)
                  setChat([])
                  setSummary(null)
                  setCards([])
                  setError('')
                }}
                className={`w-full rounded-2xl border p-3.5 text-left transition ${
                  n.id === active?.id
                    ? 'border-chip-500/70 bg-ink-800 shadow-glow'
                    : 'border-ink-600/70 bg-ink-850 hover:border-chip-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-snug">{n.title}</p>
                  <FileText size={15} className="mt-0.5 shrink-0 text-mist-500" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mist-400">{n.body}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-mist-500">
                  {noteStats(n).words} words
                </p>
              </button>
            ))}
            {visibleNotes.length === 0 && (
              <Card className="p-4 text-sm text-mist-400">No notes match that search.</Card>
            )}
          </div>

          {/* Hybrid status panel */}
          <Card className="p-4">
            <Label>Hybrid status</Label>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-mist-300">
                  <Cpu size={15} className="text-chip-400" /> On-device (Gemini Nano)
                </span>
                <span className="font-mono text-xs text-chip-300">
                  {deviceStatus === 'available'
                    ? 'Ready'
                    : deviceStatus === 'downloadable'
                      ? 'Can download'
                      : deviceStatus === 'downloading'
                        ? 'Downloading'
                        : deviceStatus === 'unavailable'
                          ? 'Not here'
                          : 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-mist-300">
                  <Cloud size={15} className="text-cloud-400" /> Cloud (Gemini)
                </span>
                <span className="font-mono text-xs text-cloud-300">
                  {!isConfigured ? 'Demo mode' : online ? 'Reachable' : 'Offline'}
                </span>
              </div>
              {downloadPct !== null && (
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs text-mist-400">
                    <Download size={13} /> Downloading on-device model: {downloadPct}%
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full bg-chip-400 transition-all" style={{ width: `${downloadPct}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Label htmlFor="mode">Routing mode</Label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2.5 text-sm font-semibold text-mist-100 focus:border-chip-500 focus:outline-none"
              >
                {Object.entries(MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-mist-400">
                Firebase AI Logic checks the device first in On-device first mode, then falls back
                to the cloud by itself. Long notes go cloud first, because the on-device window is
                small. Every answer is badged with the path that really ran.
              </p>
            </div>
          </Card>

          {!isConfigured && (
            <Card className="border-amber-500/40 p-4">
              <p className="flex items-center gap-2 font-bold text-amber-300">
                <TriangleAlert size={16} /> Demo mode is on
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-mist-300">
                No Firebase config yet, so answers come from a simple local fallback and are
                labelled Demo mode. To turn on real hybrid AI, follow the setup steps in the
                README: create a free Firebase project, enable AI Logic, and paste your web
                config into src/firebase-config.js.
              </p>
            </Card>
          )}
        </section>

        {/* Note + AI panel */}
        <section className="space-y-5">
          {active && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={active.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  className="max-w-md border-transparent bg-transparent px-1 text-lg font-extrabold focus:border-chip-500"
                  aria-label="Note title"
                />
                <span className="ml-auto font-mono text-xs text-mist-500">
                  {stats.words} words · {stats.chars} chars
                </span>
                <Button variant="danger" onClick={() => deleteNote(active.id)} className="px-3 py-2">
                  <Trash2 size={15} />
                </Button>
              </div>
              <Textarea
                value={active.body}
                onChange={(e) => updateActive({ body: e.target.value })}
                rows={7}
                placeholder="Paste or write your lecture notes here. PocketMind answers from this note only."
                className="mt-3"
              />
              <p className="mt-2 font-mono text-[11px] text-mist-500">
                Notes are saved on this device only (localStorage). Nothing is uploaded by PocketMind
                itself; only the prompts you send go to the model you routed to.
              </p>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {[
              ['ask', MessageCircleQuestion, 'Ask'],
              ['summary', NotebookPen, 'Summary'],
              ['cards', Layers, 'Flashcards'],
            ].map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                  tab === id
                    ? 'bg-chip-500 text-ink-950'
                    : 'border border-ink-600 bg-ink-850 text-mist-300 hover:border-chip-500/50'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {error && (
            <Card className="border-red-500/50 p-4 text-sm text-red-200">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert size={16} /> Something stopped that request
              </p>
              <p className="mt-1 leading-relaxed">{error}</p>
            </Card>
          )}

          {tab === 'ask' && (
            <Card className="p-5">
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {chat.length === 0 && (
                  <p className="text-sm leading-relaxed text-mist-400">
                    Ask anything about the selected note. Try: "What is the limiting factor?" or
                    "Give me the equation and explain each part." Each answer shows whether Gemini
                    Nano on this device or the cloud model produced it.
                  </p>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-chip-500/90 font-semibold text-ink-950'
                          : 'border border-ink-600 bg-ink-900 text-mist-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.role === 'ai' && (
                        <div className="mt-2">
                          <SourceBadge source={m.source} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {busy === 'ask' && (
                  <p className="font-mono text-xs text-mist-400">Thinking, routing by {MODE_LABELS[mode]}…</p>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={ask} className="mt-4 flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about this note"
                  disabled={busy !== ''}
                />
                <Button type="submit" disabled={busy !== '' || !question.trim()} className="shrink-0">
                  <Send size={15} /> Ask
                </Button>
              </form>
            </Card>
          )}

          {tab === 'summary' && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-mist-300">
                  One tap turns the selected note into a short revision summary.
                </p>
                <Button onClick={summarize} disabled={busy !== ''} className="ml-auto">
                  <NotebookPen size={15} /> {busy === 'summary' ? 'Summarizing…' : 'Summarize note'}
                </Button>
              </div>
              {summary && (
                <div className="mt-4 rounded-2xl border border-ink-600 bg-ink-900 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <SourceBadge source={summary.source} />
                    <span className="text-xs text-mist-500">{summary.reason}</span>
                  </div>
                </div>
              )}
            </Card>
          )}

          {tab === 'cards' && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-mist-300">
                  Generate flashcards from the selected note. Tap a card to flip it.
                </p>
                <Button onClick={makeCards} disabled={busy !== ''} className="ml-auto">
                  <Layers size={15} /> {busy === 'flashcards' ? 'Making cards…' : 'Make flashcards'}
                </Button>
              </div>
              {cards.length > 0 && (
                <>
                  <div className="mt-3">
                    <SourceBadge source={cardSource} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {cards.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setFlipped((prev) => ({ ...prev, [i]: !prev[i] }))}
                        className={`flashcard h-40 text-left ${flipped[i] ? 'flipped' : ''}`}
                      >
                        <div className="flashcard-inner relative h-full w-full">
                          <div className="flashcard-face absolute inset-0 rounded-2xl border border-chip-500/50 bg-ink-800 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-chip-300">
                              Question {i + 1}
                            </p>
                            <p className="mt-2 text-sm font-bold leading-relaxed">{c.q}</p>
                            <p className="absolute bottom-3 right-4 flex items-center gap-1 font-mono text-[10px] text-mist-500">
                              <RotateCw size={11} /> tap to flip
                            </p>
                          </div>
                          <div className="flashcard-face flashcard-back absolute inset-0 rounded-2xl border border-cloud-500/50 bg-ink-900 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-cloud-300">Answer</p>
                            <p className="mt-2 text-sm leading-relaxed">{c.a}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          <p className="pb-4 text-center font-mono text-[11px] text-mist-500">
            Built with Firebase AI Logic hybrid inference. On-device answers stay on this device;
            cloud answers go to Gemini through Firebase.
          </p>
        </section>
      </main>
    </div>
  )
}
