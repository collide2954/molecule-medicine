# Basic & Clinical Pharmacology in Numbers

One static page about pharmacology from the bench to the bedside, starting with the approved drugs themselves: their types, drug-likeness and size by decade, the rings, atoms and stereocentres they are built from, their names, flags and therapeutic classes. Hand-built SVG charts with no runtime dependencies, each with its numbers as a table and a CSV, and molecules drawn from their ChEMBL molfiles.

Lenses at the top filter the page: `?lens=basic`, `?lens=clinical`, `?lens=safety` or `?lens=genomics`.

## Run it

| Command | Does |
| --- | --- |
| `npm run serve` | Serves the page at http://127.0.0.1:8080/ |
| `npm run lint` | ESLint, Stylelint and html-validate, each with a no-comments rule |
| `npm test` | Lint, unit tests, and Playwright end-to-end tests at desktop and phone widths |
| `npm run snapshot` | Rebuilds `src/snapshot.js` from the ChEMBL API |
| `npm run snapshot -- drugs chemistry` | Rebuilds only the named sections |

Set `SNAPSHOT_CACHE` to a folder to keep the downloaded files between runs. The end-to-end tests need a Chromium for Playwright: `npx playwright install chromium`.

## Publish it

The `Publish site` workflow deploys to `https://collide2954.github.io/basic-clinical-pharm/` on every push to `master` and after each weekly snapshot (Settings → Pages → Source: GitHub Actions). `.github/workflows/snapshot.yml` rebuilds the data every Sunday and commits it when numbers change. A section whose source fails keeps last week’s numbers and its own date, and the run log names it.

## Where things live

- `src/queries.js`: every API and file behind the numbers.
- `scripts/chembl.mjs`: reads ChEMBL’s release counts, approved drugs and ATC hierarchy. `scripts/readers.mjs` reads CSV and other delimited text, xlsx workbooks, SAS transport files and HTML tables; `scripts/streams.mjs` streams, unzips and caches downloads; `scripts/sections.mjs` runs each section and keeps the last good values when one fails.
- `src/chem.js`: molfile reading and packing, implicit hydrogens, ring perception, aromaticity, ring names, ring-system keys and the bond geometry the drawings use.
- `src/findings.js`: the section headlines, computed from the data so they stay true after each update.
- `src/facts.js`: sources, landmark molecules and decoder examples.
- `src/charts.js`: the SVG chart engine, including hexagon maps, box plots and molecule drawings. `src/stats.js`: quantiles, binning, Lorenz curves, kernel densities, Kaplan–Meier curves, disproportionality and agreement statistics.
- `scripts/snapshot.mjs`: the weekly data pull. `scripts/export.mjs` writes the snapshot out as `snapshot.json`, which the published site links for download.
- `og.png`: the preview image shown when the link is shared.

## Reading the numbers

An approved drug is a parent compound that ChEMBL lists at maximum phase 4, approved in at least one jurisdiction, with its salts and hydrates folded in. First approval years are the earliest approval ChEMBL records: for medicines older than modern registration they come later than first use, and Drugs@FDA dates every application approved before 1 January 1982 to that day, which ChEMBL inherits.

Molecular weight, ALogP, polar surface area, hydrogen-bond donors and acceptors, rotatable bonds, rule-of-five violations and QED are the properties ChEMBL calculates. Rings, ring systems, Fsp3 and elements are computed here from ChEMBL’s 2D molfiles: rings are the smallest set of smallest rings; a ring is aromatic when its π electrons number 4n + 2, counting double bonds shared across a fused system; ring systems join rings that share an atom and keep exocyclic double-bonded atoms, as Bemis–Murcko frameworks do. Stereocentres are counted from ChEMBL’s canonical SMILES.
