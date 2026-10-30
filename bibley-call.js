/* bibley-call.js - Bibley 6.3 (2026-10-29): Call Bibley. A hands-free voice call with the AI.
   6.3: voice control. During a call Bibley can run the app's own actions (open a chapter, read aloud, search,
   bookmark, highlight, notes, Explain/Simple/Related/Prayer/Words, theme, text size, daily verse time, screens,
   translation, back, home). The AI answers with one line  ACT [ {...} ]  that this file parses and runs with the
   app's real functions, then it says what actually happened. Removing things needs a spoken yes first.
   The call shrinks to a floating bar (minimize button, or on its own when an action changes the page).
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
    "Talk like a friendly person on the phone, not like a text: use contractions, short sentences and a warm, casual tone, and now and then a natural yeah, hmm or so. " +
    "Reply in 2 to 4 short spoken sentences in plain everyday words. No lists, no markdown, no emojis, no symbols, no headings. " +
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
    down: '<path d="M6 9l6 6 6-6"/>',
    mini: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>'
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
      '<div class="bc-top"><button type="button" class="bc-min" id="bcMin" aria-label="Minimize call" title="Minimize">' + sv(IC.down, 22) + '</button>' +
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
    var bar = document.createElement("div");
    bar.id = "bcBar"; bar.className = "bc-bar"; bar.hidden = true; bar.setAttribute("role", "button"); bar.setAttribute("tabindex", "0"); bar.setAttribute("aria-label", "Return to call");
    bar.innerHTML = '<span class="bc-bar-ava"><img src="icons/icon-192.png" alt="" width="34" height="34"/></span>' +
      '<span class="bc-bar-txt"><span class="bc-bar-top"><b>Bibley</b><span id="bcBarTimer">0:00</span></span><span class="bc-bar-st" id="bcBarState">Connecting...</span></span>' +
      '<button type="button" class="bc-bar-btn" id="bcBarMute" aria-pressed="false" aria-label="Mute">' + sv(IC.mic, 20) + '</button>' +
      '<button type="button" class="bc-bar-btn bc-bar-end" id="bcBarEnd" aria-label="Hang up">' + sv(HANG, 24) + '</button>';
    document.body.appendChild(bar);
    bar.addEventListener("click", function () { expand(); });
    bar.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); expand(); } });
    $("bcBarMute").addEventListener("click", toggleMute);
    $("bcBarEnd").addEventListener("click", function (e) { e.stopPropagation(); hangUp(); });
    $("bcEnd").addEventListener("click", hangUp);
    $("bcMin").addEventListener("click", function (e) { e.stopPropagation(); minimize(); });
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
    var bs = $("bcBarState"); if (bs) bs.textContent = label;
    var bb = $("bcBar"); if (bb) bb.setAttribute("data-state", st);
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
    S.timer = setInterval(function () { var t = $("bcTimer"); if (t && S) t.textContent = fmt(Date.now() - S.started); var bt = $("bcBarTimer"); if (bt && S) bt.textContent = fmt(Date.now() - S.started); }, 500);
    S.onOff = function () { if (S) { showMsg("You're offline. The call picks back up when you're connected."); stopListening(); setState("paused", "Offline"); } };
    S.onOn = function () { if (S) { showMsg(""); if (!S.speaking) listen(); } };
    window.addEventListener("offline", S.onOff); window.addEventListener("online", S.onOn);
    S.onKey = function (e) { if (e.key === "Escape" && !S.mini) minimize(); };
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
    var bar = document.getElementById("bcBar"); if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    document.documentElement.classList.remove("bc-mini-on");
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
    if (!S.greeted) { S.greeted = true; cap("bib", "Hi, I'm Bibley. Ask me anything about the Bible, or tell me what to do, like open Psalm 23."); }
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
    var bm = $("bcBarMute"); if (bm) { bm.setAttribute("aria-pressed", S.muted ? "true" : "false"); bm.setAttribute("aria-label", S.muted ? "Unmute" : "Mute"); bm.innerHTML = sv(S.muted ? IC.micOff : IC.mic, 20); }
    if (S.stream) S.stream.getAudioTracks().forEach(function (t) { t.enabled = !S.muted; });
    if (S.muted) { if (S.state === "listening" || S.state === "hearing") { stopListening(); setState("muted", "Muted"); } }
    else if (!S.speaking && !S.busy) listen();
  }
  function tapStage() {
    if (!S) return;
    if (S.speaking && S.afterSpeak) { var f = S.afterSpeak; S.afterSpeak = null; stopSpeaking(); f(); return; }
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
    var pre = "";
    if (S.pending) { // a removal is waiting for a spoken yes
      var pend = S.pending; S.pending = null;
      if (YES.test(text)) { await finishTurn(text, [pend], "", gen, true); return; }
      if (NO.test(text) || text.split(/\s+/).length <= 3) { reply_(text, "Okay, I left it as it is.", gen); return; }
      pre = "Okay, I left that alone. ";
    }
    var raw;
    try {
      raw = await answer(text);
    } catch (e) {
      if (!S || gen !== S.gen) return;
      S.busy = false; netError(e); return;
    }
    if (!S || gen !== S.gen) return;
    var parsed = parseActs(raw);
    if (!parsed.acts.length) {
      var plain = tidy(parsed.rest);
      if (!plain) { S.busy = false; netError({ code: "empty" }); return; }
      reply_(text, pre + plain, gen);
      return;
    }
    await finishTurn(text, parsed.acts, pre + tidy(parsed.rest), gen, false);
  }
  // say a reply, keep it in the call history and the captions
  function reply_(userText, spokenText, gen, histText) {
    if (!S || gen !== S.gen) return;
    S.history.push({ role: "user", content: userText }, { role: "assistant", content: histText || spokenText });
    if (S.history.length > 12) S.history = S.history.slice(-12);
    cap("bib", spokenText);
    S.busy = false;
    speak(spokenText);
  }
  // run the actions, then say what really happened (plus anything else the AI said)
  async function finishTurn(userText, acts, extra, gen, confirmed) {
    setState("thinking", "Working...");
    var said = [], after = [];
    for (var i = 0; i < acts.length && i < 4; i++) {
      var r;
      try { r = await VC.run(acts[i], confirmed); } catch (e) { r = { say: "Sorry, that didn't work." }; }
      if (!S || gen !== S.gen) return;
      if (r.say) said.push(r.say);
      if (r.after) after.push(r.after);
      if (r.page) minimize();
      if (r.stop) break;
    }
    if (S.pending) { extra = ""; after = []; } // a yes/no question ends the turn on its own
    if (/^[^.!?]*\?$/.test(String(extra).trim())) extra = ""; // no tacked-on "how does that feel?" after a command
    var spoken = [said.join(" "), extra, after.join(" ")].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || "Done.";
    var hist = "ACT " + JSON.stringify(acts.slice(0, 4)) + "\n" + [said.join(" "), extra].filter(Boolean).join(" ");
    reply_(userText, spoken, gen, hist.slice(0, 900));
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
    var sys = SYSTEM + "\n\n" + VC.prompt();
    var hist = S.history.slice(-10), total = sys.length + text.length;
    while (hist.length && total + hist.reduce(function (n, m) { return n + m.content.length; }, 0) > 8000) hist = hist.slice(2);
    var msgs = [{ role: "system", content: sys }].concat(hist).concat([{ role: "user", content: text }]);
    try {
      var d = await postProxy("", JSON.stringify({ messages: msgs, mode: "call", max_tokens: 450, stream: false }), { "Content-Type": "application/json" }, 25000);
      var c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      var out = String(c || "").trim();
      if (out) return out;
      throw Object.assign(new Error("empty"), { code: "empty" });
    } catch (e) {
      if (e.code === "offline" || e.code === "rate_limited" && e.scope === "ip_minute") throw e;
      if (window.BibleyAI && window.BibleyAI.generate) { // free fallback services
        var ctx = S.history.slice(-4).map(function (m) { return (m.role === "user" ? "Listener: " : "Bibley: ") + m.content; }).join("\n");
        var out2 = String(await window.BibleyAI.generate(sys, (ctx ? "Conversation so far:\n" + ctx + "\n\n" : "") + "Listener says: " + text, 300) || "").trim();
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
    if (/google|samsung/.test(n)) s += 4;
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
    try { if (S && S.player) { S.player.stop(); S.player = null; } } catch (e) {}
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
    var done = function () { if (!S || gen !== S.gen || S.speakId !== id) return; S.speakId = 0; S.speaking = false; if (S.afterSpeak) { var f = S.afterSpeak; S.afterSpeak = null; f(); return; } if (S.muted) setState("muted", "Muted"); else listen(); };
    var spoken = speakable(text);
    if (neuralOn()) speakNeural(spoken, id, gen, done); else speakDevice(spoken, id, gen, done);
  }
  // say it the way a person would: references as words, no symbols
  function speakable(text) {
    return String(text || "")
      .replace(/\b(\d?\s?[A-Z][a-z]+)\s(\d+):(\d+)(?:-(\d+))?/g, function (m, b, c, v, v2) { return b + " chapter " + c + " verse " + v + (v2 ? " to " + v2 : ""); })
      .replace(/&/g, " and ").replace(/[\u2014\u2013]/g, ", ").replace(/[\u201c\u201d"]/g, "").replace(/[*_#`~<>\[\]{}|\\^=+@$%]/g, " ")
      .replace(/\s+([,.!?])/g, "$1").replace(/\s+/g, " ").trim();
  }
  /* natural voice from the proxy (/speak). First sentence plays while the next one loads.
     Plays through Web Audio (the call's AudioContext, started by the Call tap) so the Android WebView allows it. */
  var K_TTS_OFF = "bibley_call_tts_off";
  function neuralOn() { try { return Date.now() > Number(localStorage.getItem(K_TTS_OFF) || 0); } catch (e) { return true; } }
  function neuralOff(ms) { try { localStorage.setItem(K_TTS_OFF, String(Date.now() + ms)); } catch (e) {} }
  function speakNeural(spoken, id, gen, done) {
    var q = [], i = 0, jobs = {};
    sentences(spoken).forEach(function (c) { while (c.length > 550) { var cut = c.lastIndexOf(", ", 550); if (cut < 200) cut = c.lastIndexOf(" ", 550); if (cut < 100) cut = 550; q.push(c.slice(0, cut + 1).trim()); c = c.slice(cut + 1).trim(); } if (c) q.push(c); });
    var alive = function () { return S && gen === S.gen && S.speakId === id; };
    var load = function (k) {
      if (k >= q.length) return null;
      if (jobs[k]) return jobs[k];
      var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 12000);
      jobs[k] = fetch(PROXY + "speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q[k] }), signal: ctl.signal })
        .then(function (r) {
          clearTimeout(tm);
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw Object.assign(new Error("tts"), { code: d && d.error && d.error.code, status: r.status }); });
          return r.arrayBuffer();
        }, function (e) { clearTimeout(tm); throw Object.assign(new Error("tts"), { code: "network" }); });
      jobs[k].catch(function () {});
      return jobs[k];
    };
    var fallback = function (k, e) {
      if (!alive()) return;
      var c = e && e.code;
      if (c === "tts_unavailable" || e && (e.status === 403 || e.status === 404)) neuralOff(6 * 3600000);
      else if (c === "rate_limited" || c === "daily_cap" || c === "upstream_busy") neuralOff(10 * 60000);
      speakDevice(q.slice(k).join(" "), id, gen, done);
    };
    var play = function (buf, k) {
      return new Promise(function (res, rej) {
        var ac = S && S.ac;
        if (ac && ac.decodeAudioData) {
          if (ac.state === "suspended") { try { ac.resume(); } catch (e) {} }
          ac.decodeAudioData(buf.slice(0), function (ab) {
            if (!alive()) return res();
            var src = ac.createBufferSource(); src.buffer = ab; src.connect(ac.destination);
            S.player = { stop: function () { try { src.onended = null; src.stop(); } catch (e) {} } };
            var g = setTimeout(res, ab.duration * 1000 + 1500);
            src.onended = function () { clearTimeout(g); res(); };
            src.start(0);
          }, function () { rej({ code: "decode" }); });
          return;
        }
        var url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" })), a = new Audio(url);
        S.player = { stop: function () { try { a.onended = a.onerror = null; a.pause(); } catch (e) {} URL.revokeObjectURL(url); } };
        a.onended = function () { URL.revokeObjectURL(url); res(); };
        a.onerror = function () { URL.revokeObjectURL(url); rej({ code: "play" }); };
        a.play().catch(function () { URL.revokeObjectURL(url); rej({ code: "play" }); });
      });
    };
    var next = function () {
      if (!alive()) return;
      if (i >= q.length) { if (S) S.player = null; done(); return; }
      var k = i++;
      load(k).then(function (buf) {
        if (!alive()) return;
        load(k + 1);
        return play(buf, k).then(next, function (e) { fallback(k, e); });
      }, function (e) { fallback(k, e); });
    };
    load(0); load(1);
    next();
  }
  function speakDevice(spoken, id, gen, done) {
    if (!S || gen !== S.gen || S.speakId !== id) return;
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
      u.lang = "en-US"; u.rate = 0.96; u.pitch = 1.0;
      if (voice) { try { u.voice = voice; u.lang = voice.lang || "en-US"; } catch (e) {} }
      var fired = false, guard = setTimeout(function () { if (!fired) { fired = true; next(); } }, 2500 + u.text.length * 90);
      u.onend = u.onerror = function () { if (fired) return; fired = true; clearTimeout(guard); next(); };
      try { ss.speak(u); } catch (e) { fired = true; clearTimeout(guard); done(); }
    };
    next();
  }
  // native voice callback from the Android app (Bibley 2.2+)
  function ttsEvent(id, what) { if (S && S.ttsDone && (what === "done" || what === "error")) { clearTimeout(S.speakGuard); S.ttsDone(id); } }

  /* ---------------- minimized call bar ---------------- */
  function minimize() {
    if (!S || S.mini) return;
    S.mini = true;
    S.el.classList.add("mini"); S.el.setAttribute("aria-modal", "false");
    var b = $("bcBar"); if (b) b.hidden = false;
    document.documentElement.classList.add("bc-mini-on");
  }
  function expand() {
    if (!S || !S.mini) return;
    S.mini = false;
    S.el.classList.remove("mini"); S.el.setAttribute("aria-modal", "true");
    var b = $("bcBar"); if (b) b.hidden = true;
    document.documentElement.classList.remove("bc-mini-on");
    var c = $("bcCaps"); if (c) c.scrollTop = c.scrollHeight;
  }

  /* ---------------- voice control: the app's real actions ---------------- */
  var YES = /^\s*(yes|yeah|yep|yup|ya|sure|ok|okay|do it|go ahead|confirm|please do|correct|right|delete it|remove it)\b/i;
  var NO = /^\s*(no|nope|nah|cancel|don't|do not|stop|never ?mind|keep it|leave it)\b/i;
  // find "ACT" then the JSON after it (array or object), matching brackets outside strings
  function parseActs(raw) {
    raw = String(raw || "");
    var k = raw.search(/\bACT\b\s*:?\s*[\[{]/);
    if (k < 0) return { acts: [], rest: raw };
    var st = raw.slice(k).search(/[\[{]/) + k, depth = 0, inStr = false, esc_ = false, end = -1;
    for (var i = st; i < raw.length; i++) {
      var ch = raw[i];
      if (inStr) { if (esc_) esc_ = false; else if (ch === "\\") esc_ = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) return { acts: [], rest: raw.slice(0, k) };
    var acts = [];
    try { var j = JSON.parse(raw.slice(st, end + 1)); acts = (Array.isArray(j) ? j : [j]).filter(function (x) { return x && typeof x === "object" && typeof x.a === "string"; }); } catch (e) { acts = []; }
    var rest = (raw.slice(0, k) + " " + raw.slice(end + 1)).replace(/^[\s:.-]+/, "");
    return { acts: acts, rest: rest };
  }
  var VC = (function () {
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var C = function () { return window.BibleyCore; }, FX = function () { return window.BibleyFX; };
    var MODES = { explain: "Explain", simple: "Simple", related: "Related verses", prayer: "Prayer", words: "Words" };
    var THEMES = { dark: "dark mode", light: "light mode", sepia: "sepia mode", black: "black mode", system: "your phone's theme" };
    var SCREENS = {
      settings: function () { window.BibleySettings.open(); return "Opened Settings."; },
      appearance: function () { window.BibleySettings.open("appearance"); return "Opened Appearance settings."; },
      reading: function () { window.BibleySettings.open("reading"); return "Opened Reading settings."; },
      modes: function () { window.BibleySettings.open("modes"); return "Opened Modes."; },
      notifications: function () { window.BibleySettings.open("device"); return "Opened Notifications."; },
      audio: function () { window.BibleySettings.open("audio"); return "Opened Audio settings."; },
      data: function () { window.BibleySettings.open("data"); return "Opened Data and backup."; },
      today: function () { FX().open.today(); return "Opened Today."; },
      mybible: function () { FX().open.myBible(); return "Opened My Bible."; },
      highlights: function () { FX().open.myBible(); return "Opened My Bible, where your highlights are."; },
      plans: function () { FX().open.plans(); return "Opened Reading plans."; },
      reader: function () { FX().open.settings(); return "Opened reader settings."; },
      notes: function () { if (window.BibleyStudyNB) window.BibleyStudyNB.open(); else window.BibleyNotes.open(); return "Opened Notes."; },
      scroll: function () { window.BibleyScroll.open(); return "Opened Scroll."; },
      search: function () { window.BibleyNav.openSearch(); return "Opened Search."; },
      books: function () { var b = document.getElementById("openNavBtn"); if (b) b.click(); return "Opened the book list."; },
      chat: function () { C().openAi("chat"); return "Opened the Chatbot."; },
      marks: function () { C().openAi("marks"); return "Opened your Marks."; },
      outline: function () { C().openAi("outline"); return "Opened the chapter Outline."; },
      summary: function () { C().openAi("chapter"); return "Opened the chapter summary."; }
    };
    function bookName(b, c) { var n = C().BOOKS[b][1]; return (n === "Psalms" && c) ? "Psalm" : n; }
    function refName(b, c, v, v2) { return bookName(b, c) + " " + c + (v ? ":" + v + (v2 && v2 > v ? "-" + v2 : "") : ""); }
    function findBook(name) {
      var s = String(name || "").trim().replace(/\./g, ""), f = C().findBookIndex, i = f(s);
      if (i < 0) i = f(s.replace(/^psalm\b/i, "Psalms"));
      if (i < 0) i = f(s.replace(/^(first|1st|one)\s+/i, "1 ").replace(/^(second|2nd|two)\s+/i, "2 ").replace(/^(third|3rd|three)\s+/i, "3 "));
      if (i < 0) i = f(s.replace(/s$/i, ""));
      if (i < 0) i = f(s.replace(/^the\s+/i, "").replace(/^(gospel of|book of)\s+/i, ""));
      if (i < 0) { var lo = s.toLowerCase(); C().BOOKS.some(function (bk, k) { if (String(bk[1]).toLowerCase().indexOf(lo) === 0 && lo.length >= 3) { i = k; return true; } return false; }); }
      return i;
    }
    function selected() { try { var t = FX().selection(); if (t && t.verseNum) return t; } catch (e) {} return null; }
    // where an action points: {b, c, v, v2, ver} or {err}
    function target(a, needVerse) {
      var p = C().panes.a, b = p.bookIdx, c = p.chapter, v = 0, sel = selected();
      if (a.book) { b = findBook(a.book); if (b < 0) return { err: "I couldn't find the book " + a.book + "." }; c = parseInt(a.ch, 10) || 1; }
      else if (a.ch) c = parseInt(a.ch, 10) || c;
      if (a.v) v = parseInt(a.v, 10) || 0;
      else if (needVerse && sel && !a.book && !a.ch) { b = sel.bookIdx; c = sel.chapter; v = sel.verseNum; }
      var maxC = C().BOOKS[b][2];
      if (c < 1 || c > maxC) return { err: bookName(b, 0) + " only has " + maxC + " chapter" + (maxC > 1 ? "s" : "") + "." };
      if (needVerse && !v) return { err: "Which verse? Say the verse number, like verse 1." };
      return { b: b, c: c, v: v, v2: parseInt(a.to, 10) || 0, ver: p.version };
    }
    async function verses(t) { var vs = await C().getChapter(t.ver, t.b, t.c); return Array.isArray(vs) ? vs : []; }
    async function verseObj(t) {
      var vs = await verses(t), hit = vs.filter(function (x) { return +x.verse === t.v; })[0];
      if (!hit) return null;
      return { key: FX().voice.vKey(t.b, t.c, t.v), bookIdx: t.b, chapter: t.c, verseNum: t.v, text: hit.text, version: t.ver, ref: FX().voice.refOf(t.b, t.c, t.v) };
    }
    async function closeOverlays() {
      for (var i = 0; i < 6 && history.state && typeof history.state === "object"; i++) { history.back(); await wait(170); }
      try { if (window.BibleySettings && window.BibleySettings.isOpen && window.BibleySettings.isOpen()) { window.BibleySettings.close(); await wait(220); } } catch (e) {}
      try { if (FX().voice.sheetOpen()) FX().voice.closeSheet(); } catch (e) {}
      try { if (window.BibleyNav) window.BibleyNav.closeMenu(); } catch (e) {}
      try { C().closeAi(); C().closeDrawer(); } catch (e) {}
    }
    async function show(t) { // bring the chapter (and verse) on screen
      await closeOverlays();
      var p = C().panes.a;
      if (p.bookIdx !== t.b || p.chapter !== t.c || t.v) FX().jumpToVerse(t.b, t.c, t.v || 0);
      await wait(350);
    }
    function clip(text, n) { text = String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); if (text.length <= n) return text; var cut = text.slice(0, n), k = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! ")); return (k > n * 0.5 ? cut.slice(0, k + 1) : cut + "..."); }
    var DESTRUCTIVE = { unbookmark: 1, unhighlight: 1, delete_note: 1 };

    async function run(a, confirmed) {
      var t, o, vb;
      var kind = String(a.a || "").toLowerCase();
      if (DESTRUCTIVE[kind] && !confirmed) {
        t = target(a, true); if (t.err) return { say: t.err, stop: true };
        o = await verseObj(t); if (!o) return { say: "I couldn't find " + refName(t.b, t.c, t.v) + ".", stop: true };
        var have = kind === "unbookmark" ? FX().voice.vbms()[o.key] : kind === "unhighlight" ? C().getHighlights()[o.key] : FX().voice.notes()[o.key];
        var what = kind === "unbookmark" ? "bookmark" : kind === "unhighlight" ? "highlight" : "note";
        if (!have) return { say: "There's no " + what + " on " + refName(t.b, t.c, t.v) + ".", stop: true };
        S.pending = { a: kind, book: C().BOOKS[t.b][1], ch: t.c, v: t.v };
        return { say: "Do you want me to remove your " + what + " on " + refName(t.b, t.c, t.v) + "? Say yes or no.", stop: true };
      }
      switch (kind) {
        case "open": {
          if (!a.book && !a.ch) return { say: "Which book and chapter should I open?" };
          t = target(a, false); if (t.err) return { say: t.err, stop: true };
          await show(t);
          return { say: "Opened " + refName(t.b, t.c, t.v) + ".", page: true };
        }
        case "next": case "prev": {
          await closeOverlays();
          if (kind === "next") C().goNext(); else C().goPrev();
          await wait(350);
          var pp = C().panes.a;
          return { say: "Opened " + refName(pp.bookIdx, pp.chapter) + ".", page: true };
        }
        case "read": {
          t = target(a, false); if (t.err) return { say: t.err, stop: true };
          var vs = await verses(t); if (!vs.length) return { say: "I couldn't load " + refName(t.b, t.c) + " right now.", stop: true };
          var from = t.v || 1, to = t.v ? (t.v2 || t.v) : vs.length, part = vs.filter(function (x) { return +x.verse >= from && +x.verse <= to; });
          var more = false; if (part.length > 40) { part = part.slice(0, 40); more = true; }
          if (!part.length) return { say: "I couldn't find that verse.", stop: true };
          var p2 = C().panes.a, page = false;
          if (p2.bookIdx !== t.b || p2.chapter !== t.c || t.v) { await show(t); page = true; }
          var body = part.map(function (x) { return String(x.text).replace(/\s+/g, " ").trim(); }).join(" ");
          var last = part[part.length - 1].verse;
          return { say: "", after: refName(t.b, t.c, t.v ? from : 0, t.v ? last : 0) + ". " + body + (more ? " That's the first 40 verses." : ""), page: page };
        }
        case "search": {
          var q = String(a.q || "").trim().slice(0, 80); if (!q) return { say: "What should I search for?" };
          await closeOverlays();
          window.BibleyNav.openSearch();
          await wait(200);
          var inp = document.getElementById("scriptureSearch");
          if (!inp) return { say: "Search isn't ready yet.", stop: true };
          inp.value = q; inp.dispatchEvent(new Event("input", { bubbles: true }));
          try { inp.blur(); } catch (e) {}
          return { say: "Searching for " + q + ".", page: true };
        }
        case "bookmark": {
          t = target(a, true); if (t.err) return { say: t.err, stop: true };
          o = await verseObj(t); if (!o) return { say: "I couldn't find " + refName(t.b, t.c, t.v) + ".", stop: true };
          await show(t);
          if (FX().voice.vbms()[o.key]) return { say: refName(t.b, t.c, t.v) + " is already bookmarked.", page: true };
          FX().voice.toggleVbm(o);
          return { say: "Bookmarked " + refName(t.b, t.c, t.v) + ".", page: true };
        }
        case "highlight": {
          t = target(a, true); if (t.err) return { say: t.err, stop: true };
          o = await verseObj(t); if (!o) return { say: "I couldn't find " + refName(t.b, t.c, t.v) + ".", stop: true };
          var col = String(a.color || "yellow").toLowerCase(); if (FX().voice.colors.indexOf(col) < 0) col = "yellow";
          await show(t);
          FX().voice.setHighlight(o, col);
          return { say: "Highlighted " + refName(t.b, t.c, t.v) + " in " + col + ".", page: true };
        }
        case "note": {
          t = target(a, true); if (t.err) return { say: t.err, stop: true };
          var txt = String(a.text || "").trim().slice(0, 1000); if (!txt) return { say: "What should the note say?" };
          o = await verseObj(t); if (!o) return { say: "I couldn't find " + refName(t.b, t.c, t.v) + ".", stop: true };
          var old = FX().voice.notes()[o.key];
          await show(t);
          FX().voice.setNote(o, old && old.text ? old.text + "\n" + txt : txt);
          return { say: (old ? "Added to your note on " : "Saved a note on ") + refName(t.b, t.c, t.v) + ".", page: true };
        }
        case "read_notes": {
          var all = FX().voice.notes(), list = Object.keys(all).map(function (k) { return all[k]; }).filter(function (n) { return n && n.text; });
          if (!list.length) return { say: "You don't have any verse notes yet." };
          list.sort(function (x, y) { return (y.updated || 0) - (x.updated || 0); });
          var out = list.slice(0, 3).map(function (n) { return refName(n.bookIdx, n.chapter, n.verseNum) + ": " + clip(n.text, 200); });
          return { say: "You have " + list.length + " note" + (list.length > 1 ? "s" : "") + ". " + (list.length > 3 ? "The newest three. " : "") + out.join(". ") + "." };
        }
        case "unbookmark": case "unhighlight": case "delete_note": {
          t = target(a, true); if (t.err) return { say: t.err, stop: true };
          o = await verseObj(t); if (!o) return { say: "I couldn't find that verse.", stop: true };
          await show(t);
          if (kind === "unbookmark") { if (FX().voice.vbms()[o.key]) FX().voice.toggleVbm(o); return { say: "Removed the bookmark on " + refName(t.b, t.c, t.v) + ".", page: true }; }
          if (kind === "unhighlight") { FX().voice.setHighlight(o, null); return { say: "Removed the highlight on " + refName(t.b, t.c, t.v) + ".", page: true }; }
          FX().voice.setNote(o, ""); return { say: "Deleted the note on " + refName(t.b, t.c, t.v) + ".", page: true };
        }
        case "study": {
          var mode = String(a.mode || "explain").toLowerCase(); if (!MODES[mode]) mode = "explain";
          t = target(a, true); if (t.err) return { say: t.err, stop: true };
          o = await verseObj(t); if (!o || !window.BibleyVerseAI) return { say: "I couldn't open that verse.", stop: true };
          var it = { bookIdx: o.bookIdx, chapter: o.chapter, verseNum: o.verseNum, verses: [o.verseNum], ref: refName(t.b, t.c, t.v), text: o.text, version: o.version };
          await closeOverlays();
          window.BibleyVerseAI.open(it, mode);
          minimize();
          var got = "";
          for (var w = 0; w < 60 && !got; w++) { got = window.BibleyVerseAI.cacheGet(it, mode) || ""; if (!got) await wait(500); if (!S) return { say: "" }; }
          if (!got) return { say: MODES[mode] + " for " + refName(t.b, t.c, t.v) + " is on your screen.", page: true };
          return { say: MODES[mode] + " for " + refName(t.b, t.c, t.v) + ".", after: clip(tidy(got.replace(/<[^>]+>/g, " ")), 650), page: true };
        }
        case "theme": {
          var th = String(a.t || a.theme || "").toLowerCase(); if (th === "night") th = "dark"; if (th === "day") th = "light";
          if (!THEMES[th]) return { say: "I can switch to dark, light, sepia or black." };
          window.BibleySettings.setTheme(th);
          return { say: "Switched to " + THEMES[th] + ".", page: true };
        }
        case "text_size": {
          var pr = FX().voice.prefs(), n = a.size ? parseInt(a.size, 10) : pr.size + (parseInt(a.step, 10) || 2);
          n = Math.max(14, Math.min(30, n || pr.size));
          FX().voice.setPref("size", n); await closeOverlays();
          return { say: n === pr.size ? "Text size is already " + n + "." : "Text size is now " + n + ".", page: true };
        }
        case "reminder": {
          if (!window.BibleyDevice || !window.BibleyDevice.setReminderTime) return { say: "Reminders are still loading. Try again in a second." };
          var tm = String(a.time || "").trim().replace(/^(\d):/, "0$1:");
          var r = await window.BibleyDevice.setReminderTime(tm);
          if (!r.ok) return { say: r.note === "bad_time" ? "What time should I set it for?" : "I couldn't set that here. You can set it in Settings, Notifications." };
          if (r.on) return { say: "Your daily verse is set for " + r.nice + "." };
          if (r.note === "install") return { say: "I saved " + r.nice + ". To get the notification on iPhone, add Bibley to your Home Screen first." };
          if (r.note === "denied") return { say: "I saved " + r.nice + ", but notifications are blocked for Bibley in your browser settings." };
          if (r.note === "unsupported") return { say: "I saved " + r.nice + ", but this browser can't show Bibley notifications." };
          return { say: "I saved " + r.nice + ". Allow notifications when Bibley asks, or turn on Daily verse in Settings, Notifications." };
        }
        case "screen": {
          var sc = String(a.s || a.screen || "").toLowerCase().replace(/[^a-z]/g, "");
          if (sc === "home") return run({ a: "home" }, true);
          if (sc === "dailyverse" || sc === "reminder" || sc === "device") sc = "notifications";
          if (!SCREENS[sc]) return { say: "I can't open that screen yet." };
          if (sc !== "settings" && ["appearance", "reading", "modes", "notifications", "audio", "data"].indexOf(sc) < 0) await closeOverlays();
          var said = SCREENS[sc]();
          return { say: said, page: true };
        }
        case "translation": {
          var want = String(a.code || a.name || "").toLowerCase().trim(), V = C().VERSIONS || [];
          var hit = V.filter(function (x) { return String(x[0]).toLowerCase() === want; })[0] ||
            V.filter(function (x) { return String(x[1] || "").toLowerCase() === want || String(x[2] || "").toLowerCase() === want; })[0];
          var sel_ = document.getElementById("versionSelect");
          if (!hit || !sel_ || !sel_.querySelector('option[value="' + hit[0] + '"]')) return { say: "I couldn't find that translation in Bibley." };
          await closeOverlays();
          sel_.value = hit[0]; sel_.dispatchEvent(new Event("change", { bubbles: true }));
          return { say: "Switched to " + (C().versionFullName ? C().versionFullName(hit[0]) : hit[0].toUpperCase()) + ".", page: true };
        }
        case "back": {
          if (history.state && typeof history.state === "object") { history.back(); await wait(250); return { say: "Went back.", page: true }; }
          try { if (window.BibleySettings && window.BibleySettings.isOpen()) { window.BibleySettings.close(); return { say: "Went back.", page: true }; } } catch (e) {}
          await closeOverlays(); return { say: "Went back to your Bible.", page: true };
        }
        case "home": { await closeOverlays(); return { say: "Back to your Bible.", page: true }; }
        case "hangup": { S.afterSpeak = hangUp; return { say: "Okay, talk soon. Bye!", stop: true }; }
      }
      return { say: "I can't do that in the app yet." };
    }

    function prompt() {
      var st = "";
      try {
        var p = C().panes.a, sel = selected(), pr = FX().voice.prefs();
        var th = window.BibleySettings && window.BibleySettings.currentTheme ? window.BibleySettings.currentTheme() : pr.theme;
        var rem = window.BibleyDevice && window.BibleyDevice.reminderInfo ? window.BibleyDevice.reminderInfo() : null;
        var codes = (C().VERSIONS || []).map(function (x) { return x[0]; }).slice(0, 70).join(" ");
        st = "The app right now: open chapter " + C().BOOKS[p.bookIdx][1] + " " + p.chapter + " (" + String(p.version).toUpperCase() + "). " +
          "Selected verse: " + (sel ? sel.bookName + " " + sel.chapter + ":" + sel.verseNum : "none") + ". Theme: " + th + ". Text size: " + pr.size + ". " +
          (rem ? "Daily verse reminder: " + (rem.on ? "on at " : "off, time ") + rem.time + ". " : "") + "Translation codes: " + codes + ".";
      } catch (e) {}
      return "You can also control the Bibley app on this call. When the person asks you to DO something in the app, start your reply with one line: ACT followed by a JSON array of actions. " +
        "The app runs them and says out loud what it did, so for a plain app command write ONLY the ACT line: no description, no follow-up question, nothing else. Add words after the line only if they also asked a question. Never claim you did something without an ACT line.\n" +
        "Actions (use exactly these fields):\n" +
        '{"a":"open","book":"Psalms","ch":23,"v":4} open a chapter, v optional\n' +
        '{"a":"next"} {"a":"prev"} next or previous chapter\n' +
        '{"a":"read","book":"Psalms","ch":23,"v":1,"to":6} read aloud, every field optional (default: the whole open chapter)\n' +
        '{"a":"search","q":"shepherd"}\n' +
        '{"a":"bookmark","v":1} {"a":"unbookmark","v":1}\n' +
        '{"a":"highlight","v":1,"color":"yellow"} colors yellow green blue pink purple; {"a":"unhighlight","v":1}\n' +
        '{"a":"note","v":1,"text":"the note"} {"a":"read_notes"} {"a":"delete_note","v":1}\n' +
        '{"a":"study","mode":"explain","v":4} modes explain simple related prayer words\n' +
        '{"a":"theme","t":"dark"} t is dark, light, sepia, black or system\n' +
        '{"a":"text_size","step":2} bigger (use -2 for smaller) or {"a":"text_size","size":20}\n' +
        '{"a":"reminder","time":"07:00"} daily verse notification time, 24-hour; 7 means 07:00 unless they say pm or evening\n' +
        '{"a":"screen","s":"settings"} s is settings, appearance, reading, modes, notifications, audio, data, today, mybible, plans, notes, scroll, search, books, chat, marks, outline, summary, reader\n' +
        '{"a":"translation","code":"kjv"}\n' +
        '{"a":"back"} {"a":"home"} {"a":"hangup"}\n' +
        "bookmark, highlight, note, study, unbookmark, unhighlight and delete_note may also take book and ch; without them they mean the open chapter, and without v they mean the selected verse. " +
        "Use the full book name (Psalms, 1 Corinthians, Song of Songs). Example: user says open Psalm 23 and bookmark verse 1 -> ACT [{\"a\":\"open\",\"book\":\"Psalms\",\"ch\":23},{\"a\":\"bookmark\",\"v\":1}]. " +
        "If they ask for something the app cannot do, say so kindly. For questions about the Bible, just answer, no ACT line.\n" + st;
    }
    return { run: run, prompt: prompt };
  })();

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
  window.BibleyCall = { open: open, hangUp: hangUp, minimize: minimize, expand: expand, _parse: function (r) { return parseActs(r); }, _ttsEvent: ttsEvent, get active() { return !!S; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButtons); else addButtons();
})();
