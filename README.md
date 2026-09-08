# THRESHOLD

A turn-based successor to MAGNATE. You run a lab from **Q4 2012 through Q4 2030** — 73 quarters — in the intelligence race.

Two ways to win, and they pull against each other:

- **Capital** — founder paper of $1T (ops + assets − debt, not idle cash)
- **Capability** — ship a model that crosses 90 / ASI

Usable compute is the **minimum of chips, power, and fabric**. The binding constraint migrates. So does the money. China, four domestic labs, and the public commons are in the same contested pool.

Saves live in the browser (`localStorage`). No account required.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (binds `0.0.0.0:8080`).

```bash
npm run test:game    # engine + operations + expansion
npm run typecheck
npm run build
```

Auth and database stay off. Campaigns are versioned local saves; export/import JSON if you want a portable run.

## What to try

1. Pick a founder background and a seed (or let it roll one).
2. On **Command**, read the three compute tanks. The shortest stack is live.
3. Open **Operations** — same three resources on one chip-equivalent scale, a 48-tile fleet hall, and a commissioning slider that previews deliveries, retirement, reactors, and containment without spending an action.
4. Put something in the pipeline on **Supply**, set train/serve, end the quarter.
5. Sound in the header is muted until you turn it on.

## Stack

React 19, TanStack Start, Tailwind v4, IBM Plex. Engine is pure TypeScript under `src/game/` — `applyAction` / `resolveQuarter`, seeded RNG, no silent overdraft, finite quarterly supply.

## License

All rights reserved unless you add one. The scenario numbers are a game, not a forecast.
