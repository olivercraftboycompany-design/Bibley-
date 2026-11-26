# Bibley feature status

Features are placed in the matching reader and study sections. There is no separate Plus tab.

| Section | Available in this update |
| --- | --- |
| Today → Your activity | Daily recap with date navigation and copy; monthly recap with reading counts, active days, longest streak, most-read books and study totals. Recaps use records available on the device, including any synced records. They are not a historical audit, and don't reconstruct activity that was never recorded. |
| Today → Prayer & reflection | Private active/answered prayer requests, guided prayers and access to the reflection journal. Prayers can sync to the signed-in Bibley account; they are not shared publicly. |
| My Bible → Personal study | Encrypted reflection journal with a PIN or passphrase; locks when closed or hidden and after the lock timeout. Export unlocked entries only via explicit, unencrypted downloads. Export notes, bookmarks, highlights and prayers; use Trash to restore recently deleted verse notes, study notes, saved verses, memory verses or prayers. |
| Reader → Compare / More | Word-level highlighting and a percentage difference when comparing the same chapter; reading back/forward controls; print chapter or Save as PDF from the browser print dialog; optional red letters for the World English Bible (matching source-marked passages). |
| Books → Search | Whole-Bible search in the bundled translations, with testament and book filters, recent searches, voice search on supported browsers, and a random verse in the current translation. |
| Study → Explore | Strong’s Hebrew/Greek dictionary; Easton’s Bible dictionary; two historical commentaries, sourced book introductions and clickable chapter outlines; searchable timeline and character profiles; interactive maps of possible Bible locations. From a verse, Linked verses covers all 66 Protestant books; Original words shows WEB publisher tags, plus a STEPBible source-order Greek/Hebrew/Aramaic interlinear with word-by-word transliterations, English glosses and morphology. |
| Settings → Language / Idioma | Switch primary navigation, common actions and the daily/monthly recap screens between English and Spanish. Scripture stays in the selected translation, and some detailed views remain in English. |
| Read aloud | Speed and sleep timer controls while reading; retains the existing synced verse highlighting. |
| Plans → Your own pace | Custom and seasonal reading plans (Advent, Lent, Holy Week and Easter); catch-up and skip-day. |
| Today → My memory verses → Memory practice | Flashcards, fill-in-the-blank, first-letter and reference quizzes with spaced repetition. |

Account sign-up, sign-in and cross-device sync already live in **Settings → Account & Cloud Sync**. The version picker already includes Bibles in multiple languages (independent of the UI language). Study already offers AI-generated chapter summaries and outlines. The Study Notebook has its own print/PDF and Markdown options.

## Not included

- Sharing prayers with friends, friends list, group plans/discussions, public verse notes and church hub. These need backend access rules, opt-in sharing, and moderation. Private notes and prayers have not been made public.
- Complete UI localization and word alignment to the selected translation. WEB tags and optional red letters are specific to the WEB. The new study datasets are limited to the 66-book Protestant canon; other supported editions remain readable.

Strong’s data credits are in [study-data](study-data/README.md). Browser smoke tests are in `tests/section-tools-smoke.py` and `tests/study-resources-smoke.py`.

A local [community persistence foundation](backend/README.md) is available for future integration with the account host; it does not enable any public endpoints or in-app sharing.
