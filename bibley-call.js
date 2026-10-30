/* bibley-call.js - Bibley 6.2 (2026-10-29): Call Bibley. A hands-free voice call with the AI.
   Tap Call, talk, Bibley answers out loud, and it keeps going back and forth until you hang up.
   - Listening: MediaRecorder + a simple voice detector (Web Audio level). About 1.2 s of quiet ends your turn.
   - Your words: the clip goes to https://bibley-ai.sites.tab.bot/transcribe (Whisper on Oliver's Groq account,
     key stays on the server). Then the reply comes from the same proxy's chat route (short spoken answers).
   - Speaking: the Android app's native voice (window.BibleyTTS, Bibley 2.2+) when present, otherwise the
     browser's speechSynthesis with the most natural English voice it has. Tap the screen while Bibley talks to
     cut in. Live captions show both sides. Nothing is stored. ASCII only in this file. */
(function () {
  "use strict";
  var PROXY = "https://bibley-ai.sites.tab.bot/";
  var SILENCE_MS = 1200, MIN_SPEECH_MS = 250, MAX_TURN_MS = 25000, IDLE_RESTART_MS = 15000;
  var SYSTEM = "You are Bibley, a warm and friendly Bible study companion talking with someone on a live voice call. " +
    "Reply in 2 to 4 short spoken sentences in plain everyday words. No lists, no markdown, no emojis, no headings. " +
    "Say Bible references the way people speak them, like John chapter 3 verse 16. Quote scripture only briefly. " +
    "Stay focused on the Bible, God and faith, from a neutral traditional Christian view, respectful of all churches. " +
    "Say the Lord or God, never Yahweh. If asked about something unrelated, answer kindly in one sentence and steer back to the Bible. " +
    "If the person sounds hurt, unsafe or talks about harming themselves, gently tell them to talk to a parent, pastor or trusted adult today, and that in the US they can call or text 988 any time. " +
    "You may end with a short question to keep the conversation going.";
  var sv = function (d, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 20) + '" height="' + (w || 20) + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; };
  var IC = {
    phone: '<path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6v3.2a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5z"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    micOff: '<path d="M9 9v2.5a3 3 0 0 0 5.1 2.1M15 10.5V6.5a3 3 0 0 0-5.7-1.3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 10.8 4.9M18.5 11.5a6.4 6.4 0 0 1-.6 2.7M12 18v3M4 4l16 16"/>',
    down: '<path d="M6 9l6 6 6-6"/>'
  };
  var HANG = '<path d="M3.2 13.6c4.9-4.4 12.7-4.4 17.6 0l-1.9 2.6-3.4-1.2v-2.3a10.6 10.6 0 0 0-7 0V15l-3.4 1.2z" fill="currentColor" stroke="none"/>';

  var S = null; // live call state

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  /* ---------------- UI ---------------- */
  function build() {
    var w = document.createElement("div");
    w.id = "bcCall"; w.className = "bc-wrap"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", "Call with Bibley");
    w.innerHTML =
      '<div class="bc-top"><button type="button" class="bc-min" id="bcMin" aria-label="Hang up and close">' + sv(IC.down, 22) + '</button>' +
      '<div class="bc-title"><div class="bc-name">Bibley</div><div class="bc-timer" id="bcTimer">0:00</div></div><span class="bc-top-pad"></span></div>' +
      '<div class="bc-stage" id="bcStage">' +
        '<div class="bc-ava" id="bcAva"><span class="bc-ring r1"></span><span class="bc-ring r2"></span><img src="icons/icon-192.png" alt="" width="112" height="112"/></div>' +
        '<div class="bc-state" id="bcState">Connecting...</div>' +
      '</div>' +
      '<div class="bc-caps" id="bcCaps" aria-live="polite"></div>' +
      '<div class="bc-msg" id="bcMsg" hidden></div>' +
      '<div class="bc-ctrls">' +
        '<div class="bc-ctrl"><button type="button" class="bc-btn bc-mute" id="bcMute" aria-pressed="false" aria-label="Mute">' + sv(IC.mic, 26) + '</button><span id="bcMuteLbl">Mute</span></div>' +
        '<div class="bc-ctrl"><button type="button" class="bc-btn bc-end" id="bcEnd" aria-label="Hang up">' + sv(HANG, 36) + '</button><span>Hang up</span></div>' +
      '</div>';
    document.body.appendChild(w);
    $("bcEnd").addEventListener("click", hangUp);
    $("bcMin").addEventListener("click", hangUp);
    $("bcMute").addEventListener("click", toggleMute);
    $("bcStage").addEventListener("click", tapStage);
    $("bcCaps").addEventListener("click", tapStage);
    requestAnimationFrame(function () { w.classList.add("open"); });
    return w;
  }
  function setState(st, label) {
    if (!S) return;
    S.state = st;
    S.el.setAttribute("data-state", st);
    $("bcState").textContent = label;
  }
  function showMsg(text, retry) {
    var m = $("bcMsg"); if (!m) return;
    if (!text) { m.hidden = true; m.innerHTML = ""; return; }
    m.hidden = false;
    m.innerHTML = "<p>" + esc(text) + "</p>" + (retry ? '<button type="button" id="bcRetry">' + esc(retry) + "</button>" : "");
    var b = $("bcRetry"); if (b) b.addEventListener("click", function (e) { e.stopPropagation(); showMsg(""); startMic(); });
  }
  function cap(who, text, live) {
    var box = $("bcCaps"); if (!box) return null;
    var p = document.createElement("div");
    p.className = "bc-cap " + (who === "you" ? "you" : "bib") + (live ? " live" : "");
    p.innerHTML = '<span class="bc-who">' + (who === "you" ? "You" : "Bibley") + "</span><span class=\"bc-txt\"></span>";
    p.querySelector(".bc-txt").textContent = text;
    box.appendChild(p);
    while (box.children.length > 8) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
    return p;
  }

  /* ---------------- call lifecycle ---------------- */
  function open() {
    if (S) return;
    S = { el: build(), started: Date.now(), history: [], muted: false, state: "idle", gen: 0, turnId: 0 };
    S.timer = setInterval(function () { var t = $("bcTimer"); if (t && S) t.textContent = fmt(Date.now() - S.started); }, 500);
    S.onOff = function () { if (S) { showMsg("You're offline. The call picks back up when you're connected."); stopListening(); setState("paused", "Offline"); } };
    S.onOn = function () { if (S) { showMsg(""); if (!S.speaking) listen(); } };
    window.addEventListener("offline", S.onOff); window.addEventListener("online", S.onOn);
    S.onKey = function (e) { if (e.key === "Escape") hangUp(); };
    document.addEventListener("keydown", S.onKey);
    warmVoices();
    startMic();
  }
  function hangUp() {
    if (!S) return;
    var s = S; S = null;
    s.gen++;
    clearInterval(s.timer); clearInterval(s.vadTimer);
    try { if (s.rec && s.rec.state !== "inactive") s.rec.stop(); } catch (e) {}
    try { if (s.stream) s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (s.ac) s.ac.close(); } catch (e) {}
    try { if (s.abort) s.abort.abort(); } catch (e) {}
    stopSpeaking();
    window.removeEventListener("offline", s.onOff); window.removeEventListener("online", s.onOn);
    document.removeEventListener("keydown", s.onKey);
    s.el.classList.remove("open");
    setTimeout(function () { if (s.el.parentNode) s.el.parentNode.removeChild(s.el); }, 220);
  }
  async function startMic() {
    if (!S) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setState("error", "Can't use the mic here");
      showMsg(window.AndroidApp ? "This version of the Bibley app can't use the microphone yet. Update the app to 2.2 or newer to call Bibley." : "This browser can't record your voice. Try Chrome, Edge or Safari.");
      return;
    }
    if (navigator.onLine === false) { setState("paused", "Offline"); showMsg("You're offline. Connect to the internet to call Bibley.", "Try again"); return; }
    setState("connecting", "Connecting...");
    try {
      if (window.BibleyTTS && window.BibleyTTS.ensureMic) { try { window.BibleyTTS.ensureMic(); } catch (e) {} }
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      if (!S) return;
      var name = e && e.name;
      setState("error", "Microphone is off");
      if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
        showMsg(window.AndroidApp ? "Bibley needs the microphone to hear you. Allow it when your phone asks, or turn it on in Settings > Apps > Bibley > Permissions > Microphone." : "Bibley needs the microphone to hear you. Allow it for this site (tap the lock or info icon next to the address), then try again.", "Try again");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") showMsg("No microphone was found on this device.", "Try again");
      else if (name === "NotReadableError") showMsg("Another app is using the microphone. Close it and try again.", "Try again");
      else showMsg("Couldn't start the microphone (" + (name || "error") + ").", "Try again");
      return;
    }
    if (!S) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      S.ac = new AC();
      if (S.ac.state === "suspended") { try { await S.ac.resume(); } catch (e) {} }
      var src = S.ac.createMediaStreamSource(S.stream);
      S.an = S.ac.createAnalyser(); S.an.fftSize = 1024; src.connect(S.an);
      S.buf = new Float32Array(S.an.fftSize);
    } catch (e) { S.an = null; }
    S.floor = 0.01;
    if (!S.greeted) { S.greeted = true; cap("bib", "Hi, I'm Bibley. Ask me anything about the Bible."); }
    listen();
  }
  function level() {
    if (!S || !S.an) return 0;
    S.an.getFloatTimeDomainData(S.buf);
    var sum = 0; for (var i = 0; i < S.buf.length; i++) sum += S.buf[i] * S.buf[i];
    return Math.sqrt(sum / S.buf.length);
  }
  function pickMime() {
    var c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i];
    return "";
  }

  /* ---------------- listening + voice detection ---------------- */
  function listen() {
    if (!S || !S.stream || S.muted || navigator.onLine === false) return;
    stopListening();
    var my = ++S.turnId, chunks = [], mime = pickMime();
    var rec; try { rec = mime ? new MediaRecorder(S.stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(S.stream); } catch (e) { rec = new MediaRecorder(S.stream); }
    S.rec = rec;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var t0 = Date.now(), speechStart = 0, speechMs = 0, lastVoice = 0, ended = false, above = 0, calib = [];
    rec.onstop = function () {
      if (!S || my !== S.turnId) return;
      if (!ended) return;
      var blob = new Blob(chunks, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] });
      handleTurn(blob, speechMs);
    };
    rec.start(250);
    setState("listening", "Listening...");
    S.vadTimer = setInterval(function () {
      if (!S || my !== S.turnId) return;
      var now = Date.now(), lv = level();
      var ava = $("bcAva"); if (ava) ava.style.setProperty("--lv", Math.min(1, lv * 12).toFixed(3));
      if (!S.an) { // no level meter: fixed-length turns
        if (now - t0 > 6000) { ended = true; speechMs = 1000; finish(); }
        return;
      }
      if (now - t0 < 300) { calib.push(lv); return; }
      if (calib.length) { var avg = calib.reduce(function (a, b) { return a + b; }, 0) / calib.length; S.floor = Math.min(0.03, Math.max(0.002, avg)); calib = []; }
      var thr = Math.max(0.012, S.floor * 2.8);
      if (lv > thr) {
        above += 50;
        if (above >= 150 && !speechStart) { speechStart = now - above; setState("hearing", "Listening..."); }
        lastVoice = now;
      } else {
        above = 0;
        if (!speechStart) S.floor = S.floor * 0.97 + lv * 0.03;
      }
      if (speechStart) {
        speechMs = (lastVoice || now) - speechStart;
        if (now - lastVoice > SILENCE_MS || now - speechStart > MAX_TURN_MS) {
          if (speechMs >= MIN_SPEECH_MS) { ended = true; finish(); }
          else { speechStart = 0; lastVoice = 0; setState("listening", "Listening..."); }
        }
      } else if (now - t0 > IDLE_RESTART_MS) { listen(); } // drop the silent clip, keep listening
    }, 50);
    function finish() {
      clearInterval(S.vadTimer);
      try { rec.stop(); } catch (e) {}
    }
  }
  function stopListening() {
    if (!S) return;
    clearInterval(S.vadTimer);
    S.turnId++;
    try { if (S.rec && S.rec.state !== "inactive") S.rec.stop(); } catch (e) {}
    S.rec = null;
  }
  function toggleMute(e) {
    if (e) e.stopPropagation();
    if (!S) return;
    S.muted = !S.muted;
    var b = $("bcMute"); b.setAttribute("aria-pressed", S.muted ? "true" : "false"); b.innerHTML = sv(S.muted ? IC.micOff : IC.mic, 26);
    $("bcMuteLbl").textContent = S.muted ? "Unmute" : "Mute";
    if (S.stream) S.stream.getAudioTracks().forEach(function (t) { t.enabled = !S.muted; });
    if (S.muted) { if (S.state === "listening" || S.state === "hearing") { stopListening(); setState("muted", "Muted"); } }
    else if (!S.speaking && !S.busy) listen();
  }
  function tapStage() {
    if (!S) return;
    if (S.speaking) { stopSpeaking(); S.speaking = false; showMsg(""); listen(); }
    else if (S.state === "error" || S.state === "paused") startMic();
  }

  /* ---------------- one turn: transcribe -> answer -> speak ---------------- */
  function junk(text, speechMs) {
    var t = text.replace(/[^a-z ]/gi, "").trim().toLowerCase();
    if (!t) return true;
    if (speechMs < 900 && /^(thank you|thanks|thanks for watching|you|bye|okay|so|uh|um|hmm)$/.test(t)) return true;
    return false;
  }
  async function handleTurn(blob, speechMs) {
    if (!S) return;
    var gen = S.gen;
    if (!blob || blob.size < 800) { listen(); return; }
    if (blob.size > 2 * 1024 * 1024) { showMsg("That was a long one. Try asking in a shorter sentence."); listen(); return; }
    S.busy = true;
    setState("thinking", "Thinking...");
    var live = cap("you", "...", true);
    var text;
    try {
      text = await transcribe(blob);
    } catch (e) {
      if (!S || gen !== S.gen) return;
      if (live && live.parentNode) live.parentNode.removeChild(live);
      S.busy = false; netError(e); return;
    }
    if (!S || gen !== S.gen) return;
    if (junk(text, speechMs)) { if (live && live.parentNode) live.parentNode.removeChild(live); S.busy = false; listen(); return; }
    live.classList.remove("live"); live.querySelector(".bc-txt").textContent = text;
    showMsg("");
    var reply;
    try {
      reply = await answer(text);
    } catch (e) {
      if (!S || gen !== S.gen) return;
      S.busy = false; netError(e); return;
    }
    if (!S || gen !== S.gen) return;
    S.history.push({ role: "user", content: text }, { role: "assistant", content: reply });
    if (S.history.length > 12) S.history = S.history.slice(-12);
    cap("bib", reply);
    S.busy = false;
    speak(reply);
  }
  function netError(e) {
    if (!S) return;
    var code = e && e.code;
    if (navigator.onLine === false || code === "offline") { setState("paused", "Offline"); showMsg("You're offline. The call picks back up when you're connected."); return; }
    if (code === "rate_limited" || code === "daily_cap" || code === "upstream_busy") {
      var wait = code === "rate_limited" && e.scope === "ip_minute" ? Math.max(5, Math.min(60, e.retry || 30)) : 30;
      if (code === "daily_cap" || e.scope === "ip_day") { setState("paused", "Taking a break"); showMsg("Bibley has talked a lot today and needs a rest. Try calling again tomorrow, or type in the Chatbot tab."); return; }
      setState("paused", "One moment...");
      showMsg("Lots of questions right now. Bibley will listen again in " + wait + " seconds.");
      var gen = S.gen;
      setTimeout(function () { if (S && gen === S.gen && !S.muted) { showMsg(""); listen(); } }, wait * 1000);
      return;
    }
    if (code === "audio_too_large") { showMsg("That was a long one. Try asking in a shorter sentence."); listen(); return; }
    showMsg("Didn't catch that because of a connection problem. Say it again.");
    listen();
  }
  async function postProxy(path, body, headers, ms) {
    if (navigator.onLine === false) throw Object.assign(new Error("offline"), { code: "offline" });
    var ctl = new AbortController(); S.abort = ctl;
    var t = setTimeout(function () { ctl.abort(); }, ms);
    var r;
    try { r = await fetch(PROXY + path, { method: "POST", headers: headers, body: body, signal: ctl.signal }); }
    catch (e) { throw Object.assign(new Error("network"), { code: navigator.onLine === false ? "offline" : "network" }); }
    finally { clearTimeout(t); }
    var data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var er = (data && data.error) || {}; throw Object.assign(new Error(er.code || "http_" + r.status), { code: er.code || "http_" + r.status, scope: er.scope, retry: er.retry_after, status: r.status }); }
    return data || {};
  }
  async function transcribe(blob) {
    var d = await postProxy("transcribe", blob, { "Content-Type": blob.type || "audio/webm" }, 20000);
    return String(d.text || "").trim().replace(/\b([1-3]?\s?[A-Z][a-z]+) (\d{1,3})\.(\d{1,3})\b/g, "$1 $2:$3");
  }
  function tidy(t) {
    return String(t || "").replace(/[\u0590-\u05FF\u0370-\u03FF\u1F00-\u1FFF]+/g, "").replace(/\*\*?|__|#+ |`/g, "").replace(/^\s*[-*\u2022]\s+/gm, "").replace(/\(\s*\)/g, "")
      .replace(/\bYahweh\b/g, "the Lord").replace(/\s+/g, " ").trim();
  }
  async function answer(text) {
    var msgs = [{ role: "system", content: SYSTEM }].concat(S.history.slice(-10)).concat([{ role: "user", content: text }]);
    try {
      var d = await postProxy("", JSON.stringify({ messages: msgs, mode: "call", max_tokens: 450, stream: false }), { "Content-Type": "application/json" }, 25000);
      var c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      var out = tidy(c);
      if (out) return out;
      throw Object.assign(new Error("empty"), { code: "empty" });
    } catch (e) {
      if (e.code === "offline" || e.code === "rate_limited" && e.scope === "ip_minute") throw e;
      if (window.BibleyAI && window.BibleyAI.generate) { // free fallback services
        var ctx = S.history.slice(-4).map(function (m) { return (m.role === "user" ? "Listener: " : "Bibley: ") + m.content; }).join("\n");
        var out2 = tidy(await window.BibleyAI.generate(SYSTEM, (ctx ? "Conversation so far:\n" + ctx + "\n\n" : "") + "Listener says: " + text, 300));
        if (out2) return out2;
      }
      throw e;
    }
  }

  /* ---------------- speaking ---------------- */
  var voice = null;
  function score(v) {
    var n = (v.name || "").toLowerCase(), l = (v.lang || "").toLowerCase().replace("_", "-"), s = 0;
    if (l.indexOf("en") !== 0) return -1;
    if (l === "en-us") s += 4; else if (l === "en-gb" || l === "en-au" || l === "en-ca") s += 3; else s += 1;
    if (/natural|neural|premium|enhanced|online/.test(n)) s += 6;
    if (/google/.test(n)) s += 4;
    if (/samantha|ava|allison|aria|jenny|guy|daniel|karen|serena|zira/.test(n)) s += 2;
    if (/espeak|compact|novelty|whisper|bad news|bells|boing|bubbles|cellos|zarvox|trinoids|albert|fred|junior|ralph|kathy|bahh|hysterical|organ|superstar|deranged|jester/.test(n)) s -= 8;
    if (v.localService === false) s += 1;
    return s;
  }
  function warmVoices() {
    var ss = window.speechSynthesis; if (!ss) return;
    var pick = function () { var vs = ss.getVoices() || [], best = null, bs = -1; vs.forEach(function (v) { var s = score(v); if (s > bs) { bs = s; best = v; } }); if (best) voice = best; };
    pick(); if (ss.addEventListener) ss.addEventListener("voiceschanged", pick); else ss.onvoiceschanged = pick;
  }
  function sentences(t) {
    var parts = t.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [t], out = [], cur = "";
    parts.forEach(function (p) { if ((cur + p).length > 180 && cur) { out.push(cur.trim()); cur = p; } else cur += p; });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function stopSpeaking() {
    try { if (window.BibleyTTS) window.BibleyTTS.stop(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    if (S) S.speakId = 0;
  }
  function speak(text) {
    if (!S) return;
    stopListening();
    S.speaking = true;
    setState("speaking", "Speaking... tap to interrupt");
    var id = Date.now() % 1e9, gen = S.gen; S.speakId = id;
    var done = function () { if (!S || gen !== S.gen || S.speakId !== id) return; S.speakId = 0; S.speaking = false; if (S.muted) setState("muted", "Muted"); else listen(); };
    var spoken = text.replace(/\b(\d?\s?[A-Z][a-z]+)\s(\d+):(\d+)(?:-(\d+))?/g, function (m, b, c, v, v2) { return b + " chapter " + c + " verse " + v + (v2 ? " to " + v2 : ""); });
    if (window.BibleyTTS && window.BibleyTTS.speak) {
      S.ttsDone = function (gotId) { if (String(gotId) === String(id)) done(); };
      var ok = false; try { ok = window.BibleyTTS.speak(spoken, String(id)); } catch (e) { ok = false; }
      if (ok !== false) { S.speakGuard = setTimeout(done, 4000 + spoken.length * 110); return; }
    }
    var ss = window.speechSynthesis;
    if (!ss || !window.SpeechSynthesisUtterance) { setTimeout(done, 400); return; }
    ss.cancel();
    var q = sentences(spoken), i = 0;
    var next = function () {
      if (!S || gen !== S.gen || S.speakId !== id) return;
      if (i >= q.length) { done(); return; }
      var u;
      try { u = new SpeechSynthesisUtterance(q[i++]); } catch (e) { done(); return; }
      u.lang = "en-US"; u.rate = 1.0; u.pitch = 1.0;
      if (voice) { try { u.voice = voice; u.lang = voice.lang || "en-US"; } catch (e) {} }
      var fired = false, guard = setTimeout(function () { if (!fired) { fired = true; next(); } }, 2500 + u.text.length * 90);
      u.onend = u.onerror = function () { if (fired) return; fired = true; clearTimeout(guard); next(); };
      try { ss.speak(u); } catch (e) { fired = true; clearTimeout(guard); done(); }
    };
    next();
  }
  // native voice callback from the Android app (Bibley 2.2+)
  function ttsEvent(id, what) { if (S && S.ttsDone && (what === "done" || what === "error")) { clearTimeout(S.speakGuard); S.ttsDone(id); } }

  /* ---------------- entry points ---------------- */
  function addButtons() {
    var head = document.querySelector("#aiPanel .ai-head"), close = $("closeAiBtn");
    if (head && close && !$("bcOpenBtn")) {
      var b = document.createElement("button");
      b.type = "button"; b.id = "bcOpenBtn"; b.className = "bc-open"; b.title = "Call Bibley"; b.setAttribute("aria-label", "Call Bibley");
      b.innerHTML = sv(IC.phone, 16) + "<span>Call</span>";
      b.addEventListener("click", open);
      head.insertBefore(b, close);
    }
  }
  window.BibleyCall = { open: open, hangUp: hangUp, _ttsEvent: ttsEvent, get active() { return !!S; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButtons); else addButtons();
})();
