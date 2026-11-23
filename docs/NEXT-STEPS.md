# Next steps

Work in this order. Status as of 2026-11-23: live at https://mmkmmx.github.io/faceoff/, connected to the real YM Sheet, tested on phone and desktop. Link not sent yet.

## 1. Repo

- [x] `git init` here (done, branch `main`). Create a GitHub repo (Katie will choose the name; GitHub Pages on a free account needs a public repo, which is fine because the repo holds no responses).
- [x] Add a `.gitignore` (already included) and commit.
- [x] Create the GitHub repo and push.

## 2. Public survey page (`web/index.html`)

- [x] Start from `src/claude-artifact/index.html`. Keep the UI, pairing (`buildPairs`), scoring (`tally`), styles and survey flow.
- [x] Remove everything tied to claude.ai: `claude.use("user")`, `claude.use("db")`, `initShared`, the Results / Compare / By boy tabs and their code, `canSee`, the roster/drafts snapshot listeners, `dedupe` (moves server side).
- [x] Replace saving with `POST` to the Apps Script URL (see `docs/SPEC.md`). Send `{first, last, role, votes, comment, complete, at}`.
- [x] Autosave every 5 pairs (`complete: false`) and final submit (`complete: true`).
- [x] Add `localStorage` resume on the same device, wrapped in try/catch.
- [x] Put `WEB_APP_URL` in one clearly named constant at the top.
- [x] Show a clear message if the submit cannot be sent (offline), keep answers on the device and let the person retry.
- [x] Keep the page free of any results or other people's data.

## 3. Apps Script intake

- [x] Open the YM Google Sheet, Extensions > Apps Script, paste `apps-script/Code.gs`.
- [x] Review and test the draft offline (fake sheet). Fixed: Status column was read before it existed.
- [x] Test it once in a throwaway copy of the sheet.
- [x] Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the `/exec` URL into the page.
- [x] Confirm a test post creates one row with correct win rates (now plain numbers, not formulas), and that a second post with the same name replaces it, and that an unfinished post never replaces a finished one.
- [x] Header row rewritten by the script (Status in AF, Votes in AG).

## 4. Publish

- [x] Turn on GitHub Pages for the repo (serve `web/`, or move the page to the root or `docs/`).
- [x] Test the live link on a phone and on desktop, each in a private window, signed out of everything.
- [ ] Delete the "Test Delete-me" row from the real sheet.
- [ ] Delete the old test copy of the sheet (its script still accepts posts).
- [ ] Send the link to leaders and parents. Remind them there is no login. A draft message is in the 2026-11-23 session; short version: link, ~7 minutes, no login, "Start a new survey" at the end for brothers.

## 5. Owner results

- [x] Decided 2026-11-23: both, group totals only (no per-person view).
- [x] `rebuildSummary()` in `apps-script/Code.gs` writes the `2027 Results Summary` tab after every submission, plus a YM Results menu. Tested offline.
- [x] (Done 2026-11-23) Katie: paste the new `Code.gs` into the YM Sheet's Apps Script, Deploy > Manage deployments > edit > New version, then reload the sheet and run YM Results > Rebuild summary once (approve the permission prompt).
- [x] Private dashboard: https://claude.ai/artifact/2Pof1ZJoMgQcEErUunaEBn (live from the sheet, no names).
- [ ] Merge any typo duplicates by hand and say so in the sheet.
- [ ] Open the private dashboard once and confirm it draws (it was written but no one had opened it to check at the end of 2026-11-23). Approve Google Sheets when asked.
- [ ] Decide whether other leaders can open the YM Sheet. If so, they can see names on `2027 Survey Results` and the group totals on `2027 Results Summary`.

## 6. Nice to have

- [ ] Sortable Compare table on the private dashboard (sort by any group or by Gap, as the old artifact did).

- [ ] Shared code and rate limiting on the endpoint.
- [ ] A "Youth only" combined view (Deacons, Teachers and Priests together), offered earlier and not requested yet.
- [ ] Adaptive pairing, only if individual rankings become important (simulation showed a small gain, `tools/simulate.js`).

## Test checklist before sharing

- A signed-out phone can open the page and finish all 100 pairs.
- Back, Skip and Finish now behave. No pair repeats in either order.
- Two people with the same first name and different last names get two rows.
- A boy who quits at pair 40 leaves an `Unfinished` row, and retaking replaces it.
- No page shows any results.
