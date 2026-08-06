import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Droplets, BookOpen, CircleDot, Brain, PartyPopper, Lock, ArrowLeft, Shuffle, ChevronRight, Heart, Moon, Hand, Flame, Waves } from "lucide-react";

/* ============================================================
   ARCANE ARCADE — Game Hub + Digital Tarot & Fortune Card Draws
   Checkpoint 1 build
   ============================================================ */

/* ---------- secure randomness (crypto Fisher-Yates) ---------- */
function secureRandomInt(maxExclusive) {
  const arr = new Uint32Array(1);
  const limit = 0xFFFFFFFF - (0xFFFFFFFF % maxExclusive);
  let val;
  do {
    crypto.getRandomValues(arr);
    val = arr[0];
  } while (val >= limit);
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
function secureUpright() {
  return secureRandomInt(2) === 0;
}

/* ---------- data: game hub ---------- */
const GAMES = [
  { id: "tarot", name: "Digital Tarot & Fortune Draws", tagline: "Shuffle the arcana, draw your fate", icon: Sparkles, accent: "#7C5CFF", live: true },
  { id: "soulmate", name: "Soulmate Quiz", tagline: "10 questions, one honest match", icon: Heart, accent: "#FF5C8A", live: true, path: "/soulmate-quiz" },
  { id: "fortune", name: "AI Fortune Teller", tagline: "AI-written readings, offline-safe", icon: Moon, accent: "#B45CFF", live: true, path: "/fortune-teller" },
  { id: "palm", name: "Palm Reader", tagline: "Scan your palm, on your device only", icon: Hand, accent: "#22D3EE", live: true, path: "/palm-reader" },
  { id: "elemental", name: "Elemental Matcher", tagline: "Zodiac element × personality compatibility", icon: Flame, accent: "#8B5CF6", live: true, path: "/astro-matcher" },
  { id: "scrying", name: "The Scrying Pool", tagline: "Real water physics, a real oracle", icon: Waves, accent: "#5B8DEF", live: true, path: "/scrying-pool.html" },
  { id: "mood", name: "Mood Ring Oracle", tagline: "One tap, one vibe check", icon: Droplets, accent: "#26C6DA", live: false },
  { id: "study", name: "Study Deck Shuffler", tagline: "Randomised flashcard drills", icon: BookOpen, accent: "#66BB6A", live: false },
  { id: "wheel", name: "Decision Wheel", tagline: "Stop overthinking, spin instead", icon: CircleDot, accent: "#FFA726", live: false },
  { id: "trivia", name: "Trivia Draw", tagline: "Random question, real stakes", icon: Brain, accent: "#EF5350", live: false },
  { id: "dare", name: "Party Dare Cards", tagline: "Fair chaos for group nights", icon: PartyPopper, accent: "#EC407A", live: false },
];

/* ---------- data: tarot decks (skins) ---------- */
const DECKS = [
  { id: "classic", name: "Classic Rider–Waite", desc: "The 1909 original — full illustrated artwork.", art: "classic" },
  { id: "gold", name: "Golden Sigil", desc: "Minimal gold linework on deep ink.", art: "gold" },
  { id: "moonlit", name: "Moonlit Ink", desc: "Engraved indigo, cool and quiet.", art: "moonlit" },
  { id: "botanical", name: "Botanical Folk", desc: "Hand-pressed leaves and vines.", art: "botanical" },
  { id: "neon", name: "Neon Arcade", desc: "High-contrast, made for night owls.", art: "neon" },
];

/* ---------- per-deck image treatment (same art, different look) ---------- */
const DECK_FILTERS = {
  classic: "none",
  gold: "sepia(0.55) saturate(2.2) hue-rotate(-12deg) brightness(0.92) contrast(1.15)",
  moonlit: "grayscale(0.5) sepia(0.35) hue-rotate(175deg) saturate(2) brightness(0.85)",
  botanical: "sepia(0.45) hue-rotate(55deg) saturate(1.7) brightness(0.95) contrast(1.05)",
  neon: "grayscale(0.3) invert(0.85) hue-rotate(260deg) saturate(3) contrast(1.15)",
};

const WIKI_FILE = (filename) => `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`;

/* ---------- data: starter deck (7 verified Major Arcana) ---------- */
const CARDS = [
  {
    id: 0, name: "The Fool", roman: "0",
    img: WIKI_FILE("RWS_Tarot_00_Fool.jpg"),
    upright: "A leap of faith. Fresh starts, open road, nothing pinned down yet.",
    reversed: "Hesitation dressed up as caution. You already know the next step.",
    genz: "Main character energy — send the text, book the flight.",
    flag: "green",
  },
  {
    id: 1, name: "The Magician", roman: "I",
    img: WIKI_FILE("RWS_Tarot_01_Magician.jpg"),
    upright: "You have every tool you need. Focus turns intention into result.",
    reversed: "Talent without follow-through. The plan is real, the discipline isn't yet.",
    genz: "You've got the receipts and the skills — stop doubting the plan.",
    flag: "green",
  },
  {
    id: 2, name: "The High Priestess", roman: "II",
    img: WIKI_FILE("RWS_Tarot_02_High_Priestess.jpg"),
    upright: "Quiet knowing. The answer is intuitive, not loud.",
    reversed: "Ignoring a gut feeling because the facts look fine on paper.",
    genz: "Your gut already texted you back. Read it.",
    flag: "green",
  },
  {
    id: 3, name: "The Empress", roman: "III",
    img: WIKI_FILE("RWS_Tarot_03_Empress.jpg"),
    upright: "Abundance, warmth, something growing steadily under your care.",
    reversed: "Burnout from giving without refilling your own cup.",
    genz: "You're pouring for everyone else — pour yourself a cup too.",
    flag: "green",
  },
  {
    id: 4, name: "The Emperor", roman: "IV",
    img: WIKI_FILE("RWS_Tarot_04_Emperor.jpg"),
    upright: "Structure and steady authority. A boundary that actually holds.",
    reversed: "Control for control's sake. Rigidity where flexibility was needed.",
    genz: "Structure is the vibe right now, not spontaneity.",
    flag: "red",
  },
  {
    id: 5, name: "The Hierophant", roman: "V",
    img: WIKI_FILE("RWS_Tarot_05_Hierophant.jpg"),
    upright: "Tradition, mentorship, a system worth learning before you break it.",
    reversed: "Rules followed out of habit, not because they still make sense.",
    genz: "Ask the person who's already done this before you freestyle it.",
    flag: "green",
  },
  {
    id: 6, name: "The Lovers", roman: "VI",
    img: WIKI_FILE("RWS_Tarot_06_Lovers.jpg"),
    upright: "A real choice, made with someone, that actually aligns your values.",
    reversed: "Mismatch dressed up as chemistry. The values don't line up yet.",
    genz: "Chemistry ≠ compatibility. Check both before you commit.",
    flag: "red",
  },
];

/* ============================================================
   ROOT
   ============================================================ */
export default function ArcaneArcade() {
  const [view, setView] = useState("hub"); // "hub" | "tarot"

  return (
    <div className="aa-root">
      <style>{CSS}</style>
      {view === "hub" ? (
        <Hub onEnter={(id) => id === "tarot" && setView("tarot")} />
      ) : (
        <TarotGame onExit={() => setView("hub")} />
      )}
    </div>
  );
}

/* ============================================================
   HUB
   ============================================================ */
function Hub({ onEnter }) {
  return (
    <div className="hub">
      <header className="hub-nav">
        <div className="brand">
          <Sparkles size={20} />
          <span>My Fortune</span>
        </div>
        <nav>
          <a>Games</a><a>How it works</a><a>About</a>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">A cabinet of fair, well‑made mini games</p>
        <h1>Every draw is honest. Every card is real.</h1>
        <p className="sub">
          Cryptographically shuffled, zero ads, zero accounts required. Pick a game below —
          the first one, Tarot, is ready to play.
        </p>
      </section>

      <section className="grid">
        {GAMES.map((g) => (
          <GameCard key={g.id} game={g} onEnter={() => onEnter(g.id)} />
        ))}
      </section>

      <SeoSection />
      <FaqSection />
      <Footer />
    </div>
  );
}

function SeoSection() {
  return (
    <section className="seo-content">
      <h2>What is My Fortune?</h2>
      <p>
        My Fortune is a free collection of browser-based fortune and compatibility games —
        no downloads, no accounts, and no hidden costs. Everything runs directly in your
        browser using client-side JavaScript, which means your answers, your photos, and
        your results stay on your own device unless you explicitly choose to share them
        through a link.
      </p>
      <p>
        The idea behind My Fortune is simple: fortune-telling apps online are often either
        cheap random-number generators dressed up with mystical branding, or paid apps that
        ask for an account before you've even seen what they do. My Fortune tries to do
        better on both counts. Every game uses a genuine, explainable algorithm — whether
        that's a cryptographically secure shuffle for the Tarot deck, cosine similarity
        between two personality vectors in the Soulmate Quiz, real zodiac trigon element
        theory combined with your actual answers in the Elemental Matcher, or an honest
        two-buffer wave physics simulation powering The Scrying Pool. Nothing here is a
        black box; if you're curious how a particular result was generated, the logic is
        consistent and repeatable, not arbitrary.
      </p>
      <p>
        The current lineup includes <strong>Digital Tarot &amp; Fortune Draws</strong>, a
        five-deck tarot experience using real 1909 Pamela Colman Smith illustrations; the{" "}
        <strong>Soulmate Quiz</strong>, a ten-question compatibility test you can take solo,
        pass-and-play with a partner, or send as a shareable challenge link; the{" "}
        <strong>AI Fortune Teller</strong>, which pairs AI-generated one-line predictions
        with a genuinely offline fallback so it never leaves you stuck; the{" "}
        <strong>Palm Reader</strong>, which uses real on-device hand-landmark detection to
        scan your actual palm shape rather than guessing from a random photo; the{" "}
        <strong>Elemental Matcher</strong>, combining zodiac element compatibility with a
        real personality vector; and <strong>The Scrying Pool</strong>, a physically
        simulated water ripple oracle with synthesized ambient sound and draggable ritual
        relics. More games are being added regularly.
      </p>
      <p>
        Every game supports at least one multiplayer mode — either Pass &amp; Play on a
        single device, or a Destiny Link you can send to a friend on another device, so
        they can see how their result compares to yours without either of you needing to
        sign up for anything. Results can usually be saved as an image and shared directly
        to social media.
      </p>
      <p>
        My Fortune is built for entertainment. None of the predictions, compatibility
        scores, or readings are scientifically validated, and nothing here should be used
        to make real decisions about your relationships, health, career, or finances. What
        it is meant to be is a genuinely fun, fast, and fair way to pass a few minutes —
        whether you're curious what the cards say, testing compatibility with a partner, or
        just seeing what rises to the surface of the scrying pool.
      </p>
    </section>
  );
}

const FAQ_ITEMS = [
  { q: "Is My Fortune actually free?", a: "Yes, completely. There are no accounts, subscriptions, paywalls, or hidden costs. The site runs entirely client-side with no backend to pay for." },
  { q: "Do I need to sign up or log in?", a: "No. None of the games on My Fortune require an account, email address, or personal information to play." },
  { q: "Is my data stored anywhere?", a: "No servers are involved. Some games use your browser's localStorage to remember which questions you've already seen so repeat visits feel fresh — that data stays on your device and is never transmitted anywhere." },
  { q: "Does the Palm Reader upload my photo?", a: "No. Your photo is captured and analyzed entirely on-device using your browser's camera or file picker. It is never uploaded to a server, ever." },
  { q: "How are the results actually generated?", a: "Each game uses a real, documented algorithm — cryptographically secure shuffling, cosine similarity between personality vectors, zodiac element compatibility theory, or genuine wave physics — rather than arbitrary randomness." },
  { q: "Can I play with a friend who isn't next to me?", a: "Most games include a shareable 'Destiny Link' that encodes your result into the URL. When your friend opens it, they can complete their own reading and see a side-by-side comparison." },
  { q: "Are the fortunes or compatibility scores real predictions?", a: "No — My Fortune is built purely for entertainment. Nothing on this site is scientifically validated and it shouldn't be used to make real decisions." },
  { q: "What devices and browsers are supported?", a: "Any modern browser on desktop or mobile. Some features, like the Palm Reader's camera scan, require camera permission and a secure (HTTPS) connection." },
];

function FaqSection() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return (
    <section className="faq-content">
      <h2>Frequently asked questions</h2>
      <div className="faq-list">
        {FAQ_ITEMS.map((item, i) => (
          <details key={i} className="faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        <a href="/about">About Us</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms &amp; Conditions</a>
        <a href="/contact">Contact Us</a>
      </div>
      <p className="footer-copy">My Fortune is built for entertainment purposes only. &copy; {new Date().getFullYear()} My Fortune.</p>
    </footer>
  );
}

function GameCard({ game, onEnter }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const Icon = game.icon;

  function handleMove(e) {
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -8, y: px * 8 });
  }
  function handleLeave() {
    setTilt({ x: 0, y: 0 });
  }

  const Tag = game.live && game.path ? "a" : "button";

  return (
    <Tag
      ref={ref}
      href={game.live && game.path ? game.path : undefined}
      className={"card" + (game.live ? "" : " locked")}
      style={{ "--accent": game.accent, transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={() => game.live && !game.path && onEnter()}
    >
      <span className="card-glow" />
      <div className="card-top">
        <span className="card-icon"><Icon size={26} /></span>
        {game.live ? <span className="badge live">Live</span> : <span className="badge soon"><Lock size={11} /> Soon</span>}
      </div>
      <h3>{game.name}</h3>
      <p>{game.tagline}</p>
      <span className="card-cta">
        {game.live ? <>Play now <ChevronRight size={15} /></> : "In the works"}
      </span>
    </Tag>
  );
}

/* ============================================================
   TAROT GAME
   ============================================================ */
function TarotGame({ onExit }) {
  const [stage, setStage] = useState("deck"); // deck -> spread -> draw
  const [deck, setDeck] = useState(DECKS[0]);
  const [spread, setSpread] = useState(1);
  const [order, setOrder] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [shuffling, setShuffling] = useState(false);

  function startShuffle() {
    setShuffling(true);
    setRevealed([]);
    setTimeout(() => {
      const shuffledCards = secureShuffle(CARDS).slice(0, spread).map((c) => ({
        ...c,
        upright: secureUpright() ? "up" : "down",
      }));
      setOrder(shuffledCards);
      setShuffling(false);
    }, 900);
  }

  function reveal(i) {
    if (revealed.includes(i)) return;
    setRevealed([...revealed, i]);
  }

  return (
    <div className="tarot">
      <header className="tarot-nav">
        <button className="back" onClick={onExit}><ArrowLeft size={16} /> Hub</button>
        <div className="brand small"><Sparkles size={16} /> Tarot & Fortune Draws</div>
        <span className="deck-tag" style={{ opacity: stage === "deck" ? 0 : 1 }}>{deck.name}</span>
      </header>

      {stage === "deck" && (
        <DeckPicker
          onPick={(d) => { setDeck(d); setStage("spread"); }}
        />
      )}

      {stage === "spread" && (
        <SpreadPicker
          onBack={() => setStage("deck")}
          onPick={(n) => { setSpread(n); setStage("draw"); }}
        />
      )}

      {stage === "draw" && (
        <DrawTable
          deck={deck}
          spread={spread}
          order={order}
          revealed={revealed}
          shuffling={shuffling}
          onShuffle={startShuffle}
          onReveal={reveal}
          onNewSpread={() => { setStage("spread"); setOrder([]); setRevealed([]); }}
        />
      )}
    </div>
  );
}

function DeckPicker({ onPick }) {
  return (
    <div className="stage">
      <p className="eyebrow">Step 1 of 3</p>
      <h2>Choose your deck</h2>
      <p className="sub">Every deck draws from the same 22 Major Arcana — only the artwork changes.</p>
      <div className="deck-row">
        {DECKS.map((d) => (
          <button key={d.id} className="deck-card" onClick={() => onPick(d)}>
            <span className={"deck-face art-" + d.art}>
              <img
                src={CARDS[0].img}
                alt=""
                loading="lazy"
                style={{ filter: DECK_FILTERS[d.art] }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </span>
            <h4>{d.name}</h4>
            <p>{d.desc}</p>
            <span className="select-btn">Select deck</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SpreadPicker({ onPick, onBack }) {
  return (
    <div className="stage">
      <p className="eyebrow">Step 2 of 3</p>
      <h2>Choose your spread</h2>
      <div className="spread-row">
        <button className="spread-card" onClick={() => onPick(1)}>
          <span className="spread-count">1</span>
          <h4>Single Card</h4>
          <p>One clear answer to one clear question.</p>
        </button>
        <button className="spread-card" onClick={() => onPick(3)}>
          <span className="spread-count">3</span>
          <h4>Past · Present · Future</h4>
          <p>A short arc — where you were, where you are, where you're headed.</p>
        </button>
      </div>
      <button className="ghost-btn" onClick={onBack}>Back to decks</button>
    </div>
  );
}

function DrawTable({ deck, spread, order, revealed, shuffling, onShuffle, onReveal, onNewSpread }) {
  const labels = spread === 3 ? ["Past", "Present", "Future"] : ["Your card"];
  const started = order.length > 0;
  const [imgErrors, setImgErrors] = useState({});
  function handleImgError(i) {
    setImgErrors((prev) => ({ ...prev, [i]: true }));
  }

  return (
    <div className="stage">
      <p className="eyebrow">Step 3 of 3</p>
      <h2>{started ? "Tap each card to reveal" : "Ready when you are"}</h2>
      <p className="sub">Shuffle uses your browser's crypto RNG — a true, unbiased cut of the deck.</p>

      {!started && (
        <button className={"shuffle-btn" + (shuffling ? " shuffling" : "")} onClick={onShuffle} disabled={shuffling}>
          <Shuffle size={18} /> {shuffling ? "Shuffling…" : "Shuffle & draw"}
        </button>
      )}

      {started && (
        <>
          <div className="draw-row">
            {order.map((card, i) => (
              <div key={i} className="draw-slot">
                <span className="slot-label">{labels[i]}</span>
                <button
                  className={"tarot-card" + (revealed.includes(i) ? " flipped" : "") + " art-" + deck.art}
                  onClick={() => onReveal(i)}
                >
                  <div className="tarot-card-inner">
                    <div className="tarot-back" />
                    <div className={"tarot-front" + (card.upright === "down" ? " reversed" : "")}>
                      {imgErrors[i] ? (
                        <span className="face-roman">{card.roman}</span>
                      ) : (
                        <img
                          src={card.img}
                          alt={card.name}
                          loading="lazy"
                          style={{ filter: DECK_FILTERS[deck.art] }}
                          onError={() => handleImgError(i)}
                        />
                      )}
                      <span className="face-name">{card.name}{card.upright === "down" ? " (Reversed)" : ""}</span>
                    </div>
                  </div>
                </button>
                {revealed.includes(i) && (
                  <div className="meaning">
                    <p>{card.upright === "down" ? card.reversed : card.upright}</p>
                    <p className="genz">"{card.genz}"</p>
                    <span className={"flag " + card.flag}>{card.flag === "green" ? "🟩 Green flag" : "🚩 Worth a pause"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {revealed.length === order.length && (
            <button className="ghost-btn" onClick={onNewSpread}>Draw again</button>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Manrope:wght@400;500;600;700&display=swap');

.aa-root{ font-family:'Manrope',sans-serif; background:#0B0B14; color:#F3ECE0; min-height:100vh; }
.aa-root *{ box-sizing:border-box; }
h1,h2,h3,h4{ font-family:'Cinzel',serif; margin:0; font-weight:700; }
button{ font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }

/* ---------- hub ---------- */
.hub{ max-width:1160px; margin:0 auto; padding:24px 28px 80px; }
.hub-nav{ display:flex; align-items:center; justify-content:space-between; padding:8px 0 40px; }
.brand{ display:flex; align-items:center; gap:8px; font-family:'Cinzel',serif; font-weight:700; letter-spacing:.03em; color:#E8C766; }
.brand.small{ font-size:14px; }
.hub-nav nav{ display:flex; gap:28px; }
.hub-nav nav a{ color:#9490A8; font-size:14px; }

.hero{ padding:40px 0 56px; text-align:left; max-width:640px; }
.eyebrow{ text-transform:uppercase; letter-spacing:.14em; font-size:11.5px; color:#7C5CFF; margin:0 0 14px; font-weight:700; }
.hero h1{ font-size:40px; line-height:1.15; color:#F3ECE0; margin-bottom:16px; }
.sub{ color:#9490A8; font-size:15px; line-height:1.6; }

.grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
@media(max-width:860px){ .grid{ grid-template-columns:repeat(2,1fr);} }
@media(max-width:560px){ .grid{ grid-template-columns:1fr; } }

.card{ position:relative; text-align:left; background:linear-gradient(180deg,#14131f,#100f19); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:22px; transition:box-shadow .25s ease, border-color .25s ease; overflow:hidden; }
.card:hover{ border-color:var(--accent); box-shadow:0 18px 40px -12px rgba(0,0,0,.6), 0 0 0 1px var(--accent) inset, 0 0 24px -4px var(--accent); }
.card.locked{ opacity:.55; cursor:default; }
.card.locked:hover{ border-color:rgba(255,255,255,.08); box-shadow:none; }
.card-glow{ position:absolute; inset:-40% -40% auto auto; width:160px; height:160px; background:radial-gradient(circle,var(--accent) 0%, transparent 70%); opacity:.18; pointer-events:none; }
.card-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
.card-icon{ color:var(--accent); display:inline-flex; padding:10px; border-radius:12px; background:rgba(255,255,255,.04); animation:float 3.4s ease-in-out infinite; }
@keyframes float{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-5px);} }
.badge{ font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; padding:4px 9px; border-radius:99px; display:flex; align-items:center; gap:4px; font-weight:700; }
.badge.live{ background:rgba(124,92,255,.18); color:#B3A2FF; }
.badge.soon{ background:rgba(255,255,255,.06); color:#8B8FA3; }
.card h3{ font-size:17.5px; color:#F3ECE0; margin-bottom:6px; line-height:1.3; }
.card p{ color:#9490A8; font-size:13.5px; line-height:1.5; margin-bottom:18px; }
.card-cta{ display:inline-flex; align-items:center; gap:4px; font-size:13px; font-weight:700; color:var(--accent); }

/* ---------- premium buttons ---------- */
.shuffle-btn, .select-btn, .ghost-btn{ font-weight:700; }
.shuffle-btn{ display:inline-flex; align-items:center; gap:10px; margin-top:8px; padding:14px 28px; border-radius:99px; background:linear-gradient(135deg,#E8C766,#C9A227); color:#1a1408; font-size:15px; box-shadow:0 10px 30px -8px rgba(201,162,39,.5); transition:transform .15s ease; }
.shuffle-btn:hover{ transform:translateY(-2px); }
.shuffle-btn.shuffling{ opacity:.75; }
.ghost-btn{ margin-top:22px; padding:11px 22px; border-radius:99px; border:1px solid rgba(255,255,255,.18); color:#F3ECE0; font-size:13.5px; }
.ghost-btn:hover{ border-color:#E8C766; color:#E8C766; }

/* ---------- tarot shell ---------- */
.tarot{ max-width:1080px; margin:0 auto; padding:20px 24px 90px; }
.tarot-nav{ display:flex; align-items:center; justify-content:space-between; padding:6px 0 30px; }
.back{ display:flex; align-items:center; gap:6px; color:#9490A8; font-size:13.5px; }
.back:hover{ color:#E8C766; }
.deck-tag{ color:#7C5CFF; font-size:12.5px; font-weight:700; letter-spacing:.03em; transition:opacity .2s; }

.stage{ text-align:center; padding-top:10px; }
.stage h2{ font-size:28px; margin:6px 0 10px; }
.stage .sub{ margin:0 auto 34px; }

/* deck picker */
.deck-row{ display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }
.deck-card{ width:168px; background:#14131f; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:16px; text-align:center; transition:.2s; }
.deck-card:hover{ border-color:#7C5CFF; transform:translateY(-4px); box-shadow:0 16px 30px -12px rgba(124,92,255,.4); }
.deck-face{ display:block; position:relative; width:100%; height:150px; border-radius:10px; margin-bottom:12px; overflow:hidden; }
.deck-face img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top center; }
.deck-face::after{ content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.55) 100%); }
.deck-card h4{ font-size:14px; margin-bottom:5px; }
.deck-card p{ font-size:11.5px; color:#9490A8; line-height:1.4; min-height:44px; }
.select-btn{ display:inline-block; margin-top:10px; font-size:11px; padding:7px 14px; border-radius:99px; background:rgba(124,92,255,.16); color:#B3A2FF; }

.art-classic{ background:linear-gradient(160deg,#2b2440,#100f19); }
.art-gold{ background:repeating-linear-gradient(45deg,#3a2f10,#3a2f10 6px,#241d09 6px,#241d09 12px); border:1px solid #C9A227; }
.art-moonlit{ background:radial-gradient(circle at 30% 20%,#2b3a66,#0b0e1a 70%); }
.art-botanical{ background:linear-gradient(160deg,#1f3320,#0f1a10); }
.art-neon{ background:#0b0b14; border:1px solid #ff4fd8; box-shadow:inset 0 0 20px rgba(255,79,216,.35); }

/* spread picker */
.spread-row{ display:flex; gap:20px; justify-content:center; flex-wrap:wrap; }
.spread-card{ width:230px; background:#14131f; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:24px 18px; transition:.2s; }
.spread-card:hover{ border-color:#E8C766; transform:translateY(-4px); }
.spread-count{ font-family:'Cinzel',serif; font-size:30px; color:#E8C766; display:block; margin-bottom:10px; }
.spread-card h4{ font-size:15px; margin-bottom:6px; }
.spread-card p{ font-size:12.5px; color:#9490A8; line-height:1.5; }

/* draw table */
.draw-row{ display:flex; gap:26px; justify-content:center; flex-wrap:wrap; }
.draw-slot{ width:170px; }
.slot-label{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:#7C5CFF; margin-bottom:10px; font-weight:700; }
.tarot-card{ width:170px; height:270px; perspective:1000px; display:block; }
.tarot-card-inner{ position:relative; width:100%; height:100%; transition:transform .6s cubic-bezier(.2,.8,.2,1); transform-style:preserve-3d; border-radius:14px; }
.tarot-card.flipped .tarot-card-inner{ transform:rotateY(180deg); }
.tarot-back, .tarot-front{ position:absolute; inset:0; border-radius:14px; backface-visibility:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; }
.tarot-back{ background:linear-gradient(160deg,#2b2440,#100f19); border:1px solid rgba(232,199,102,.5); }
.tarot-back::after{ content:'✦'; color:#E8C766; font-size:26px; }
.tarot-front{ transform:rotateY(180deg); background:#14131f; border:1px solid #E8C766; padding:10px; text-align:center; }
.tarot-front img{ width:100%; height:190px; object-fit:cover; border-radius:8px; margin-bottom:8px; }
.tarot-front.reversed img{ transform:rotate(180deg); }
.face-roman{ font-family:'Cinzel',serif; font-size:38px; color:#E8C766; margin-bottom:10px; }
.face-name{ font-size:12px; font-weight:700; line-height:1.3; }

.meaning{ margin-top:14px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px; text-align:left; }
.meaning p{ font-size:12.5px; color:#DCD8E8; line-height:1.5; margin:0 0 8px; }
.meaning .genz{ color:#9490A8; font-style:italic; }
.flag{ display:inline-block; font-size:11px; padding:3px 9px; border-radius:99px; background:rgba(255,255,255,.05); }

/* ---------- SEO content, FAQ, footer ---------- */
.seo-content{ max-width:760px; margin:70px auto 0; }
.seo-content h2{ font-size:24px; color:#F3ECE0; margin-bottom:18px; }
.seo-content p{ color:#B7B3C7; font-size:14.5px; line-height:1.8; margin-bottom:16px; }
.seo-content strong{ color:#E8C766; font-weight:700; }

.faq-content{ max-width:760px; margin:60px auto 0; }
.faq-content h2{ font-size:24px; color:#F3ECE0; margin-bottom:18px; }
.faq-list{ display:flex; flex-direction:column; gap:10px; }
.faq-item{ background:#14131f; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:16px 18px; }
.faq-item summary{ cursor:pointer; font-weight:700; font-size:14.5px; color:#F3ECE0; list-style:none; }
.faq-item summary::-webkit-details-marker{ display:none; }
.faq-item summary::before{ content:'+'; color:#E8C766; margin-right:10px; font-weight:700; }
.faq-item[open] summary::before{ content:'\\2212'; }
.faq-item p{ margin:12px 0 0; color:#9490A8; font-size:13.5px; line-height:1.6; }

.site-footer{ max-width:1160px; margin:70px auto 0; padding:28px 0 10px; border-top:1px solid rgba(255,255,255,.08); text-align:center; }
.footer-links{ display:flex; gap:24px; justify-content:center; flex-wrap:wrap; margin-bottom:14px; }
.footer-links a{ color:#9490A8; font-size:13px; text-decoration:none; }
.footer-links a:hover{ color:#E8C766; }
.footer-copy{ color:#6b6880; font-size:11.5px; }
`;
