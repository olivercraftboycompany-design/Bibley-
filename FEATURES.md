# Bibley feature roadmap

Oliver's feature list (sent 2026-11-26), tracked here. Status:

- ✅ **Built** — working in the app now (see the version noted)
- 🔨 **Existing** — was already in Bibley before this list
- 🕓 **Planned** — not built yet; reason noted

## 1. Database, Accounts & Community

- 🔨 Sign up/in + cloud sync across devices (notes, highlights, bookmarks, settings, streaks) — **Existing since 6.8**: Settings > Account & Cloud Sync, syncs through bibley.sites.tab.bot. Recaps, prayers, memory progress and plans from 7.2 sync through the same account.
- ✅ Prayer list (private, active/answered) + guided prayers — **Built in 7.2** (Plus > Prayer list). Private only; the shared-prayer half is 🕓 pending a deliberate, opt-in design.
- 🕓 Friends list to share highlights, notes & encouragement — needs a deliberate privacy design on the sync backend; nothing is shared publicly by default.
- 🕓 Group reading plans + daily discussions — same.
- 🕓 Public verse notes + Church hub (events, bulletins, sermon outlines, giving links) — public-by-design surface; needs Oliver's explicit choices on moderation and content before anything is built.

## 2. Reading & Comparison

- ✅ Word-level & % diff highlighting between parallel translations — **Built in 7.2**: open Compare, tap "Diff" in the second pane's toolbar; changed words are underlined and the pane shows "% different".
- 🕓 Red-letter mode (words of Jesus) — the bundled translations carry no red-letter markup; needs a licensed words-of-Jesus dataset.
- ✅ Back/forward chapter history — **Built in 7.2**: ‹ › buttons in the reading toolbar retrace the chapters you visited.
- 🕓 Multi-language Bibles + multi-language UI — large content + translation project.
- ✅ Print-friendly reading & study view — **Built in 7.2**: Plus > Tools > Print this chapter (browser "Save as PDF" works from the same view).

## 3. Study & Original Languages

- 🕓 Strong's Concordance + Greek/Hebrew interlinear, transliteration & word study — needs bundled Strong's/lexicon data (public-domain sources identified; size and quality review pending).
- 🕓 Cross-references + public-domain commentaries & Bible dictionary — same data-bundling work (Treasury of Scripture Knowledge and public-domain commentaries are candidates).
- 🕓 Book intros, outlines, timelines, character profiles & interactive Bible maps — content to write/source; maps need artwork. 🔨 Chapter summaries, key points, structure, verse context and outlines already exist in the Study assistant.

## 4. Search, Audio & Journaling

- ✅ Filtered search (book/testament/version) — **Built in 7.2**: Plus > Search+ searches the whole Bible in any bundled translation, filtered by testament or book.
- ✅ Saved search history — **Built in 7.2**: recent searches appear as chips in Search+; clearable.
- ✅ Voice search — **Built in 7.2**: mic button in the Books drawer search and in Search+ (Chrome/Edge).
- ✅ Random verse picker — **Built in 7.2**: Books drawer > Random verse, or Plus > Tools.
- 🔨 Synced verse highlighting while listening — already existed; read-aloud highlights the current verse and follows along.
- ✅ TTS sleep timer + speed controls — **Built in 7.2**: a bar appears while reading aloud with a sleep timer (5–60 min) and speed control.
- ✅ Trash/recovery for deleted notes — **Built in 7.2**: Plus > Tools > Trash restores deleted notes, saved verses, memory verses and prayers for 30 days.
- ✅ Journal PIN lock + reflection log — **Built in 7.2**: Plus > Journal. Entries are AES-GCM encrypted with a key derived from the PIN or passphrase (PBKDF2, 250k rounds); only ciphertext plus a last-modified timestamp is stored or synced, and the PIN is never stored. The app says plainly: a short numeric PIN can be brute-forced by someone who gets the data (use a longer passphrase), a forgotten PIN means no recovery, and encryption can't protect against malicious software on the device itself. Locks automatically (10 min idle, tab hide, or sheet close).
- ✅ PDF / Markdown / CSV export — **Built in 7.2**: Plus > Tools > Export Markdown / Export CSV / Print (Save as PDF).

## 5. Plans & Memorization

- ✅ Flashcards, fill-in-the-blank & first-letter memorization + reference quiz — **Built in 7.2**: Plus > Memory practice (works with the existing Memorize verse list).
- ✅ Spaced repetition — **Built in 7.2**: reviews are scheduled by how well you know each verse; due count shows on the Plus menu.
- ✅ Custom reading-plan builder — **Built in 7.2**: Plus > Reading plans+ > Build a custom plan (choose books and pace).
- ✅ Catch-up & skip-day — **Built in 7.2**: behind-schedule banner with Catch up; Skip this day on the current reading.
- ✅ Seasonal plans (Advent, Lent, Easter/Holy Week) — **Built in 7.2**: dates are computed each year (e.g. Lent starts Ash Wednesday).
- ✅ Daily recap — **Built in 7.2**: Plus > Daily recap (reading, notes, highlights, saved verses, prayers, memory, journal, streak; copyable).
- ✅ Monthly recap — **Built in 7.2**: Plus > Monthly recap (chapters, active days, best streak, top books, prayers, memory; browsable by month).

Recaps only count activity recorded on the device; they don't invent history for days with no records.

## Still to do (summary)

Red-letter data, Strong's/interlinear + word study, cross-references, commentaries/dictionary, book intros/timelines/profiles/maps, multi-language Bibles and UI, and the community features (friends, group plans, public notes, church hub) which will be designed privacy-first and opt-in.
