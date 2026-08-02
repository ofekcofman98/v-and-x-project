import { useState, useEffect, useRef } from 'react'

// ─── Waveform visualizer (animated bars) ─────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.8, 0.55, 0.9, 0.65, 1, 0.5, 0.75, 0.85, 0.45, 0.7, 0.95, 0.6]
  return (
    <div className="flex items-center gap-[3px] h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${h * 100}%`,
            borderRadius: 2,
            background: active ? '#13501B' : '#d1fae5',
            transformOrigin: 'center',
            animation: active
              ? `wave-bar ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.06}s infinite`
              : 'none',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Voice orb ───────────────────────────────────────────────────────────────
function VoiceOrb({ recording }: { recording: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-20 h-20 select-none">
      {recording && (
        <>
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: '#13501B', opacity: 0.15, animation: 'pulse-ring 1.4s ease-out infinite' }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: '#13501B', opacity: 0.1, animation: 'pulse-ring 1.4s ease-out 0.5s infinite' }}
          />
        </>
      )}
      <button
        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border-0"
        style={{
          background: recording ? '#13501B' : '#000',
          boxShadow: recording ? '0 0 0 3px rgba(19,80,27,0.3)' : '0 4px 24px rgba(0,0,0,0.18)',
          transform: recording ? 'scale(1.07)' : 'scale(1)',
        }}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        <MicIcon color="#fff" size={22} filled={recording} />
      </button>
    </div>
  )
}

// ─── Icon set ────────────────────────────────────────────────────────────────
function MicIcon({ color = '#000', size = 20, filled = false }: { color?: string; size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRight({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 4" stroke="#13501B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Live demo ticker ─────────────────────────────────────────────────────────
const DEMO_COMMANDS = [
  { voice: '"John Smith, 85"', action: 'Cell filled → Quiz 3, Row 1' },
  { voice: '"Sarah, 92"', action: 'Fuzzy matched → Sarah Johnson' },
  { voice: '"Add column: Homework 4"', action: 'Column created instantly' },
  { voice: '"Skip Mike, next"', action: 'Pointer advanced → Row 4' },
  { voice: '"SKU 4821, quantity 47"', action: 'Inventory logged' },
  { voice: '"Attendance: all present except Jake"', action: '29 cells filled, 1 flagged' },
  { voice: '"Column first mode"', action: 'Navigation mode switched' },
  { voice: '"Export to Excel"', action: 'Download triggered' },
]

function CommandTicker() {
  return (
    <div className="relative overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}>
      <div
        className="flex gap-3 whitespace-nowrap"
        style={{ animation: 'ticker 28s linear infinite' }}
      >
        {[...DEMO_COMMANDS, ...DEMO_COMMANDS].map((cmd, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full border shrink-0"
            style={{ borderColor: '#e5e7eb', background: '#fafafa' }}
          >
            <span
              className="text-xs font-medium"
              style={{ fontFamily: 'var(--font-mono)', color: '#13501B' }}
            >
              {cmd.voice}
            </span>
            <span className="w-px h-3 bg-gray-300" />
            <span className="text-xs text-gray-500">{cmd.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 no-underline">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#13501B' }}
          >
            <MicIcon color="#fff" size={14} />
          </div>
          <span
            className="text-[15px] font-bold tracking-tight text-black"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            VocalGrid
          </span>
        </a>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-8">
          {['Features', 'Use Cases', 'How it works', 'Pricing'].map((l) => (
            <a
              key={l}
              href="#"
              className="text-sm font-medium text-gray-600 hover:text-black transition-colors no-underline"
            >
              {l}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a href="#" className="hidden md:block text-sm font-medium text-gray-600 hover:text-black transition-colors no-underline">
            Sign in
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 no-underline"
            style={{ background: '#13501B', fontFamily: 'var(--font-display)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0d3b14' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#13501B' }}
          >
            Get started free
          </a>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [typed, setTyped] = useState('')
  const demoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const DEMO_TRANSCRIPT = 'John Smith, 85'
  const DEMO_RESULT = '→ Cell (John Smith, Quiz 3) filled with 85'

  const handleRecord = () => {
    if (recording) {
      setRecording(false)
      setTyped('')
      setTranscript('')
      if (demoRef.current) clearTimeout(demoRef.current)
      return
    }
    setRecording(true)
    setTranscript('')
    setTyped('')

    // Simulate typing transcript
    let i = 0
    const type = () => {
      i++
      setTyped(DEMO_TRANSCRIPT.slice(0, i))
      if (i < DEMO_TRANSCRIPT.length) demoRef.current = setTimeout(type, 70)
      else {
        demoRef.current = setTimeout(() => {
          setRecording(false)
          setTranscript(DEMO_RESULT)
          setTyped('')
        }, 600)
      }
    }
    demoRef.current = setTimeout(type, 800)
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 pb-24 px-6">
      {/* Subtle grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-xs font-medium border"
          style={{
            background: '#f2f8f2',
            borderColor: 'rgba(19,80,27,0.2)',
            color: '#13501B',
            fontFamily: 'var(--font-display)',
            animation: 'fade-up 0.5s ease both',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#13501B] inline-block" />
          Voice-first data entry — now in beta
        </div>

        {/* Headline */}
        <h1
          className="text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.0] text-black mb-6"
          style={{
            fontFamily: 'var(--font-display)',
            animation: 'fade-up 0.5s ease 0.1s both',
          }}
        >
          Say it.
          <br />
          <span style={{ color: '#13501B' }}>It's logged.</span>
        </h1>

        {/* Sub */}
        <p
          className="text-lg md:text-xl text-gray-500 max-w-xl leading-relaxed mb-10"
          style={{ animation: 'fade-up 0.5s ease 0.2s both' }}
        >
          VocalGrid turns your voice into precise spreadsheet entries — hands-free, eyes-free, in under 3 seconds. Built for teachers, supervisors, and anyone who works with data while doing something else.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row items-center gap-3 mb-16"
          style={{ animation: 'fade-up 0.5s ease 0.3s both' }}
        >
          <a
            href="#"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-bold text-white transition-all duration-200 no-underline"
            style={{ background: '#13501B', fontFamily: 'var(--font-display)', boxShadow: '0 2px 16px rgba(19,80,27,0.3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0d3b14'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#13501B'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >
            Start for free
            <ArrowRight size={15} color="#fff" />
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-black border border-gray-200 hover:border-gray-400 transition-all duration-200 no-underline bg-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Watch demo
            <span className="text-xs font-normal text-gray-400">2 min</span>
          </a>
        </div>

        {/* Interactive demo orb */}
        <div
          className="w-full max-w-lg"
          style={{ animation: 'fade-up 0.5s ease 0.4s both' }}
        >
          <div
            className="rounded-2xl border p-6 text-left"
            style={{ borderColor: '#e5e7eb', background: '#fafafa', boxShadow: '0 4px 40px rgba(0,0,0,0.06)' }}
          >
            {/* Table preview */}
            <div className="mb-5">
              <div
                className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Grade tracker — Period 3
              </div>
              <MiniTable activeRow={recording || !!transcript ? 0 : -1} filled={!!transcript} />
            </div>

            {/* Voice interface */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
              <VoiceOrb recording={recording} />
              <div className="flex-1 min-w-0">
                {!recording && !typed && !transcript && (
                  <p className="text-sm text-gray-400">Click the mic to try a demo →</p>
                )}
                {(recording || typed) && (
                  <div>
                    <div
                      className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      Listening...
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Waveform active={recording} />
                    </div>
                    {typed && (
                      <p
                        className="text-sm font-medium text-black"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        "{typed}
                        <span style={{ animation: 'blink 0.8s step-end infinite', borderRight: '2px solid #13501B', marginLeft: 1 }} />
                        "
                      </p>
                    )}
                  </div>
                )}
                {transcript && !recording && (
                  <div>
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: '#13501B', fontFamily: 'var(--font-mono)' }}
                    >
                      ✓ Logged in 1.8s
                    </div>
                    <p className="text-sm text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                      {transcript}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleRecord}
                className="shrink-0 cursor-pointer border-0 p-0 bg-transparent"
                aria-label="Toggle demo"
              />
            </div>
            <button
              onClick={handleRecord}
              className="sr-only"
            />
          </div>
          <div className="flex justify-center mt-3">
            <button
              onClick={handleRecord}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              {recording ? 'Stop demo' : 'Try the interactive demo'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Mini table (demo) ────────────────────────────────────────────────────────
function MiniTable({ activeRow, filled }: { activeRow: number; filled: boolean }) {
  const rows = [
    { name: 'John Smith', q1: 82, q2: 79, q3: filled ? 85 : null },
    { name: 'Sarah Johnson', q1: 94, q2: 91, q3: null },
    { name: 'Mike Brown', q1: 76, q2: 88, q3: null },
    { name: 'Emma Davis', q1: 88, q2: 85, q3: null },
  ]

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#e5e7eb' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th className="text-left px-3 py-2 font-medium text-gray-500 border-r" style={{ borderColor: '#e5e7eb' }}>Student</th>
            <th className="px-3 py-2 font-medium text-gray-500 border-r" style={{ borderColor: '#e5e7eb' }}>Quiz 1</th>
            <th className="px-3 py-2 font-medium text-gray-500 border-r" style={{ borderColor: '#e5e7eb' }}>Quiz 2</th>
            <th
              className="px-3 py-2 font-semibold border-r"
              style={{ color: '#13501B', borderColor: '#e5e7eb', background: '#f2f8f2' }}
            >
              Quiz 3 ←
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: activeRow === i ? '#f2f8f2' : i % 2 === 0 ? '#fff' : '#fafafa',
                transition: 'background 0.2s',
              }}
            >
              <td className="px-3 py-2 font-medium text-gray-800 border-r" style={{ borderColor: '#e5e7eb' }}>
                {row.name}
              </td>
              <td className="px-3 py-2 text-center text-gray-600 border-r" style={{ fontFamily: 'var(--font-mono)', borderColor: '#e5e7eb' }}>
                {row.q1}
              </td>
              <td className="px-3 py-2 text-center text-gray-600 border-r" style={{ fontFamily: 'var(--font-mono)', borderColor: '#e5e7eb' }}>
                {row.q2}
              </td>
              <td
                className="px-3 py-2 text-center font-semibold border-r"
                style={{
                  fontFamily: 'var(--font-mono)',
                  borderColor: '#e5e7eb',
                  color: row.q3 ? '#13501B' : activeRow === i ? '#13501B' : 'transparent',
                  background: activeRow === i ? '#e8f2e9' : 'transparent',
                  transition: 'all 0.3s',
                }}
              >
                {row.q3 ?? (activeRow === i ? '█' : '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Social proof strip ───────────────────────────────────────────────────────
function SocialProof() {
  const stats = [
    { value: '< 3.5s', label: 'Voice-to-cell latency' },
    { value: '90%+', label: 'Parsing accuracy' },
    { value: '2.5 hrs', label: 'Saved per teacher/week' },
    { value: '0', label: 'Transcription errors' },
  ]

  return (
    <section className="border-t border-b border-gray-100 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-medium text-gray-400 text-center mb-8 uppercase tracking-widest">
          Built for performance
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div
                className="text-3xl font-extrabold mb-1"
                style={{ fontFamily: 'var(--font-display)', color: i % 2 === 0 ? '#13501B' : '#000' }}
              >
                {s.value}
              </div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Data Model: Lists + Templates → Tables ──────────────────────────────────
const TEMPLATES = [
  {
    id: 'exam',
    label: 'Exam',
    icon: '📝',
    color: '#13501B',
    bg: '#f2f8f2',
    border: 'rgba(19,80,27,0.2)',
    cols: ['Score (0–100)', 'Grade', 'Notes'],
    colTypes: ['number', 'text', 'text'],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: '✓',
    color: '#1e40af',
    bg: '#eff6ff',
    border: 'rgba(30,64,175,0.2)',
    cols: ['Present', 'Arrival Time', 'Reason (if absent)'],
    colTypes: ['boolean', 'text', 'text'],
  },
  {
    id: 'homework',
    label: 'Homework',
    icon: '⊞',
    color: '#92400e',
    bg: '#fffbeb',
    border: 'rgba(146,64,14,0.2)',
    cols: ['Submitted', 'Score', 'Late?'],
    colTypes: ['boolean', 'number', 'boolean'],
  },
]

const CLASS_ENTITIES = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Evan Lee']

function DataModelSection() {
  const [activeTemplate, setActiveTemplate] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  const switchTemplate = (i: number) => {
    if (i === activeTemplate) return
    setAnimating(true)
    setTimeout(() => {
      setActiveTemplate(i)
      setAnimating(false)
    }, 180)
  }

  const tpl = TEMPLATES[activeTemplate]

  return (
    <section
      ref={sectionRef}
      className="py-24 px-6"
      style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="grid md:grid-cols-2 gap-12 items-end mb-16">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: '#13501B', fontFamily: 'var(--font-mono)' }}
            >
              How VocalGrid thinks
            </p>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight text-black leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Three building blocks.
              <br />
              Infinite combinations.
            </h2>
          </div>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            Most tools mix the <em>who</em> with the <em>what</em>. VocalGrid separates them — so your student roster, your column structures, and your data tables each live in exactly one place.
          </p>
        </div>

        {/* Concept pills */}
        <div className="grid md:grid-cols-3 gap-3 mb-12">
          {[
            {
              label: 'Base List',
              tag: 'Your entities',
              desc: 'The people or things you track. Created once, reused forever. "Class 10A" exists in one place.',
              icon: '⊡',
              color: '#000',
            },
            {
              label: 'Template',
              tag: 'Your column structure',
              desc: 'A reusable schema — "Exam" has Score + Grade + Notes. "Attendance" has Present + Time. Build once.',
              icon: '⊟',
              color: '#13501B',
            },
            {
              label: 'Table',
              tag: 'Base List + Template',
              desc: 'The live data entry surface. Class 10A × Exam Template = "Math Q1." Voice-ready in seconds.',
              icon: '⊞',
              color: '#000',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-5 border transition-all duration-200"
              style={{
                background: '#fff',
                borderColor: '#e5e7eb',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 0.4s ease ${i * 0.1}s, transform 0.4s ease ${i * 0.1}s`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg" style={{ color: item.color }}>{item.icon}</span>
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: item.color, fontFamily: 'var(--font-mono)' }}
                >
                  {item.tag}
                </span>
              </div>
              <h3
                className="text-base font-bold text-black mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {item.label}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Interactive diagram */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: '#e5e7eb', background: '#fff', boxShadow: '0 4px 40px rgba(0,0,0,0.05)' }}
        >
          {/* Diagram header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: '#f0f0f0', background: '#fafafa' }}
          >
            <p
              className="text-xs font-medium text-gray-500"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Interactive example — click a template to see how the table changes
            </p>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#f2f8f2', color: '#13501B', fontFamily: 'var(--font-mono)' }}
            >
              Class 10A × {tpl.label}
            </span>
          </div>

          <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-0">
            {/* Column 1: Base List */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: '#000', fontFamily: 'var(--font-display)' }}
                >
                  ⊡
                </div>
                <div>
                  <p className="text-xs font-semibold text-black" style={{ fontFamily: 'var(--font-display)' }}>
                    Base List
                  </p>
                  <p className="text-[10px] text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>created once</p>
                </div>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{ borderColor: '#e5e7eb', background: '#fafafa' }}
              >
                <p
                  className="text-xs font-bold text-black mb-3"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Class 10A
                </p>
                <div className="flex flex-col gap-1.5">
                  {CLASS_ENTITIES.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: '#13501B', fontFamily: 'var(--font-display)' }}
                      >
                        {name[0]}
                      </div>
                      <span className="text-xs text-gray-700 truncate">{name}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-gray-400 mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                    + 25 more students
                  </div>
                </div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center justify-center px-2">
              <div className="hidden md:flex flex-col items-center gap-1">
                <div className="w-px h-8 bg-gray-200" />
                <span className="text-gray-300 text-sm font-light">×</span>
                <div className="w-px h-8 bg-gray-200" />
              </div>
            </div>

            {/* Column 2: Template selector */}
            <div className="p-6 border-x" style={{ borderColor: '#f0f0f0' }}>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{ background: '#13501B', color: '#fff', fontFamily: 'var(--font-display)' }}
                >
                  ⊟
                </div>
                <div>
                  <p className="text-xs font-semibold text-black" style={{ fontFamily: 'var(--font-display)' }}>
                    Template
                  </p>
                  <p className="text-[10px] text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>pick one</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {TEMPLATES.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => switchTemplate(i)}
                    className="w-full text-left rounded-xl border p-3.5 cursor-pointer transition-all duration-200"
                    style={{
                      background: activeTemplate === i ? t.bg : '#fafafa',
                      borderColor: activeTemplate === i ? t.border : '#e5e7eb',
                      boxShadow: activeTemplate === i ? `0 0 0 1px ${t.border}` : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-xs font-bold"
                        style={{ color: activeTemplate === i ? t.color : '#374151', fontFamily: 'var(--font-display)' }}
                      >
                        {t.icon} {t.label}
                      </span>
                      {activeTemplate === i && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: t.color, color: '#fff', fontFamily: 'var(--font-mono)' }}
                        >
                          active
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.cols.map((col, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-1.5 py-0.5 rounded-full border"
                          style={{
                            background: activeTemplate === i ? '#fff' : '#f5f5f5',
                            borderColor: activeTemplate === i ? t.border : '#e5e7eb',
                            color: activeTemplate === i ? t.color : '#6b7280',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {col.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center justify-center px-2">
              <div className="hidden md:flex flex-col items-center gap-1">
                <div className="w-px h-8 bg-gray-200" />
                <span className="text-gray-300 text-sm font-light">=</span>
                <div className="w-px h-8 bg-gray-200" />
              </div>
            </div>

            {/* Column 3: Resulting table */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: '#000', fontFamily: 'var(--font-display)' }}
                >
                  ⊞
                </div>
                <div>
                  <p className="text-xs font-semibold text-black" style={{ fontFamily: 'var(--font-display)' }}>
                    Table
                  </p>
                  <p className="text-[10px] text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>voice-ready</p>
                </div>
              </div>

              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  borderColor: '#e5e7eb',
                  opacity: animating ? 0 : 1,
                  transform: animating ? 'translateY(4px)' : 'translateY(0)',
                  transition: 'opacity 0.18s ease, transform 0.18s ease',
                }}
              >
                {/* Table name bar */}
                <div
                  className="px-3 py-2 border-b flex items-center justify-between"
                  style={{ background: tpl.bg, borderColor: tpl.border }}
                >
                  <span
                    className="text-xs font-bold"
                    style={{ color: tpl.color, fontFamily: 'var(--font-display)' }}
                  >
                    Class 10A — {tpl.label}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: tpl.color, fontFamily: 'var(--font-mono)', opacity: 0.7 }}
                  >
                    30 rows
                  </span>
                </div>
                {/* Column headers */}
                <div
                  className="grid text-[10px] font-semibold border-b"
                  style={{
                    gridTemplateColumns: `1fr ${tpl.cols.map(() => '1fr').join(' ')}`,
                    borderColor: '#f0f0f0',
                    background: '#f9f9f9',
                  }}
                >
                  <div className="px-2 py-1.5 text-gray-500 border-r" style={{ borderColor: '#f0f0f0', fontFamily: 'var(--font-mono)' }}>
                    Name
                  </div>
                  {tpl.cols.map((col, j) => (
                    <div
                      key={j}
                      className="px-2 py-1.5 border-r last:border-0"
                      style={{ color: tpl.color, borderColor: '#f0f0f0', fontFamily: 'var(--font-mono)' }}
                    >
                      {col.split(' ')[0]}
                    </div>
                  ))}
                </div>
                {/* Data rows */}
                {CLASS_ENTITIES.slice(0, 4).map((name, i) => (
                  <div
                    key={i}
                    className="grid border-b last:border-0 hover:bg-gray-50 transition-colors"
                    style={{
                      gridTemplateColumns: `1fr ${tpl.cols.map(() => '1fr').join(' ')}`,
                      borderColor: '#f5f5f5',
                    }}
                  >
                    <div
                      className="px-2 py-2 text-xs text-gray-700 font-medium border-r truncate"
                      style={{ borderColor: '#f5f5f5' }}
                    >
                      {name.split(' ')[0]}
                    </div>
                    {tpl.cols.map((_, j) => (
                      <div
                        key={j}
                        className="px-2 py-2 border-r last:border-0"
                        style={{ borderColor: '#f5f5f5' }}
                      >
                        <div className="h-3 rounded-sm" style={{ background: '#f0f0f0', width: `${40 + Math.random() * 40}%` }} />
                      </div>
                    ))}
                  </div>
                ))}
                {/* Voice hint row */}
                <div
                  className="px-3 py-2 flex items-center gap-2"
                  style={{ background: tpl.bg }}
                >
                  <MicIcon color={tpl.color} size={10} />
                  <span
                    className="text-[10px] italic"
                    style={{ color: tpl.color, fontFamily: 'var(--font-mono)' }}
                  >
                    "{CLASS_ENTITIES[0].split(' ')[0]}, {tpl.id === 'exam' ? '92' : tpl.id === 'attendance' ? 'present' : 'submitted'}"
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer insight */}
          <div
            className="px-6 py-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            style={{ borderColor: '#f0f0f0', background: '#fafafa' }}
          >
            <p className="text-xs text-gray-500 leading-relaxed max-w-md">
              <strong className="text-black">The key insight:</strong> "Class 10A" is defined exactly once. You can create Exam, Attendance, and Homework tables from it in seconds — each with its own column structure, its own voice matching, and its own export.
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {TEMPLATES.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => switchTemplate(i)}
                  className="w-2 h-2 rounded-full cursor-pointer border-0 transition-all duration-200"
                  style={{ background: activeTemplate === i ? '#13501B' : '#d1d5db' }}
                  aria-label={`Switch to ${t.label} template`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* DRY principle callout */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Define your roster once', body: 'Update "Alice Johnson" in the Base List and it reflects across every table that uses Class 10A.' },
            { label: 'Snap on any template', body: 'Exam, Attendance, Homework — or build custom templates. Each is a reusable column schema.' },
            { label: 'Tables multiply freely', body: 'Math Q1, Math Q2, Science Q1 — all from the same list. New table in under 5 seconds.' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl border"
              style={{ borderColor: '#f0f0f0', background: '#fff' }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: '#13501B' }}
              >
                <CheckIcon size={12} />
              </div>
              <div>
                <p className="text-sm font-semibold text-black mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Build your Base List',
      body: 'Create your entity roster once — a class, a product list, a team. Import from CSV or enter manually. This list becomes the reusable foundation for every table you create from it.',
      tag: 'Base List',
    },
    {
      num: '02',
      title: 'Pick or build a Template',
      body: 'Choose a column structure: "Exam" has Score + Grade + Notes. "Attendance" has Present + Time. Build once, reuse across every class, every week. Snap it onto any Base List.',
      tag: 'Template',
    },
    {
      num: '03',
      title: 'Start talking',
      body: 'Your table is voice-ready the moment it\'s created. Say names, values, commands naturally. The smart pointer finds the right cell, fuzzy-matches entities, and fills data hands-free.',
      tag: 'Voice Entry',
    },
    {
      num: '04',
      title: 'Export and repeat',
      body: 'Download CSV or Excel in one command. Next quiz? Snap the same Base List onto the Exam template again. New table in under 5 seconds, no re-entering your roster.',
      tag: 'Export',
    },
  ]

  return (
    <section className="py-24 px-6" id="how-it-works">
      <div className="max-w-5xl mx-auto">
        <div className="mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: '#13501B', fontFamily: 'var(--font-mono)' }}
          >
            How it works
          </p>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-black"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            From table to filled
            <br />
            in four steps.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
          {steps.map((step, i) => (
            <div
              key={i}
              className="bg-white p-8 group hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="flex items-start justify-between mb-6">
                <span
                  className="text-5xl font-extrabold leading-none select-none"
                  style={{ fontFamily: 'var(--font-display)', color: '#f0f0f0' }}
                >
                  {step.num}
                </span>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full border"
                  style={{ color: '#13501B', borderColor: 'rgba(19,80,27,0.2)', background: '#f2f8f2', fontFamily: 'var(--font-mono)' }}
                >
                  {step.tag}
                </span>
              </div>
              <h3
                className="text-xl font-bold text-black mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: '⌖',
      title: 'Smart Pointer',
      body: 'Context-aware cursor that understands Column-First and Row-First navigation. Automatically advances after each entry. No screen-touching required.',
    },
    {
      icon: '≈',
      title: 'Fuzzy Matching',
      body: '"Jon" maps to "Jonathan." "Smith" resolves to the right row. The LLM understands partial names, abbreviations, and natural phrasing.',
    },
    {
      icon: '⊕',
      title: 'Live Schema Edits',
      body: 'Add a column mid-session with a voice command. "Add column: Homework 4" — done. No menu diving, no breaking your flow.',
    },
    {
      icon: '↗',
      title: 'Sub-3.5s latency',
      body: 'Whisper STT + GPT-4o-mini parsing completes in under 3.5 seconds at P95. Optimistic UI updates mean you feel it even faster.',
    },
    {
      icon: '⬢',
      title: 'Export anywhere',
      body: 'CSV and Excel export built in. Voice-trigger or one-click. Compatible with Google Sheets, Excel, Notion databases, or any downstream tool.',
    },
    {
      icon: '⊘',
      title: 'Secure by default',
      body: 'Row-Level Security via Supabase. Every table is private to its owner. No API keys in client code. HTTPS-only, rate-limited voice endpoints.',
    },
  ]

  return (
    <section className="py-24 px-6 bg-black" id="features">
      <div className="max-w-5xl mx-auto">
        <div className="mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: '#13501B', fontFamily: 'var(--font-mono)' }}
          >
            Features
          </p>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Everything you need.
            <br />
            Nothing you don't.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
          {features.map((f, i) => (
            <div
              key={i}
              className="p-8 group cursor-default transition-colors duration-200"
              style={{ background: '#111' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#13501B' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#111' }}
            >
              <div
                className="text-2xl mb-5 font-light select-none"
                style={{ color: '#13501B', transition: 'color 0.2s' }}
              >
                {f.icon}
              </div>
              <h3
                className="text-base font-bold text-white mb-2.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {f.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed group-hover:text-white/70 transition-colors duration-200">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Use cases ────────────────────────────────────────────────────────────────
function UseCases() {
  const [active, setActive] = useState(0)

  const cases = [
    {
      persona: 'Ms. Sarah Rodriguez',
      role: 'High School Math Teacher',
      quote: 'I grade 30 quizzes while walking around the classroom. No more hunching over a laptop — I just talk and it fills in.',
      stat: '2.5 hrs saved / week',
      workflow: [
        'Open VocalGrid on tablet, select class Period 3',
        'Set Column-First mode → Quiz 3',
        'Say "John Smith, 85" — cell fills, pointer advances',
        'Continue through 30 students without touching the screen',
        'Export to gradebook CSV when done',
      ],
      color: '#13501B',
    },
    {
      persona: 'Marcus Thompson',
      role: 'Inventory Manager, Warehouse',
      quote: 'My team holds scanners and counts simultaneously. VocalGrid means we log counts in real time — no clipboard, no evening re-entry.',
      stat: '5 hrs saved / person / week',
      workflow: [
        'Create inventory table with SKU, Location, Count columns',
        'Set Row-First mode — one row per product scan',
        'Say "SKU 4821, Aisle 7, quantity 47"',
        'Confirm by exception only — VocalGrid flags discrepancies',
        'Export to ERP at end of shift',
      ],
      color: '#000',
    },
  ]

  const c = cases[active]

  return (
    <section className="py-24 px-6" id="use-cases">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: '#13501B', fontFamily: 'var(--font-mono)' }}
          >
            Use cases
          </p>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-black"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Built for people
            <br />who can't type right now.
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-10">
          {cases.map((c, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border"
              style={{
                fontFamily: 'var(--font-display)',
                background: active === i ? '#13501B' : '#fff',
                color: active === i ? '#fff' : '#555',
                borderColor: active === i ? '#13501B' : '#e5e7eb',
              }}
            >
              {c.role.split(',')[0]}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Quote card */}
          <div
            className="rounded-2xl p-8 border"
            style={{ borderColor: '#e5e7eb' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ background: c.color, fontFamily: 'var(--font-display)' }}
              >
                {c.persona.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-sm font-semibold text-black" style={{ fontFamily: 'var(--font-display)' }}>
                  {c.persona}
                </div>
                <div className="text-xs text-gray-500">{c.role}</div>
              </div>
            </div>
            <blockquote className="text-[15px] text-gray-700 leading-relaxed mb-6 italic">
              "{c.quote}"
            </blockquote>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: '#f2f8f2', color: '#13501B', fontFamily: 'var(--font-mono)' }}
            >
              ↑ {c.stat}
            </div>
          </div>

          {/* Workflow */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-5 text-gray-400"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Typical workflow
            </p>
            <ol className="flex flex-col gap-4">
              {c.workflow.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                    style={{ background: '#13501B', fontFamily: 'var(--font-display)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Live commands strip ──────────────────────────────────────────────────────
function CommandsStrip() {
  return (
    <section className="py-10 border-t border-b border-gray-100 overflow-hidden">
      <div className="mb-4 px-6 text-center">
        <p
          className="text-xs font-medium text-gray-400 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Voice commands — live examples
        </p>
      </div>
      <CommandTicker />
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'For individuals exploring voice-first data entry.',
      features: [
        '3 tables',
        '100 voice entries / month',
        'CSV export',
        'Column-First & Row-First navigation',
      ],
      cta: 'Get started',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$12',
      period: 'per month',
      description: 'For power users who rely on VocalGrid daily.',
      features: [
        'Unlimited tables',
        'Unlimited voice entries',
        'CSV + Excel export',
        'Import from CSV',
        'Priority processing',
        'Email support',
      ],
      cta: 'Start free trial',
      highlight: true,
    },
    {
      name: 'Team',
      price: '$39',
      period: 'per month',
      description: 'For teams who share tables and workflows.',
      features: [
        'Everything in Pro',
        'Up to 5 users',
        'Shared table access',
        'Admin dashboard',
        'Priority support',
      ],
      cta: 'Contact us',
      highlight: false,
    },
  ]

  return (
    <section className="py-24 px-6" id="pricing" style={{ background: '#fafafa' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: '#13501B', fontFamily: 'var(--font-mono)' }}
          >
            Pricing
          </p>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-black"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Simple, honest pricing.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, i) => (
            <div
              key={i}
              className="rounded-2xl p-7 flex flex-col border transition-shadow duration-200"
              style={{
                background: plan.highlight ? '#13501B' : '#fff',
                borderColor: plan.highlight ? '#13501B' : '#e5e7eb',
                boxShadow: plan.highlight ? '0 8px 40px rgba(19,80,27,0.25)' : 'none',
              }}
            >
              <div className="mb-6">
                <div
                  className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{
                    color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#13501B',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {plan.name}
                </div>
                <div
                  className="text-4xl font-extrabold mb-0.5"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: plan.highlight ? '#fff' : '#000',
                  }}
                >
                  {plan.price}
                </div>
                <div
                  className="text-xs"
                  style={{ color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}
                >
                  {plan.period}
                </div>
              </div>

              <p
                className="text-sm mb-6 leading-relaxed"
                style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#6b7280' }}
              >
                {plan.description}
              </p>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-sm"
                    style={{ color: plan.highlight ? '#fff' : '#374151' }}>
                    <CheckIcon size={14} />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className="w-full text-center py-3 rounded-xl text-sm font-bold transition-all duration-200 no-underline block"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: plan.highlight ? '#fff' : '#13501B',
                  color: plan.highlight ? '#13501B' : '#fff',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.opacity = '0.9'
                  el.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.opacity = '1'
                  el.style.transform = 'translateY(0)'
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-24 px-6 bg-black">
      <div className="max-w-3xl mx-auto text-center">
        <div className="flex justify-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#13501B', boxShadow: '0 0 40px rgba(19,80,27,0.4)' }}
          >
            <MicIcon color="#fff" size={28} />
          </div>
        </div>
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Ready to stop typing?
        </h2>
        <p className="text-lg text-gray-400 mb-10 leading-relaxed">
          Join teachers, supervisors, and data workers who've moved their data entry to their voice. Free to start, no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[15px] font-bold text-black transition-all duration-200 no-underline"
            style={{ background: '#fff', fontFamily: 'var(--font-display)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >
            Start for free
            <ArrowRight size={15} color="#000" />
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[15px] font-semibold text-gray-400 border border-white/10 hover:border-white/30 transition-all duration-200 no-underline"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Read the docs
          </a>
        </div>
        <p className="text-xs text-gray-600 mt-6">
          No credit card required · Free forever plan · Cancel anytime
        </p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const links = {
    Product: ['Features', 'How it works', 'Pricing', 'Changelog'],
    Company: ['About', 'Blog', 'Careers', 'Press'],
    Resources: ['Documentation', 'API Reference', 'Status', 'Community'],
    Legal: ['Privacy', 'Terms', 'Security', 'Cookies'],
  }

  return (
    <footer className="border-t border-gray-100 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: '#13501B' }}
              >
                <MicIcon color="#fff" size={12} />
              </div>
              <span
                className="text-sm font-bold text-black"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                VocalGrid
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Voice-first data entry. Say it, it's logged.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <p
                className="text-xs font-semibold text-black mb-4 uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {group}
              </p>
              <ul className="flex flex-col gap-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-xs text-gray-500 hover:text-black transition-colors no-underline"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            © 2025 VocalGrid. All rights reserved.
          </p>
          <p
            className="text-xs text-gray-400"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            v1.1 · Built in public
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <main>
        <Hero />
        <SocialProof />
        <CommandsStrip />
        <HowItWorks />
        <DataModelSection />
        <Features />
        <UseCases />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
