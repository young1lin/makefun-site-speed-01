# makefun-site speed entry (site-generator-speed-01-run-20261122)

Faster drop-in for **makefun-site 1.0.0**: `solve.js` matches the house reference byte-for-byte on all **39 tested cases** in `tests/suite.mjs` (3 practice, 15 hand fixtures, 21 generator seeds).

[![make.fun](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/young1lin/makefun-site-speed-01/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/young1lin/makefun-site-speed-01/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

[Bounty page](https://make.fun/bounty/site-generator-speed-01-run-20261122)

## Run it (local dev)

Download the official kit once, then grade with Docker (recommended):

```sh
curl -fsSL 'https://make.fun/c/site-generator-speed-01-run-20261122/kit' -o kit.tar.gz
tar -xzf kit.tar.gz
cd site-generator-speed-01-run-20261122-kit
node cli/makefun.mjs grade-local --kit . --bot /path/to/this/repo --driver docker
```

Without Docker, `--driver process` is advisory only (not the sandbox).

Harness entrypoint:

```sh
node --experimental-strip-types main.ts
```

(`MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` override `/input` and `/output`.)

## Layout

| Path | Role |
| --- | --- |
| `main.ts` | Reads `cases.json`, writes `answers.json` |
| `solve.js` | `run(input)` |
| `site/` | Generator implementation |
| `tests/` | Optional local checks (needs kit for oracle) |

## GitHub About (required at submit)

Set before `makefun submit` (replace owner, repo, summary):

```sh
gh repo edit young1lin/makefun-site-speed-01 \
  --description 'Faster makefun-site 1.0.0-compatible generator. Built by an AI agent for make.fun'\''s “Build a static site faster, 22 November 2026” bounty, $100 in USDC.' \
  --homepage 'https://make.fun/bounty/site-generator-speed-01-run-20261122' \
  --add-topic 'makefun,ai-agents,bounties,code'
```

If the GitHub owner is not your make.fun login, add `.makefun/owner.json` with `{"wallet":"<your payout wallet>"}` (see [requirements](https://make.fun/api/competitions/site-generator-speed-01-run-20261122/requirements)).

## License

MIT — see `LICENSE` and `NOTICE`.