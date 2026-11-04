import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ddiRows, cipaRows, perDrugMedians } from '../../scripts/adme.mjs';
import {
  oralConcentration, repeatedDoses, averageSteadyState, accumulation, halfLife,
} from '../../src/pk.js';

const HEAD = ['Drug or Other Substance', 'CYP Strg INH', 'CYP Mod INH', 'CYP WK INH', 'CYP Strg IND', 'CYP Mod IND', 'CYP WK IND', 'CYP SENS SUB', 'CYP Mod SENS SUB', 'TRNSP INH', 'TRNSP SUB'];
const row = (...cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
const HTML = `<table><tr>${HEAD.map((h) => `<th>${h}</th>`).join('')}</tr>
${row('clarithromycin', '3A strong inhibitor', '', '', '', '', '', '', '', 'P-gp; OATP1B1; OATP1B3 inhibitor', '')}
${row('fluvoxamine8', '1A2; 2C19 strong inhibitor', '3A moderate inhibitor5', '2D6 weak inhibitor', '', '', '', '', '', '', '')}
${row('rifampin', '', '', '', '3A; 2C19 strong inducer', '1A2, 2B6; 2C8; 2C9 moderate inducer', '', '', '', 'OATP1B inhibitor', '')}
${row('midazolam', '', '', '', '', '', '', '3A sensitive substrate', '', '', '')}
${row('atorvastatin', '', '', '', '', '', '', '', '3A moderate substrate', '', 'OATP1B1; OATP1B3 substrate')}
${row('ritonavir14, 15,', '3A strong inhibitor', '', '', '', '', '', '', '', '', '')}
${row('Pirtobrutinib', '', '', '', '', '', '', '', '', 'P-gp inhibitor', '')}
</table><table><tr><th>Potency Category</th><th>Definitions</th></tr>${row('Strong Inhibitor', 'x')}</table>`;

test('ddiRows reads the FDA interaction table into drugs, systems, roles and strengths', () => {
  const rows = ddiRows(HTML);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.slice(5).map((r) => r.drug), ['ritonavir', 'pirtobrutinib']);
  assert.deepEqual(rows[0], {
    drug: 'clarithromycin',
    links: [
      { system: '3A', role: 'inhibitor', strength: 'strong' },
      { system: 'P-gp', role: 'inhibitor', strength: 'transporter' },
      { system: 'OATP1B1', role: 'inhibitor', strength: 'transporter' },
      { system: 'OATP1B3', role: 'inhibitor', strength: 'transporter' },
    ],
  });
  assert.deepEqual(rows[1].drug, 'fluvoxamine');
  assert.deepEqual(rows[1].links.map((l) => `${l.system} ${l.strength} ${l.role}`), ['1A2 strong inhibitor', '2C19 strong inhibitor', '3A moderate inhibitor', '2D6 weak inhibitor']);
  assert.deepEqual(rows[2].links.map((l) => `${l.system} ${l.strength} ${l.role}`), ['3A strong inducer', '2C19 strong inducer', '1A2 moderate inducer', '2B6 moderate inducer', '2C8 moderate inducer', '2C9 moderate inducer', 'OATP1B1 transporter inhibitor', 'OATP1B3 transporter inhibitor']);
  assert.deepEqual(rows[3].links, [{ system: '3A', role: 'substrate', strength: 'sensitive' }]);
  assert.deepEqual(rows[4].links.map((l) => `${l.system} ${l.strength} ${l.role}`), ['3A moderate substrate', 'OATP1B1 transporter substrate', 'OATP1B3 transporter substrate']);
});

const IC50 = 'drug,ICaL_h,ICaL_IC50,INaL_h,INaL_IC50,hERG_IC50,hERG_h\ndofetilide,1.16,260,0.26,750000,5,0.93\nverapamil,1.09,202.5,1.03,8100,283.5,0.96\nranolazine,NA,NA,0.94,8000,8000,0.8866\n';
const DRUGS = 'drug,therapeutic,CiPA\ndofetilide,2,2\nverapamil,81,0\nranolazine,2000,1\n';

test('cipaRows joins CiPA IC50s to free Cmax and risk, as margins over Cmax', () => {
  assert.deepEqual(cipaRows(IC50, DRUGS), [
    {
      drug: 'dofetilide', risk: 'high', cmax: 2, ic50: { ICaL: 260, INaL: 750000, hERG: 5 }, margin: { ICaL: 130, INaL: 375000, hERG: 2.5 },
    },
    {
      drug: 'verapamil', risk: 'low', cmax: 81, ic50: { ICaL: 202.5, INaL: 8100, hERG: 283.5 }, margin: { ICaL: 2.5, INaL: 100, hERG: 3.5 },
    },
    {
      drug: 'ranolazine', risk: 'intermediate', cmax: 2000, ic50: { ICaL: null, INaL: 8000, hERG: 8000 }, margin: { ICaL: null, INaL: 4, hERG: 4 },
    },
  ]);
});

test('perDrugMedians reads one median per approved drug from a terms aggregation', () => {
  const es = { aggregations: { drugs: { buckets: [{ key: 'CHEMBL25', doc_count: 3, median: { values: { '50.0': 68.5 } } }, { key: 'CHEMBL3', doc_count: 1, median: { values: { '50.0': 90 } } }] } } };
  assert.deepEqual(perDrugMedians(es), [{ id: 'CHEMBL25', median: 68.5, n: 3 }, { id: 'CHEMBL3', median: 90, n: 1 }]);
});

const r4 = (v) => Math.round(v * 10000) / 10000;

test('the one-compartment oral model gives concentrations, steady state, accumulation and half-life', () => {
  const p = {
    dose: 100, f: 1, ka: 1, ke: 0.1, v: 10,
  };
  assert.equal(r4(oralConcentration(0, p)), 0);
  assert.equal(r4(oralConcentration(2, p)), r4(((100 * 1) / (10 * 0.9)) * (Math.exp(-0.2) - Math.exp(-2))));
  assert.equal(r4(repeatedDoses(13, 12, p)), r4(oralConcentration(13, p) + oralConcentration(1, p)));
  assert.equal(r4(repeatedDoses(5, 12, p)), r4(oralConcentration(5, p)));
  assert.equal(averageSteadyState({
    dose: 100, f: 0.5, cl: 5, tau: 10,
  }), 1);
  assert.equal(r4(accumulation(0.1, 12)), r4(1 / (1 - Math.exp(-1.2))));
  assert.equal(r4(halfLife(1, 10)), r4(Math.LN2 * 10));
});
