# Bibley feature roadmap

Oliver's feature list (sent 2026-11-26), tracked here. Status:

- ✅ **Built** — working in the app now (see the version noted)
- 🔨 **Existing** — was already in Bibley before this list
- 🗑 **Removed** — built in 7.2, then removed in 7.2.2 at Oliver's request (2026-11-26); can be restored if he asks
- 🕓 **Planned** — not built yet; reason noted

## 1. Database, Accounts & Community

- 🔨 Sign up/in + cloud sync across devices (notes, highlights, bookmarks, settings, streaks) — **Existing since 6.8**: Settings > Account & Cloud Sync, syncs through bibley.sites.tab.bot.
- 🗑 Prayer list (private, active/answered) + guided prayers — **Removed in 7.2.2** (built in 7.2) (Plus > Prayer list). Private only; the shared-prayer half is 🕓 pending a deliberate, opt-in design.
- 🕓 Friends list to share highlights, notes & encouragement — needs a deliberate privacy design on the sync backend; nothing is shared publicly by default.
- 🕓 Group reading plans + daily discussions — same.
- 🕓 Public verse notes + Church hub (events, bulletins, sermon outlines, giving links) — public-by-design surface; needs Oliver's explicit choices on moderation and content before anything is built.

## 2. Reading & Comparison

- ✅ Word-level & % diff highlighting between parallel translations — **Built in 7.3** (rebuilt from scratch): open Compare (More > Compare translations) and the words that differ are marked in both panes; the chip in the second pane's toolbar shows how different the chapter is (e.g. "31% different") and turns the marks on or off. Same switch in Settings > Reading > Compare; the choice is saved and syncs. Word-level Myers diff that ignores case, punctuation, apostrophes and accents; verses only one translation has are marked whole, and when the verse numbering differs (e.g. psalm titles counted as verse 1) the chapter is compared as one passage.
- 🕓 Red-letter mode (words of Jesus) — the bundled translations carry no red-letter markup; needs a licensed words-of-Jesus dataset.
- ✅ Back/forward chapter history — **Built in 7.3** (rebuilt from scratch): back / forward arrows next to Books in the top bar retrace the chapters you opened, like a browser (going somewhere new after going back drops the forward list) and return you to where you were in the chapter. The phone's Back button steps back through them too when no sheet or screen is open, and closes the Books drawer or Study panel if one is open. Kept for the session (until Bibley is closed). On phones the forward arrow appears once you've gone back.
- 🕓 Multi-language Bibles + multi-language UI — large content + translation project.
- ✅ Print-friendly reading & study view — **Built in 7.3** (rebuilt from scratch): More (⋮) > Print chapter ("Print both translations" in Compare) prints a clean page: the chapter with section headings, your highlights and notes, the copyright lines, and in Compare both translations side by side verse by verse (with the differences underlined if they're on). The browser's own Print / Save as PDF gives the same page. The Android app's WebView can't print yet, so it says so; use Bibley in Chrome.

## 3. Study & Original Languages

- 🕓 Strong's Concordance + Greek/Hebrew interlinear, transliteration & word study — needs bundled Strong's/lexicon data (public-domain sources identified; size and quality review pending).
- 🕓 Cross-references + public-domain commentaries & Bible dictionary — same data-bundling work (Treasury of Scripture Knowledge and public-domain commentaries are candidates).
- 🕓 Book intros, outlines, timelines, character profiles & interactive Bible maps — content to write/source; maps need artwork. 🔨 Chapter summaries, key points, structure, verse context and outlines already exist in the Study assistant.

## 4. Search, Audio & Journaling

- 🗑 Filtered search (book/testament/version) — **Removed in 7.2.2** (built in 7.2): Plus > Search+ searches the whole Bible in any bundled translation, filtered by testament or book.
- 🗑 Saved search history — **Removed in 7.2.2** (built in 7.2): recent searches appear as chips in Search+; clearable.
- 🗑 Voice search — **Removed in 7.2.2** (built in 7.2): mic button in the Books drawer search and in Search+ (Chrome/Edge).
- 🗑 Random verse picker — **Removed in 7.2.2** (built in 7.2): Books drawer > Random verse, or Plus > Tools.
- 🔨 Synced verse highlighting while listening — already existed; read-aloud highlights the current verse and follows along.
- 🗑 TTS sleep timer + speed controls — **Removed in 7.2.2** (built in 7.2): a bar appears while reading aloud with a sleep timer (5–60 min) and speed control.
- 🗑 Trash/recovery for deleted notes — **Removed in 7.2.2** (built in 7.2): Plus > Tools > Trash restores deleted notes, saved verses, memory verses and prayers for 30 days.
- 🗑 Journal PIN lock + reflection log — **Removed in 7.2.2** (built in 7.2): Plus > Journal. Entries are AES-GCM encrypted with a key derived from the PIN or passphrase (PBKDF2, 250k rounds); only ciphertext plus a last-modified timestamp is stored or synced, and the PIN is never stored. The app says plainly: a short numeric PIN can be brute-forced by someone who gets the data (use a longer passphrase), a forgotten PIN means no recovery, and encryption can't protect against malicious software on the device itself. Locks automatically (10 min idle, tab hide, or sheet close).
- 🗑 PDF / Markdown / CSV export — **Removed in 7.2.2** (built in 7.2): Plus > Tools > Export Markdown / Export CSV / Print (Save as PDF).

- ✅ Historic Christian writings lookup (Augustine & Calvin) — **Added 2026-11-26**: in the Study Assistant chatbot with the on-device engine, a question the Bible search can't match is answered honestly ("I searched the Bible text I have here and did not find a passage matching this question") and, when the topic appears in historic writings, shows matching passages from Augustine's Confessions (Pusey translation) and Calvin's Institutes (Allen translation, volume 1 of 2 - public-domain sources). Excerpts appear in expandable cards labeled "From historic Christian writings - not Scripture", each with the full passage and a link to the whole source text. No-match replies attach no verse chips or cards. Retrieval only: this is not a new AI model and adds no generated answers; the corpus is two works, so coverage is narrow and the wording says exactly what was searched.
- ✅ Find a verse with AI — **Built in 7.5** (2026-11-27): describe a verse in your own words ("the one where God so loved the world", "don't worry about tomorrow", "be strong and courageous") in the Books search (a "Find verses about … with AI" row appears when the text isn't a book name or is 3+ words; Enter opens it) or the Study Notebook search ("Ask AI: find verses about …"). Up to 5 verses appear in a pop-up, best first; tap one (or Open) to jump to it, or Add to notebook / Copy. The AI (same engine as the rest of Bibley: Groq through Oliver's proxy first, then the free services) only names references; every one is checked against the bundled King James text, references that don't exist are dropped, and the verse text shown always comes from the Bible data, never from the AI. A plain reference ("John 3:16") is looked up directly. If the AI can't be reached (offline, services busy) it says so with Try again and shows on-device keyword matches from the KJV instead. New files `bibley-versefind.js` / `.css`; nothing is stored.
- ✅ Live formatting in the Study Notebook — **Built in 7.5** (2026-11-27): Write mode now shows formatting as you type — B / Ctrl+B makes text bold, I / Ctrl+I italic, H1 / H2 are real headings, lists, numbered lists, checklists (tap the box to tick), quotes, callouts, dividers and the new code blocks look finished, with no `**` or `#` marks visible; toolbar buttons light up for the formatting under the cursor. Markdown shortcuts work while typing (`# `, `## `, `- `, `1. `, `> `, `[] `, `**bold**`, `*italic*`, ``` or --- then Enter). Paste is plain text (Markdown in it gets formatted). Notes are still saved as the same Markdown as before, so existing notes open formatted and Preview, search, export, share, Grammar Fix and sync keep working; Write / Split / Preview stay. New file `bibley-mdedit.js` (plain JavaScript, no libraries).

## 5. Plans & Memorization

- 🗑 Flashcards, fill-in-the-blank & first-letter memorization + reference quiz — **Removed in 7.2.2** (built in 7.2): Plus > Memory practice (works with the existing Memorize verse list).
- 🗑 Spaced repetition — **Removed in 7.2.2** (built in 7.2): reviews are scheduled by how well you know each verse; due count shows on the Plus menu.
- 🗑 Custom reading-plan builder — **Removed in 7.2.2** (built in 7.2): Plus > Reading plans+ > Build a custom plan (choose books and pace).
- 🗑 Catch-up & skip-day — **Removed in 7.2.2** (built in 7.2): behind-schedule banner with Catch up; Skip this day on the current reading.
- 🗑 Seasonal plans (Advent, Lent, Easter/Holy Week) — **Removed in 7.2.2** (built in 7.2): dates are computed each year (e.g. Lent starts Ash Wednesday).
- ✅ Daily recap — **Built in 7.4** (rebuilt from scratch, no Plus menu): More (⋮) > Recap, the "Your recap" button on the streak card (Today and Reading plans), or Settings > Study & notes > Recap. The Day tab shows chapters read, time in Bibley, study marks, the current streak, reading-plan progress (and plan days completed), and the notes, highlights, saved and liked verses and memory verses from that day, each tappable to open the verse. Browse back day by day (arrows, swipe or ←/→); Copy or Share as text.
- ✅ Weekly recap — **Built in 7.4** (new): the Week tab shows chapters read, active days, time in Bibley, best streak, a day-by-day strip (tap a day to open it), most-read books, books finished, study counts and last week for comparison. Weeks start on Sunday or Monday automatically from the device's region, or as chosen in Settings > Study & notes > Recap week starts on. Browse previous weeks; Copy or Share as text. The streak card on Today also shows this week as seven dots.
- ✅ Monthly recap — **Built in 7.4** (rebuilt from scratch): the Month tab shows chapters read, active days, best streak, time in Bibley, a calendar of the month shaded by chapters read (tap a day to open it), the top five books, books finished, study counts and last month for comparison. Browse previous months; Copy or Share as text.

- ✅ More on-device AI models — **Built in 7.6**: ten new on-device models under 1B parameters join Bibley 2.1 and 2.2 in Settings > AI Engine: Bibley 2.3 Qwen3.5 0.8B, 2.4 LFM2 700M, 2.5 Qwen2.5 0.5B Instruct, 2.6 LFM2.5 350M, 2.7 LFM2 350M, 2.8 Granite 4.0 350M, 2.9 ERNIE 4.5 0.3B, 2.10 SmolLM2 360M, 2.11 Gemma 3 270M (experimental) and 2.12 SmolLM2 135M. A model with only one build (WebGPU or CPU) uses the one it has.
- ✅ Teachings for on-device AI — **Built in 7.6**: every on-device model now gets the KJV verse lookup plus short passages from the teachings library (Augustine's Confessions, Calvin's Institutes), labelled as that writer's words, not Scripture. Loads only when needed; offline or slow, answers use verses only.

Recaps only count what Bibley recorded (chapters marked read, the streak's activity days, plan days, and the time stamps on notes, highlights, saved, liked and memory verses); days with no records stay empty and nothing is estimated. New in 7.4 and recorded from then on: time in Bibley (while the app is on screen and in use: a tap, scroll or key in the last 2 minutes, or read-aloud playing) and chapters opened (30 seconds of that time on a chapter), kept per day and per device in `bibley_daylog_v1`, which syncs with the account and rides in backups; the week-start choice is `bibley_recap_v1` (synced); the device id `bibley_recap_device_v1` never syncs.

Note: everything marked 🗑 was removed from the app on 2026-11-26 at Oliver's request ("Remove bibley plus"). The 7.2 code remains in git history and can be restored if he asks. The ✅ 7.3 and 7.4 items above were rebuilt from scratch inside the reader (no Plus menu) and share none of the 7.2 code.

## Still to do (summary)

Red-letter data, Strong's/interlinear + word study, cross-references, commentaries/dictionary, book intros/timelines/profiles/maps, multi-language Bibles and UI, and the community features (friends, group plans, public notes, church hub) which will be designed privacy-first and opt-in.
