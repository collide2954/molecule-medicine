import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { start } from '../../scripts/serve.mjs';
import snapshot from '../../src/snapshot.js';
import {
  EXAMPLES, LANDMARKS, GENETIC_SUPPORT, ATTRITION,
} from '../../src/facts.js';
import { exact } from '../../src/lib.js';
import {
  findings, propertyByDecade, ringCounts, stemCounts, typeGroups, atcGroups,
} from '../../src/findings.js';
import {
  targetHierarchy, familyCounts, familyActions, topTargets, networkGraph, gtopdbRows, affinityByType,
} from '../../src/targets.js';
import { efficiencyPoints, agreementStats } from '../../src/bioactivity.js';

let server;
let browser;
let base;

const open = async ({ width = 1280, height = 900, search = '', motion = 'reduce' } = {}) => {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED|fonts\.g/.test(m.text()) && errors.push(m.text()));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${base}${search}`);
  await page.waitForSelector('#types-chart svg', { state: 'attached' });
  return { page, errors };
};

const openPhone = async () => {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(base);
  await page.waitForSelector('#types-chart svg', { state: 'attached' });
  return { page, context };
};

const tapAt = async (page, selector, fx = 0.5, fy = 0.5) => {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(250);
};

const tipLinesOf = (page) => page.$$eval('#tip > *', (els) => els.map((e) => e.textContent));

const CHAPTERS = {
  molecules: ['approved', 'druglike', 'properties', 'extremes', 'rings', 'atoms', 'stereo', 'stems', 'flags', 'atc'],
  targets: ['classes', 'actions', 'drugged', 'network', 'gtopdb', 'orphans', 'enzymes', 'genetics', 'kinome', 'structures'],
  bioactivity: ['record', 'potency', 'efficiency', 'agreement', 'kinetics', 'theory', 'combinations'],
  pharmacokinetics: ['pk', 'simulator', 'ddi', 'cipa'],
  trials: ['registry', 'design', 'reporting', 'attrition', 'psychedelics'],
  reference: ['decoder', 'sources'],
};

const slide = (page, sel, value) => page.$eval(sel, (el, v) => {
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, String(value));

before(async () => {
  server = await start(0);
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  server.close();
});

test('loads without errors, leads with the activities in ChEMBL and states every finding', async () => {
  const { page, errors } = await open();
  assert.equal(await page.title(), 'Basic & Clinical Pharmacology in Numbers');
  assert.equal((await page.textContent('[data-hero="activities"]')).trim(), exact(snapshot.chembl.activities));
  const f = findings(snapshot);
  for (const node of await page.$$('[data-finding]')) {
    const key = await node.getAttribute('data-finding');
    assert.equal((await node.textContent()).trim(), f[key], key);
  }
  assert.equal(await page.locator('[data-finding]').count(), Object.keys(f).length);
  assert.ok(await page.locator('#ticker div').count() >= 6);
  assert.deepEqual(errors, []);
  await page.close();
});

test('every chart draws an svg', async () => {
  const { page } = await open();
  const empty = await page.$$eval('.chart', (els) => els.filter((e) => !e.querySelector('svg')).map((e) => e.id));
  assert.deepEqual(empty, []);
  assert.ok(await page.locator('.chart svg').count() >= 20);
  await page.close();
});

test('the approved drugs part splits molecule types and stacks approvals by year', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#types-chart .legend li').count(), typeGroups(snapshot).filter((g) => g.n / snapshot.drugs.length >= 0.005).length + 1);
  assert.equal(await page.locator('#types-chart [data-k]').count(), 100);
  assert.equal(await page.locator('#approvals-chart path[data-key]').count(), 4);
  await page.hover('#approvals-chart .hit');
  assert.match(await page.textContent('#tip'), /\d{4}: [\d,]+/);
  await page.close();
});

test('chemical space bins approved small molecules in hexagons inside a rule-of-five box', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#space-chart [data-hex]').count() > 50);
  assert.equal(await page.locator('#space-chart .ro5').count(), 1);
  const first = await page.getAttribute('#space-chart [data-hex]', 'data-hex');
  await page.hover(`#space-chart [data-hex="${first}"]`);
  assert.match(await page.textContent('#tip'), /small molecules?[\s\S]*Da[\s\S]*ALogP/);
  assert.equal(await page.locator('#ro5-chart [data-k]').count(), 5);
  assert.ok(await page.locator('#qed-chart [data-bin]').count() >= 10);
  await page.close();
});

test('property boxes draw one box per decade with its median', async () => {
  const { page } = await open();
  const decades = propertyByDecade(snapshot, 'mw').map((r) => String(r.decade));
  assert.deepEqual(await page.$$eval('#mw-decade-chart [data-decade]', (els) => els.map((e) => e.dataset.decade)), decades);
  await page.hover(`#mw-decade-chart [data-decade="${decades.at(-2)}"]`);
  assert.match(await page.textContent('#tip'), /median[\s\S]*Da/);
  for (const id of ['logp-decade-chart', 'psa-decade-chart', 'qed-decade-chart', 'fsp3-chart']) assert.ok(await page.locator(`#${id} [data-decade]`).count() >= 5, id);
  await page.close();
});

test('landmark molecules are drawn from their molfiles, bond by bond', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#landmarks-chart [data-mol]').count(), LANDMARKS.length);
  const bonds = await page.$$eval('#landmarks-chart [data-mol]', (gs) => gs.map((g) => g.querySelectorAll('.bond').length));
  for (const n of bonds) assert.ok(n >= 5, `${n}`);
  await page.hover(`#landmarks-chart [data-mol="${LANDMARKS[0].id}"]`);
  assert.match(await page.textContent('#tip'), /Sertürner/);
  assert.equal(await page.locator('#lightest-chart [data-row]').count(), 15);
  assert.equal(await page.locator('#heaviest-chart [data-row]').count(), 15);
  await page.close();
});

test('ring charts rank ring types, draw ring systems and count rings per molecule', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#ring-chart [data-row]').count(), 25);
  await page.hover('#ring-chart [data-row="benzene"]');
  assert.match(await page.textContent('#tip'), new RegExp(`${exact(ringCounts(snapshot)[0].n)} approved small molecules`));
  assert.equal(await page.locator('#systems-chart [data-mol]').count(), 16);
  assert.ok(await page.locator('#ring-count-chart [data-k]').count() >= 8);
  await page.close();
});

test('atom, handedness and name charts cover elements, decades and stems', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#element-chart [data-row]').count() >= 8);
  assert.equal(await page.locator('#fluorine-chart path.line').count(), 2);
  assert.ok(await page.locator('#chirality-chart [data-row]').count() >= 6);
  assert.equal(await page.locator('#chirality-chart .legend li').count(), 3);
  assert.ok(await page.locator('#stereocentre-chart [data-k]').count() >= 8);
  assert.equal(await page.locator('#stem-chart [data-row]').count(), 25);
  await page.hover(`#stem-chart [data-row="${stemCounts(snapshot)[0].stem}"]`);
  assert.match(await page.textContent('#tip'), /monoclonal antibodies/);
  assert.equal(await page.locator('#stem-years-chart path.line').count(), 6);
  await page.close();
});

test('flag, route and ATC charts list their rows and tiles', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#flag-chart [data-row]').count(), 6);
  assert.equal(await page.locator('#route-chart [data-row]').count(), 3);
  assert.equal(await page.locator('#availability-chart [data-row]').count(), 5);
  assert.equal(await page.locator('#atc-chart [data-key]').count(), atcGroups(snapshot).length);
  await page.hover(`#atc-chart [data-key="${atcGroups(snapshot)[0].code}"]`);
  assert.match(await page.textContent('#tip'), /drugs/);
  assert.equal(await page.locator('#atc3-chart [data-row]').count(), 20);
  await page.close();
});

test('the target classes icicle nests protein classes and the family bars rank them', async () => {
  const { page } = await open();
  const tree = targetHierarchy(snapshot);
  assert.equal(await page.locator('#class-chart [data-depth="1"]').count(), tree.children.length);
  assert.ok(await page.locator('#class-chart [data-depth="3"]').count() > 10);
  await page.hover(`#class-chart [data-class="${tree.children[0].name}"]`);
  assert.match(await page.textContent('#tip'), /drug–target pairs[\s\S]*approved drugs[\s\S]*targets/);
  assert.equal(await page.locator('#family-chart [data-row]').count(), familyCounts(snapshot).length);
  await page.close();
});

test('the actions grid crosses target families with actions', async () => {
  const { page } = await open();
  const fa = familyActions(snapshot);
  assert.equal(await page.locator('#action-chart [data-cell]').count(), fa.families.length * fa.actions.length);
  await page.hover('#action-chart [data-cell="0:0"]');
  assert.match(await page.textContent('#tip'), /drug–target pairs/);
  assert.ok(await page.locator('#action-count-chart [data-row]').count() >= 10);
  await page.close();
});

test('the most-drugged targets are ranked and drugs per target are binned', async () => {
  const { page } = await open();
  const [top] = topTargets(snapshot, 1);
  assert.equal(await page.locator('#drugged-chart [data-row]').count(), 25);
  await page.hover(`#drugged-chart [data-row="${top.id}"]`);
  assert.match(await page.textContent('#tip'), new RegExp(`${top.drugs} approved drugs`));
  assert.equal(await page.locator('#per-target-chart [data-k]').count(), 7);
  assert.equal(await page.locator('#per-drug-chart [data-k]').count(), 6);
  await page.close();
});

test('the network draws every drug and target once with their links', async () => {
  const { page } = await open();
  const g = networkGraph(snapshot);
  assert.equal(await page.locator('#network-chart circle.node').count(), g.nodes.length);
  assert.equal(await page.locator('#network-chart path.links').count(), 1);
  const hub = g.nodes.reduce((a, b) => (b.degree > a.degree ? b : a));
  await page.focus('#network-chart svg');
  await page.keyboard.press('Home');
  assert.match(await page.textContent('#tip'), new RegExp(`${exact(hub.degree)} links`));
  await page.close();
});

test('GtoPdb bars split target types by ligand and boxes show approved affinities', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#gtopdb-chart [data-row]').count(), gtopdbRows(snapshot).length);
  assert.equal(await page.locator('#gtopdb-chart .legend li').count(), 3);
  assert.equal(await page.locator('#affinity-chart [data-type]').count(), affinityByType(snapshot).length);
  await page.hover('#affinity-chart [data-type="gpcr"]');
  assert.match(await page.textContent('#tip'), /median[\s\S]*nM/);
  assert.ok(await page.locator('#orphan-chart [data-row]').count() >= 4);
  assert.ok(await page.locator('#endogenous-chart [data-row]').count() >= 3);
  await page.close();
});

test('enzyme, EC and channel charts list the classes approved drugs act on', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#enzyme-chart [data-row]').count() >= 8);
  assert.equal(await page.locator('#ec-chart [data-row]').count(), 7);
  assert.ok(await page.locator('#channel-chart [data-row]').count() >= 8);
  await page.close();
});

test('the genetic support forest plot is marked fixed and ClinVar bins compare target genes with all genes', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#rs-chart [data-row]').count(), GENETIC_SUPPORT.sources.length + GENETIC_SUPPORT.areas.length);
  assert.equal(await page.locator('#rs-chart line.ref').count(), 1);
  await page.hover('#rs-chart [data-row="OMIM"]');
  assert.match(await page.textContent('#tip'), /3\.67[\s\S]*3\.07[\s\S]*4\.37/);
  assert.match(await page.textContent('#genetics'), /Fixed table/);
  assert.equal(await page.locator('#clinvar-chart [data-bin]').count(), 5);
  await page.close();
});

test('the kinome matrix draws every measured Kd and the selectivity scatter every inhibitor', async () => {
  const { page } = await open();
  const K = snapshot.kinome;
  assert.equal(await page.locator('#kinome-chart rect.cell').count(), K.pkd.flat().filter((v) => v !== null).length);
  assert.ok(await page.locator('#kinome-chart text.group-lab').count() >= 8);
  await page.focus('#kinome-chart svg');
  await page.keyboard.press('Home');
  assert.match(await page.textContent('#tip'), /Kd|no binding/);
  assert.equal(await page.locator('#selectivity-chart circle.pt').count(), K.inhibitors.length);
  await page.close();
});

test('structure charts stack PDB releases by method and count GPCR structures', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#pdb-chart path[data-key]').count(), 4);
  const G = snapshot.structures.gpcrdb;
  assert.equal(await page.locator('#gpcr-chart [data-row]').count(), Object.keys(G.classes).length);
  assert.equal(await page.locator('#gpcr-years-chart path[data-key]').count(), Object.keys(G.methods).length);
  await page.close();
});

test('the measurement record counts activities by type, year, source and format', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#type-chart [data-row]').count(), 20);
  assert.ok(await page.locator('#year-chart [data-k]').count() >= 40);
  assert.ok(await page.locator('#source-chart [data-row]').count() >= 10);
  assert.ok(await page.locator('#format-chart [data-row]').count() >= 6);
  await page.close();
});

test('potency lines compare assay types, and approved drugs are set against all measurements', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#pchembl-chart path.line').count(), snapshot.activities.byType.length);
  assert.equal(await page.locator('#approved-potency-chart .legend li').count(), 2);
  assert.equal(await page.locator('#measured-chart [data-row]').count(), 15);
  await page.close();
});

test('efficiency scatters carry iso-efficiency lines', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#le-chart circle.pt').count(), efficiencyPoints(snapshot).length);
  assert.ok(await page.locator('#le-chart line.ref').count() >= 2);
  assert.ok(await page.locator('#lle-chart line.ref').count() >= 2);
  await page.close();
});

test('agreement plots pair kinobeads with KINOMEscan and mark the bias and limits', async () => {
  const { page } = await open();
  const s = agreementStats(snapshot, 'klaeger');
  assert.equal(await page.locator('#agree-chart circle.pt').count(), s.n);
  assert.equal(await page.locator('#bland-chart circle.pt').count(), s.n);
  assert.equal(await page.locator('#bland-chart line.ref').count(), 3);
  assert.match(await page.textContent('#agreement .dek'), /Karaman/);
  await page.close();
});

test('the kinetic map places every K4DD pair against lines of equal affinity', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#kinetic-map circle.pt').count(), snapshot.kinetics.pairs.length);
  assert.ok(await page.locator('#kinetic-map line.ref').count() >= 4);
  assert.ok(await page.locator('#residence-chart [data-target]').count() >= 3);
  await page.close();
});

test('the receptor theory explorers redraw when their sliders move', async () => {
  const { page } = await open();
  const responseBefore = await page.getAttribute('#occupancy-chart path.line >> nth=1', 'd');
  await slide(page, '#log-tau', 2.5);
  assert.notEqual(await page.getAttribute('#occupancy-chart path.line >> nth=1', 'd'), responseBefore);
  assert.match(await page.textContent('#occupancy-out'), /EC50[\s\S]*Emax[\s\S]*occupied/);
  const curveBefore = await page.getAttribute('#binding-chart path.line', 'd');
  await slide(page, '#log-koff', -1);
  assert.notEqual(await page.getAttribute('#binding-chart path.line', 'd'), curveBefore);
  assert.match(await page.textContent('#binding-out'), /residence time[\s\S]*half-life/);
  await page.close();
});

test('the ALMANAC matrix lays out every drug pair and ranks the strongest', async () => {
  const { page } = await open();
  const n = snapshot.almanac.drugs.length;
  assert.equal(await page.locator('#combo-chart [data-cell]').count(), n * n);
  assert.equal(await page.locator('#combo-top-chart [data-row]').count(), 20);
  assert.ok(await page.locator('#combo-dist-chart [data-bin]').count() >= 10);
  await page.close();
});

test('PK histograms bin oral bioavailability, half-life and unbound fraction across approved drugs', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#f-chart [data-bin]').count(), 10);
  assert.ok(await page.locator('#halflife-chart [data-bin]').count() >= 8);
  assert.ok(await page.locator('#fu-chart [data-bin]').count() >= 5);
  await page.close();
});

test('the PK simulator redraws its concentration curve when a slider moves', async () => {
  const { page } = await open();
  const curveBefore = await page.getAttribute('#pk-chart path.line', 'd');
  await slide(page, '#pk-interval', 24);
  assert.notEqual(await page.getAttribute('#pk-chart path.line', 'd'), curveBefore);
  assert.match(await page.textContent('#pk-out'), /half-life[\s\S]*accumulat[\s\S]*steady state/);
  await page.close();
});

test('interaction grids cross enzymes and transporters with roles, and perpetrators are ranked', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#ddi-chart [data-cell]').count(), 7 * 8);
  assert.equal(await page.locator('#transporter-chart [data-cell]').count(), 10 * 2);
  assert.equal(await page.locator('#perpetrator-chart [data-row]').count(), 20);
  await page.close();
});

test('CiPA charts cross drugs with ion currents and rank hERG margins', async () => {
  const { page } = await open();
  const n = snapshot.cipa.rows.length;
  const currents = Object.keys(snapshot.cipa.rows[0].margin).length;
  assert.equal(await page.locator('#cipa-chart [data-cell]').count(), n * currents);
  assert.equal(await page.locator('#herg-chart [data-row]').count(), n);
  await page.close();
});

test('the registry stacks drug trials by phase each year and ranks every study status', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#registry-chart path.area').count(), 5);
  assert.equal(await page.locator('#status-chart [data-row]').count(), snapshot.trials.fields.OverallStatus.values.length);
  await page.close();
});

test('design grids cross the eight phase groups with design features and enrollment bands', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#design-chart [data-cell]').count(), 8 * 10);
  assert.equal(await page.locator('#enrollment-chart [data-cell]').count(), 8 * 6);
  await page.close();
});

test('the reporting chart draws a submission curve for each sponsor group and marks the one-year deadline', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#reporting-chart path.line').count(), snapshot.reporting.groups.length);
  assert.equal(await page.locator('#reporting-chart .mark-line').count(), 1);
  assert.match(await page.textContent('#reporting-dek'), /year after primary completion/);
  await page.close();
});

test('attrition charts are marked fixed and plot success rates with intervals and the published estimates', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#attrition-chart [data-row]').count(), ATTRITION.groups.length + 2);
  assert.equal(await page.locator('#transitions-chart [data-cell]').count(), (ATTRITION.groups.length + 2) * 4);
  assert.equal(await page.locator('#estimates-chart [data-row]').count(), ATTRITION.estimates.length);
  assert.match(await page.textContent('#attrition figcaption'), /Fixed table/);
  await page.close();
});

test('psychedelic and cannabinoid charts draw one line per compound', async () => {
  const { page } = await open();
  const group = (g) => snapshot.psychoactive.compounds.filter((c) => c.group === g).length;
  assert.equal(await page.locator('#psychedelics-chart path.line').count(), group('psychedelics'));
  assert.equal(await page.locator('#cannabinoids-chart path.line').count(), group('cannabinoids'));
  await page.close();
});

test('every figure offers its numbers as a table and as CSV', async () => {
  const { page } = await open();
  const figs = await page.$$eval('.fig', (els) => els.map((f) => ({
    id: f.querySelector('.chart')?.id,
    table: !!f.querySelector('figcaption details.data table'),
    head: [...f.querySelectorAll('figcaption details.data thead th')].map((th) => th.textContent).join(','),
    csv: f.querySelector('figcaption a.csv')?.getAttribute('href') ?? '',
    name: f.querySelector('figcaption a.csv')?.getAttribute('download') ?? '',
  })));
  assert.ok(figs.length >= 20);
  for (const f of figs) {
    assert.ok(f.table, `${f.id} table`);
    assert.match(f.csv, /^data:text\/csv;charset=utf-8,/, f.id);
    assert.equal(decodeURIComponent(f.csv.split(',').slice(1).join(',')).split('\r\n')[0], f.head, f.id);
    assert.match(f.name, /^[a-z0-9-]+\.csv$/, f.id);
  }
  await page.close();
});

test('sections sit in their parts with a reading guide up front', async () => {
  const { page } = await open();
  const layout = await page.evaluate(() => {
    const out = {};
    let current = null;
    for (const n of document.querySelectorAll('main > .chapter, main > section.story')) {
      if (n.classList.contains('chapter')) {
        current = n.dataset.chapter;
        out[current] = [];
      } else out[current].push(n.id);
    }
    return out;
  });
  assert.deepEqual(layout, CHAPTERS);
  assert.ok(await page.locator('#readme li').count() >= 5);
  assert.equal(await page.locator('#jump a.jump-ch').count(), Object.keys(CHAPTERS).length);
  await page.close();
});

test('lens buttons hide sections and update the URL', async () => {
  const { page } = await open();
  await page.click('#lenses button[data-lens="genomics"]');
  assert.equal(await page.isVisible('#druglike'), false);
  assert.equal(await page.isVisible('#decoder'), true);
  assert.match(page.url(), /\?lens=genomics$/);
  await page.click('#lenses button[data-lens="all"]');
  assert.equal(await page.isVisible('#druglike'), true);
  assert.doesNotMatch(page.url(), /lens=/);
  await page.close();
});

test('a lens in the URL is applied on load and hides empty parts', async () => {
  const { page } = await open({ search: '?lens=genomics' });
  assert.equal(await page.isVisible('[data-chapter="molecules"]'), false);
  assert.equal(await page.getAttribute('#lenses button[data-lens="genomics"]', 'aria-pressed'), 'true');
  await page.close();
});

test('theme toggle flips the color scheme', async () => {
  const { page } = await open();
  const initial = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#theme');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), initial);
  await page.close();
});

test('decoder identifies typed and example identifiers, naming ATC levels from the snapshot', async () => {
  const { page } = await open();
  await page.fill('#decoder-input', 'N02BE01');
  await page.waitForSelector('#decoder-out a');
  assert.match(await page.textContent('#decoder-out'), /ATC code[\s\S]*nervous system[\s\S]*anilides[\s\S]*paracetamol/);
  assert.equal(await page.getAttribute('#decoder-out a', 'href'), 'https://atcddd.fhi.no/atc_ddd_index/?code=N02BE01');
  await page.click('#examples button[data-id="CHEMBL25"]');
  assert.equal(await page.inputValue('#decoder-input'), 'CHEMBL25');
  assert.match(await page.textContent('#decoder-out'), /ChEMBL ID[\s\S]*Aspirin in ChEMBL/);
  await page.fill('#decoder-input', 'not an id');
  assert.match(await page.textContent('#decoder-out'), /No match/);
  assert.equal(await page.locator('#examples button').count(), EXAMPLES.length);
  await page.close();
});

test('on desktop hover previews, click pins and Escape closes', async () => {
  const { page } = await open();
  await page.hover('#ring-chart [data-row="benzene"]');
  assert.equal(await page.isVisible('#tip'), true);
  assert.notEqual(await page.getAttribute('#tip', 'data-pinned'), 'true');
  await page.click('#ring-chart [data-row="benzene"]');
  assert.equal(await page.getAttribute('#tip', 'data-pinned'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#tip'), false);
  await page.close();
});

test('each chart is one tab stop and arrow keys step through its marks', async () => {
  const { page } = await open();
  const stops = await page.evaluate(() => ({
    marks: document.querySelectorAll('.chart [data-k][tabindex="0"]').length,
    charts: document.querySelectorAll('.chart svg[tabindex="0"]').length,
  }));
  assert.equal(stops.marks, 0);
  assert.ok(stops.charts >= 20, `${stops.charts}`);
  const [first, second] = ringCounts(snapshot);
  await page.focus('#ring-chart svg');
  await page.keyboard.press('Home');
  assert.ok((await tipLinesOf(page)).some((l) => l.includes(first.name)));
  await page.keyboard.press('ArrowDown');
  assert.ok((await tipLinesOf(page)).some((l) => l.includes(second.name)));
  await page.close();
});

test('the page never scrolls sideways on a phone', async () => {
  const { page, context } = await openPhone();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(over <= 0, `${over}px`);
  await context.close();
});

test('on a phone a tap pins the popup and a tap outside closes it', async () => {
  const { page, context } = await openPhone();
  await tapAt(page, '#ring-chart [data-row="benzene"]', 0.6, 0.5);
  assert.equal(await page.getAttribute('#tip', 'data-pinned'), 'true');
  const tip = await page.locator('#tip').boundingBox();
  assert.ok(tip.x >= 0 && tip.x + tip.width <= page.viewportSize().width);
  await tapAt(page, '#rings .dek', 0.5, 0.5);
  assert.equal(await page.isVisible('#tip'), false);
  await context.close();
});

test('chart labels are never cut off and axis labels never overlap', async () => {
  for (const width of [1280, 375]) {
    const { page } = await open({ width });
    const cut = await page.$$eval('.chart text.lab', (ts) => ts.map((t) => t.textContent).filter((s) => s.endsWith('…')));
    assert.deepEqual(cut, [], `${width}px`);
    const clashes = await page.$$eval('.chart svg', (svgs) => svgs.flatMap((svg) => {
      const ticks = [...svg.querySelectorAll('text.tick')].map((t) => ({ t: t.textContent, b: t.getBBox() }));
      return ticks.flatMap((a, i) => ticks.slice(i + 1).filter((c) => Math.abs(a.b.y - c.b.y) < 2 && a.b.x < c.b.x + c.b.width && c.b.x < a.b.x + a.b.width)
        .map((c) => `${svg.closest('[id]')?.id}: ${a.t}/${c.t}`));
    }));
    assert.deepEqual(clashes, [], `${width}px`);
    await page.close();
  }
});

test('hexagons and points sit inside their plot', async () => {
  const { page } = await open();
  const out = await page.$$eval('.chart svg', (svgs) => svgs.flatMap((svg) => {
    const box = svg.viewBox.baseVal;
    return [...svg.querySelectorAll('[data-hex], circle.pt')].map((n) => ({ n, b: n.getBBox() }))
      .filter(({ b }) => b.x < -0.5 || b.y < -0.5 || b.x + b.width > box.width + 0.5 || b.y + b.height > box.height + 0.5)
      .map(({ n }) => `${svg.closest('[id]')?.id}: ${n.dataset.hex ?? n.dataset.point}`);
  }));
  assert.deepEqual(out, []);
  await page.close();
});

test('chart labels stay inside their chart', async () => {
  for (const width of [1280, 375]) {
    const { page } = await open({ width });
    const out = await page.$$eval('.chart svg', (svgs) => svgs.flatMap((svg) => {
      const box = svg.viewBox.baseVal;
      return [...svg.querySelectorAll('text.lab')].map((t) => ({ t: t.textContent, b: t.getBBox() }))
        .filter(({ b }) => b.x < -1 || b.x + b.width > box.width + 1)
        .map(({ t }) => `${svg.closest('[id]')?.id}: ${t}`);
    }));
    assert.deepEqual(out, [], `${width}px`);
    await page.close();
  }
});

test('the page states numbers, not opinions', async () => {
  const { page } = await open();
  const text = await page.evaluate(() => document.querySelector('main').innerText);
  assert.doesNotMatch(text, /\b(amazing|astonishing|stunning|shocking|staggering|incredible|remarkabl\w*|surprising\w*|merely|sadly|interestingly)\b/i);
  await page.close();
});

test('sources are titled and grouped, not bare URLs', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#sources .srcgroup').count() >= 2);
  const texts = await page.$$eval('#sources .srcgroup a', (as) => as.map((a) => a.textContent.trim()));
  assert.ok(texts.length >= 8);
  assert.deepEqual(texts.filter((t) => /^(https?:|www\.|[a-z0-9.-]+\.(gov|org|com|edu)\/)/.test(t)), []);
  await page.close();
});

test('the data behind the page can be downloaded and cited', async () => {
  const { page } = await open();
  const href = await page.getAttribute('#data-use a[href$="snapshot.json"]', 'href');
  const json = await (await page.request.get(new URL(href, page.url()).href)).json();
  assert.equal(json.generated, snapshot.generated);
  assert.ok(await page.locator('#data-use a[href="https://github.com/collide2954/basic-clinical-pharm"]').count());
  assert.match(await page.textContent('#data-use'), /Cite as:.*https:\/\/collide2954\.github\.io\/basic-clinical-pharm\//);
  await page.close();
});

test('shared links get a title, description and preview image', async () => {
  const { page } = await open();
  const meta = (sel) => page.getAttribute(sel, 'content');
  assert.equal(await meta('meta[property="og:title"]'), 'Basic & Clinical Pharmacology in Numbers');
  assert.ok((await meta('meta[property="og:description"]')).length > 40);
  assert.equal(await meta('meta[property="og:url"]'), 'https://collide2954.github.io/basic-clinical-pharm/');
  assert.equal(await meta('meta[property="og:image"]'), 'https://collide2954.github.io/basic-clinical-pharm/og.png');
  assert.equal(await meta('meta[name="twitter:card"]'), 'summary_large_image');
  const res = await page.request.get(new URL('og.png', page.url()).href);
  assert.equal(res.status(), 200);
  const png = await res.body();
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  await page.close();
});

test('the footer says AI helped and that a person reviewed the work', async () => {
  const { page } = await open();
  const note = await page.textContent('#foot .made');
  assert.match(note, /^Made by a person, with help from AI tools\./);
  assert.match(note, /reviewed before publishing/);
  assert.match(await page.textContent('#foot'), /Not an official FDA, NIH, EMBL-EBI or WHO site/);
  await page.close();
});

test('figures animate in when scrolled into view', async () => {
  const { page } = await open({ motion: 'no-preference' });
  assert.equal(await page.locator('#atc .fig.in').count(), 0);
  await page.locator('#atc-chart').scrollIntoViewIfNeeded();
  await page.waitForSelector('#atc .fig.in');
  await page.close();
});
