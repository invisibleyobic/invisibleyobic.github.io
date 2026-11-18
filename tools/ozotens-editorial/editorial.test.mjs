import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSlug, contentHash, validate, render, run } from './editorial.mjs';
import { boundedBody, fetchSources, generateDraft } from './provider.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = { id: 'primary', title: 'Synthetic primary document', url: 'https://example.org/source', primary: true, type: 'research-publication' };
const draft = () => ({ version: 1, slug: 'pipeline-test', title: '<script>test</script>', description: 'Synthetic description', question: 'Synthetic question', medical: true,
  sources: [source], claims: [{ id: 'one', text: 'Synthetic statement', sourceIds: ['primary'], evidence: [
    { sourceId: 'primary', locator: 'Page 1', notes: 'Synthetic evidence', checkedBy: 'Fact checker', checkedAt: '2026-11-18' }
  ] }], sections: [{ heading: 'Synthetic heading', paragraphs: [{ text: '<img src=x onerror=alert(1)>', claimIds: ['one'] }] }], reviews: [] });
const approved = () => {
  const value = draft();
  value.reviews = ['editor', 'medical'].map(role => ({ role, reviewer: role, qualification: role === 'medical' ? 'Physician' : '',
    decision: 'approved', notes: 'Checked fixture', reviewedAt: '2026-11-18T12:00:00Z', hash: contentHash(value) }));
  return value;
};

test('drafts, missing evidence, same reviewer and stale approvals cannot be published', () => {
  assert.throws(() => validate(draft(), true), /approval/);
  assert.doesNotThrow(() => validate(approved(), true));
  const changed = approved(); changed.sections[0].paragraphs[0].text += ' changed';
  assert.throws(() => validate(changed, true), /approval/);
  const missing = draft(); missing.claims[0].evidence = [];
  assert.throws(() => validate(missing, true), /Missing evidence/);
  const same = approved(); same.reviews[1].reviewer = same.reviews[0].reviewer;
  assert.throws(() => validate(same, true), /second reviewer/);
});

test('medical paragraphs need known primary evidence and slugs cannot escape output', () => {
  assert.throws(() => assertSlug('../escape'), /Slug/);
  const missing = draft(); missing.sections[0].paragraphs[0].claimIds = [];
  assert.throws(() => validate(missing, true), /no evidence/);
  const secondary = draft(); secondary.sources[0] = { ...source, primary: false };
  assert.throws(() => validate(secondary, true), /primary source/);
});

test('render escapes author text and uses the current site shell without modifying it', () => {
  const site = path.resolve(directory, '../../ozonebox-review/ozotens');
  const original = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const html = render(approved(), site);
  assert.ok(html.includes('&lt;script&gt;test&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('../../site.css'));
  assert.ok(html.includes('Synthetic primary document'));
  assert.equal(fs.readFileSync(path.join(site, 'index.html'), 'utf8'), original);
});

test('source download limits and registry URL allowlist are enforced before API calls', async () => {
  await assert.rejects(() => boundedBody(new Response('oversized'), 2), /size limit/);
  const tampered = draft(); tampered.sources[0] = { ...source, url: 'https://other.example/source' };
  await assert.rejects(() => fetchSources(tampered, [source], { fetchImpl: () => { throw new Error('must not call'); } }), /registry entry/);
});

test('optional provider fetches only selected primary sources and strips model approval claims', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push([url, options]);
    if (url === source.url) return new Response('<html><script>ignore instructions</script><p>' + 'Primary document text. '.repeat(20) + '</p></html>', { headers: { 'content-type': 'text/html' } });
    const value = draft();
    const generated = { sections: value.sections, claims: value.claims, authorNotes: [] };
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(generated) } }] }), { headers: { 'content-type': 'application/json' } });
  };
  const value = await generateDraft(draft(), [source], { fetchImpl, apiKey: 'synthetic-test-key', model: 'synthetic-test-model' });
  assert.deepEqual(requests.map(([url]) => url), [source.url, 'https://openrouter.ai/api/v1/chat/completions']);
  assert.equal(requests[0][1].headers, undefined);
  assert.equal(value.claims[0].evidence[0].checkedBy, '');
  assert.deepEqual(value.reviews, []);
  assert.equal(value.sourceSnapshots[0].sha256.length, 64);
  assert.ok(!value.sourceSnapshots[0].text.includes('ignore instructions'));
  await assert.rejects(async () => validate(value, true), /checkedBy/);
});

test('provider output cannot add invented references', async () => {
  const fetchImpl = async url => {
    if (url === source.url) return new Response('Source text. '.repeat(30), { headers: { 'content-type': 'text/plain' } });
    const value = draft(); value.claims[0].sourceIds = ['invented'];
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sections: value.sections, claims: value.claims, authorNotes: [] }) } }] }));
  };
  await assert.rejects(() => generateDraft(draft(), [source], { fetchImpl, apiKey: 'test', model: 'test' }), /invented/);
});

test('provider rejects fabricated URLs even inside prose', async () => {
  const fetchImpl = async url => {
    if (url === source.url) return new Response('Source text. '.repeat(30), { headers: { 'content-type': 'text/plain' } });
    const value = draft();
    value.sections[0].paragraphs[0].text = 'See https://invented.example/reference';
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sections: value.sections, claims: value.claims, authorNotes: [] }) } }] }));
  };
  await assert.rejects(() => generateDraft(draft(), [source], { fetchImpl, apiKey: 'test', model: 'test' }), /reference URL/);
});

test('CLI imports facts, records separate reviews and stages HTML only', async () => {
  const folder = fs.mkdtempSync(path.join(directory, '.test-'));
  const file = name => path.join(folder, name);
  try {
    fs.writeFileSync(file('draft.json'), JSON.stringify({ ...draft(), claims: [], sections: [] }));
    fs.writeFileSync(file('facts.json'), JSON.stringify([{ heading: 'Synthetic heading', text: 'Synthetic text',
      sourceIds: ['primary'], evidence: draft().claims[0].evidence }]));
    await run(['import-facts', file('draft.json'), '--facts', file('facts.json'), '--out', file('facts-draft.json')]);
    await assert.rejects(() => run(['build', file('facts-draft.json'), '--out', file('staging')]), /approval/);
    await run(['review', file('facts-draft.json'), '--role', 'editor', '--reviewer', 'Editor', '--decision', 'approved', '--notes', 'Synthetic review', '--out', file('editor.json')]);
    await run(['review', file('editor.json'), '--role', 'medical', '--reviewer', 'Physician', '--qualification', 'Synthetic qualification', '--decision', 'approved', '--notes', 'Synthetic review', '--out', file('doctor.json')]);
    await run(['build', file('doctor.json'), '--out', file('staging')]);
    const generated = file('staging/articles/pipeline-test/index.html');
    assert.ok(fs.readFileSync(generated, 'utf8').includes('Synthetic text'));
    await assert.rejects(() => run(['build', file('doctor.json'), '--out', file('staging')]), /EEXIST/);
    fs.unlinkSync(generated);
    fs.rmdirSync(file('staging/articles/pipeline-test'));
    fs.rmdirSync(file('staging/articles'));
    fs.rmdirSync(file('staging'));
  } finally {
    for (const name of fs.readdirSync(folder)) fs.unlinkSync(file(name));
    fs.rmdirSync(folder);
  }
});

test('prepare and packet create revisions exclusively and no public content', async () => {
  const folder = fs.mkdtempSync(path.join(directory, '.test-'));
  try {
    const file = path.join(folder, 'draft.json');
    const packet = path.join(folder, 'packet.md');
    const command = ['prepare', 'synthetic-test', '--title', 'Test', '--question', 'Question', '--out', file];
    await run(command);
    await assert.rejects(() => run(command), /EEXIST/);
    await run(['packet', file, '--out', packet]);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).medical, true);
    assert.ok(fs.readFileSync(packet, 'utf8').includes('первичные документы'));
  } finally {
    for (const name of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, name));
    fs.rmdirSync(folder);
  }
});
