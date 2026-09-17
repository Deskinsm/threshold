# THRESHOLD

[![CI](https://github.com/Deskinsm/threshold/actions/workflows/ci.yml/badge.svg)](https://github.com/Deskinsm/threshold/actions/workflows/ci.yml)

A turn-based successor to MAGNATE. You run a lab from **Q4 2012 through Q4 2030** — 73 quarters — in the intelligence race.

It is October 2012. A neural network trained on two gaming GPUs has just won an image competition by a margin that cannot be explained away, and a very small number of people have understood what that implies. You are one of them.

Two ways to win, and they pull against each other:

- **Capital** — founder paper of $1T (ops + assets − debt, not idle cash)
- **Capability** — ship a model that crosses 90 / ASI

Usable compute is the **minimum of chips, power, and fabric**. The binding constraint migrates. So does the money. Four named labs — HELIOS, MERIDIAN, AEGIS, THE COMMONS — and the programme abroad draw from the same contested pool.

Saves live in the browser. No account.

The scenario numbers are a game, not a forecast.

## A quarter

The screen opens at the start of a quarter. Deliveries due now are already in. You spend actions — orders, research, hires, ventures, a release — then **End Quarter**. Operations resolve, rivals bid, the clock advances. Q4 2030 is playable.

Cash does not overdraft in silence. If a quarter would go under, you get an explicit rescue or you default. Quarterly supply is finite; two purchases cannot both take the whole allocation.

## Floors

| Floor | What it is for |
| --- | --- |
| **Command** | The three tanks, cash, forecast, raise, hire. The shortest stack is live. |
| **Operations** | Same three resources on one chip-equivalent scale, a 48-tile fleet hall, and a commissioning slider that previews deliveries, retirement, reactors, and containment without spending an action. |
| **Supply** | Chips, interconnection, turbines, fabric. Orders arrive on a stated quarter. |
| **Lab** | Research, evaluations, limited vs broad release. Research capability is not a crossing until you ship. |
| **Ventures** | Power, colo, fiber, and the rest — with campuses, specializations, and PR. |
| **World** | Named people, the other labs, the record. |
| **Wire** | What happened, in order. |

Founder backgrounds: **research** (talent, thin cash), **infrastructure** (megawatts, a colo habit), **enterprise** (customers on day one).

**Sandbox — Q3 2024** is a late-game fixture (four campuses, four ventures, $10B). It is not an earned campaign. It replaces a save if you confirm.

## First session

1. Pick a background and a seed, or let one roll. Begin — Q4 2012.
2. On Command, read the three tanks. Buy whatever is shortest.
3. Open Operations once so the fleet and the horizon make sense. Return. End Quarter.
4. Sound in the header is muted until you turn it on.
5. Export a JSON copy if the run starts to matter. Continue restores the last local save.

## Run it

Node 22 and npm 10.9+. The lockfile is generated with that pair.

```bash
npm ci
npm run dev
```

Then open the URL Vite prints.

```bash
npm test             # engine, expansion, saves, operations, sandbox loader
npm run test:render  # view markup + Begin → tabs → New → Continue
npm run typecheck
npm run build
```

Auth and database stay off. Campaigns are versioned local saves (`SAVE_VERSION` 5); export/import JSON for a portable run. Old v2/v4 saves migrate.

CI runs on pull requests and on pushes to `main`: clean install, tests, typecheck, render check, production build.

## Stack

React 19, TanStack Start, Tailwind v4, IBM Plex. Engine is pure TypeScript under [`src/game/`](src/game/) — `applyAction` / `resolveQuarter`, seeded RNG, no silent overdraft, finite quarterly supply. The shell is [`src/components/game/`](src/components/game/).

## License

All rights reserved unless you add one.
