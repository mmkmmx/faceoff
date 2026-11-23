# YM Annual Planning Survey Tool

A Pair Rank survey for choosing the 2027 Young Men activities. Respondents pick between two activities at a time. Each activity's win rate decides the ranking.

## Folder map

| Path | What it is |
|---|---|
| `CLAUDE.md` | Context and rules for Claude Code. Start here. |
| `docs/SPEC.md` | What the survey does, the data layout and the architecture |
| `docs/NEXT-STEPS.md` | Ordered to-do list and test checklist |
| `src/claude-artifact/index.html` | Working survey from claude.ai (needs a Claude login, so reference only) |
| `apps-script/Code.gs` | Draft script that receives votes and writes them to the Google Sheet (untested) |
| `data/activities-2027.json` | The 26 activities, in the order the vote indexes use |
| `tools/simulate.js` | Simulation used to choose 100 pairs per person (`node tools/simulate.js`) |

## Continue in Claude Code

Open this folder in Claude Code and ask it to work through `docs/NEXT-STEPS.md`. The first job is turning the reference survey into a public page that needs no login and saves to the sheet.
