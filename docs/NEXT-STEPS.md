# Next steps

Work in this order. Nothing in the public version has been built or tested yet.

## 1. Repo

- [ ] `git init` here. Create a GitHub repo (Katie will choose the name; GitHub Pages on a free account needs a public repo, which is fine because the repo holds no responses).
- [ ] Add a `.gitignore` (already included) and commit.

## 2. Public survey page (`web/index.html`)

- [ ] Start from `src/claude-artifact/index.html`. Keep the UI, pairing (`buildPairs`), scoring (`tally`), styles and survey flow.
- [ ] Remove everything tied to claude.ai: `claude.use("user")`, `claude.use("db")`, `initShared`, the Results / Compare / By boy tabs and their code, `canSee`, the roster/drafts snapshot listeners, `dedupe` (moves server side).
- [ ] Replace saving with `POST` to the Apps Script URL (see `docs/SPEC.md`). Send `{first, last, role, votes, comment, complete, at}`.
- [ ] Autosave every 5 pairs (`complete: false`) and final submit (`complete: true`).
- [ ] Add `localStorage` resume on the same device, wrapped in try/catch.
- [ ] Put `WEB_APP_URL` in one clearly named constant at the top.
- [ ] Show a clear message if the submit cannot be sent (offline), keep answers on the device and let the person retry.
- [ ] Keep the page free of any results or other people's data.

## 3. Apps Script intake

- [ ] Open the YM Google Sheet, Extensions > Apps Script, paste `apps-script/Code.gs`.
- [ ] Review and test the draft (it has never been run). Use a throwaway sheet copy first.
- [ ] Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the `/exec` URL into the page.
- [ ] Confirm a test post creates one row with correct win-rate formulas, and that a second post with the same name replaces it, and that an unfinished post never replaces a finished one.
- [ ] Add the `Status` column header (column EB). The script's `ensureHeader()` does this.

## 4. Publish

- [ ] Turn on GitHub Pages for the repo (serve `web/`, or move the page to the root or `docs/`).
- [ ] Test the live link on a phone and on desktop, each in a private window, signed out of everything.
- [ ] Delete the test rows from the sheet.
- [ ] Send the link to leaders and parents. Remind them there is no login.

## 5. Owner results

- [ ] Decide with Katie: sheet formulas on a results tab, a private dashboard, or both (`docs/SPEC.md`).
- [ ] If a results tab is built in the sheet: per-group win rates (Everyone, Deacons, Teachers & Priests, Leaders) and a Compare table with rank and gap.
- [ ] Merge any typo duplicates by hand and say so in the sheet.

## 6. Nice to have

- [ ] Shared code and rate limiting on the endpoint.
- [ ] A "Youth only" combined view (Deacons, Teachers and Priests together), offered earlier and not requested yet.
- [ ] Adaptive pairing, only if individual rankings become important (simulation showed a small gain, `tools/simulate.js`).

## Test checklist before sharing

- A signed-out phone can open the page and finish all 100 pairs.
- Back, Skip and Finish now behave. No pair repeats in either order.
- Two people with the same first name and different last names get two rows.
- A boy who quits at pair 40 leaves an `Unfinished` row, and retaking replaces it.
- No page shows any results.
