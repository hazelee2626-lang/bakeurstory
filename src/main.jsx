import { useState, useEffect, useRef } from "react";

async function sGet(k, fb) {
  try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : fb; }
  catch (e) { return fb; }
}
async function sSet(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch (e) { /* */ } }

function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  const yd = new Date(now); yd.setDate(now.getDate() - 1);
  if (dayKey(ts) === dayKey(now.getTime())) return "오늘";
  if (dayKey(ts) === dayKey(yd.getTime())) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function fmtClock(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDate(ts) { const d = new Date(ts); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; }
async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}
function parseJson(t) {
  const c = t.replace(/```json|```/g, "").trim();
  return JSON.parse(c.slice(c.indexOf("{"), c.lastIndexOf("}") + 1));
}
function extractSvg(t) { const m = t.match(/<svg[\s\S]*<\/svg>/); return m ? m[0] : null; }
function voiceSpec(v) {
  const len = [{id:"short",label:"짧게 · 600~800자",spec:"공백 포함 600~800자"},{id:"mid",label:"보통 · 900~1200자",spec:"공백 포함 900~1200자"}].find(l => l.id === v.length) || {id:"mid",label:"보통",spec:"공백 포함 900~1200자"};
  return `하젤의 글 스타일(반드시 지킬 것):
- ${v.memo}
- 주 독자: ${v.reader}
- 톤: ${v.tone} / 말투: ${v.speech}
- 사진 없이도 읽히는 글. 묘사로 장면을 보여준다.
- 한국어. 분량은 ${len.spec}.
- 식당은 반드시 "K BBQ"라고만 표기하고 실명은 절대 쓰지 않는다.`;
}

const COLORS = {
  bg: "#0a0807",
  glass: "rgba(28,22,16,.55)",
  glassHi: "rgba(42,33,23,.7)",
  border: "rgba(255,176,90,.14)",
  borderHi: "rgba(255,176,90,.42)",
  text: "#f3ead9",
  soft: "#b5a890",
  dim: "#6e6353",
  amber: "#ffb054",
  flame: "#ff7a2f",
  deep: "#e8541f",
};

function EmberCanvas({ stateRef }) {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let W, H, raf;
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const parts = [];
    function spawn(burst) {
      const heat = stateRef.current.heat;
      parts.push({
        x: W * (0.5 + (Math.random() - 0.5) * (burst ? 0.9 : 0.7)),
        y: H + 10,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.4 + Math.random() * (burst ? 1.6 : 0.8) + heat * 0.5),
        r: 0.6 + Math.random() * (burst ? 2.4 : 1.7),
        life: 0,
        max: 240 + Math.random() * 240,
        hue: 18 + Math.random() * 26,
        flicker: Math.random() * Math.PI * 2,
      });
    }
    function tick() {
      ctx.clearRect(0, 0, W, H);
      const brewing = stateRef.current.brewing;
      const heat = stateRef.current.heat;
      const targetCount = brewing ? 170 : 26 + Math.round(heat * 55);
      const rate = brewing ? 6 : 1;
      for (let i = 0; i < rate; i++) if (parts.length < targetCount) spawn(brewing);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        p.x += p.vx + Math.sin((p.life + p.flicker * 60) * 0.02) * 0.3;
        p.y += p.vy;
        if (p.life > p.max || p.y < -20) { parts.splice(i, 1); continue; }
        const fade = 1 - p.life / p.max;
        const fl = 0.55 + 0.45 * Math.sin(p.life * 0.15 + p.flicker);
        const a = fade * fl * (brewing ? 0.9 : 0.65);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},95%,${58 + fl * 12}%,${a})`;
        ctx.shadowColor = `hsla(${p.hue},100%,55%,${a * 0.9})`;
        ctx.shadowBlur = 8 + p.r * 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [stateRef]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} aria-hidden="true" />;
}

export default function App() {
  const [tab, setTab] = useState(0);
  const [frags, setFrags] = useState([]);
  const [epis, setEpis] = useState([]);
  const [voice, setVoice] = useState({ memo: "솔직한 실수와 시행착오를 숨기지 않는 공감형 스토리텔링. 자기비하 유머가 아니라 진심 어린 공개를 통한 공감. 구체적인 한 장면으로 시작해 작은 깨달음으로 끝낸다.", reader: "한인 자영업자, 그리고 노션과 기록을 배우고 싶은 사람들", tone: "담백하게", speech: "해요체", length: "mid" });
  const [input, setInput] = useState("");
  const [ph] = useState(["방금 무슨 일이 있었나요? 한 줄이면 충분해요", "지금 스친 생각을 불씨로 남겨두세요", "오늘 가장 오래 남을 것 같은 장면 하나", "들은 말을, 들은 그대로"][Math.floor(Math.random() * 4)]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [brewing, setBrewing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [baked, setBaked] = useState(null);
  const [draftEdit, setDraftEdit] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [err, setErr] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const resultRef = useRef(null);
  const emberState = useRef({ brewing: false, heat: 0 });

  const included = frags.filter(f => f.included);
  useEffect(() => {
    emberState.current.brewing = brewing || drawing || converting;
    emberState.current.heat = Math.min(1, included.length / 8);
  }, [brewing, drawing, converting, included.length]);

  useEffect(() => {
    (async () => {
      let f = await sGet("ember-frags", null) || [];
      let e = await sGet("ember-epis", null) || [];
      let v = await sGet("ember-voice", null);
      if (!v) v = voice;
      setFrags(f);
      setEpis(e);
      setVoice(v);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) sSet("ember-frags", frags); }, [frags, loaded]);
  useEffect(() => { if (loaded) sSet("ember-epis", epis); }, [epis, loaded]);
  useEffect(() => { if (loaded) sSet("ember-voice", voice); }, [voice, loaded]);

  function toast(m) { setToastMsg(m); setTimeout(() => setToastMsg(""), 2300); }

  function addFrag() {
    const text = input.trim();
    if (!text) return;
    const ts = Date.now();
    setFrags(f => [...f, { id: ts + "" + Math.floor(Math.random() * 999), text, ts, included: true }]);
    setInput("");
  }

  function saveEdit(id) {
    const t = editText.trim();
    if (t) setFrags(f => f.map(x => x.id === id ? { ...x, text: t } : x));
    setEditingId(null);
  }

  const groups = [];
  frags.slice().sort((a, b) => b.ts - a.ts).forEach(f => {
    const k = dayKey(f.ts);
    let g = groups.find(x => x.key === k);
    if (!g) { g = { key: k, label: dayLabel(f.ts), items: [] }; groups.push(g); }
    g.items.push(f);
  });
  groups.forEach(g => g.items.sort((a, b) => a.ts - b.ts));

  async function bake(withFeedback) {
    if (!included.length) return;
    setBrewing(true);
    setErr("");
    const fragText = included.slice().sort((a, b) => a.ts - b.ts).map(f => `[${dayLabel(f.ts)} ${fmtClock(f.ts)}] ${f.text}`).join("\n");
    const fb = withFeedback && baked ? `\n\n이전 초안:\n${baked.draft}\n\n하젤의 피드백: "${feedback}"\n피드백을 충실히 반영해 다시 써라.` : "";
    const prompt = `너는 '하젤'의 블로그 초안 작가다. 하젤은 미국 휴스턴에서 한국 BBQ 식당("K BBQ")을 운영하는 매니저이자, 노션 교육 커뮤니티를 운영하고 디지털 제품을 만드는 사람이다.

${voiceSpec(voice)}

아래는 하젤이 순간순간 기록한 조각들이다 (시간순):
${fragText}${fb}

조각들을 읽고 스스로 주제를 발견해 한 편의 글로 엮어라. 여러 주제가 섞여 있으면 가장 이야기가 되는 흐름을 중심으로 엮고, 어울리지 않는 조각은 과감히 버려라.

반드시 아래 JSON으로만 응답하라. 다른 텍스트 없이:
{"titles":["제목후보1","제목후보2","제목후보3"],"draft":"본문 전체"}`;
    try {
      const p = parseJson(await callClaude(prompt));
      if (!p.titles || !p.draft) throw new Error("bad");
      setBaked({ titles: p.titles, pickedIdx: 0, draft: p.draft, fragIds: included.map(f => f.id), svg: null, insta: null, threads: null });
      setDraftEdit(false);
      setFeedback("");
      setTimeout(() => resultRef.current && resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) {
      setErr("불이 잠시 꺼졌어요 — 한 번 더 시도해 주세요");
    } finally {
      setBrewing(false);
    }
  }

  async function drawCover() {
    if (!baked) return;
    setDrawing(true);
    setErr("");
    const prompt = `다음 글의 표지 일러스트를 SVG 코드로 그려라.

글 제목: ${baked.titles[baked.pickedIdx]}
글 요약 장면: ${baked.draft.slice(0, 300)}

규칙:
- viewBox="0 0 800 500", 미니멀한 플랫 일러스트, 단순한 도형, 여백을 살린 구도
- 색은 이 팔레트만: #0a0807(배경), #1c1610, #ffb054, #ff7a2f, #f3ead9, #6e6353
- 글자(text 요소) 금지. 장면만.
- 밤의 따뜻한 불빛 같은 분위기.
- 응답은 <svg>로 시작해 </svg>로 끝나는 코드만. 다른 텍스트 절대 금지.`;
    try {
      const svg = extractSvg(await callClaude(prompt));
      if (!svg) throw new Error("no svg");
      setBaked(b => ({ ...b, svg }));
    } catch (e) {
      setErr("그림이 잘 구워지지 않았어요 — 다시 시도해 주세요");
    } finally {
      setDrawing(false);
    }
  }

  function downloadSvg(svg, title) {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "표지") + ".svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function convertChannels() {
    if (!baked) return;
    setConverting(true);
    setErr("");
    const prompt = `아래 글을 두 채널용으로 변환하라.

${voiceSpec(voice)}

원문 제목: ${baked.titles[baked.pickedIdx]}
원문:
${baked.draft}

1) insta: 인스타그램 캡션. 첫 줄은 스크롤을 멈추게 하는 한 문장. 전체 350~500자, 끝에 글과 어울리는 해시태그 5개.
2) threads: 스레드용. 짧은 단문 호흡, 250자 이내, 해시태그 없음.

반드시 JSON으로만: {"insta":"...","threads":"..."}`;
    try {
      const p = parseJson(await callClaude(prompt));
      setBaked(b => ({ ...b, insta: p.insta, threads: p.threads }));
    } catch (e) {
      setErr("변환에 실패했어요 — 다시 시도해 주세요");
    } finally {
      setConverting(false);
    }
  }

  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || "복사했어요"); } catch (e) { toast("복사가 막혔어요 — 길게 눌러 직접 복사해 주세요"); }
  }

  function archive() {
    if (!baked) return;
    setEpis(e => [{ id: Date.now() + "", title: baked.titles[baked.pickedIdx], draft: baked.draft, svg: baked.svg, insta: baked.insta, threads: baked.threads, ts: Date.now() }, ...e]);
    setFrags(f => f.filter(x => !baked.fragIds.includes(x.id)));
    setBaked(null);
    toast("서랍에 넣고 화로를 정리했어요");
  }

  const heat = Math.min(1, included.length / 8);

  return (
    <div className="hearth-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hahmlet:wght@300;500;800&family=IBM+Plex+Sans+KR:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        :root{ color-scheme: dark; }
        .hearth-root{
          min-height:100vh; color:${COLORS.text};
          font-family:'IBM Plex Sans KR',sans-serif;
          background:
            radial-gradient(90% 55% at 50% 108%, rgba(255,110,40,${0.14 + heat * 0.16}), transparent 62%),
            radial-gradient(120% 80% at 50% -20%, rgba(255,176,90,.05), transparent 55%),
            ${COLORS.bg};
          transition: background 1.2s ease;
          padding-bottom:110px; position:relative; overflow-x:hidden;
        }
        .hearth-root *{box-sizing:border-box; -webkit-tap-highlight-color:transparent}
        ::selection{background:rgba(255,122,47,.4)}
        textarea::placeholder{color:#5a5142}
        textarea:focus{border-color:${COLORS.borderHi} !important; box-shadow:0 0 0 3px rgba(255,150,60,.08), 0 8px 30px rgba(255,120,40,.07) !important; outline:none}

        .wrap{max-width:600px;margin:0 auto;padding:0 18px;position:relative;z-index:1}
        .mono{font-family:'JetBrains Mono',monospace}

        @keyframes up{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
        @keyframes upSoft{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .up{animation:up .8s cubic-bezier(.22,1,.36,1) both}
        .d1{animation-delay:.08s}.d2{animation-delay:.16s}.d3{animation-delay:.26s}.d4{animation-delay:.36s}

        .hero{text-align:center;padding:54px 0 8px}
        .hero .kicker{font-size:10px;letter-spacing:.42em;color:${COLORS.dim};text-transform:uppercase}
        .hero h1{
          font-family:'Hahmlet',serif;font-weight:800;font-size:clamp(42px,11vw,58px);
          letter-spacing:.01em;line-height:1.15;margin:14px 0 10px;
          background:linear-gradient(120deg, #f6e7c8 10%, ${COLORS.amber} 45%, ${COLORS.flame} 80%);
          background-size:200% 100%;
          -webkit-background-clip:text;background-clip:text;color:transparent;
          animation:shimmer 6s ease-in-out infinite;
        }
        @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .hero p{font-size:13.5px;color:${COLORS.soft};line-height:1.75;font-weight:400}

        .core{position:relative;height:120px;margin:6px 0 2px;display:flex;align-items:center;justify-content:center}
        .core .orb{
          width:${56 + heat * 36}px;height:${56 + heat * 36}px;border-radius:50%;
          background:radial-gradient(circle at 50% 38%, #ffe3ae, ${COLORS.amber} 35%, ${COLORS.deep} 72%, rgba(232,84,31,0) 100%);
          filter:blur(${1 + heat * 1.5}px) saturate(1.15);
          box-shadow:
            0 0 ${30 + heat * 70}px ${8 + heat * 22}px rgba(255,130,45,${0.18 + heat * 0.3}),
            0 0 ${90 + heat * 140}px ${20 + heat * 40}px rgba(255,90,25,${0.07 + heat * 0.13});
          animation:breath 3.2s ease-in-out infinite;
          transition:width 1s cubic-bezier(.22,1,.36,1), height 1s cubic-bezier(.22,1,.36,1), box-shadow 1s ease;
        }
        @keyframes breath{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        .core .count{
          position:absolute;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.3em;
          color:${COLORS.amber};bottom:-2px;text-shadow:0 0 12px rgba(255,150,60,.5);
        }

        .tabs{position:relative;display:flex;background:${COLORS.glass};backdrop-filter:blur(14px);
          border:1px solid ${COLORS.border};border-radius:99px;padding:5px;margin-top:24px}
        .tab-ind{position:absolute;top:5px;bottom:5px;width:calc((100% - 10px)/3);border-radius:99px;
          background:linear-gradient(120deg,${COLORS.amber},${COLORS.flame});
          box-shadow:0 4px 18px rgba(255,120,40,.35);
          transition:transform .45s cubic-bezier(.34,1.3,.4,1);left:5px}
        .tabbtn{flex:1;position:relative;z-index:1;border:none;background:none;cursor:pointer;
          padding:11px 4px;font-family:inherit;font-size:13.5px;font-weight:600;color:${COLORS.soft};
          transition:color .35s;border-radius:99px}
        .tabbtn.on{color:#1d1208}

        .card{background:${COLORS.glass};backdrop-filter:blur(16px);border:1px solid ${COLORS.border};
          border-radius:22px;padding:18px;transition:border-color .3s, box-shadow .3s, transform .3s}
        .ta{width:100%;background:rgba(12,9,6,.55);border:1px solid ${COLORS.border};border-radius:14px;
          color:${COLORS.text};font-family:'Hahmlet',serif;font-weight:300;font-size:15.5px;padding:14px 16px;
          resize:vertical;line-height:1.85;transition:border-color .3s, box-shadow .3s}

        .btn{border:1px solid ${COLORS.border};background:rgba(255,255,255,.03);color:${COLORS.text};
          border-radius:13px;padding:13px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;
          transition:all .3s cubic-bezier(.22,1,.36,1);position:relative;overflow:hidden;letter-spacing:.02em}
        .btn:hover{border-color:${COLORS.borderHi};transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,120,40,.12)}
        .btn:active{transform:translateY(0) scale(.97)}
        .btn.fire{background:linear-gradient(120deg,${COLORS.amber},${COLORS.flame});border:none;color:#1d1208;font-weight:700;
          box-shadow:0 6px 22px rgba(255,120,40,.3)}
        .btn.fire:hover{box-shadow:0 10px 32px rgba(255,120,40,.45);transform:translateY(-2px)}
        .btn:disabled{opacity:.35;cursor:default;transform:none !important;box-shadow:none !important}
        .flex{display:flex;gap:9px}
        .flex .btn{flex:1}
        .ghost{border:none;background:none;color:${COLORS.dim};font-size:12px;cursor:pointer;padding:3px 7px;
          font-family:inherit;transition:color .25s;font-weight:500}
        .ghost:hover{color:${COLORS.amber}}
        .chip{border:1px solid ${COLORS.border};background:rgba(255,255,255,.03);color:${COLORS.soft};border-radius:99px;
          padding:9px 16px;font-size:12.5px;cursor:pointer;transition:all .3s cubic-bezier(.22,1,.36,1);font-family:inherit;font-weight:500}
        .chip:hover{border-color:${COLORS.borderHi};transform:translateY(-1px)}
        .chip.on{background:linear-gradient(120deg,${COLORS.amber},${COLORS.flame});color:#1d1208;border-color:transparent;font-weight:700;
          box-shadow:0 4px 16px rgba(255,120,40,.3)}

        .bakewrap{position:relative;margin-top:26px;border-radius:20px;padding:1.5px;overflow:hidden;isolation:isolate}
        .bakewrap::before{content:"";position:absolute;inset:-60%;z-index:-1;
          background:conic-gradient(from 0deg, transparent 0 18%, ${COLORS.amber} 28%, ${COLORS.flame} 38%, transparent 50%, transparent 68%, ${COLORS.deep} 80%, transparent 92%);
          animation:spin 3.4s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .bakebtn{width:100%;border:none;border-radius:19px;cursor:pointer;padding:19px 16px;
          background:linear-gradient(120deg, #2a1a0c, #1a0f07);color:${COLORS.text};
          font-family:'Hahmlet',serif;font-weight:800;font-size:18px;letter-spacing:.04em;
          transition:all .3s;position:relative}
        .bakebtn:hover{color:#fff}
        .bakebtn .sub{display:block;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.34em;
          color:${COLORS.amber};margin-top:7px;font-weight:400}
        .bakebtn:disabled{opacity:.45;cursor:default}

        .dayhead{display:flex;align-items:baseline;gap:12px;margin:26px 2px 12px}
        .dayhead b{font-family:'Hahmlet',serif;font-weight:500;font-size:16px;color:${COLORS.text}}
        .dayhead span{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:${COLORS.dim};letter-spacing:.2em}
        .dayhead i{flex:1;border-top:1px solid ${COLORS.border}}
        .frag{display:flex;gap:13px;background:${COLORS.glass};backdrop-filter:blur(12px);
          border:1px solid ${COLORS.border};border-radius:17px;padding:14px 15px;margin-bottom:10px;cursor:pointer;
          transition:all .4s cubic-bezier(.22,1,.36,1);animation:upSoft .55s cubic-bezier(.22,1,.36,1) both}
        .frag:hover{border-color:${COLORS.borderHi};transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.35), 0 4px 18px rgba(255,120,40,.08)}
        .frag.off{opacity:.45}
        .frag.off:hover{opacity:.7}
        .frag .ember{width:9px;height:9px;border-radius:50%;margin-top:7px;flex-shrink:0;transition:all .4s;
          background:radial-gradient(circle at 35% 30%, #ffd9a0, ${COLORS.flame});
          box-shadow:0 0 10px rgba(255,140,50,.8), 0 0 20px rgba(255,110,40,.4)}
        .frag.off .ember{background:#3a322a;box-shadow:none}
        .frag .txt{font-family:'Hahmlet',serif;font-weight:300;font-size:15px;line-height:1.85;flex:1}
        .frag .meta{display:flex;gap:10px;align-items:center;margin-top:7px}
        .frag time{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:${COLORS.dim};letter-spacing:.12em}
        .offnote{font-size:11px;color:${COLORS.amber};opacity:.8}

        .result{margin-top:30px;background:linear-gradient(170deg, rgba(48,34,20,.72), rgba(24,17,11,.78));
          backdrop-filter:blur(20px);border:1px solid ${COLORS.borderHi};border-radius:26px;padding:24px 20px;
          box-shadow:0 24px 70px rgba(0,0,0,.5), 0 0 60px rgba(255,120,40,.07);animation:up .7s cubic-bezier(.22,1,.36,1) both}
        .rk{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.36em;color:${COLORS.amber};margin-bottom:16px}
        .topt{display:block;width:100%;text-align:left;background:rgba(255,255,255,.02);border:1px solid ${COLORS.border};
          border-radius:14px;margin-bottom:9px;padding:13px 16px;cursor:pointer;
          font-family:'Hahmlet',serif;font-weight:500;font-size:17px;line-height:1.55;color:${COLORS.soft};
          transition:all .35s cubic-bezier(.22,1,.36,1)}
        .topt:hover{color:${COLORS.text};transform:translateX(4px)}
        .topt.pick{border-color:${COLORS.borderHi};color:${COLORS.text};
          background:linear-gradient(120deg, rgba(255,176,84,.12), rgba(255,122,47,.07));
          box-shadow:0 4px 20px rgba(255,130,45,.12)}
        .draft{font-family:'Hahmlet',serif;font-weight:300;font-size:15.5px;line-height:2.15;white-space:pre-wrap;margin-top:8px}
        .tools{display:flex;justify-content:space-between;align-items:center;margin:22px 0 12px;padding-top:16px;
          border-top:1px solid ${COLORS.border}}
        .cc{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:${COLORS.dim};letter-spacing:.2em}
        .coverbox{margin:18px 0 10px;border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};
          box-shadow:0 14px 44px rgba(0,0,0,.4)}
        .coverbox svg{display:block;width:100%;height:auto}
        .fbbox{margin-top:24px;background:rgba(255,176,84,.05);border:1px dashed rgba(255,176,90,.25);border-radius:16px;padding:16px}
        .channel{margin-top:12px;background:rgba(255,255,255,.025);border:1px solid ${COLORS.border};border-radius:16px;padding:17px;
          animation:upSoft .5s cubic-bezier(.22,1,.36,1) both}
        .channel h4{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.36em;color:${COLORS.amber};margin:0 0 10px;font-weight:500}
        .channel p{font-size:13.5px;line-height:1.85;white-space:pre-wrap;margin:0 0 12px;color:${COLORS.soft}}

        .epi{background:${COLORS.glass};backdrop-filter:blur(12px);border:1px solid ${COLORS.border};border-radius:19px;
          padding:17px 18px;margin-bottom:11px;transition:all .35s cubic-bezier(.22,1,.36,1);animation:upSoft .5s both}
        .epi:hover{border-color:${COLORS.borderHi};transform:translateY(-2px);box-shadow:0 12px 36px rgba(0,0,0,.4)}
        .epi-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;cursor:pointer}
        .epi-head b{font-family:'Hahmlet',serif;font-weight:500;font-size:15.5px;line-height:1.55}
        .epi-head time{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:${COLORS.dim};white-space:nowrap}
        .acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .55s cubic-bezier(.22,1,.36,1)}
        .acc.open{grid-template-rows:1fr}
        .acc>div{overflow:hidden}

        .errline{margin-top:14px;color:#ff8a5c;font-size:13px;font-weight:500}

        .toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%) translateY(110px) scale(.9);
          background:linear-gradient(120deg,${COLORS.amber},${COLORS.flame});color:#1d1208;font-size:13px;font-weight:700;
          padding:13px 26px;border-radius:99px;transition:all .5s cubic-bezier(.34,1.4,.4,1);z-index:60;
          box-shadow:0 12px 40px rgba(255,120,40,.4)}
        .toast.show{transform:translateX(-50%) translateY(0) scale(1)}

        @media(prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important}}
      `}</style>

      <EmberCanvas stateRef={emberState} />

      <div className="wrap">
        <div className="hero up">
          <div className="kicker mono">Hazel's Story Hearth</div>
          <h1>이야기 화로</h1>
          <p>순간의 불씨를 모아두면, 하루의 끝에 한 편의 글로 타오릅니다</p>
        </div>

        <div className="core up d1">
          <div className="orb" />
          <div className="count">{included.length === 0 ? "EMPTY" : `${included.length} EMBERS`}</div>
        </div>

        <div className="tabs up d2">
          <div className="tab-ind" style={{ transform: `translateX(${tab * 100}%)` }} />
          {["화로", "서랍", "목소리"].map((label, i) => (
            <button key={label} className={"tabbtn" + (tab === i ? " on" : "")}
              onClick={() => { setTab(i); setEditingId(null); }}>{label}</button>
          ))}
        </div>

        {tab === 0 && (<div>
          <div className="card up d3" style={{ marginTop: 22 }}>
            <textarea className="ta" rows={2} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addFrag(); } }}
              placeholder={ph} />
            <button className="btn fire" style={{ width: "100%", marginTop: 11 }} onClick={addFrag} disabled={!input.trim()}>
              불씨 올리기
            </button>
          </div>

          {frags.length === 0 && (
            <div className="card up d4" style={{ marginTop: 14, textAlign: "center", padding: "26px 20px" }}>
              {[
                ["一", "낮 동안, 스치는 순간을 한 줄씩 올려두면"],
                ["二", "하루의 끝, 「굽기」 한 번에 글이 되고"],
                ["三", "블로그 · 인스타 · 스레드로 옮기면 끝"],
              ].map(([n, t]) => (
                <div key={n} style={{ display: "flex", gap: 14, alignItems: "baseline", justifyContent: "center", margin: "11px 0" }}>
                  <span style={{ fontFamily: "'Hahmlet',serif", color: COLORS.amber, fontSize: 14 }}>{n}</span>
                  <span style={{ fontFamily: "'Hahmlet',serif", fontWeight: 300, fontSize: 14, color: COLORS.soft, lineHeight: 1.8 }}>{t}</span>
                </div>
              ))}
            </div>
          )}

          {groups.map(g => (
            <div key={g.key}>
              <div className="dayhead"><b>{g.label}</b><span>{g.items.length} PIECES</span><i /></div>
              {g.items.map((f, i) => (
                <div key={f.id} className={"frag" + (f.included ? "" : " off")} style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => editingId !== f.id && setFrags(fr => fr.map(x => x.id === f.id ? { ...x, included: !x.included } : x))}>
                  <div className="ember" />
                  {editingId === f.id ? (
                    <div style={{ flex: 1 }} onClick={e => e.stopPropagation()}>
                      <textarea className="ta" rows={2} value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                      <div className="flex" style={{ marginTop: 9 }}>
                        <button className="btn fire" onClick={() => saveEdit(f.id)}>저장</button>
                        <button className="btn" onClick={() => setEditingId(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div className="txt">{f.text}</div>
                      <div className="meta">
                        <time>{fmtClock(f.ts)}</time>
                        {!f.included && <span className="offnote">이번 굽기에서 빼둠 — 탭하면 다시 지핌</span>}
                        <div style={{ flex: 1 }} />
                        <button className="ghost" onClick={e => { e.stopPropagation(); setEditingId(f.id); setEditText(f.text); }}>수정</button>
                        <button className="ghost" onClick={e => { e.stopPropagation(); setFrags(fr => fr.filter(x => x.id !== f.id)); }}>끄기</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {frags.length > 0 && (
            <div className="bakewrap">
              <button className="bakebtn" onClick={() => bake(false)} disabled={!included.length || brewing}>
                {brewing ? "굽는 중 —" : "이야기로 굽기"}
                <span className="sub">{brewing ? "THE FIRE IS WORKING" : `${included.length} EMBERS → ONE STORY`}</span>
              </button>
            </div>
          )}
          {err && <div className="errline">{err}</div>}

          {baked && (
            <div className="result" ref={resultRef}>
              <div className="rk">FRESH FROM THE HEARTH — {fmtDate(Date.now())}</div>
              {baked.titles.map((t, i) => (
                <button key={i} className={"topt" + (i === baked.pickedIdx ? " pick" : "")}
                  onClick={() => setBaked(b => ({ ...b, pickedIdx: i }))}>{t}</button>
              ))}

              {baked.svg ? (
                <div>
                  <div className="coverbox" dangerouslySetInnerHTML={{ __html: baked.svg }} />
                  <div className="flex">
                    <button className="btn" onClick={() => downloadSvg(baked.svg, baked.titles[baked.pickedIdx])}>표지 저장 (SVG)</button>
                    <button className="btn" onClick={drawCover} disabled={drawing}>{drawing ? "굽는 중…" : "다르게 그리기"}</button>
                  </div>
                </div>
              ) : (
                <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={drawCover} disabled={drawing}>
                  {drawing ? "🎨 그리는 중…" : "🎨 표지 일러스트 굽기"}
                </button>
              )}

              <div className="tools">
                <span className="cc">{baked.draft.length} CHARS</span>
                <button className="ghost" style={{ color: COLORS.amber, fontWeight: 600 }} onClick={() => setDraftEdit(d => !d)}>
                  {draftEdit ? "편집 끝내기" : "✎ 직접 고치기"}
                </button>
              </div>
              {draftEdit ? (
                <textarea className="ta" rows={14} style={{ lineHeight: 2.1 }} value={baked.draft}
                  onChange={e => setBaked(b => ({ ...b, draft: e.target.value }))} />
              ) : (
                <div className="draft">{baked.draft}</div>
              )}

              <div className="fbbox">
                <div className="rk" style={{ marginBottom: 11 }}>한 줄 피드백으로 다시 굽기</div>
                <div className="flex">
                  <textarea className="ta" rows={1} style={{ minHeight: 48, fontSize: 14 }} value={feedback}
                    onChange={e => setFeedback(e.target.value)} placeholder="예: 도입이 길어. 결말은 더 담백하게" />
                  <button className="btn" style={{ flex: "none" }} onClick={() => feedback.trim() && bake(true)}
                    disabled={brewing || !feedback.trim()}>다시 굽기</button>
                </div>
              </div>

              {(baked.insta || baked.threads) ? (
                <div>
                  {[["INSTAGRAM", baked.insta, "인스타 캡션 복사 완료"], ["THREADS", baked.threads, "스레드 버전 복사 완료"]].map(([name, body, msg], i) => body && (
                    <div key={name} className="channel" style={{ animationDelay: `${i * 0.12}s` }}>
                      <h4>{name}</h4>
                      <p>{body}</p>
                      <button className="btn" style={{ width: "100%" }} onClick={() => copyText(body, msg)}>복사</button>
                    </div>
                  ))}
                </div>
              ) : (
                <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={convertChannels} disabled={converting}>
                  {converting ? "변환 중…" : "📣 인스타 · 스레드 버전 만들기"}
                </button>
              )}

              <div className="flex" style={{ marginTop: 16 }}>
                <button className="btn" onClick={() => copyText(baked.titles[baked.pickedIdx] + "\n\n" + baked.draft, "블로그에 붙여넣기만 하면 끝")}>본문 복사</button>
                <button className="btn fire" onClick={archive}>서랍에 넣기</button>
              </div>
            </div>
          )}
        </div>)}

        {tab === 1 && (
          <div style={{ marginTop: 22 }}>
            {epis.length === 0 && (
              <div className="card up" style={{ textAlign: "center", padding: "50px 20px" }}>
                <div style={{ fontFamily: "'Hahmlet',serif", fontWeight: 500, fontSize: 19, marginBottom: 9 }}>아직 서랍이 비어 있어요</div>
                <div style={{ fontSize: 13, color: COLORS.dim, lineHeight: 1.7 }}>화로에서 첫 이야기를 구워보세요</div>
              </div>
            )}
            {epis.map((ep, i) => (
              <Drawer key={ep.id} ep={ep} delay={i * 0.06} onCopy={copyText} onDownloadSvg={downloadSvg}
                onDelete={() => { setEpis(e => e.filter(x => x.id !== ep.id)); toast("비웠어요"); }} />
            ))}
          </div>
        )}

        {tab === 2 && (
          <div style={{ marginTop: 22 }}>
            <div className="card up">
              <div className="rk">나의 글, 나의 불 조절</div>
              <div style={{ fontSize: 12.5, color: COLORS.soft, lineHeight: 1.8, marginBottom: 13, fontFamily: "'Hahmlet',serif", fontWeight: 300 }}>
                결과가 마음에 들지 않을 때마다 규칙을 한 줄씩 더하세요. 구울수록 화로가 하젤의 목소리를 닮아갑니다.
              </div>
              <textarea className="ta" rows={6} value={voice.memo} onChange={e => setVoice(v => ({ ...v, memo: e.target.value }))} />
            </div>
            <div className="card up d1" style={{ marginTop: 13 }}>
              <div className="rk">이 글을 읽을 사람</div>
              <textarea className="ta" rows={2} value={voice.reader} onChange={e => setVoice(v => ({ ...v, reader: e.target.value }))}
                placeholder="예: 한인 자영업자, 노션 입문자" />
            </div>
            <div className="card up d2" style={{ marginTop: 13 }}>
              <div className="rk">톤</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["담백하게", "따뜻하게", "위트있게", "차분한 전문가"].map(t => <button key={t} className={"chip" + (voice.tone === t ? " on" : "")} onClick={() => setVoice(v => ({ ...v, tone: t }))}>{t}</button>)}
              </div>
              <div className="rk" style={{ marginTop: 20 }}>말투</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["해요체", "합니다체", "반말(에세이체)"].map(s => <button key={s} className={"chip" + (voice.speech === s ? " on" : "")} onClick={() => setVoice(v => ({ ...v, speech: s }))}>{s}</button>)}
              </div>
              <div className="rk" style={{ marginTop: 20 }}>분량</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{id:"short",label:"짧게 · 600~800자"},{id:"mid",label:"보통 · 900~1200자"}].map(l => <button key={l.id} className={"chip" + (voice.length === l.id ? " on" : "")} onClick={() => setVoice(v => ({ ...v, length: l.id }))}>{l.label}</button>)}
              </div>
              <div style={{ fontSize: 11.5, color: COLORS.dim, marginTop: 20, lineHeight: 1.7 }}>모든 설정은 자동 저장되며, 다음 굽기부터 바로 적용돼요.</div>
            </div>
          </div>
        )}
      </div>

      <div className={"toast" + (toastMsg ? " show" : "")}>{toastMsg}</div>
    </div>
  );
}

function Drawer({ ep, delay, onCopy, onDelete, onDownloadSvg }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="epi" style={{ animationDelay: `${delay}s` }}>
      <div className="epi-head" onClick={() => setOpen(o => !o)}>
        <b>{ep.title}</b>
        <time>{fmtDate(ep.ts)}</time>
      </div>
      <div className={"acc" + (open ? " open" : "")}>
        <div>
          <div style={{ paddingTop: 15 }}>
            {ep.svg && <div className="coverbox" style={{ margin: "0 0 13px" }} dangerouslySetInnerHTML={{ __html: ep.svg }} />}
            <div className="draft" style={{ fontSize: 14.5 }}>{ep.draft}</div>
            <div className="flex" style={{ marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => onCopy(ep.title + "\n\n" + ep.draft, "복사했어요")}>본문 복사</button>
              {ep.insta && <button className="btn" onClick={() => onCopy(ep.insta, "인스타 캡션 복사")}>인스타</button>}
              {ep.threads && <button className="btn" onClick={() => onCopy(ep.threads, "스레드 복사")}>스레드</button>}
              {ep.svg && <button className="btn" onClick={() => onDownloadSvg(ep.svg, ep.title)}>표지 저장</button>}
              <button className="btn" style={{ color: "#ff8a5c" }} onClick={onDelete}>삭제</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import ReactDOM from "react-dom/client";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
