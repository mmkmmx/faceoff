# YM Annual Planning Survey Tool

Context for Claude Code. Read this first, then `docs/SPEC.md` and `docs/NEXT-STEPS.md`.

## What this is

A Pair Rank survey that decides which activities the Young Men program runs in 2027. Each person is shown two activities at a time and taps the one they would rather do. Every activity earns a win rate (wins divided by appearances).

- Program: combined Young Men program for Murray 1st Ward and Murray 12th Ward (Murray, Utah). Deacons 11-13, Teachers 14-15, Priests 16-18.
- The activity list is the rows marked "Yes" under "2027 Module" in the **Activity Master List** tab of the YM Google Sheet (26 activities, see `data/activities-2027.json`).
- Expected respondents: about 8-10 deacons, 8-10 teachers and priests, about 12 leaders.

## Hard constraints (from the owner, Katie)

- **No logins for respondents.** The boys are minors and cannot have Claude accounts. Anyone with the link must be able to take the survey on any phone or desktop.
- **Results are private to the owner.** Respondents must never see what others picked (no groupthink). The public page must not expose any results or names.
- **Collect a first and last name** for each respondent (some boys share a first name). No other personal data. Store name, role, picks and an optional comment only.
- **Data goes into the YM Google Sheet**, tab `2027 Survey Results`.
- **No AI calls at runtime.** All logic (pairing, scoring) is plain code in the browser or in Apps Script.
- Treat youth information carefully: keep names out of anything shared widely.

## Decisions already made

- 100 pairs per person. Chosen after a simulation (`tools/simulate.js`): 100 random pairs beat 75 adaptive pairs on ranking accuracy and keep the scoring simple. Adaptive pairing was considered and rejected for now.
- Pairs come from the 325 unordered matchups, each used at most once, so A vs B is never followed by B vs A. Selection favors activities that have appeared least, so stopping early still covers everything evenly. Left/right order is random.
- "Finish now" is allowed after 30 pairs. Progress autosaves every 5 pairs.
- Roles: Deacon, Teacher, Priest, Leader (Parent was removed).
- Results are compiled into four views: Everyone, Deacons, Teachers & Priests, Leaders, plus a side-by-side Compare table (rank and win rate per group, with a "gap" column that flags disagreements of 30+ points).
- Same-name handling: one record per person (case and spacing ignored). A finished survey beats any unfinished one. Otherwise the newest record wins. An unfinished retake never overwrites a finished survey.
- Score = wins / appearances, computed in `apps-script/Code.gs` and written to the sheet as numbers. Raw votes are kept in one column (AG) for pooled group results. Run `node tools/test-apps-script.js` after any change to the script.

## Current state

- `src/claude-artifact/index.html` is the working survey as published on claude.ai. It stores data with the claude.ai artifact `db` capability, which **requires every viewer to be signed in to Claude**. That is why it cannot be used by the boys. Treat it as the reference for UI, pairing, scoring and result views, not as the deliverable.
- The Google Sheet tab `2027 Survey Results` exists with headers only, in the old layout (A to EA). The script rewrites the header to the new layout (A to AG, see `docs/SPEC.md`) on its first submission.
- `apps-script/Code.gs` is the intake endpoint. Tested offline and deployed on a copy of the sheet. The live page `https://mmkmmx.github.io/faceoff/` (repo `mmkmmx/faceoff`, `web/` published by GitHub Actions) currently points at that test deployment.
- The test response in the old artifact was purged. The sheet has no data rows.

## Links

- Google Sheet: https://docs.google.com/spreadsheets/d/1nwRJiMnCpUWfbE80NsyHeK1M07nGFSuBIrlo_lcV_CQ/edit (tab `2027 Survey Results`, sheetId 1819138395)
- Old Claude artifact (owner-only): https://claude.ai/artifact/NopuDkGD8RtQq9cHTtrfFk

## How to work in this repo

- Be practical and concise. Katie is a volunteer leader with limited time.
- Ask for missing details rather than guessing. Mark unknowns as TBD.
- Run `node tools/simulate.js` to re-check any change to pairing or scoring.
- Test on a phone and a desktop in a private/incognito window before anything is shared. Delete test rows from the sheet afterwards.
- Do not commit any survey data or names to git.
