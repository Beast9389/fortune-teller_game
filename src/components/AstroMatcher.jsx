import React, { useState, useEffect } from "react";
import {
  Sparkles, Flame, Mountain, Wind, Droplet, Users, Share2, Download,
  RotateCcw, Lock, ChevronRight, Star,
} from "lucide-react";

/* ============================================================
   ASTROLOGICAL & ELEMENTAL MATCHER
   Zero backend. Zodiac Trigon (Fire/Earth/Air/Water) compatibility
   combined with a 5-question personality vector, scored via
   cosine similarity. No external image service — zodiac glyphs
   are real Unicode astrological symbols (never fail to load),
   and interaction sound is synthesized live via Web Audio, so
   there's no audio file to break either.
   ============================================================ */

// ---------- crypto-secure Fisher-Yates (fair question selection) ----------
function secureRandomInt(maxExclusive) {
  const arr = new Uint32Array(1);
  const limit = 0xFFFFFFFF - (0xFFFFFFFF % maxExclusive);
  let val;
  do { crypto.getRandomValues(arr); val = arr[0]; } while (val >= limit);
  return val % maxExclusive;
}
function secureShuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- synthesized sound (Web Audio, no files) ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}
function playTone(freq = 440, duration = 0.14, type = "sine", delay = 0) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch {}
}
const sfx = {
  select: () => playTone(560, 0.12, "sine"),
  advance: () => playTone(660, 0.1, "triangle"),
  reveal: () => { playTone(392, 0.18, "sine", 0); playTone(494, 0.18, "sine", 0.09); playTone(659, 0.26, "sine", 0.18); },
  lock: () => playTone(220, 0.25, "sawtooth"),
};

// ---------- zodiac data ----------
const ZODIAC = [
  { key: "aries", symbol: "♈", name: "Aries", element: "Fire" },
  { key: "taurus", symbol: "♉", name: "Taurus", element: "Earth" },
  { key: "gemini", symbol: "♊", name: "Gemini", element: "Air" },
  { key: "cancer", symbol: "♋", name: "Cancer", element: "Water" },
  { key: "leo", symbol: "♌", name: "Leo", element: "Fire" },
  { key: "virgo", symbol: "♍", name: "Virgo", element: "Earth" },
  { key: "libra", symbol: "♎", name: "Libra", element: "Air" },
  { key: "scorpio", symbol: "♏", name: "Scorpio", element: "Water" },
  { key: "sagittarius", symbol: "♐", name: "Sagittarius", element: "Fire" },
  { key: "capricorn", symbol: "♑", name: "Capricorn", element: "Earth" },
  { key: "aquarius", symbol: "♒", name: "Aquarius", element: "Air" },
  { key: "pisces", symbol: "♓", name: "Pisces", element: "Water" },
];
const ELEMENTS = ["Fire", "Earth", "Air", "Water"];
const ELEMENT_ICON = { Fire: Flame, Earth: Mountain, Air: Wind, Water: Droplet };
const ELEMENT_COLOR = { Fire: "#FF6B4A", Earth: "#4ADE80", Air: "#22D3EE", Water: "#5B8DEF" };

// Zodiac Trigon logic: same element = strongest bond, complementary
// (Fire-Air, Earth-Water) = natural flow, neutral pairs = workable,
// opposing (Fire-Water, Earth-Air) = friction that takes real effort.
function trigonScore(e1, e2) {
  if (e1 === e2) return 0.95;
  const complementary = [["Fire", "Air"], ["Earth", "Water"]];
  const opposing = [["Fire", "Water"], ["Earth", "Air"]];
  const isPair = (pairs) => pairs.some(([a, b]) => (a === e1 && b === e2) || (a === e2 && b === e1));
  if (isPair(complementary)) return 0.82;
  if (isPair(opposing)) return 0.34;
  return 0.58;
}
const TRIGON_NOTES = {
  "Fire-Fire": "Two flames — thrilling, fast, occasionally combustible.",
  "Earth-Earth": "Rock solid — steady, dependable, rarely surprising.",
  "Air-Air": "All ideas, all talk — brilliant, sometimes ungrounded.",
  "Water-Water": "Deeply intuitive — emotionally fluent, occasionally overwhelming.",
  "Fire-Air": "A natural spark — Air feeds Fire, Fire excites Air.",
  "Earth-Water": "Grounding meets flow — Earth gives Water banks to run in.",
  "Fire-Earth": "Passion meets patience — needs real compromise on pace.",
  "Air-Water": "Logic meets feeling — needs translation, but worth it.",
  "Fire-Water": "Steam — can extinguish or can power something bigger.",
  "Earth-Air": "Practical meets abstract — different clocks entirely.",
};
function trigonNote(e1, e2) {
  const key1 = `${e1}-${e2}`, key2 = `${e2}-${e1}`;
  return TRIGON_NOTES[key1] || TRIGON_NOTES[key2] || "An unusual pairing — genuinely hard to predict.";
}

// ---------- question pool (schema scales cleanly; localStorage keeps repeats fresh) ----------
const SEEN_KEY = "aa_astro_seen_ids_v1";
const QUESTIONS = [
  { id: 0, text: "A weekend with nothing planned. You:", options: [
    { label: "Plan something spontaneous, right now", v: [1, 0, 0, 0] },
    { label: "Finally tackle that home project", v: [0, 1, 0, 0] },
    { label: "Call everyone you know", v: [0, 0, 1, 0] },
    { label: "Disappear into your own head for a while", v: [0, 0, 0, 1] },
  ]},
  { id: 1, text: "In an argument, you're the one who:", options: [
    { label: "Says the sharp thing first", v: [1, 0, 0, 0] },
    { label: "Waits it out, stays steady", v: [0, 1, 0, 0] },
    { label: "Tries to reframe it logically", v: [0, 0, 1, 0] },
    { label: "Feels it in your body for days after", v: [0, 0, 0, 1] },
  ]},
  { id: 2, text: "Your ideal Friday night:", options: [
    { label: "Loud, spontaneous, out the door by 9", v: [1, 0, 0, 0] },
    { label: "A good meal, no rush, familiar faces", v: [0, 1, 0, 0] },
    { label: "A party where you don't know everyone yet", v: [0, 0, 1, 0] },
    { label: "One deep conversation over a slow dinner", v: [0, 0, 0, 1] },
  ]},
  { id: 3, text: "When you fall for someone, it's usually because of:", options: [
    { label: "The chemistry — instant and undeniable", v: [1, 0, 0, 0] },
    { label: "How safe and steady they make you feel", v: [0, 1, 0, 0] },
    { label: "How much you can talk to them", v: [0, 0, 1, 0] },
    { label: "How deeply they seem to get you", v: [0, 0, 0, 1] },
  ]},
  { id: 4, text: "Your biggest strength, honestly:", options: [
    { label: "Courage — you go first", v: [1, 0, 0, 0] },
    { label: "Reliability — you follow through", v: [0, 1, 0, 0] },
    { label: "Perspective — you see all sides", v: [0, 0, 1, 0] },
    { label: "Empathy — you feel what others feel", v: [0, 0, 0, 1] },
  ]},
  { id: 5, text: "Your biggest flaw, if you're honest:", options: [
    { label: "Impatient — you want it now", v: [1, 0, 0, 0] },
    { label: "Stubborn — change is hard for you", v: [0, 1, 0, 0] },
    { label: "Detached — you overthink your own feelings", v: [0, 0, 1, 0] },
    { label: "Moody — your feelings run the day", v: [0, 0, 0, 1] },
  ]},
  { id: 6, text: "Money, honestly:", options: [
    { label: "Spend it — you'll earn more", v: [1, 0, 0, 0] },
    { label: "Save methodically, always have a cushion", v: [0, 1, 0, 0] },
    { label: "It's just a tool, don't overthink it", v: [0, 0, 1, 0] },
    { label: "It's tied up with how secure you feel", v: [0, 0, 0, 1] },
  ]},
  { id: 7, text: "A friend is struggling. Your instinct:", options: [
    { label: "Get them out of the house, distract them", v: [1, 0, 0, 0] },
    { label: "Show up with something practical — food, help", v: [0, 1, 0, 0] },
    { label: "Talk it through, help them see it clearly", v: [0, 0, 1, 0] },
    { label: "Just sit with them, no fixing needed", v: [0, 0, 0, 1] },
  ]},
  { id: 8, text: "Your work style:", options: [
    { label: "Bursts of intense energy, then done", v: [1, 0, 0, 0] },
    { label: "Slow, steady, rarely miss a deadline", v: [0, 1, 0, 0] },
    { label: "Best with a team to bounce ideas off", v: [0, 0, 1, 0] },
    { label: "Best alone, in your own flow", v: [0, 0, 0, 1] },
  ]},
  { id: 9, text: "You feel most alive when:", options: [
    { label: "Taking a real risk", v: [1, 0, 0, 0] },
    { label: "Building something that lasts", v: [0, 1, 0, 0] },
    { label: "Learning something completely new", v: [0, 0, 1, 0] },
    { label: "Feeling truly connected to someone", v: [0, 0, 0, 1] },
  ]},
  { id: 10, text: "Your love language, if you had to pick one:", options: [
    { label: "Adventure together", v: [1, 0, 0, 0] },
    { label: "Acts of service", v: [0, 1, 0, 0] },
    { label: "Deep conversation", v: [0, 0, 1, 0] },
    { label: "Undivided emotional presence", v: [0, 0, 0, 1] },
  ]},
  { id: 11, text: "Under stress, you:", options: [
    { label: "Get restless, need to move", v: [1, 0, 0, 0] },
    { label: "Get quiet, need routine back", v: [0, 1, 0, 0] },
    { label: "Need to talk it out loud, with someone", v: [0, 0, 1, 0] },
    { label: "Need to be alone with it first", v: [0, 0, 0, 1] },
  ]},
  { id: 12, text: "Your dream trip:", options: [
    { label: "Somewhere with zero itinerary", v: [1, 0, 0, 0] },
    { label: "Somewhere comfortable, done properly", v: [0, 1, 0, 0] },
    { label: "Somewhere culturally rich, museums and all", v: [0, 0, 1, 0] },
    { label: "Somewhere quiet, close to nature or water", v: [0, 0, 0, 1] },
  ]},
  { id: 13, text: "What people misunderstand about you:", options: [
    { label: "That your intensity isn't anger", v: [1, 0, 0, 0] },
    { label: "That your caution isn't coldness", v: [0, 1, 0, 0] },
    { label: "That your detachment isn't disinterest", v: [0, 0, 1, 0] },
    { label: "That your sensitivity isn't weakness", v: [0, 0, 0, 1] },
  ]},
  { id: 14, text: "Your ideal partner, above all, should be:", options: [
    { label: "Bold enough to keep up with you", v: [1, 0, 0, 0] },
    { label: "Consistent — no guessing games", v: [0, 1, 0, 0] },
    { label: "Someone you can really talk to", v: [0, 0, 1, 0] },
    { label: "Emotionally fluent and present", v: [0, 0, 0, 1] },
  ]},
];

function normalize(v) {
  const sum = v.reduce((a, b) => a + b, 0) || 1;
  return v.map((n) => n / sum);
}
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function getSeenIds() {
  try { const raw = window.localStorage.getItem(SEEN_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function markSeen(ids) {
  try {
    const existing = new Set(getSeenIds());
    ids.forEach((id) => existing.add(id));
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...existing]));
  } catch {}
}
function pickQuestions(count) {
  const seen = new Set(getSeenIds());
  let pool = QUESTIONS.filter((q) => !seen.has(q.id));
  if (pool.length < count) {
    try { window.localStorage.removeItem(SEEN_KEY); } catch {}
    pool = QUESTIONS;
  }
  const picked = secureShuffle(pool).slice(0, count);
  markSeen(picked.map((q) => q.id));
  return picked;
}

// ---------- try/catch + shape-validated Destiny Link decode ----------
function parseDestinyHash() {
  try {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const raw = params.get("partner");
    if (!raw) return null;
    const decoded = JSON.parse(atob(raw));
    if (!Array.isArray(decoded.v) || decoded.v.length !== 4) return null;
    if (!decoded.v.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    if (typeof decoded.z !== "string" || !ZODIAC.some((z) => z.key === decoded.z)) return null;
    return {
      v: decoded.v,
      zodiacKey: decoded.z,
      n: typeof decoded.n === "string" ? decoded.n.slice(0, 40) : "A friend",
    };
  } catch (err) {
    console.warn("Corrupt or tampered destiny link, ignoring:", err);
    return null;
  }
}
function encodeDestinyLink(zodiacKey, vector, nickname) {
  const payload = btoa(JSON.stringify({ z: zodiacKey, v: vector, n: nickname || "A friend" }));
  return `${window.location.origin}${window.location.pathname}#partner=${payload}`;
}

function computeSynergy(zodiacKey1, vector1, zodiacKey2, vector2) {
  const z1 = ZODIAC.find((z) => z.key === zodiacKey1);
  const z2 = ZODIAC.find((z) => z.key === zodiacKey2);
  const trigon = trigonScore(z1.element, z2.element);
  const sim = cosineSimilarity(vector1, vector2);
  const combined = trigon * 0.45 + sim * 0.55;
  const pct = Math.round(10 + combined * 89);
  return { pct: Math.min(99, Math.max(10, pct)), z1, z2, note: trigonNote(z1.element, z2.element) };
}

export default function AstroMatcher() {
  const [step, setStep] = useState("intro");
  const [mode, setMode] = useState("solo");
  const [player, setPlayer] = useState(1);
  const [nickname, setNickname] = useState("");
  const [zodiac, setZodiac] = useState([null, null]);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [vectors, setVectors] = useState([[0, 0, 0, 0], [0, 0, 0, 0]]);
  const [incoming, setIncoming] = useState(null);
  const [copiedLink, setCopiedLink] = useState("");

  useEffect(() => {
    const found = parseDestinyHash();
    if (found) setIncoming(found);
  }, []);

  function beginReading(chosenMode) {
    sfx.advance();
    setMode(chosenMode);
    setPlayer(1);
    setZodiac([null, null]);
    setVectors([[0, 0, 0, 0], [0, 0, 0, 0]]);
    setStep("zodiac");
  }

  function chooseZodiac(key) {
    sfx.select();
    setZodiac((prev) => { const next = [...prev]; next[player - 1] = key; return next; });
    setQuestions(pickQuestions(5));
    setQIndex(0);
    setStep("quiz");
  }

  function answer(vec) {
    sfx.select();
    const idx = player - 1;
    setVectors((prev) => {
      const next = prev.map((v) => [...v]);
      vec.forEach((n, i) => { next[idx][i] += n; });
      return next;
    });
    const isLast = qIndex === questions.length - 1;
    if (isLast) {
      sfx.reveal();
      if (mode === "pass" && player === 1) { setStep("lockscreen"); return; }
      if (mode === "pass" && player === 2) { setStep("pass-result"); return; }
      if (incoming) { setStep("destiny-result"); return; }
      setStep("result");
    } else {
      setQIndex((i) => i + 1);
    }
  }

  function startPlayerTwo() {
    sfx.lock();
    setPlayer(2);
    setStep("zodiac");
  }

  function reset() {
    window.history.replaceState({}, "", window.location.pathname);
    setIncoming(null); setMode("solo"); setPlayer(1);
    setZodiac([null, null]); setVectors([[0, 0, 0, 0], [0, 0, 0, 0]]);
    setStep("intro");
  }

  async function downloadCard() {
    const card = document.getElementById("result-card");
    if (card && window.html2canvas) {
      const canvas = await window.html2canvas(card, { useCORS: true, backgroundColor: "#0B0B14" });
      const link = document.createElement("a");
      link.download = "cosmic-synergy.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  }
  function shareDestiny() {
    const link = encodeDestinyLink(zodiac[0], normalize(vectors[0]), nickname);
    setCopiedLink(link);
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  return (
    <div className="relative min-h-screen am-root">
      <style>{CSS}</style>
      <div className="am-glow am-glow-1" /><div className="am-glow am-glow-2" />
      <div className="relative max-w-3xl mx-auto px-5 py-6 min-h-screen flex flex-col z-10">
        <header className="flex items-center justify-between py-2 mb-6">
          <a href="/" className="am-back">← Hub</a>
          <div className="am-brand"><Sparkles size={16} className="animate-pulse" /> Elemental Matcher</div>
        </header>

        {step === "intro" && (
          <IntroScreen incoming={incoming} onSolo={() => beginReading("solo")} onPass={() => beginReading("pass")} onAcceptDestiny={() => beginReading("solo")} />
        )}
        {step === "zodiac" && (
          <ZodiacScreen playerLabel={mode === "pass" ? `Player ${player} — ` : ""} onPick={chooseZodiac} />
        )}
        {step === "quiz" && questions[qIndex] && (
          <QuizScreen playerLabel={mode === "pass" ? `Player ${player} — ` : ""} index={qIndex} total={questions.length} question={questions[qIndex]} onAnswer={answer} />
        )}
        {step === "lockscreen" && <LockScreen onUnlock={startPlayerTwo} />}
        {step === "result" && (
          <SoloResultScreen zodiacKey={zodiac[0]} vector={normalize(vectors[0])} onDownload={downloadCard} onShare={shareDestiny} onReset={reset} copiedLink={copiedLink} nickname={nickname} setNickname={setNickname} />
        )}
        {step === "pass-result" && (
          <DuoResultScreen synergy={computeSynergy(zodiac[0], normalize(vectors[0]), zodiac[1], normalize(vectors[1]))} v1={normalize(vectors[0])} v2={normalize(vectors[1])} label1="Player 1" label2="Player 2" onDownload={downloadCard} onReset={reset} />
        )}
        {step === "destiny-result" && incoming && (
          <DuoResultScreen synergy={computeSynergy(zodiac[0], normalize(vectors[0]), incoming.zodiacKey, incoming.v)} v1={normalize(vectors[0])} v2={incoming.v} label1="You" label2={incoming.n} onDownload={downloadCard} onReset={reset} />
        )}
      </div>
    </div>
  );
}

/* ============================================================ SCREENS ============================================================ */
function IntroScreen({ incoming, onSolo, onPass, onAcceptDestiny }) {
  if (incoming) {
    const z = ZODIAC.find((z) => z.key === incoming.zodiacKey);
    return (
      <section className="am-center">
        <p className="am-eyebrow">{incoming.n} shared their cosmic profile ({z?.symbol} {z?.name})</p>
        <h1 className="am-h1">Answer the same 5 questions to see your Cosmic Synergy.</h1>
        <button className="am-btn-gold" onClick={onAcceptDestiny}>Begin</button>
      </section>
    );
  }
  return (
    <section className="am-center">
      <p className="am-eyebrow">Zodiac trigon × personality vector · zero data stored</p>
      <h1 className="am-h1">How elementally compatible are you, really?</h1>
      <p className="am-sub">Pick your sign, answer 5 quick questions. We combine real elemental astrology with your actual answers — not just sun-sign guesswork.</p>
      <div className="am-mode-grid">
        <button className="am-mode-card" onClick={onSolo}><Star size={20} className="animate-pulse" /><h3>Solo Reading</h3><p>See your elemental profile and best-matched signs.</p></button>
        <button className="am-mode-card" onClick={onPass}><Users size={20} /><h3>Pass &amp; Play</h3><p>Two people, one device, one synergy score.</p></button>
      </div>
    </section>
  );
}

function ZodiacGlyph({ z, size = 44 }) {
  return (
    <span className="am-glyph" style={{ "--glow": ELEMENT_COLOR[z.element], width: size, height: size, fontSize: size * 0.55 }}>
      {z.symbol}
    </span>
  );
}

function ZodiacScreen({ playerLabel, onPick }) {
  return (
    <section className="am-stage">
      <p className="am-eyebrow">{playerLabel}Step 1 of 2</p>
      <h2 className="am-h2">Choose your sign</h2>
      <div className="am-zodiac-grid">
        {ZODIAC.map((z) => (
          <button key={z.key} className="am-zodiac-card" onClick={() => onPick(z.key)}>
            <ZodiacGlyph z={z} />
            <span className="am-zodiac-name">{z.name}</span>
            <span className="am-zodiac-element" style={{ color: ELEMENT_COLOR[z.element] }}>{z.element}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuizScreen({ playerLabel, index, total, question, onAnswer }) {
  return (
    <section className="am-stage">
      <div className="am-progress-row">
        <span className="am-eyebrow" style={{ margin: 0 }}>{playerLabel}Question {index + 1} of {total}</span>
      </div>
      <div className="am-progress-track"><div className="am-progress-fill" style={{ width: `${(index / total) * 100}%` }} /></div>
      <h2 className="am-h2" style={{ marginTop: 18 }}>{question.text}</h2>
      <div className="am-options">
        {question.options.map((opt, i) => (
          <button key={i} className="am-option" onClick={() => onAnswer(opt.v)}>
            <span>{opt.label}</span>
            <ChevronRight size={16} className="am-chev" />
          </button>
        ))}
      </div>
    </section>
  );
}

function LockScreen({ onUnlock }) {
  return (
    <section className="am-center">
      <div className="am-lock-icon"><Lock size={34} /></div>
      <p className="am-eyebrow">Player 1 complete</p>
      <h1 className="am-h1">Pass the device to Player 2.</h1>
      <p className="am-sub">Player 1's answers are hidden now — no peeking.</p>
      <button className="am-btn-gold" onClick={onUnlock}>Unlock for Player 2</button>
    </section>
  );
}

function ElementBars({ vector, compareVector }) {
  return (
    <div className="am-bars">
      {ELEMENTS.map((el, i) => {
        const Icon = ELEMENT_ICON[el];
        return (
          <div key={el} className="am-bar-row">
            <span className="am-bar-icon" style={{ color: ELEMENT_COLOR[el] }}><Icon size={14} /></span>
            <span className="am-bar-label">{el}</span>
            <div className="am-bar-track">
              <div className="am-bar-fill" style={{ width: `${vector[i] * 100}%`, background: ELEMENT_COLOR[el] }} />
              {compareVector && <div className="am-bar-fill am-bar-fill-ghost" style={{ width: `${compareVector[i] * 100}%`, borderColor: ELEMENT_COLOR[el] }} />}
            </div>
            <span className="am-bar-pct">{Math.round(vector[i] * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function SoloResultScreen({ zodiacKey, vector, onDownload, onShare, onReset, copiedLink, nickname, setNickname }) {
  const z = ZODIAC.find((z) => z.key === zodiacKey);
  const ranked = [...ZODIAC].filter((o) => o.key !== zodiacKey).map((o) => ({ ...o, score: trigonScore(z.element, o.element) })).sort((a, b) => b.score - a.score).slice(0, 3);
  return (
    <section className="am-center">
      <p className="am-eyebrow">Your elemental profile</p>
      <div id="result-card" className="am-card">
        <div className="am-card-hero">
          <ZodiacGlyph z={z} size={72} />
          <h1 className="am-h1" style={{ fontSize: 22, margin: "10px 0 2px" }}>{z.name}</h1>
          <p className="am-sub" style={{ margin: 0 }}>Ruling element: <strong style={{ color: ELEMENT_COLOR[z.element] }}>{z.element}</strong></p>
        </div>
        <div className="am-card-body">
          <h3 className="am-section-title">Elemental breakdown</h3>
          <ElementBars vector={vector} />
          <h3 className="am-section-title">Your best cosmic matches</h3>
          <div className="am-match-list">
            {ranked.map((r) => (
              <div key={r.key} className="am-match-row">
                <ZodiacGlyph z={r} size={32} />
                <div className="am-match-info"><p className="am-match-name">{r.name}</p><p className="am-match-note">{trigonNote(z.element, r.element)}</p></div>
                <span className="am-match-pct">{Math.round(10 + r.score * 89)}%</span>
              </div>
            ))}
          </div>
          <div className="am-field">
            <label>Nickname for your Destiny Link (optional)</label>
            <input className="am-input" maxLength={40} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Sam" />
          </div>
        </div>
      </div>
      <div className="am-actions">
        <button className="am-btn-gold" onClick={onDownload}><Download size={16} /> Save as image</button>
        <button className="am-btn-outline" onClick={onShare}><Share2 size={16} /> Destiny Link</button>
        <button className="am-btn-outline" onClick={onReset}><RotateCcw size={16} /> Start over</button>
      </div>
      {copiedLink && <p className="am-link">{copiedLink}</p>}
      <p className="am-disclaimer">For entertainment only.</p>
    </section>
  );
}

function DuoResultScreen({ synergy, v1, v2, label1, label2, onDownload, onReset }) {
  const { pct, z1, z2, note } = synergy;
  return (
    <section className="am-center">
      <p className="am-eyebrow">Cosmic Synergy Report</p>
      <div id="result-card" className="am-card">
        <div className="am-card-hero">
          <div className="am-duo-glyphs">
            <ZodiacGlyph z={z1} size={56} /><span className="am-duo-x">×</span><ZodiacGlyph z={z2} size={56} />
          </div>
          <h1 className="am-h1" style={{ fontSize: 34, margin: "10px 0 4px" }}>{pct}%</h1>
          <p className="am-sub" style={{ margin: 0 }}>{z1.element} meets {z2.element} — {note}</p>
        </div>
        <div className="am-card-body">
          <h3 className="am-section-title">{label1} vs {label2} — elemental profile</h3>
          <ElementBars vector={v1} compareVector={v2} />
          <div className="am-legend"><span className="am-legend-dot" /> {label1} <span className="am-legend-dot ghost" /> {label2}</div>
        </div>
      </div>
      <div className="am-actions">
        <button className="am-btn-gold" onClick={onDownload}><Download size={16} /> Save as image</button>
        <button className="am-btn-outline" onClick={onReset}><RotateCcw size={16} /> Start over</button>
      </div>
      <p className="am-disclaimer">For entertainment only.</p>
    </section>
  );
}

/* ============================================================ STYLES ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap');
.am-root { background:#0B0B14; color:#F3ECE0; font-family:'Manrope',sans-serif; }
.am-root * { box-sizing:border-box; }
.am-root button { font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }

.am-glow { position:fixed; border-radius:999px; filter:blur(110px); pointer-events:none; z-index:0; }
.am-glow-1 { top:-100px; left:-60px; width:360px; height:360px; background:#8B5CF6; opacity:.22; }
.am-glow-2 { bottom:-100px; right:-60px; width:360px; height:360px; background:#22D3EE; opacity:.16; }

.am-back { color:#9490A8; font-size:13.5px; text-decoration:none; }
.am-back:hover { color:#E8C766; }
.am-brand { display:flex; align-items:center; gap:8px; font-family:'Cinzel',serif; font-weight:700; color:#22D3EE; letter-spacing:.03em; }

.am-center, .am-stage { flex:1; display:flex; flex-direction:column; align-items:center; text-align:center; gap:20px; }
.am-stage { text-align:left; align-items:stretch; }
.am-eyebrow { text-transform:uppercase; letter-spacing:.14em; font-size:11px; color:#8B5CF6; font-weight:700; margin:0; }
.am-h1 { font-family:'Cinzel',serif; font-weight:700; font-size:28px; max-width:520px; }
.am-h2 { font-family:'Cinzel',serif; font-weight:700; font-size:22px; margin:2px 0 4px; }
.am-sub { color:#9490A8; font-size:14px; max-width:460px; line-height:1.6; }

.am-mode-grid { display:grid; gap:14px; width:100%; max-width:420px; }
.am-mode-card { text-align:left; padding:18px 20px; border-radius:16px; background:rgba(255,255,255,.04); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,.1); transition:.2s; }
.am-mode-card:hover { border-color:#22D3EE; transform:translateY(-3px); box-shadow:0 16px 30px -14px rgba(34,211,238,.35); }
.am-mode-card h3 { font-weight:700; margin:8px 0 2px; font-size:15px; }
.am-mode-card p { color:#9490A8; font-size:12.5px; }

.am-zodiac-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
@media(max-width:520px){ .am-zodiac-grid{ grid-template-columns:repeat(3,1fr); } }
.am-zodiac-card { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 6px; border-radius:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); transition:.18s; }
.am-zodiac-card:hover { border-color:#22D3EE; transform:translateY(-3px); box-shadow:0 14px 26px -14px rgba(34,211,238,.4); }
.am-zodiac-name { font-size:12px; font-weight:700; }
.am-zodiac-element { font-size:10.5px; font-weight:600; }

.am-glyph { display:flex; align-items:center; justify-content:center; border-radius:999px; background:rgba(255,255,255,.05); border:1.5px solid var(--glow); color:var(--glow); box-shadow:0 0 18px -2px var(--glow); font-weight:600; }

.am-progress-row { display:flex; justify-content:space-between; }
.am-progress-track { height:5px; border-radius:99px; background:rgba(255,255,255,.08); overflow:hidden; }
.am-progress-fill { height:100%; background:linear-gradient(90deg,#8B5CF6,#22D3EE); transition:width .3s ease; }
.am-options { display:grid; gap:10px; margin-top:6px; }
.am-option { display:flex; align-items:center; justify-content:space-between; text-align:left; padding:15px 18px; border-radius:14px; background:rgba(255,255,255,.04); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.1); font-size:14px; transition:.15s; }
.am-option:hover { border-color:#8B5CF6; background:rgba(139,92,246,.08); }
.am-option:hover .am-chev { transform:translateX(3px); color:#8B5CF6; }
.am-chev { transition:.15s; color:#9490A8; flex-shrink:0; margin-left:10px; }

.am-lock-icon { width:64px; height:64px; border-radius:50%; background:rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.4); display:flex; align-items:center; justify-content:center; color:#B9A6FF; }

.am-btn-gold { display:inline-flex; align-items:center; gap:8px; justify-content:center; padding:13px 26px; border-radius:99px; background:linear-gradient(135deg,#E8C766,#C9A227); color:#1a1408; font-weight:700; font-size:14.5px; box-shadow:0 10px 28px -8px rgba(201,162,39,.5); transition:transform .15s; }
.am-btn-gold:hover { transform:translateY(-2px); }
.am-btn-outline { display:inline-flex; align-items:center; gap:8px; justify-content:center; padding:11px 20px; border-radius:99px; border:1px solid rgba(255,255,255,.18); font-size:13.5px; font-weight:600; transition:.15s; }
.am-btn-outline:hover { border-color:#22D3EE; color:#22D3EE; }

.am-card { width:100%; max-width:460px; border-radius:20px; overflow:hidden; background:rgba(255,255,255,.04); backdrop-filter:blur(18px); border:1px solid rgba(139,92,246,.35); text-align:left; }
.am-card-hero { padding:26px 20px 18px; text-align:center; background:radial-gradient(circle at 50% 0%, rgba(139,92,246,.18), transparent 70%); }
.am-card-body { padding:20px; display:flex; flex-direction:column; gap:16px; }
.am-section-title { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#9490A8; font-weight:700; margin:0; }

.am-bars { display:flex; flex-direction:column; gap:9px; }
.am-bar-row { display:flex; align-items:center; gap:8px; }
.am-bar-icon { flex-shrink:0; }
.am-bar-label { font-size:12px; width:46px; flex-shrink:0; color:#DCD8E8; }
.am-bar-track { flex:1; height:8px; border-radius:99px; background:rgba(255,255,255,.08); position:relative; overflow:visible; }
.am-bar-fill { position:absolute; inset:0; height:100%; border-radius:99px; transition:width .4s ease; }
.am-bar-fill-ghost { background:transparent !important; border:1.5px dashed; border-radius:99px; top:-3px; bottom:-3px; height:auto; opacity:.8; }
.am-bar-pct { font-size:11px; color:#9490A8; width:32px; text-align:right; flex-shrink:0; }

.am-match-list { display:flex; flex-direction:column; gap:10px; }
.am-match-row { display:flex; align-items:center; gap:12px; }
.am-match-info { flex:1; }
.am-match-name { font-size:13.5px; font-weight:700; margin:0; }
.am-match-note { font-size:11.5px; color:#9490A8; margin:1px 0 0; }
.am-match-pct { font-size:13px; font-weight:700; color:#8B5CF6; }

.am-duo-glyphs { display:flex; align-items:center; justify-content:center; gap:14px; }
.am-duo-x { color:#9490A8; font-size:18px; }
.am-legend { display:flex; align-items:center; gap:6px; font-size:11px; color:#9490A8; }
.am-legend-dot { width:8px; height:8px; border-radius:50%; background:#8B5CF6; display:inline-block; }
.am-legend-dot.ghost { background:transparent; border:1.5px dashed #8B5CF6; margin-left:10px; }

.am-field label { display:block; font-size:12px; color:#9490A8; margin-bottom:6px; font-weight:600; }
.am-input { width:100%; padding:10px 13px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); color:#F3ECE0; font-size:13.5px; }

.am-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.am-link { font-size:11.5px; color:#9490A8; word-break:break-all; max-width:460px; }
.am-disclaimer { font-size:11px; color:#6b6880; }

.animate-pulse { animation:am-pulse 2.4s ease-in-out infinite; }
@keyframes am-pulse { 0%,100% { opacity:1; } 50% { opacity:.55; } }
`;