# Basic & Clinical Pharmacology in Numbers

One static page about pharmacology from the bench to the bedside. It starts with the approved drugs themselves: their types, drug-likeness and size by decade, the rings, atoms and stereocentres they are built from, their names, flags and therapeutic classes. Then their targets: protein classes and families, actions, the most-drugged targets and the drug–target network, the Guide to Pharmacology’s receptors, channels and enzymes, orphans and endogenous ligands, genetic support, the Davis 2011 kinome panel and the structures in the PDB and GPCRdb. Then bioactivity: the 24 million activity records in ChEMBL, potency by assay type, ligand efficiency, kinobeads against KINOMEscan, binding kinetics from K4DD, receptor theory and binding explorers, and drug pairs from NCI-ALMANAC. Then pharmacokinetics: bioavailability, half-life and protein binding of approved drugs, a dosing simulator, FDA’s CYP and transporter interaction table, and CiPA’s cardiac ion channel margins. Hand-built SVG charts with no runtime dependencies, each with its numbers as a table and a CSV, and molecules drawn from their ChEMBL molfiles.

Lenses at the top filter the page: `?lens=basic`, `?lens=clinical`, `?lens=safety` or `?lens=genomics`.

## Run it

| Command | Does |
| --- | --- |
| `npm run serve` | Serves the page at http://127.0.0.1:8080/ |
| `npm run lint` | ESLint, Stylelint and html-validate, each with a no-comments rule |
| `npm test` | Lint, unit tests, and Playwright end-to-end tests at desktop and phone widths |
| `npm run snapshot` | Rebuilds `src/snapshot.js` from ChEMBL, GtoPdb, the RCSB PDB, GPCRdb, ClinVar, HGNC and NCI-ALMANAC |
| `npm run snapshot -- targets network kinome` | Rebuilds only the named sections: `chembl`, `drugs`, `chemistry`, `targets`, `network`, `kinome`, `gtopdb`, `genetics`, `structures`, `activities`, `agreement`, `kinetics`, `almanac`, `pk`, `ddi`, `cipa` |

Set `SNAPSHOT_CACHE` to a folder to keep the downloaded files between runs. The end-to-end tests need a Chromium for Playwright: `npx playwright install chromium`.

## Publish it

The `Publish site` workflow deploys to `https://collide2954.github.io/basic-clinical-pharm/` on every push to `master` and after each weekly snapshot (Settings → Pages → Source: GitHub Actions). `.github/workflows/snapshot.yml` rebuilds the data every Sunday and commits it when numbers change. A section whose source fails keeps last week’s numbers and its own date, and the run log names it.

## Where things live

- `src/queries.js`: every API and file behind the numbers.
- `scripts/chembl.mjs`: reads ChEMBL’s release counts, approved drugs, ATC hierarchy, mechanisms of action, targets and protein classes. `scripts/gtopdb.mjs` reads the Guide to Pharmacology’s targets and interactions, `scripts/kinome.mjs` lays the Davis 2011 Kd values out by kinome group and scores selectivity, `scripts/structures.mjs` counts PDB and GPCRdb structures, `scripts/genetics.mjs` compares the genes of drug targets in ClinVar with all HGNC protein-coding genes, and `scripts/network.mjs` with `scripts/layout.mjs` builds the drug–target network and packs a force layout of each connected piece.
- `scripts/bioactivity.mjs` reads the aggregations ChEMBL’s activity search index returns, normalises kinetic rates and pairs Kd values across studies; `scripts/almanac.mjs` scores NCI-ALMANAC drug pairs; `scripts/adme.mjs` reads FDA’s interaction table, CiPA’s ion channel data and per-drug PK medians.
- `scripts/readers.mjs` reads CSV and other delimited text, xlsx workbooks, SAS transport files and HTML tables; `scripts/streams.mjs` streams, unzips and caches downloads; `scripts/sections.mjs` runs each section and keeps the last good values when one fails.
- `src/chem.js`: molfile reading and packing, implicit hydrogens, ring perception, aromaticity, ring names, ring-system keys and the bond geometry the drawings use.
- `src/findings.js`, `src/targets.js` and `src/bioactivity.js`: the counts behind each part and the section headlines, computed from the data so they stay true after each update. `src/theory.js` and `src/pk.js`: occupancy, the operational model, Schild and Cheng–Prusoff, binding kinetics and the one-compartment oral model for the explorers; `src/pharmacokinetics.js` counts the interaction matrices and CiPA margins.
- `src/facts.js`: sources, landmark molecules, decoder examples and the fixed tables, such as genetic support from Minikel et al. 2024.
- `src/charts.js`: the SVG chart engine, including hexagon maps, box plots, molecule drawings, an icicle, grids, the kinome matrix, the network, forest plots and scatter plots. `src/stats.js`: quantiles, binning, Lorenz curves, kernel densities, Kaplan–Meier curves, disproportionality and agreement statistics.
- `scripts/snapshot.mjs`: the weekly data pull. `scripts/export.mjs` writes the snapshot out as `snapshot.json`, which the published site links for download.
- `og.png`: the preview image shown when the link is shared.

## Reading the numbers

An approved drug is a parent compound that ChEMBL lists at maximum phase 4, approved in at least one jurisdiction, with its salts and hydrates folded in. First approval years are the earliest approval ChEMBL records: for medicines older than modern registration they come later than first use, and Drugs@FDA dates every application approved before 1 January 1982 to that day, which ChEMBL inherits.

Targets are the ones ChEMBL’s mechanisms of action name for approved drugs. A drug–target pair is one drug on one target, so a drug acting on three targets makes three pairs; each caption says whether it counts drugs, targets or pairs. Protein classes come from ChEMBL’s protein classification, taking the deepest class among a target’s components; mRNA, ribosome and other non-protein targets are filed by kind. Genes of drug targets are those of human single-protein and protein-complex targets, matched to HGNC by UniProt accession, because protein families and groups list every member. The genetic support figure is a fixed table from Minikel et al. 2024 and is not refreshed weekly. Kinome selectivity is S(3 µM), the share of wild-type kinase constructs bound with Kd below 3 µM, and the Gini coefficient of each inhibitor’s affinities.

Counts of ChEMBL activity records come from the Elasticsearch index behind ChEMBL’s web interface, which aggregates all 24 million records in one request; the per-document pulls for Davis 2011, Karaman 2008, Klaeger 2017 and K4DD use the same index. Davis 2011 repeats most of the Kd values it shares with Karaman 2008, so the agreement figure pairs Davis with the kinobeads study instead, an independent method. NCI-ALMANAC scores are NCI’s own: each combination well against the Bliss expectation from single-drug wells on the same plate, averaged by cell line and then across cell lines. The explorers compute their curves in the page and fetch nothing. Human PK values are the median, for each approved drug, of the oral bioavailability, half-life and plasma protein binding ChEMBL abstracts from the literature for whole-body human studies; they come from many studies and populations, so read them as typical values. CiPA margins divide each IC50 by the free therapeutic Cmax in FDA’s CiPA repository, pinned to one commit.

Molecular weight, ALogP, polar surface area, hydrogen-bond donors and acceptors, rotatable bonds, rule-of-five violations and QED are the properties ChEMBL calculates. Rings, ring systems, Fsp3 and elements are computed here from ChEMBL’s 2D molfiles: rings are the smallest set of smallest rings; a ring is aromatic when its π electrons number 4n + 2, counting double bonds shared across a fused system; ring systems join rings that share an atom and keep exocyclic double-bonded atoms, as Bemis–Murcko frameworks do. Stereocentres are counted from ChEMBL’s canonical SMILES.
