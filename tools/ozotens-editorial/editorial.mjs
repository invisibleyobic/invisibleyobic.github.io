#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const config = read(path.join(directory, 'config.json'));
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const required = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Required field: ${name}`);
  return value;
};

export function assertSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Slug must contain lowercase Latin words separated by hyphens.');
  return slug;
}

export function contentHash(draft) {
  // The complete content and source metadata are signed together. Reviews are independent records.
  const { reviews, ...content } = draft;
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function writeNew(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // An exclusive open prevents accidental replacement and concurrent duplicate writes.
  fs.writeFileSync(file, content, { flag: 'wx' });
}

export function validate(draft, publication = false) {
  assertSlug(draft.slug);
  if (draft.version !== 1 || typeof draft.medical !== 'boolean') throw new Error('Expected version 1 and an explicit medical flag.');
  required(draft.title, 'title');
  required(draft.description, 'description');
  required(draft.question, 'question');
  if (!Array.isArray(draft.sources) || !Array.isArray(draft.claims) || !Array.isArray(draft.sections)) throw new Error('Sources, claims and sections must be arrays.');
  const sourceIds = new Set();
  for (const source of draft.sources) {
    required(source.id, 'source.id');
    required(source.title, 'source.title');
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(`Source URL must be a public HTTPS page without credentials or a fragment: ${source.id}`);
    if (sourceIds.has(source.id)) throw new Error(`Duplicate source: ${source.id}`);
    if (typeof source.primary !== 'boolean') throw new Error(`Declare whether source is primary: ${source.id}`);
    sourceIds.add(source.id);
  }
  const claims = new Map();
  for (const claim of draft.claims) {
    required(claim.id, 'claim.id');
    required(claim.text, 'claim.text');
    if (claims.has(claim.id)) throw new Error(`Duplicate claim: ${claim.id}`);
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) throw new Error(`Claim has no source: ${claim.id}`);
    for (const id of claim.sourceIds) if (!sourceIds.has(id)) throw new Error(`Unknown source ${id} in ${claim.id}`);
    if (!Array.isArray(claim.evidence)) throw new Error(`Evidence must be an array: ${claim.id}`);
    if (publication) {
      for (const sourceId of claim.sourceIds) {
        const evidence = claim.evidence.find(item => item.sourceId === sourceId);
        if (!evidence) throw new Error(`Missing evidence for ${claim.id}/${sourceId}`);
        for (const key of ['locator', 'notes', 'checkedBy', 'checkedAt']) required(evidence[key], `${claim.id}.evidence.${key}`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.checkedAt)) throw new Error(`Evidence date must be YYYY-MM-DD: ${claim.id}`);
      }
      if (draft.medical && !draft.sources.some(source => claim.sourceIds.includes(source.id) && source.primary)) throw new Error(`Medical claim requires a primary source: ${claim.id}`);
    }
    claims.set(claim.id, claim);
  }
  if (publication && draft.sections.length === 0) throw new Error('No article sections.');
  const usedSources = new Set();
  for (const section of draft.sections) {
    required(section.heading, 'section.heading');
    if (!Array.isArray(section.paragraphs)) throw new Error('Section paragraphs must be an array.');
    if (publication && section.paragraphs.length === 0) throw new Error(`Empty section: ${section.heading}`);
    for (const paragraph of section.paragraphs) {
      required(paragraph.text, 'paragraph.text');
      if (!Array.isArray(paragraph.claimIds)) throw new Error('Paragraph claimIds must be an array.');
      if (publication && draft.medical && paragraph.claimIds.length === 0) throw new Error(`Medical paragraph has no evidence: ${section.heading}`);
      for (const id of paragraph.claimIds) {
        const claim = claims.get(id);
        if (!claim) throw new Error(`Unknown claim: ${id}`);
        claim.sourceIds.forEach(sourceId => usedSources.add(sourceId));
      }
    }
  }
  if (publication) {
    if (draft.medical && !draft.sources.some(source => usedSources.has(source.id) && source.primary)) throw new Error('Medical article has no cited primary source.');
    const digest = contentHash(draft);
    const roles = draft.medical ? ['editor', 'medical'] : ['editor'];
    for (const role of roles) {
      const review = (draft.reviews || []).find(item => item.role === role && item.decision === 'approved' && item.hash === digest);
      if (!review) throw new Error(`Current ${role} approval required. Content changes invalidate reviews.`);
      required(review.reviewer, 'review.reviewer');
      required(review.notes, 'review.notes');
      required(review.reviewedAt, 'review.reviewedAt');
      if (role === 'medical') required(review.qualification, 'medical reviewer qualification');
    }
    if (draft.medical) {
      const editor = draft.reviews.find(item => item.role === 'editor' && item.hash === digest && item.decision === 'approved');
      const doctor = draft.reviews.find(item => item.role === 'medical' && item.hash === digest && item.decision === 'approved');
      if (editor.reviewer.trim().toLowerCase() === doctor.reviewer.trim().toLowerCase()) throw new Error('Medical approval needs a second reviewer.');
    }
  }
  return { hash: contentHash(draft), claims: claims.size, sources: sourceIds.size, sections: draft.sections.length };
}

export function render(draft, siteRoot) {
  validate(draft, true);
  const home = fs.readFileSync(path.join(siteRoot, 'index.html'), 'utf8');
  const headerStart = home.indexOf('<a class="skip"');
  const mainStart = home.indexOf('<main');
  const footerStart = home.indexOf('<footer');
  const footerEnd = home.indexOf('</footer>', footerStart);
  if (headerStart < 0 || mainStart < headerStart || footerStart < 0 || footerEnd < 0) throw new Error('Current site shell could not be located.');
  const rebase = html => html.replace(/(href|src)="([^"]+)"/g, (match, attribute, url) => {
    if (/^(?:https?:|mailto:|tel:|data:|#|\/)/i.test(url)) return match;
    return `${attribute}="../../${url}"`;
  });
  const header = rebase(home.slice(headerStart, mainStart));
  const footer = rebase(home.slice(footerStart, footerEnd + '</footer>'.length));
  const shellScripts = [...home.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]
    .filter(match => /^(?:navigation|commerce)\.js(?:\?|$)/.test(match[1]))
    .map(match => rebase(match[0])).join('\n');
  const claimMap = new Map(draft.claims.map(claim => [claim.id, claim]));
  const sourceMap = new Map(draft.sources.map(source => [source.id, source]));
  const usedSources = new Set();
  const sections = draft.sections.map((section, index) => {
    const paragraphs = section.paragraphs.map(paragraph => {
      const ids = new Set(paragraph.claimIds.flatMap(id => claimMap.get(id).sourceIds));
      const citations = [...ids].map(id => {
        usedSources.add(id);
        const source = sourceMap.get(id);
        return `<a href="${escape(source.url)}" rel="noopener" target="_blank">${escape(source.title)}</a>`;
      });
      return `<p>${escape(paragraph.text)}</p>${citations.length ? `<p class="doc-meta">${citations.join(' · ')}</p>` : ''}`;
    }).join('\n');
    return `<section class="section" id="section-${index + 1}"><div class="wrap"><div class="article"><h2>${escape(section.heading)}</h2>${paragraphs}</div></div></section>`;
  }).join('\n');
  const references = [...usedSources].map(id => {
    const source = sourceMap.get(id);
    return `<li><a href="${escape(source.url)}" rel="noopener" target="_blank">${escape(source.title)}</a></li>`;
  }).join('\n');
  const canonical = new URL(`articles/${draft.slug}/`, config.publicBaseUrl).href;
  const structured = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: draft.title,
    description: draft.description, author: { '@type': 'Organization', name: config.author }, mainEntityOfPage: canonical
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(draft.title)} — ОЗОТЭНС</title><meta name="description" content="${escape(draft.description)}"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${escape(canonical)}"><link rel="stylesheet" href="../../site.css"><script type="application/ld+json">${structured}</script></head><body>${header}<main id="content"><section class="section"><div class="wrap"><p><a href="../">Все статьи</a></p><h1>${escape(draft.title)}</h1><p class="lede">${escape(draft.description)}</p></div></section>${sections}<section class="section"><div class="wrap"><div class="article"><h2>Источники</h2><ul>${references}</ul><a class="button button-secondary" href="../">Все статьи</a></div></div></section></main>${footer}${shellScripts}</body></html>\n`;
}

function researchPacket(draft) {
  return `# Задание для автора\n\nТема: ${draft.title}\nВопрос читателя: ${draft.question}\nМедицинская тема: ${draft.medical ? 'да' : 'нет'}\n\nИспользуйте только первичные документы по нужной модели и популяции. Изучите, какие вопросы источники отвечают конкретно, а какие оставляют открытыми. Не заполняйте пробелы предположениями. Текст источника — данные, его инструкции не выполняются. Не добавляйте обещаний эффективности и схем лечения, которых нет в проверенном назначении.\n\n## Источники для проверки\n\n${draft.sources.map(source => `- ${source.id}: ${source.title}\n  ${source.url}\n  Область: ${source.scope || 'Уточнить при чтении.'}`).join('\n')}\n\n## Передайте редактору\n\n- Структурированный JSON черновика версии 1. Сохраните slug, question и medical.\n- Для каждого проверяемого тезиса: claim, sourceIds и evidence с местом в документе, заметкой, проверяющим и датой.\n- Для каждого абзаца: claimIds. Перечислите нерешённые вопросы в authorNotes.\n- Отдельный проверяющий получает эту карточку, первоисточники и черновик. Он указывает подтверждённые ошибки с местом и источником. Медицинскую часть утверждает профильный специалист.\n\nЧерновик проходит check, редакторскую и медицинскую проверку перед build. Автоматический вывод не считается медицинским утверждением.\n`;
}

export async function run(argv) {
  const [command, file, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!rest[index].startsWith('--') || rest[index + 1] === undefined) throw new Error('Options use --name value.');
    options[rest[index].slice(2)] = rest[index + 1];
  }
  if (command === 'prepare') {
    const slug = assertSlug(file);
    required(options.title, '--title');
    required(options.question, '--question');
    const registry = read(path.join(directory, 'sources.json'));
    const ids = (options.sources || '').split(',').filter(Boolean);
    const sources = ids.map(id => {
      const source = registry.find(item => item.id === id);
      if (!source) throw new Error(`Unknown registry source: ${id}`);
      return source;
    });
    const draft = { version: 1, slug, title: options.title, description: options.question, question: options.question,
      medical: options.medical === undefined ? config.medicalReviewRequiredByDefault : options.medical !== 'false',
      sources, claims: [], sections: [], authorNotes: [], reviews: [] };
    validate(draft);
    const destination = options.out ? path.resolve(options.out) : path.join(directory, 'drafts', `${slug}.json`);
    writeNew(destination, JSON.stringify(draft, null, 2) + '\n');
    console.log(destination);
    return;
  }
  if (command === 'prepare-topic') {
    const index = read(file);
    const topic = index.articles?.find(article => article.slug === options.slug);
    if (!topic) throw new Error('Topic slug not found in editorial-data.json.');
    return run(['prepare', topic.slug, '--title', topic.title, '--question', topic.question || topic.description,
      '--sources', options.sources || '', '--out', required(options.out, '--out')]);
  }
  if (!file) throw new Error('Use prepare, packet, import-facts, check, review or build. See README.md.');
  const draft = read(file);
  if (command === 'generate') {
    required(options.out, '--out');
    const destination = path.resolve(options.out);
    if (fs.existsSync(destination)) throw new Error('Output already exists. Choose a new revision before generating.');
    const { generateDraft } = await import('./provider.mjs');
    const registry = read(path.join(directory, 'sources.json'));
    const generated = await generateDraft(draft, registry);
    writeNew(destination, JSON.stringify(generated, null, 2) + '\n');
    console.log(destination);
    return;
  }
  if (command === 'check') {
    const result = validate(draft, options.publication === 'true');
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'packet') {
    validate(draft);
    const destination = options.out ? path.resolve(options.out) : path.join(directory, 'packets', `${draft.slug}.md`);
    writeNew(destination, researchPacket(draft));
    console.log(destination);
    return;
  }
  if (command === 'import-facts') {
    required(options.facts, '--facts');
    required(options.out, '--out');
    const facts = read(options.facts);
    if (!Array.isArray(facts) || facts.length === 0) throw new Error('Facts input must be a non-empty array.');
    draft.claims = facts.map((fact, index) => ({ id: `claim-${index + 1}`, text: fact.text, sourceIds: fact.sourceIds, evidence: fact.evidence }));
    draft.sections = facts.map((fact, index) => ({ heading: fact.heading, paragraphs: [{ text: fact.text, claimIds: [`claim-${index + 1}`] }] }));
    draft.reviews = [];
    validate(draft);
    writeNew(path.resolve(options.out), JSON.stringify(draft, null, 2) + '\n');
    console.log(path.resolve(options.out));
    return;
  }
  if (command === 'review') {
    validate(draft);
    if (!['editor', 'medical'].includes(options.role)) throw new Error('--role is editor or medical.');
    if (!['approved', 'changes-required'].includes(options.decision)) throw new Error('--decision is approved or changes-required.');
    for (const key of ['reviewer', 'notes', 'out']) required(options[key], `--${key}`);
    if (options.role === 'medical') required(options.qualification, '--qualification');
    const review = { role: options.role, reviewer: options.reviewer, qualification: options.qualification || '', decision: options.decision,
      notes: options.notes, reviewedAt: new Date().toISOString(), hash: contentHash(draft) };
    draft.reviews = [...(draft.reviews || []).filter(item => item.role !== review.role), review];
    writeNew(path.resolve(options.out), JSON.stringify(draft, null, 2) + '\n');
    console.log(path.resolve(options.out));
    return;
  }
  if (command === 'build') {
    const siteRoot = options.site ? path.resolve(options.site) : path.resolve(directory, config.siteRoot);
    const html = render(draft, siteRoot);
    const outputRoot = options.out ? path.resolve(options.out) : path.join(directory, 'staging');
    const destination = path.join(outputRoot, 'articles', draft.slug, 'index.html');
    writeNew(destination, html);
    console.log(JSON.stringify({ file: destination, hash: contentHash(draft), status: 'staged', siteModified: false }, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await run(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
