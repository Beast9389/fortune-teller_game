import React, { useState, useRef, useEffect } from "react";
import {
  Camera, Upload, Hand, ScanLine, Heart, Users, Sparkles,
  Percent, Hash, Hourglass, TrendingUp, GraduationCap, Star, Plane,
  Crown, Share2, Download, RotateCcw, Palette, CheckCircle2, Loader2,
} from "lucide-react";

/* ============================================================
   PALM READER & FUTURE PREDICTOR — v2
   Real hand detection via MediaPipe HandLandmarker (client-side,
   no server). Capture is only allowed once an actual hand is
   detected in frame, and the saved photo is cropped tightly to
   the hand's bounding box — no background, no other body parts.
   Readings are derived from real finger/palm proportions, not
   arbitrary pixel color, then seeded into Mulberry32 for the
   playful categorical predictions (soulmate initial, luck, etc).
   ============================================================ */

// ---------- Mulberry32 ----------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function bucket(value, lowMax, midMax) { return value < lowMax ? "low" : value < midMax ? "mid" : "high"; }

// ---------- MediaPipe HandLandmarker (lazy singleton, loaded once) ----------
let landmarkerPromise = null;
function ensureLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
    })();
  }
  return landmarkerPromise;
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// ---------- real geometry from detected landmarks ----------
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function computePalmProfile(lm) {
  const wrist = lm[0], thumbBase = lm[1], thumbTip = lm[4];
  const indexBase = lm[5], indexTip = lm[8];
  const middleBase = lm[9], middleTip = lm[12];
  const ringBase = lm[13], ringTip = lm[16];
  const pinkyBase = lm[17], pinkyTip = lm[20];
  const palmLength = dist(wrist, middleBase) || 0.001;
  const palmWidth = dist(indexBase, pinkyBase) || 0.001;
  const avgFinger = (dist(indexBase, indexTip) + dist(middleBase, middleTip) + dist(ringBase, ringTip) + dist(pinkyBase, pinkyTip)) / 4;
  const thumbLength = dist(thumbBase, thumbTip);
  const tipSpread = (dist(indexTip, middleTip) + dist(middleTip, ringTip) + dist(ringTip, pinkyTip)) / 3;
  return {
    fingerRatio: avgFinger / palmLength,
    palmRatio: palmWidth / palmLength,
    thumbRatio: thumbLength / palmLength,
    spreadRatio: tipSpread / palmWidth,
  };
}
function seedFromLandmarks(lm) {
  let seed = 0;
  lm.forEach((p, i) => { seed = (seed * 31 + Math.round(p.x * 1000) * 3 + Math.round(p.y * 1000) * 7 + i) | 0; });
  return seed >>> 0;
}
function boundingBoxFromLandmarks(lm, padding = 0.28) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  lm.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  const w = maxX - minX, h = maxY - minY;
  const pad = Math.max(w, h) * padding;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const width = Math.min(1 - x, w + pad * 2);
  const height = Math.min(1 - y, h + pad * 2);
  return { x, y, width, height };
}

// ---------- palm-line readings, driven by real proportions ----------
const READINGS = {
  life: {
    low: "Long and deep — steady endurance, rarely slowed down for long.",
    mid: "Balanced and clear — good rhythm between rest and ambition.",
    high: "Wide-set and strong — high vitality, a life lived at full pace.",
  },
  heart: {
    low: "Short and direct — you love practically, actions over words.",
    mid: "Curved and warm — affectionate, but you guard your heart a little.",
    high: "Long, reaching toward the index finger — idealistic, deeply romantic.",
  },
  head: {
    low: "Tightly set — focused, methodical thinking.",
    mid: "Well-balanced — equally at home with logic and imagination.",
    high: "Wide and sloping — creative, independent-minded, thinks outside the frame.",
  },
  fate: {
    low: "Faint but present — your path bends with circumstance, not fixed destiny.",
    mid: "Steady and unbroken — a clear sense of direction most of your life.",
    high: "Deep and strong — strong will, self-made success.",
  },
};

// ---------- data pools ----------
const GENDERS = ["Male", "Female", "Non-binary"];
const AGE_BRACKETS = ["13-19", "20-29", "30-39", "40-49", "50+"];
const MEETING_LOCATIONS = ["at college or university", "through mutual friends", "at work", "while travelling", "at a wedding or family event", "online, somewhere unexpected", "at the gym", "in your own neighbourhood", "through a shared hobby"];
const MARRIAGE_TYPES = ["a love marriage", "an arranged marriage that turns into real love", "a slow-burn — friends first, everything after"];
const CHILDREN_OPTIONS = ["one — a daughter", "one — a son", "two, a boy and a girl", "twins", "three, close in age", "none by choice, and a full life anyway"];
const GRANDCHILDREN_OPTIONS = ["a houseful at every holiday", "a close, small circle", "one who takes after you more than anyone expects", "twins who keep you young"];
const COLORS = ["Emerald Green", "Deep Violet", "Burnt Gold", "Ocean Teal", "Rose Red", "Midnight Blue", "Sunset Orange"];
const TRAVEL_DESTINIES = ["Japan", "Italy", "Iceland", "Portugal", "New Zealand", "Morocco", "Peru", "Vietnam", "Norway"];
const EXAM_OUTCOMES = ["Distinction is well within reach if you keep this pace", "Steady, solid results — trust the work you've put in", "A real jump forward is coming, especially if you push the next few weeks"];
const HIDDEN_TALENTS = ["a gift for making people feel at ease", "a sharper eye for detail than you give yourself credit for", "real talent in something creative you haven't taken seriously yet", "a natural pull toward leading, even if you don't feel ready"];
const LEGACY_LINES = ["being the one who kept everyone together", "a piece of advice you gave that someone never forgot", "starting something that outlasted you", "being remembered as endlessly generous with your time"];

function generateFortune(seed, ageBracket, palmProfile) {
  const rng = mulberry32(seed);
  const weddingMin = 22 + Math.floor(rng() * 9);
  const currentYear = new Date().getFullYear();

  const fortune = {
    weddingAgeRange: `${weddingMin}-${weddingMin + 3}`,
    marriageType: pick(rng, MARRIAGE_TYPES),
    soulmateInitial: String.fromCharCode(65 + Math.floor(rng() * 26)),
    meetingLocation: pick(rng, MEETING_LOCATIONS),
    familyPrediction: ageBracket === "50+" ? pick(rng, GRANDCHILDREN_OPTIONS) : pick(rng, CHILDREN_OPTIONS),
    familyLabel: ageBracket === "50+" ? "Grandchildren" : "Children",
    lifespanRange: `${80 + Math.floor(rng() * 8)}-${92 + Math.floor(rng() * 6)}`,
    careerBreakthroughYear: currentYear + 1 + Math.floor(rng() * 7),
    luckToday: 42 + Math.floor(rng() * 57),
    luckyColor: pick(rng, COLORS),
    luckyNumber: 1 + Math.floor(rng() * 98),
  };

  if (ageBracket === "13-19") {
    fortune.examOutcome = pick(rng, EXAM_OUTCOMES);
    fortune.hiddenTalent = pick(rng, HIDDEN_TALENTS);
  } else if (ageBracket === "50+") {
    fortune.legacyLine = pick(rng, LEGACY_LINES);
  } else {
    fortune.travelDestiny = pick(rng, TRAVEL_DESTINIES);
  }

  if (palmProfile) {
    fortune.lifeLineReading = READINGS.life[bucket(palmProfile.palmRatio, 0.72, 0.88)];
    fortune.heartLineReading = READINGS.heart[bucket(palmProfile.fingerRatio, 0.72, 0.95)];
    fortune.headLineReading = READINGS.head[bucket(palmProfile.spreadRatio, 0.55, 0.72)];
    fortune.fateLineReading = READINGS.fate[bucket(palmProfile.thumbRatio, 0.36, 0.48)];
  }

  fortune.vector = [rng(), rng(), rng(), rng()];
  return fortune;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ---------- try/catch + shape-validated Destiny Link decode ----------
function parseDestinyHash() {
  try {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const raw = params.get("state");
    if (!raw) return null;
    const decoded = JSON.parse(atob(raw));
    if (!Array.isArray(decoded.v) || decoded.v.length !== 4) return null;
    if (!decoded.v.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return {
      v: decoded.v,
      n: typeof decoded.n === "string" ? decoded.n.slice(0, 40) : "A friend",
      s: typeof decoded.s === "string" ? decoded.s.slice(0, 1) : "?",
      w: typeof decoded.w === "string" ? decoded.w.slice(0, 20) : "unknown",
    };
  } catch (err) {
    console.warn("Corrupt or tampered destiny link, ignoring:", err);
    return null;
  }
}
function encodeDestinyLink(fortune, nickname) {
  const payload = btoa(JSON.stringify({ v: fortune.vector, n: nickname || "A friend", s: fortune.soulmateInitial, w: fortune.weddingAgeRange }));
  return `${window.location.origin}${window.location.pathname}#state=${payload}`;
}

// ---------- stylized palm lines, drawn through real detected points when available ----------
function PalmLines({ seed, landmarks }) {
  if (landmarks && landmarks.length >= 21) {
    const P = (i) => ({ x: landmarks[i].x * 300, y: landmarks[i].y * 300 });
    const wrist = P(0), thumbBase = P(1), indexBase = P(5), middleBase = P(9), pinkyBase = P(17);
    const heart = `M${indexBase.x} ${indexBase.y} Q${middleBase.x} ${middleBase.y - 12} ${pinkyBase.x} ${pinkyBase.y}`;
    const head = `M${thumbBase.x + 8} ${thumbBase.y + 18} Q${middleBase.x} ${middleBase.y + 26} ${pinkyBase.x - 8} ${pinkyBase.y + 14}`;
    const life = `M${thumbBase.x} ${thumbBase.y} Q${thumbBase.x - 26} ${(thumbBase.y + wrist.y) / 2} ${wrist.x - 8} ${wrist.y}`;
    const fate = `M${wrist.x} ${wrist.y} Q${wrist.x + 4} ${(wrist.y + middleBase.y) / 2} ${middleBase.x} ${middleBase.y}`;
    return (
      <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full pointer-events-none">
        <g fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
          <path d={heart} /><path d={head} /><path d={life} /><path d={fate} />
        </g>
      </svg>
    );
  }
  const rng = mulberry32((seed || 42) + 99);
  const jitter = () => (rng() - 0.5) * 30;
  return (
    <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full pointer-events-none">
      <g fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
        <path d={`M60 ${140 + jitter()} Q150 ${120 + jitter()} 250 ${150 + jitter()}`} />
        <path d={`M50 ${190 + jitter()} Q150 ${210 + jitter()} 240 ${175 + jitter()}`} />
        <path d={`M150 ${260 + jitter()} Q160 ${160 + jitter()} 150 ${60 + jitter()}`} />
        <path d={`M100 ${250 + jitter()} Q110 ${150 + jitter()} 90 ${70 + jitter()}`} />
      </g>
    </svg>
  );
}

export default function PalmReader() {
  const [step, setStep] = useState("intro");
  const [mode, setMode] = useState("solo");
  const [player, setPlayer] = useState(1);
  const [gender, setGender] = useState(null);
  const [ageBracket, setAgeBracket] = useState(null);
  const [nickname, setNickname] = useState("");
  const [captured, setCaptured] = useState([null, null]);
  const [landmarksNorm, setLandmarksNorm] = useState([null, null]);
  const [fortunes, setFortunes] = useState([null, null]);
  const [incoming, setIncoming] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [modelStatus, setModelStatus] = useState("idle"); // idle | loading | ready | error
  const [scanningLabel, setScanningLabel] = useState("Reading your palm…");
  const [copiedLink, setCopiedLink] = useState("");

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const rafRef = useRef(null);
  const rawLandmarksRef = useRef(null);

  useEffect(() => {
    const found = parseDestinyHash();
    if (found) setIncoming(found);
    return () => { stopCamera(); cancelDetectionLoop(); };
  }, []);

  function stopCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  }
  function cancelDetectionLoop() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function drawOverlay(landmarks) {
    const canvas = overlayRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.clientWidth; canvas.height = video.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;
    ctx.strokeStyle = "#22D3EE"; ctx.lineWidth = 2; ctx.fillStyle = "#E8C766";
    HAND_CONNECTIONS.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height);
      ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height);
      ctx.stroke();
    });
    landmarks.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  async function detectionTick() {
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      try {
        const landmarker = await ensureLandmarker();
        const result = landmarker.detectForVideo(video, performance.now());
        const lm = result.landmarks && result.landmarks[0] ? result.landmarks[0] : null;
        rawLandmarksRef.current = lm;
        setHandDetected((prev) => (!!lm !== prev ? !!lm : prev));
        drawOverlay(lm);
      } catch {
        // transient detection error — just skip this frame
      }
    }
    rafRef.current = requestAnimationFrame(detectionTick);
  }

  async function startCamera() {
    setCameraError(null);
    setModelStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraActive(true);
      await ensureLandmarker();
      setModelStatus("ready");
      cancelDetectionLoop();
      rafRef.current = requestAnimationFrame(detectionTick);
    } catch (err) {
      setModelStatus("error");
      setCameraError("Couldn't access the camera or load hand detection — you can upload a photo instead.");
    }
  }

  function cropAndEncode(source, naturalW, naturalH, lm) {
    const bbox = boundingBoxFromLandmarks(lm);
    const sx = bbox.x * naturalW, sy = bbox.y * naturalH, sw = bbox.width * naturalW, sh = bbox.height * naturalH;
    const canvas = document.createElement("canvas");
    const outSize = 480;
    canvas.width = outSize; canvas.height = outSize;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outSize, outSize);
    const cropLandmarks = lm.map((p) => ({ x: (p.x - bbox.x) / bbox.width, y: (p.y - bbox.y) / bbox.height }));
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), cropLandmarks };
  }

  function captureFromVideo() {
    const video = videoRef.current;
    const lm = rawLandmarksRef.current;
    if (!video || !lm) return;
    cancelDetectionLoop();
    const { dataUrl, cropLandmarks } = cropAndEncode(video, video.videoWidth, video.videoHeight, lm);
    const palmProfile = computePalmProfile(lm);
    const seed = seedFromLandmarks(lm);
    stopCamera();
    onImageReady(dataUrl, cropLandmarks, palmProfile, seed);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        try {
          setModelStatus("loading");
          const landmarker = await ensureLandmarker();
          setModelStatus("ready");
          const result = landmarker.detectForVideo(img, performance.now());
          const lm = result.landmarks && result.landmarks[0] ? result.landmarks[0] : null;
          if (!lm) {
            setCameraError("No hand detected in that photo — try a clearer, well-lit shot of just your palm.");
            return;
          }
          const { dataUrl, cropLandmarks } = cropAndEncode(img, img.naturalWidth, img.naturalHeight, lm);
          const palmProfile = computePalmProfile(lm);
          const seed = seedFromLandmarks(lm);
          onImageReady(dataUrl, cropLandmarks, palmProfile, seed);
        } catch {
          setCameraError("Hand detection failed to load — check your connection and try again.");
          setModelStatus("error");
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function onImageReady(dataUrl, cropLandmarks, palmProfile, seed) {
    const idx = player - 1;
    setCaptured((prev) => { const next = [...prev]; next[idx] = dataUrl; return next; });
    setLandmarksNorm((prev) => { const next = [...prev]; next[idx] = cropLandmarks; return next; });
    setStep("scanning");
    try { if ("vibrate" in navigator) navigator.vibrate([80, 40, 80]); } catch {}
    setScanningLabel("Reading your palm lines…");

    setTimeout(() => {
      const fortune = generateFortune(seed, ageBracket, palmProfile);
      setFortunes((prev) => { const next = [...prev]; next[idx] = fortune; return next; });
      if (mode === "pass" && player === 1) setStep("pass-handoff");
      else if (mode === "pass" && player === 2) setStep("pass-result");
      else if (incoming) setStep("destiny-result");
      else setStep("result");
    }, 1800);
  }

  function beginReading(chosenMode) {
    setMode(chosenMode); setPlayer(1);
    setCaptured([null, null]); setLandmarksNorm([null, null]); setFortunes([null, null]);
    setStep("profile");
  }
  function goToScan() { setStep("scan"); }
  function startPlayerTwo() { setPlayer(2); setStep("profile"); }

  function reset() {
    stopCamera(); cancelDetectionLoop();
    window.history.replaceState({}, "", window.location.pathname);
    setIncoming(null); setMode("solo"); setPlayer(1);
    setGender(null); setAgeBracket(null);
    setCaptured([null, null]); setLandmarksNorm([null, null]); setFortunes([null, null]);
    setStep("intro");
  }

  async function downloadCard() {
    const card = document.getElementById("result-card");
    if (card && window.html2canvas) {
      const canvas = await window.html2canvas(card, { useCORS: true, backgroundColor: "#100f19" });
      const link = document.createElement("a");
      link.download = "palm-reading.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  }
  function shareDestiny() {
    const link = encodeDestinyLink(fortunes[0], nickname);
    setCopiedLink(link);
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  return (
    <div className="relative min-h-screen">
      <style>{CSS}</style>
      <div className="pr-glow pr-glow-1" />
      <div className="pr-glow pr-glow-2" />
      <div className="relative max-w-3xl mx-auto px-5 py-6 min-h-screen flex flex-col">
        <header className="flex items-center justify-between py-2 mb-6">
          <a href="/" className="pr-back">← Hub</a>
          <div className="pr-brand"><Hand size={16} /> Palm Reader</div>
        </header>

        {step === "intro" && <IntroScreen incoming={incoming} onSolo={() => beginReading("solo")} onPass={() => beginReading("pass")} onAcceptDestiny={() => beginReading("solo")} />}

        {step === "profile" && (
          <ProfileScreen
            playerLabel={mode === "pass" ? `Player ${player} — ` : ""}
            gender={gender} setGender={setGender}
            ageBracket={ageBracket} setAgeBracket={setAgeBracket}
            nickname={nickname} setNickname={setNickname}
            showNickname={player === 1}
            onContinue={goToScan}
          />
        )}

        {step === "scan" && (
          <ScanScreen
            videoRef={videoRef} overlayRef={overlayRef}
            cameraActive={cameraActive} cameraError={cameraError}
            handDetected={handDetected} modelStatus={modelStatus}
            onStartCamera={startCamera} onCapture={captureFromVideo}
            onUploadClick={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef} onFileChange={handleFileUpload}
          />
        )}

        {step === "scanning" && <ScanningScreen image={captured[player - 1]} landmarks={landmarksNorm[player - 1]} label={scanningLabel} />}

        {step === "result" && fortunes[0] && (
          <ResultScreen fortune={fortunes[0]} image={captured[0]} landmarks={landmarksNorm[0]} onDownload={downloadCard} onShare={shareDestiny} onReset={reset} copiedLink={copiedLink} />
        )}
        {step === "pass-handoff" && <HandoffScreen onNext={startPlayerTwo} />}
        {step === "pass-result" && fortunes[0] && fortunes[1] && (
          <DuoResultScreen f1={fortunes[0]} f2={fortunes[1]} label1="Player 1" label2="Player 2" onDownload={downloadCard} onReset={reset} />
        )}
        {step === "destiny-result" && fortunes[0] && incoming && (
          <DuoResultScreen f1={fortunes[0]} f2={{ vector: incoming.v, soulmateInitial: incoming.s, weddingAgeRange: incoming.w }} label1="You" label2={incoming.n} onDownload={downloadCard} onReset={reset} />
        )}
      </div>
    </div>
  );
}

/* ============================================================ SCREENS ============================================================ */
function IntroScreen({ incoming, onSolo, onPass, onAcceptDestiny }) {
  if (incoming) {
    return (
      <section className="pr-center">
        <p className="pr-eyebrow">{incoming.n} shared their reading</p>
        <h1 className="pr-h1">Scan your palm to see how your fates line up.</h1>
        <button className="pr-btn-gold" onClick={onAcceptDestiny}>Begin your reading</button>
      </section>
    );
  }
  return (
    <section className="pr-center">
      <p className="pr-eyebrow">On-device · nothing uploaded, ever</p>
      <h1 className="pr-h1">What does your palm already know?</h1>
      <p className="pr-sub">Real hand detection scans just your palm — no background, no guesswork. Everything runs in your browser.</p>
      <div className="pr-mode-grid">
        <button className="pr-mode-card" onClick={onSolo}><Hand size={22} /><h3>Solo Reading</h3><p>Just you and your palm.</p></button>
        <button className="pr-mode-card" onClick={onPass}><Users size={22} /><h3>Pass &amp; Play</h3><p>Two people, one device, one compatibility score.</p></button>
      </div>
    </section>
  );
}

function ProfileScreen({ playerLabel, gender, setGender, ageBracket, setAgeBracket, nickname, setNickname, showNickname, onContinue }) {
  const canContinue = gender && ageBracket;
  return (
    <section className="pr-stage">
      <p className="pr-eyebrow">{playerLabel}Step 1 of 2</p>
      <h2 className="pr-h2">A little about you</h2>
      <div className="pr-field">
        <label>Gender</label>
        <div className="pr-chip-row">{GENDERS.map((g) => (<button key={g} className={"pr-chip" + (gender === g ? " active" : "")} onClick={() => setGender(g)}>{g}</button>))}</div>
      </div>
      <div className="pr-field">
        <label>Age bracket</label>
        <div className="pr-chip-row">{AGE_BRACKETS.map((a) => (<button key={a} className={"pr-chip" + (ageBracket === a ? " active" : "")} onClick={() => setAgeBracket(a)}>{a}</button>))}</div>
      </div>
      {showNickname && (
        <div className="pr-field">
          <label>Nickname (optional, shown if you share a Destiny Link)</label>
          <input className="pr-input" maxLength={40} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Sam" />
        </div>
      )}
      <button className="pr-btn-gold" disabled={!canContinue} onClick={onContinue}>Continue to scan</button>
    </section>
  );
}

function ScanScreen({ videoRef, overlayRef, cameraActive, cameraError, handDetected, modelStatus, onStartCamera, onCapture, onUploadClick, fileInputRef, onFileChange }) {
  return (
    <section className="pr-stage">
      <p className="pr-eyebrow">Step 2 of 2</p>
      <h2 className="pr-h2">Scan your palm</h2>
      <p className="pr-sub">Your photo stays on this device — nothing is ever uploaded. Hold your palm flat, fingers slightly spread.</p>

      <div className="pr-scan-frame">
        <video ref={videoRef} className={"pr-video" + (cameraActive ? "" : " hidden")} playsInline muted />
        <canvas ref={overlayRef} className="pr-overlay" />
        {!cameraActive && (
          <svg viewBox="0 0 300 300" className="pr-blueprint">
            <g fill="none" stroke="#22D3EE" strokeWidth="2" opacity="0.5">
              <path d="M100 260V130a50 50 0 01100 0v40" /><path d="M100 260h100" />
              <path d="M60 140Q150 120 240 150" /><path d="M50 190Q150 210 240 175" />
            </g>
          </svg>
        )}
        {cameraActive && (
          <div className={"pr-status" + (handDetected ? " ok" : "")}>
            {handDetected ? <><CheckCircle2 size={14} /> Palm detected</> : <><Loader2 size={14} className="pr-spin" /> Show your palm</>}
          </div>
        )}
      </div>
      {cameraError && <p className="pr-error">{cameraError}</p>}
      {modelStatus === "loading" && <p className="pr-sub" style={{ fontSize: 12 }}>Loading hand detection… (first time only)</p>}

      <div className="pr-scan-actions">
        {!cameraActive ? (
          <button className="pr-btn-outline" onClick={onStartCamera}><Camera size={16} /> Use camera</button>
        ) : (
          <button className="pr-btn-gold" onClick={onCapture} disabled={!handDetected}><ScanLine size={16} /> Capture</button>
        )}
        <button className="pr-btn-outline" onClick={onUploadClick}><Upload size={16} /> Upload photo</button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>
    </section>
  );
}

function ScanningScreen({ image, landmarks, label }) {
  return (
    <section className="pr-center">
      <div className="pr-scanning-frame">
        {image && <img src={image} alt="" className="pr-scan-img" />}
        <div className="pr-laser" />
        <PalmLines landmarks={landmarks} />
      </div>
      <p className="pr-sub mt-4">{label}</p>
    </section>
  );
}

function HandoffScreen({ onNext }) {
  return (
    <section className="pr-center">
      <p className="pr-eyebrow">Player 1 done</p>
      <h1 className="pr-h1">Hand the device to Player 2.</h1>
      <button className="pr-btn-gold" onClick={onNext}>I'm Player 2 — continue</button>
    </section>
  );
}

function ResultRow({ icon: Icon, label, value }) {
  return (
    <div className="pr-row">
      <span className="pr-row-icon"><Icon size={16} /></span>
      <div><p className="pr-row-label">{label}</p><p className="pr-row-value">{value}</p></div>
    </div>
  );
}

function ResultScreen({ fortune, image, landmarks, onDownload, onShare, onReset, copiedLink }) {
  return (
    <section className="pr-center">
      <p className="pr-eyebrow">Your reading</p>
      <div id="result-card" className="pr-card">
        <div className="pr-card-hero">
          {image && <img src={image} alt="" className="pr-card-img" />}
          <PalmLines landmarks={landmarks} />
        </div>
        <div className="pr-card-body">
          {fortune.lifeLineReading && (
            <div className="pr-analysis">
              <p><strong>Life line —</strong> {fortune.lifeLineReading}</p>
              <p><strong>Heart line —</strong> {fortune.heartLineReading}</p>
              <p><strong>Head line —</strong> {fortune.headLineReading}</p>
              <p><strong>Fate line —</strong> {fortune.fateLineReading}</p>
            </div>
          )}
          <ResultRow icon={Heart} label="Marriage" value={`Around age ${fortune.weddingAgeRange} — ${fortune.marriageType}`} />
          <ResultRow icon={Sparkles} label="Soulmate" value={`First initial "${fortune.soulmateInitial}", met ${fortune.meetingLocation}`} />
          <ResultRow icon={Users} label={fortune.familyLabel} value={fortune.familyPrediction} />
          <ResultRow icon={Hourglass} label="A long life ahead" value={`${fortune.lifespanRange} years, full and well-lived`} />
          <ResultRow icon={TrendingUp} label="Career breakthrough" value={`Around ${fortune.careerBreakthroughYear}`} />
          {fortune.examOutcome && <ResultRow icon={GraduationCap} label="Exams" value={fortune.examOutcome} />}
          {fortune.hiddenTalent && <ResultRow icon={Star} label="Hidden talent" value={fortune.hiddenTalent} />}
          {fortune.travelDestiny && <ResultRow icon={Plane} label="Travel destiny" value={fortune.travelDestiny} />}
          {fortune.legacyLine && <ResultRow icon={Crown} label="You'll be remembered for" value={fortune.legacyLine} />}
          <ResultRow icon={Percent} label="Today's luck" value={`${fortune.luckToday}%`} />
          <ResultRow icon={Palette} label="Lucky colour" value={fortune.luckyColor} />
          <ResultRow icon={Hash} label="Lucky number" value={fortune.luckyNumber} />
        </div>
      </div>
      <div className="pr-actions">
        <button className="pr-btn-gold" onClick={onDownload}><Download size={16} /> Save as image</button>
        <button className="pr-btn-outline" onClick={onShare}><Share2 size={16} /> Destiny Link</button>
        <button className="pr-btn-outline" onClick={onReset}><RotateCcw size={16} /> Read again</button>
      </div>
      {copiedLink && <p className="pr-link">{copiedLink}</p>}
      <p className="pr-disclaimer">For entertainment only — a bit of fun, not a real prediction.</p>
    </section>
  );
}

function DuoResultScreen({ f1, f2, label1, label2, onDownload, onReset }) {
  const pct = Math.round(cosineSimilarity(f1.vector, f2.vector) * 100);
  return (
    <section className="pr-center">
      <p className="pr-eyebrow">Compatibility</p>
      <div id="result-card" className="pr-card">
        <div className="pr-card-body">
          <h1 className="pr-match-pct">{pct}% aligned fates</h1>
          <div className="pr-duo-grid">
            <div><h3>{label1}</h3><p className="pr-row-value">Soulmate initial: {f1.soulmateInitial}</p><p className="pr-row-value">Wedding age: {f1.weddingAgeRange}</p></div>
            <div><h3>{label2}</h3><p className="pr-row-value">Soulmate initial: {f2.soulmateInitial}</p><p className="pr-row-value">Wedding age: {f2.weddingAgeRange}</p></div>
          </div>
        </div>
      </div>
      <div className="pr-actions">
        <button className="pr-btn-gold" onClick={onDownload}><Download size={16} /> Save as image</button>
        <button className="pr-btn-outline" onClick={onReset}><RotateCcw size={16} /> Read again</button>
      </div>
      <p className="pr-disclaimer">For entertainment only — a bit of fun, not a real prediction.</p>
    </section>
  );
}

/* ============================================================ STYLES ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap');
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { background:#0B0B14; }
a, button { font-family: 'Manrope', sans-serif; }

.pr-glow { position:fixed; border-radius:999px; filter:blur(100px); pointer-events:none; z-index:0; }
.pr-glow-1 { top:-100px; left:-60px; width:340px; height:340px; background:#8B5CF6; opacity:0.22; }
.pr-glow-2 { bottom:-100px; right:-60px; width:340px; height:340px; background:#22D3EE; opacity:0.16; }

.pr-back { color:#9490A8; font-size:13.5px; text-decoration:none; }
.pr-back:hover { color:#E8C766; }
.pr-brand { display:flex; align-items:center; gap:8px; font-family:'Cinzel',serif; font-weight:700; color:#22D3EE; letter-spacing:.03em; }

.pr-center, .pr-stage { position:relative; z-index:1; flex:1; display:flex; flex-direction:column; align-items:center; text-align:center; gap:22px; padding-top:10px; color:#F3ECE0; font-family:'Manrope',sans-serif; }
.pr-stage { text-align:left; align-items:stretch; }
.pr-eyebrow { text-transform:uppercase; letter-spacing:.14em; font-size:11px; color:#8B5CF6; font-weight:700; margin:0; }
.pr-h1 { font-family:'Cinzel',serif; font-size:30px; font-weight:700; max-width:520px; }
.pr-h2 { font-family:'Cinzel',serif; font-size:24px; font-weight:700; margin:2px 0 4px; }
.pr-sub { color:#9490A8; font-size:14px; max-width:460px; line-height:1.6; }

.pr-mode-grid { display:grid; gap:14px; width:100%; max-width:420px; }
.pr-mode-card { text-align:left; padding:18px 20px; border-radius:16px; background:rgba(255,255,255,.04); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,.1); color:#F3ECE0; transition:.2s; }
.pr-mode-card:hover { border-color:#22D3EE; transform:translateY(-3px); }
.pr-mode-card h3 { font-weight:700; margin:8px 0 2px; font-size:15px; }
.pr-mode-card p { color:#9490A8; font-size:12.5px; }

.pr-field { margin-bottom:18px; }
.pr-field label { display:block; font-size:12.5px; color:#9490A8; margin-bottom:8px; font-weight:600; }
.pr-chip-row { display:flex; gap:8px; flex-wrap:wrap; }
.pr-chip { padding:9px 16px; border-radius:99px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); color:#F3ECE0; font-size:13px; transition:.15s; }
.pr-chip.active { border-color:#22D3EE; background:rgba(34,211,238,.15); color:#22D3EE; }
.pr-input { width:100%; padding:11px 14px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); color:#F3ECE0; font-size:14px; }

.pr-btn-gold { display:inline-flex; align-items:center; gap:8px; justify-content:center; padding:13px 26px; border-radius:99px; background:linear-gradient(135deg,#E8C766,#C9A227); color:#1a1408; font-weight:700; font-size:14.5px; box-shadow:0 10px 28px -8px rgba(201,162,39,.5); transition:transform .15s; align-self:flex-start; }
.pr-btn-gold:hover { transform:translateY(-2px); }
.pr-btn-gold:disabled { opacity:.4; cursor:not-allowed; transform:none; }
.pr-btn-outline { display:inline-flex; align-items:center; gap:8px; justify-content:center; padding:11px 20px; border-radius:99px; border:1px solid rgba(255,255,255,.18); color:#F3ECE0; font-size:13.5px; font-weight:600; transition:.15s; }
.pr-btn-outline:hover { border-color:#22D3EE; color:#22D3EE; }

.pr-scan-frame { position:relative; width:280px; height:280px; border-radius:20px; overflow:hidden; background:#14131f; border:1px solid rgba(255,255,255,.1); align-self:center; }
.pr-video { width:100%; height:100%; object-fit:cover; }
.pr-video.hidden { display:none; }
.pr-overlay { position:absolute; inset:0; width:100%; height:100%; }
.pr-blueprint { position:absolute; inset:0; width:100%; height:100%; animation:pr-pulse 2.4s ease-in-out infinite; }
@keyframes pr-pulse { 0%,100% { opacity:.35; } 50% { opacity:.8; } }
.pr-status { position:absolute; bottom:10px; left:10px; right:10px; display:flex; align-items:center; gap:6px; justify-content:center; padding:6px 10px; border-radius:99px; background:rgba(0,0,0,.55); font-size:11.5px; color:#F0B94D; }
.pr-status.ok { color:#4ADE80; }
.pr-spin { animation:spin 1.2s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.pr-error { color:#FF8FA3; font-size:12.5px; text-align:center; }
.pr-scan-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.hidden { display:none; }

.pr-scanning-frame { position:relative; width:260px; height:260px; border-radius:20px; overflow:hidden; background:#14131f; border:1px solid rgba(34,211,238,.4); }
.pr-scan-img { width:100%; height:100%; object-fit:cover; }
.pr-laser { position:absolute; left:0; right:0; height:3px; background:linear-gradient(90deg, transparent, #22D3EE, transparent); box-shadow:0 0 16px 4px rgba(34,211,238,.7); animation:pr-scan 1.8s linear infinite; }
@keyframes pr-scan { 0% { top:0; } 100% { top:100%; } }

.pr-card { width:100%; max-width:420px; border-radius:20px; overflow:hidden; background:rgba(255,255,255,.04); backdrop-filter:blur(18px); border:1px solid rgba(139,92,246,.35); text-align:left; }
.pr-card-hero { position:relative; height:190px; background:#14131f; }
.pr-card-img { width:100%; height:100%; object-fit:cover; opacity:.92; }
.pr-card-body { padding:20px; display:flex; flex-direction:column; gap:14px; }
.pr-analysis { background:rgba(139,92,246,.08); border:1px solid rgba(139,92,246,.25); border-radius:12px; padding:12px 14px; font-size:12.5px; line-height:1.6; color:#DCD8E8; }
.pr-analysis p { margin:0 0 4px; }
.pr-analysis strong { color:#B9A6FF; }
.pr-row { display:flex; align-items:flex-start; gap:12px; }
.pr-row-icon { width:32px; height:32px; border-radius:10px; background:rgba(139,92,246,.15); color:#8B5CF6; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pr-row-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#9490A8; font-weight:700; margin:0; }
.pr-row-value { font-size:14px; color:#F3ECE0; margin:2px 0 0; line-height:1.4; }
.pr-match-pct { font-family:'Cinzel',serif; font-size:32px; text-align:center; margin:0 0 16px; }
.pr-duo-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; text-align:center; }
.pr-duo-grid h3 { font-size:14px; margin-bottom:8px; }

.pr-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.pr-link { font-size:11.5px; color:#9490A8; word-break:break-all; max-width:420px; }
.pr-disclaimer { font-size:11px; color:#6b6880; }
`;