# Bibley feature status

Features are placed in the matching reader and study sections. There is no separate Plus tab.

| Section | Available in this update |
| --- | --- |
| Today → Your activity | Daily recap with date navigation and copy; monthly recap with reading counts, active days, longest streak, most-read books and study totals. Recaps use records available on the device, including any synced records. They are not a historical audit, and don't reconstruct activity that was never recorded. |
| Today → Prayer & reflection | Private active/answered prayer requests, guided prayers and access to the reflection journal. Prayers can sync to the signed-in Bibley account; they are not shared publicly. |
| My Bible → Personal study | Encrypted reflection journal with a PIN or passphrase; locks when closed or hidden and after the lock timeout. Export unlocked entries only via explicit, unencrypted downloads. Export notes, bookmarks, highlights and prayers; use Trash to restore recently deleted verse notes, study notes, saved verses, memory verses or prayers. |
| Reader → Compare / More | Word-level highlighting and a percentage difference when comparing the same chapter; reading back/forward controls; print chapter or Save as PDF from the browser print dialog. |
| Books → Search | Whole-Bible search in the bundled translations, with testament and book filters, recent searches, voice search on supported browsers, and a random verse in the current translation. |
| Study → Explore | Strong’s Hebrew and Greek dictionary lookup by number, original word or transliteration, with definitions and KJV renderings. Select a verse and use Linked verses to browse bundled Berean Study Bible cross-references for Genesis through Ezra. |
| Read aloud | Speed and sleep timer controls while reading; retains the existing synced verse highlighting. |
| Plans → Your own pace | Custom and seasonal reading plans (Advent, Lent, Holy Week and Easter); catch-up and skip-day. |
| Today → My memory verses → Memory practice | Flashcards, fill-in-the-blank, first-letter and reference quizzes with spaced repetition. |

Account sign-up, sign-in and cross-device sync already live in **Settings → Account & Cloud Sync**. The version picker already includes Bibles in multiple languages (independent of the UI language). Study already offers AI-generated chapter summaries and outlines. The Study Notebook has its own print/PDF and Markdown options.

## Not included

- Sharing prayers with friends, friends list, group plans/discussions, public verse notes and church hub. These need backend access rules, opt-in sharing, and moderation. Private notes and prayers have not been made public.
- Red-letter text, localized UI, Greek/Hebrew interlinear alignment, and cross-reference data for books beyond Ezra. A Strong’s lookup gives dictionary entries, not an automatic word-for-word mapping across translations.
- Public-domain commentary and a separate Bible dictionary, sourced book intros and outlines, timelines, profiles, and interactive maps.

Strong’s data credits are in [study-data](study-data/README.md). A browser smoke test is in `tests/section-tools-smoke.py`.
