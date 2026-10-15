/* bibley-studio.js - Bibley v4 extras (2026-10-14):
   1. Verse Image Maker: turn any verse into a phone wallpaper (1080x1920) or a square post
      (1080x1080). 12 built-in backgrounds drawn on the device (no downloaded images, works
      offline), 4 fonts, alignment, text size. Download or Share.
   2. Memorize mode: hide words step by step, peek by tapping, then a "type it from memory" test
      with a score. Your memory verses are listed with progress.
   3. Page turn animation when changing chapters (buttons, swipe, Next chapter), direction aware.
      On/off in Aa settings; quick fade if the phone asks for reduced motion.
   4. What's new: an updates log shown once per version (X closes it for good until the next update).
   Stored on the device only: "bibley_memorize_v1", "bibley_imagemaker_v1", "bibley_page_anim", "bibley_seen_version".
   No notifications. ASCII only in this file (symbols are written as escapes). */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !FX.ui || !C) { console.warn("Bibley studio: features bridge missing"); return; }
  const { openSheet, closeSheet, toast, h, esc, vname } = FX.ui;
  const BOOKS = C.BOOKS;
  const K_MEM = "bibley_memorize_v1", K_IMG = "bibley_imagemaker_v1", K_ANIM = "bibley_page_anim";
  const LQ = "\u201C", RQ = "\u201D", DOT = "\u00B7";
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("Couldn't save: storage is full"); return false; } };
  const ICON = {
    image: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>',
    brain: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8a3 3 0 0 0 0 5 3 3 0 0 0 3 4.5A3 3 0 0 0 12 19z"/><path d="M12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8a3 3 0 0 1 0 5 3 3 0 0 1-3 4.5A3 3 0 0 1 12 19z"/><path d="M12 5v14"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 8l5-4 5 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  // small deterministic random so a background looks the same every time
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ===================================================================
     1. VERSE IMAGE MAKER
     =================================================================== */
  const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const rad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  function fill(ctx, W, H, style) { ctx.fillStyle = style; ctx.fillRect(0, 0, W, H); }
  function stars(ctx, W, H, n, seed, maxR, alpha) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, s = r() * maxR + .4; ctx.globalAlpha = (r() * .7 + .3) * alpha; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
  function ridge(ctx, W, H, baseY, amp, seed, color, steps) {
    const r = rng(seed); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, baseY);
    const n = steps || 9; let prev = baseY;
    for (let i = 1; i <= n; i++) { const x = W * i / n; const y = baseY - r() * amp + amp * .35; ctx.quadraticCurveTo(x - W / n / 2, Math.min(prev, y) - r() * amp * .5, x, y); prev = y; }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function vignette(ctx, W, H, a) { fill(ctx, W, H, rad(ctx, W / 2, H / 2, Math.min(W, H) * .35, Math.max(W, H) * .8, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0," + a + ")"]])); }

  // Each background: draw(ctx,W,H), ink (verse colour), accent (reference colour), shade (text panel strength)
  const BGS = {
    midnight: { name: "Midnight", ink: "#f3ecda", accent: "#e2c07e", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W * .3, H, [[0, "#1d2747"], [1, "#070b17"]])); fill(c, W, H, rad(c, W * .82, H * .12, 10, W * .9, [[0, "rgba(226,192,126,.30)"], [1, "rgba(226,192,126,0)"]])); stars(c, W, H * .55, 90, 7, 1.6, .7); } },
    sunrise: { name: "Sunrise", ink: "#fffaf0", accent: "#fff0c8", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#2b1f4f"], [.45, "#b2486b"], [.75, "#f08a4b"], [1, "#ffd27a"]])); fill(c, W, H, rad(c, W * .5, H * .78, 10, W * .55, [[0, "rgba(255,240,200,.95)"], [.25, "rgba(255,210,140,.55)"], [1, "rgba(255,180,120,0)"]])); ridge(c, W, H, H * .86, H * .05, 3, "rgba(60,20,50,.55)", 7); ridge(c, W, H, H * .92, H * .04, 9, "rgba(35,12,35,.75)", 6); } },
    ocean: { name: "Ocean", ink: "#f2fbff", accent: "#bfefff", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#0b3d5c"], [.55, "#0e6f8e"], [1, "#062a3f"]])); for (let i = 0; i < 7; i++) { const y = H * (.62 + i * .06); c.strokeStyle = "rgba(255,255,255," + (.10 - i * .01) + ")"; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x / 90 + i) * 14; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); } fill(c, W, H, rad(c, W * .3, H * .18, 10, W * .7, [[0, "rgba(190,240,255,.22)"], [1, "rgba(190,240,255,0)"]])); } },
    forest: { name: "Forest", ink: "#f4f7ee", accent: "#d8e8b0", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#c9d9b4"], [.35, "#6f9a76"], [1, "#16301f"]])); ridge(c, W, H, H * .55, H * .1, 11, "rgba(60,100,75,.55)", 8); ridge(c, W, H, H * .66, H * .1, 21, "rgba(35,70,50,.75)", 10); const r = rng(5); c.fillStyle = "#0f2418"; for (let i = 0; i < 26; i++) { const x = r() * W, b = H * (.78 + r() * .1), th = H * (.12 + r() * .1), tw = th * .28; c.beginPath(); c.moveTo(x, b - th); c.lineTo(x - tw, b); c.lineTo(x + tw, b); c.closePath(); c.fill(); } c.fillRect(0, H * .86, W, H); } },
    galaxy: { name: "Galaxy", ink: "#f6f0ff", accent: "#d9c2ff", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#140b2e"], [1, "#05030e"]])); fill(c, W, H, rad(c, W * .25, H * .3, 10, W * .8, [[0, "rgba(140,80,220,.45)"], [1, "rgba(140,80,220,0)"]])); fill(c, W, H, rad(c, W * .8, H * .7, 10, W * .7, [[0, "rgba(60,120,230,.35)"], [1, "rgba(60,120,230,0)"]])); stars(c, W, H, 260, 42, 1.8, .9); } },
    dusk: { name: "Desert", ink: "#fff7ee", accent: "#ffe0b3", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#3c2f6b"], [.5, "#c56b6b"], [1, "#f2b26b"]])); fill(c, W, H, rad(c, W * .7, H * .62, 10, W * .25, [[0, "rgba(255,236,190,1)"], [.5, "rgba(255,220,160,.5)"], [1, "rgba(255,200,150,0)"]])); ridge(c, W, H, H * .74, H * .04, 13, "#a8584f", 4); ridge(c, W, H, H * .82, H * .05, 17, "#7a3c3f", 3); ridge(c, W, H, H * .9, H * .04, 19, "#4f2533", 3); } },
    mountains: { name: "Mountains", ink: "#ffffff", accent: "#ffe7b8", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#f7c59f"], [.35, "#9fb7d9"], [1, "#2c3e63"]])); ridge(c, W, H, H * .55, H * .16, 31, "rgba(110,135,175,.85)", 6); ridge(c, W, H, H * .66, H * .14, 37, "rgba(70,92,135,.9)", 7); ridge(c, W, H, H * .78, H * .1, 41, "rgba(40,55,90,.95)", 8); ridge(c, W, H, H * .9, H * .06, 47, "#1b2540", 9); } },
    parchment: { name: "Parchment", ink: "#3a2d1f", accent: "#8a6420", light: true, draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#f8f0dc"], [1, "#e6d5b0"]])); const r = rng(77); for (let i = 0; i < 1400; i++) { c.fillStyle = "rgba(120,90,40," + (r() * .06) + ")"; c.fillRect(r() * W, r() * H, 2, 2); } fill(c, W, H, rad(c, W / 2, H / 2, Math.min(W, H) * .3, Math.max(W, H) * .75, [[0, "rgba(120,80,20,0)"], [1, "rgba(120,80,20,.28)"]])); } },
    bokeh: { name: "Glow", ink: "#fff9ef", accent: "#ffd79a", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, W, H, [[0, "#2a1a10"], [1, "#0d0a14"]])); const r = rng(99); const cols = ["255,200,120", "255,150,90", "255,230,170", "200,160,255"]; for (let i = 0; i < 34; i++) { const x = r() * W, y = r() * H, rr = 30 + r() * 120, col = cols[i % 4]; fill(c, W, H, rad(c, x, y, 0, rr, [[0, "rgba(" + col + "," + (.18 + r() * .25) + ")"], [.7, "rgba(" + col + ",.08)"], [1, "rgba(" + col + ",0)"]])); } } },
    aurora: { name: "Aurora", ink: "#f0fff8", accent: "#a8ffd8", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#04121c"], [1, "#0a1f2c"]])); stars(c, W, H * .7, 120, 3, 1.4, .8); [["60,230,160", .30, 0], ["120,120,255", .55, 1.7], ["40,200,220", .42, 3.1]].forEach(([col, y0, ph]) => { for (let k = 0; k < 18; k++) { c.strokeStyle = "rgba(" + col + "," + (.05) + ")"; c.lineWidth = 40 - k * 1.5; c.beginPath(); for (let x = -20; x <= W + 20; x += 24) { const y = H * y0 + Math.sin(x / 160 + ph) * 70 + Math.sin(x / 57 + ph) * 18 + k * 6; x > -20 ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } }); ridge(c, W, H, H * .9, H * .04, 5, "#020a10", 10); } },
    light: { name: "Clean", ink: "#1d2230", accent: "#8a6420", light: true, draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#ffffff"], [1, "#efe9dc"]])); c.strokeStyle = "rgba(138,100,32,.35)"; c.lineWidth = 3; c.strokeRect(54, 54, W - 108, H - 108); } },
    cross: { name: "Cross", ink: "#fbf5e6", accent: "#f0cf8a", draw(c, W, H) { fill(c, W, H, lin(c, 0, 0, 0, H, [[0, "#0d1222"], [1, "#1c1630"]])); const cx = W / 2, cy = H * .2; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.fillStyle = "rgba(240,207,138," + (i % 2 ? .035 : .06) + ")"; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * W * 2, cy + Math.sin(a) * W * 2); c.lineTo(cx + Math.cos(a + .13) * W * 2, cy + Math.sin(a + .13) * W * 2); c.closePath(); c.fill(); } fill(c, W, H, rad(c, cx, cy, 5, W * .5, [[0, "rgba(255,230,170,.55)"], [1, "rgba(255,230,170,0)"]])); const s = Math.min(W, H) * .07; c.fillStyle = "rgba(255,240,210,.9)"; c.fillRect(cx - s * .13, cy - s, s * .26, s * 2.1); c.fillRect(cx - s * .65, cy - s * .45, s * 1.3, s * .26); } }
  };
  const FONTS = {
    classic: { name: "Classic", css: (px) => "600 " + px + "px Fraunces, Georgia, serif", load: "600 60px Fraunces" },
    book: { name: "Book", css: (px) => "400 " + px + "px 'Source Serif 4', Georgia, serif", load: "400 60px 'Source Serif 4'" },
    italic: { name: "Italic", css: (px) => "italic 400 " + px + "px 'Source Serif 4', Georgia, serif", load: "italic 400 60px 'Source Serif 4'" },
    modern: { name: "Modern", css: (px) => "700 " + px + "px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", load: null }
  };
  const SIZES = { wall: { name: "Wallpaper", w: 1080, h: 1920 }, square: { name: "Square", w: 1080, h: 1080 } };
  const IMG_DEF = { bg: "midnight", font: "classic", align: "center", size: 100, format: "wall", mark: true };
  const imgPrefs = () => { const p = Object.assign({}, IMG_DEF, load(K_IMG, {})); if (!BGS[p.bg]) p.bg = IMG_DEF.bg; if (!FONTS[p.font]) p.font = IMG_DEF.font; if (!SIZES[p.format]) p.format = IMG_DEF.format; if (!/^(left|center|right)$/.test(p.align)) p.align = "center"; p.size = Math.max(70, Math.min(140, +p.size || 100)); return p; };

  function wrapLines(ctx, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean), lines = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  async function fontsReady(fontKey) {
    const f = FONTS[fontKey]; const list = ["600 40px Fraunces"]; if (f && f.load) list.push(f.load);
    try { await Promise.race([Promise.all(list.map(x => document.fonts.load(x))), new Promise(r => setTimeout(r, 1500))]); } catch {}
  }
  // Renders verse d = {text, ref, version} onto canvas with options o. Returns the canvas.
  async function renderImage(canvas, d, o) {
    o = Object.assign({}, imgPrefs(), o || {});
    const S = SIZES[o.format], W = S.w, H = S.h, bg = BGS[o.bg], font = FONTS[o.font];
    canvas.width = W; canvas.height = H;
    await fontsReady(o.font);
    const ctx = canvas.getContext("2d");
    ctx.save(); bg.draw(ctx, W, H); ctx.restore(); ctx.globalAlpha = 1;
    // text box: on a wallpaper keep clear of the lock-screen clock (top) and the home bar (bottom)
    const padX = 110, top = o.format === "wall" ? H * .30 : H * .14, bottom = o.format === "wall" ? H * .76 : H * .74;
    const maxW = W - padX * 2;
    const text = LQ + String(d.text || "").trim().replace(/^["\u201C]+|["\u201D]+$/g, "") + RQ;
    const maxPx = Math.round((o.format === "wall" ? 84 : 70) * o.size / 100), minPx = 26;
    let px = maxPx, lines = [], lh = 0;
    for (; px >= minPx; px -= 2) { ctx.font = font.css(px); lines = wrapLines(ctx, text, maxW); lh = px * 1.38; if (lines.length * lh <= bottom - top) break; }
    const blockH = lines.length * lh;
    const x = o.align === "left" ? padX : o.align === "right" ? W - padX : W / 2;
    ctx.textAlign = o.align; ctx.textBaseline = "alphabetic";
    // soft panel behind the words for readability on busy backgrounds
    const y0 = top + (bottom - top - blockH) / 2;
    const panel = rad(ctx, W / 2, y0 + blockH / 2, 10, Math.max(maxW, blockH) * .75, bg.light ? [[0, "rgba(255,255,255,.55)"], [1, "rgba(255,255,255,0)"]] : [[0, "rgba(0,0,0,.42)"], [1, "rgba(0,0,0,0)"]]);
    ctx.fillStyle = panel; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = bg.ink; ctx.font = font.css(px);
    ctx.shadowColor = bg.light ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 2;
    let y = y0 + px;
    for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
    // reference
    const refY = y0 + blockH + Math.max(70, px * .9);
    ctx.shadowBlur = 10; ctx.fillStyle = bg.accent;
    const lineX = o.align === "left" ? padX : o.align === "right" ? W - padX - 90 : W / 2 - 45;
    ctx.fillRect(lineX, refY - Math.max(46, px * .7), 90, 4);
    ctx.font = "600 " + Math.round(Math.max(40, px * .62)) + "px Fraunces, Georgia, serif";
    ctx.fillText(String(d.ref || ""), x, refY + 12);
    if (d.version) { ctx.globalAlpha = .82; ctx.fillStyle = bg.ink; ctx.font = "400 " + Math.round(Math.max(28, px * .4)) + "px 'Source Serif 4', Georgia, serif"; ctx.fillText(vname(d.version), x, refY + 12 + Math.max(50, px * .62)); ctx.globalAlpha = 1; }
    if (o.mark) { ctx.shadowBlur = 0; ctx.globalAlpha = .6; ctx.fillStyle = bg.accent; ctx.textAlign = "center"; ctx.font = "600 28px Fraunces, Georgia, serif"; ctx.fillText("B I B L E Y", W / 2, H - (o.format === "wall" ? 150 : 70)); ctx.globalAlpha = 1; }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    return canvas;
  }
  const fileName = (d, o) => (String(d.ref || "verse").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "verse") + "-" + (o.format === "wall" ? "wallpaper" : "square") + ".png";
  const toBlob = cv => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("no-blob")), "image/png"));
  async function downloadBlob(b, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function imageMaker(d) {
    if (!d || !d.text) { toast("Pick a verse first"); return; }
    let o = imgPrefs();
    openSheet("image", "Make a verse image", body => {
      const seg = (k, opts) => '<div class="fx-seg st-seg" data-k="' + k + '">' + opts.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (String(o[k]) === String(v) ? "on" : "") + '">' + l + "</button>").join("") + "</div>";
      const el = h('<div class="st-maker">' +
        '<div class="st-preview" data-format="' + o.format + '"><canvas aria-label="Verse image preview"></canvas></div>' +
        '<div class="fx-set"><label class="h">Size</label>' + seg("format", [["wall", "Wallpaper 9:16"], ["square", "Square 1:1"]]) + "</div>" +
        '<div class="fx-set"><label class="h">Background</label><div class="st-bgs" role="group" aria-label="Background">' + Object.keys(BGS).map(k => '<button type="button" class="st-bg ' + (k === o.bg ? "on" : "") + '" data-bg="' + k + '" aria-label="' + BGS[k].name + '" title="' + BGS[k].name + '"><canvas width="90" height="120"></canvas><span>' + BGS[k].name + "</span></button>").join("") + "</div></div>" +
        '<div class="fx-set"><label class="h">Font</label>' + seg("font", Object.keys(FONTS).map(k => [k, FONTS[k].name])) + "</div>" +
        '<div class="fx-set"><label class="h">Align</label>' + seg("align", [["left", "Left"], ["center", "Center"], ["right", "Right"]]) + "</div>" +
        '<div class="fx-set"><label class="h"><span>Text size</span><span class="st-sz">' + o.size + '%</span></label><input class="fx-range" type="range" min="70" max="140" step="5" value="' + o.size + '" aria-label="Text size"></div>' +
        '<label class="st-check"><input type="checkbox" ' + (o.mark ? "checked" : "") + '> Show the Bibley mark</label>' +
        '<div class="fx-row st-actions"><button class="fx-btn primary" data-a="share" type="button" style="flex:1">' + ICON.share + " Share</button>" +
        '<button class="fx-btn" data-a="dl" type="button" style="flex:1">' + ICON.download + " Download</button></div></div>");
      body.append(el);
      const cv = el.querySelector(".st-preview canvas"), pv = el.querySelector(".st-preview");
      // thumbnails
      el.querySelectorAll(".st-bg canvas").forEach(t => { const k = t.closest(".st-bg").dataset.bg; const big = document.createElement("canvas"); big.width = 270; big.height = 360; const bc = big.getContext("2d"); bc.save(); bc.scale(.25, .1875); BGS[k].draw(bc, 1080, 1920); bc.restore(); t.getContext("2d").drawImage(big, 0, 0, 90, 120); });
      let busy = null, again = false;
      const redraw = async () => { if (busy) { again = true; return busy; } busy = renderImage(cv, d, o).catch(e => console.warn(e)); await busy; busy = null; if (again) { again = false; redraw(); } };
      const persist = () => save(K_IMG, o);
      el.querySelectorAll(".st-seg").forEach(s => s.querySelectorAll("button").forEach(b => b.onclick = () => {
        o[s.dataset.k] = b.dataset.v; s.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
        if (s.dataset.k === "format") pv.dataset.format = o.format; persist(); redraw();
      }));
      el.querySelectorAll(".st-bg").forEach(b => b.onclick = () => { o.bg = b.dataset.bg; el.querySelectorAll(".st-bg").forEach(x => x.classList.toggle("on", x === b)); persist(); redraw(); });
      const r = el.querySelector(".fx-range"); r.oninput = () => { o.size = +r.value; el.querySelector(".st-sz").textContent = r.value + "%"; persist(); redraw(); };
      el.querySelector(".st-check input").onchange = e => { o.mark = e.target.checked; persist(); redraw(); };
      el.querySelector('[data-a="dl"]').onclick = async () => { await redraw(); const b = await toBlob(cv); api._lastBlob = b; await downloadBlob(b, fileName(d, o)); toast("Image saved to Downloads"); };
      el.querySelector('[data-a="share"]').onclick = async () => {
        await redraw(); const b = await toBlob(cv); api._lastBlob = b; const name = fileName(d, o);
        const file = new File([b], name, { type: "image/png" });
        if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: d.ref, text: d.ref + (d.version ? " (" + vname(d.version) + ")" : "") }); }
          catch (e) { if (e && e.name !== "AbortError") { await downloadBlob(b, name); toast("Sharing isn't available, so it was downloaded"); } }
        } else { await downloadBlob(b, name); toast("Sharing isn't available here, so it was downloaded"); }
      };
      redraw();
    });
  }

  /* ===================================================================
     2. MEMORIZE MODE
     =================================================================== */
  const LEVELS = ["Read it", "A few hidden", "Half hidden", "Most hidden", "First letters", "All hidden"];
  const memAll = () => { const d = load(K_MEM, {}); return d && typeof d === "object" && d.verses && typeof d.verses === "object" ? d : { v: 1, verses: {} }; };
  const memKey = d => d.key || ("ref:" + String(d.ref || "").replace(/\s+/g, "_"));
  function memGet(d) { return memAll().verses[memKey(d)] || null; }
  function memPut(d, patch) {
    const all = memAll(), k = memKey(d); const cur = all.verses[k] || { ref: d.ref, text: d.text, version: d.version || "", bookIdx: d.bookIdx, chapter: d.chapter, verseNum: d.verseNum, added: Date.now(), level: 0, best: 0, tries: 0 };
    all.verses[k] = Object.assign(cur, { text: d.text || cur.text, ref: d.ref || cur.ref }, patch || {}); all.v = 1; save(K_MEM, all); return all.verses[k];
  }
  function memDel(k) { const all = memAll(); delete all.verses[k]; save(K_MEM, all); }
  const words = t => String(t || "").trim().split(/\s+/).filter(Boolean);
  const norm = w => String(w).toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9]/g, "");
  // order in which words disappear (same every time for a verse, each level hides more)
  function hideOrder(n, seedStr) { let s = 0; for (const ch of seedStr) s = (s * 31 + ch.charCodeAt(0)) >>> 0; const r = rng(s || 1); const idx = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx; }
  function maskedHtml(text, level, seed) {
    const ws = words(text), n = ws.length, ord = hideOrder(n, seed);
    const frac = [0, .25, .5, .75, 1, 1][level]; const hidden = new Set(ord.slice(0, Math.round(n * frac)));
    return ws.map((w, i) => {
      if (!hidden.has(i)) return '<span class="st-w">' + esc(w) + "</span>";
      const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][\s\S]*?)([^A-Za-z0-9]*)$/) || ["", "", w, ""];
      const core = m[2] || w;
      const shown = level === 4 ? esc(core[0]) + '<i>' + "_".repeat(Math.max(1, Math.min(8, core.length - 1))) + "</i>" : '<i>' + "_".repeat(Math.max(2, Math.min(10, core.length))) + "</i>";
      return '<span class="st-w">' + esc(m[1]) + '<button type="button" class="st-blank" data-w="' + esc(core) + '" aria-label="Hidden word, tap to peek">' + shown + "</button>" + esc(m[3]) + "</span>";
    }).join(" ");
  }
  function score(target, typed) {
    const T = words(target).map(norm).filter(Boolean), Y = words(typed).map(norm).filter(Boolean);
    // longest common subsequence: words in the right order count as correct
    const m = T.length, n = Y.length, dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = T[i] === Y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ok = new Array(m).fill(false); let i = 0, j = 0;
    while (i < m && j < n) { if (T[i] === Y[j]) { ok[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    const hit = ok.filter(Boolean).length, extra = Math.max(0, n - hit);
    const pct = m ? Math.max(0, Math.round(100 * (hit - extra * .5) / m)) : 0;
    return { pct: Math.min(100, pct), ok, hit, total: m };
  }
  function memorize(d, startLevel) {
    if (!d || !d.text) { toast("Pick a verse first"); return; }
    const rec = memPut(d, {}); let level = typeof startLevel === "number" ? startLevel : Math.min(rec.level || 0, 5);
    const seed = memKey(d);
    openSheet("memorize", "Memorize " + DOT + " " + d.ref, body => {
      const el = h('<div class="st-mem">' +
        '<div class="st-levels" role="group" aria-label="Level">' + LEVELS.map((l, i) => '<button type="button" class="st-lv" data-l="' + i + '" aria-label="Level ' + (i + 1) + ": " + l + '"></button>').join("") + "</div>" +
        '<div class="st-lvname"></div><div class="fx-vtext st-text" aria-live="polite"></div>' +
        '<p class="fx-muted st-hint">Say it out loud. Tap a blank to peek.</p>' +
        '<div class="fx-row"><button class="fx-btn" data-a="less" type="button" style="flex:1">Show more</button><button class="fx-btn primary" data-a="more" type="button" style="flex:1">Hide more</button></div>' +
        '<div style="height:10px"></div><button class="fx-btn block" data-a="test" type="button">' + ICON.check + " Test me: type it from memory</button>" +
        '<div class="st-test" hidden><textarea class="fx-textarea" rows="4" placeholder="Type the verse from memory..." aria-label="Type the verse from memory" autocapitalize="sentences"></textarea>' +
        '<div class="fx-row" style="margin-top:8px"><button class="fx-btn primary" data-a="check" type="button" style="flex:1">Check</button><button class="fx-btn" data-a="hide" type="button">Back</button></div><div class="st-result"></div></div>' +
        '<div class="st-foot fx-muted"></div>' +
        '<button class="fx-btn small block" data-a="list" type="button" style="margin-top:10px">' + ICON.brain + " My memory verses</button></div>");
      body.append(el);
      const txt = el.querySelector(".st-text"), foot = el.querySelector(".st-foot");
      const draw = () => {
        txt.innerHTML = maskedHtml(d.text, level, seed);
        el.querySelector(".st-lvname").textContent = "Step " + (level + 1) + " of 6 " + DOT + " " + LEVELS[level];
        el.querySelectorAll(".st-lv").forEach((b, i) => { b.classList.toggle("on", i <= level); b.classList.toggle("cur", i === level); });
        el.querySelector('[data-a="less"]').disabled = level === 0; el.querySelector('[data-a="more"]').disabled = level === 5;
        const r = memGet(d) || rec; foot.textContent = r.best ? "Best test score: " + r.best + "%" + (r.best >= 90 ? " " + DOT + " memorized!" : "") : "Not tested yet";
        txt.querySelectorAll(".st-blank").forEach(b => b.onclick = () => { b.classList.add("peek"); b.textContent = b.dataset.w; setTimeout(() => { if (b.isConnected) { b.classList.remove("peek"); draw(); } }, 1600); });
      };
      const setLevel = l => { level = Math.max(0, Math.min(5, l)); const r = memGet(d) || rec; if (level > (r.level || 0)) memPut(d, { level }); draw(); };
      el.querySelector('[data-a="more"]').onclick = () => setLevel(level + 1);
      el.querySelector('[data-a="less"]').onclick = () => setLevel(level - 1);
      el.querySelectorAll(".st-lv").forEach(b => b.onclick = () => setLevel(+b.dataset.l));
      const test = el.querySelector(".st-test"), ta = test.querySelector("textarea"), res = el.querySelector(".st-result");
      el.querySelector('[data-a="test"]').onclick = () => { test.hidden = false; txt.innerHTML = maskedHtml(d.text, 5, seed); res.innerHTML = ""; setTimeout(() => { try { ta.focus(); } catch {} }, 150); };
      el.querySelector('[data-a="hide"]').onclick = () => { test.hidden = true; draw(); };
      el.querySelector('[data-a="check"]').onclick = () => {
        if (!ta.value.trim()) { toast("Type what you remember first"); return; }
        const s = score(d.text, ta.value), r = memGet(d) || rec;
        const best = Math.max(r.best || 0, s.pct); memPut(d, { best, tries: (r.tries || 0) + 1, lastScore: s.pct, practiced: Date.now(), mastered: best >= 90 || !!r.mastered });
        const ws = words(d.text); let k = 0;
        const marked = ws.map(w => { const isWord = !!norm(w); const good = isWord ? s.ok[k++] : true; return '<span class="' + (good ? "st-ok" : "st-miss") + '">' + esc(w) + "</span>"; }).join(" ");
        const msg = s.pct >= 90 ? "You've got it memorized!" : s.pct >= 70 ? "So close. One more try?" : s.pct >= 40 ? "Good start. Practise a step back and try again." : "Keep going. Go back a step or two and say it out loud.";
        res.innerHTML = '<div class="st-score ' + (s.pct >= 90 ? "great" : "") + '"><b>' + s.pct + '%</b><span>' + s.hit + " of " + s.total + " words " + DOT + " " + msg + '</span></div><div class="fx-vtext st-diff">' + marked + "</div>";
        if (s.pct >= 90) toast("Memorized " + DOT + " " + d.ref, 2800);
        draw(); txt.innerHTML = maskedHtml(d.text, 5, seed);
      };
      el.querySelector('[data-a="list"]').onclick = memoryList;
      draw();
    });
  }
  function memoryList() {
    openSheet("memlist", "My memory verses", body => {
      const all = memAll().verses; const keys = Object.keys(all).sort((a, b) => (all[b].practiced || all[b].added || 0) - (all[a].practiced || all[a].added || 0));
      if (!keys.length) { body.append(h('<div class="fx-card"><p class="fx-muted" style="margin:0">No memory verses yet. Tap any verse in the reader, then tap <b>Memorize</b>.</p></div>')); return; }
      const done = keys.filter(k => (all[k].best || 0) >= 90).length;
      body.append(h('<p class="fx-muted" style="margin:0 0 10px">' + keys.length + " verse" + (keys.length === 1 ? "" : "s") + " " + DOT + " " + done + " memorized</p>"));
      const list = h('<div class="st-memlist"></div>'); body.append(list);
      keys.forEach(k => {
        const r = all[k], pct = Math.round(((r.level || 0) / 5) * 100);
        const row = h('<div class="st-mrow"><button type="button" class="st-mopen"><div class="r">' + esc(r.ref) + ((r.best || 0) >= 90 ? ' <span class="st-badge">' + ICON.check + "</span>" : "") + '</div><div class="t">' + esc(r.text) + '</div><div class="st-bar"><i style="width:' + pct + '%"></i></div><div class="fx-muted st-msub">Step ' + ((r.level || 0) + 1) + "/6" + (r.best ? " " + DOT + " best " + r.best + "%" : "") + '</div></button><button type="button" class="st-mdel" aria-label="Remove ' + esc(r.ref) + '">&times;</button></div>');
        row.querySelector(".st-mopen").onclick = () => memorize(Object.assign({ key: k }, r));
        row.querySelector(".st-mdel").onclick = () => { if (confirm("Remove " + r.ref + " from your memory verses?")) { memDel(k); memoryList(); } };
        list.append(row);
      });
    });
  }

  /* ===================================================================
     3. PAGE TURN ANIMATION
     =================================================================== */
  const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const animOn = () => localStorage.getItem(K_ANIM) !== "off";
  function setAnim(on) { try { localStorage.setItem(K_ANIM, on ? "on" : "off"); } catch {} document.documentElement.classList.toggle("st-pageturn", on); }
  document.documentElement.classList.toggle("st-pageturn", animOn());
  const pending = {};
  function snapshot(k, dir) {
    if (!animOn()) return;
    const rm = document.querySelector('.pane[data-pane="' + k + '"] .reader-main'); if (!rm) return;
    const r = rm.getBoundingClientRect(); if (r.width < 50 || r.height < 50) return;
    if (pending[k]) finish(k, true);
    const wrap = document.createElement("div"); wrap.className = "st-turn"; wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
    const page = document.createElement("div"); page.className = "st-page " + (dir === "prev" ? "prev" : "next");
    const inner = document.createElement("div"); inner.className = "st-page-inner";
    const clone = rm.cloneNode(true); clone.querySelectorAll("[id]").forEach(n => n.removeAttribute("id")); clone.removeAttribute("id");
    clone.style.cssText = "position:absolute;left:0;top:" + (-rm.scrollTop) + "px;width:" + r.width + "px;height:auto;min-height:" + r.height + "px;overflow:visible;margin:0";
    inner.appendChild(clone); page.appendChild(inner);
    const sheen = document.createElement("div"); sheen.className = "st-sheen"; page.appendChild(sheen);
    const shade = document.createElement("div"); shade.className = "st-shade";
    wrap.appendChild(shade); wrap.appendChild(page); document.body.appendChild(wrap);
    pending[k] = { wrap, page, timer: setTimeout(() => finish(k), 2500) };
  }
  function finish(k, instant) {
    const p = pending[k]; if (!p) return; delete pending[k]; clearTimeout(p.timer);
    if (instant) { p.wrap.remove(); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      p.wrap.classList.add(reduceMotion() ? "go-fade" : "go");
      setTimeout(() => p.wrap.remove(), reduceMotion() ? 260 : 700);
    }));
  }
  // capture prev/next button taps before the reader changes the page
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".prev-btn, .next-btn"); if (!b || b.disabled) return;
    snapshot(b.dataset.pane || "a", b.classList.contains("prev-btn") ? "prev" : "next");
  }, true);
  // swipe and "Next chapter" go through BibleyCore
  ["goNext", "goPrev"].forEach(fn => { const orig = C[fn]; if (typeof orig !== "function") return; C[fn] = function (k) { snapshot(k || "a", fn === "goNext" ? "next" : "prev"); return orig.apply(this, arguments); }; });
  const origOnChapter = FX.onChapter;
  FX.onChapter = function (k, info) { const out = origOnChapter.apply(this, arguments); if (pending[k]) finish(k); return out; };


  /* ===================================================================
     4. WHAT'S NEW (updates log)
     Shows once per version: closes with the X or a tap outside, then stays hidden
     until APP_VERSION changes. Stored: localStorage "bibley_seen_version".
     =================================================================== */
  const APP_VERSION = "4.0";
  const K_SEEN_VER = "bibley_seen_version";
  const CHANGELOG = [
    { v: "4.0", date: "October 2026", items: [
      ["AI study help fixed", "Verse and chapter summaries now come back complete (Summary, In Context and Application), retry on their own if an answer gets cut off, and no longer make up Hebrew or Greek words."],
      ["Verse Image Maker", "Tap a verse, then Image: 12 backgrounds, 4 fonts, alignment and size. Make a phone wallpaper or a square post, then download or share it."],
      ["Memorize mode", "Tap a verse, then Memorize. Words disappear step by step, tap a blank to peek, then type it from memory for a score. Find them all under My memory verses."],
      ["Page turn animation", "Chapters now turn like real pages (buttons and swipe). Turn it off in Aa settings."],
      ["More Bible versions", "Added NRSV, ISV, CEV, plus a Catholic group with NABRE, RSV-CE and NJB."],
      ["What's new", "This updates log. It shows once after each update."]
    ] },
    { v: "3.0", date: "October 2026", items: [
      ["Notes notebook", "Paged notes you can name, flip through and export."],
      ["Add to notes", "Save any AI verse or chapter summary straight into your notes."]
    ] },
    { v: "2.0", date: "October 2026", items: [
      ["40+ Bible versions", "Popular, easy-to-read, classic and other languages, plus Compare."],
      ["Install as an app", "Add Bibley to your home screen. Chapters you've opened work offline."]
    ] }
  ];
  function whatsNew() {
    const old = document.querySelector(".st-wn-wrap"); if (old) old.remove();
    const cur = CHANGELOG[0], earlier = CHANGELOG.slice(1);
    const li = it => '<li><b>' + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></li>";
    const wrap = h('<div class="st-wn-wrap" role="dialog" aria-modal="true" aria-labelledby="stWnTitle"><div class="st-wn">' +
      '<button type="button" class="st-wn-x" aria-label="Close what\'s new">&times;</button>' +
      '<div class="fx-eyebrow">What\'s new ' + DOT + " version " + esc(cur.v) + '</div><h2 id="stWnTitle">Bibley just got better</h2>' +
      '<ul class="st-wn-list">' + cur.items.map(li).join("") + "</ul>" +
      '<details class="st-wn-earlier"><summary>Earlier updates</summary>' + earlier.map(e => '<div class="st-wn-v">Version ' + esc(e.v) + '</div><ul class="st-wn-list small">' + e.items.map(li).join("") + "</ul>").join("") + "</details>" +
      '<button type="button" class="fx-btn primary block st-wn-ok">Got it</button></div></div>');
    document.body.appendChild(wrap);
    const close = () => { try { localStorage.setItem(K_SEEN_VER, APP_VERSION); } catch {} wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 250); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    wrap.querySelector(".st-wn-x").onclick = close; wrap.querySelector(".st-wn-ok").onclick = close;
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => wrap.classList.add("open"));
    setTimeout(() => { try { wrap.querySelector(".st-wn-x").focus({ preventScroll: true }); } catch {} }, 300);
  }
  function maybeWhatsNew() {
    let seen = null; try { seen = localStorage.getItem(K_SEEN_VER); } catch {}
    if (seen === APP_VERSION) return;
    setTimeout(whatsNew, 900);
  }

  /* ===================================================================
     public
     =================================================================== */
  const api = window.BibleyStudio = {
    imageMaker, memorize, memoryList, renderImage, score, maskedHtml,
    pageTurn: { enabled: animOn, set: setAnim },
    whatsNew, APP_VERSION, CHANGELOG,
    backgrounds: Object.keys(BGS), fonts: Object.keys(FONTS), ICON, _lastBlob: null
  };
  maybeWhatsNew();
})();
