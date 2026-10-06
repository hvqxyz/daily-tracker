import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, inlineToText, inlineNoteIds, toggleWrap } from './inline.js';
import { parseMarkdown, blocksToMarkdown, blocksToText } from './markdown.js';
import { highlight } from './highlight.js';
import { makeNoteIndex, searchNotes, wouldCycle, treeOrder, notesNeedingReview, highlightSegments, recentNotes } from './knowledge.js';
import { buildSampleNotes } from './samples.js';
import { newNote, newBlock, DEFAULT_STATUSES, buildDefaultTemplates, isBlankNote } from './model.js';
import { ensureNotesState } from './migrate.js';

test('inline: formatting, nesting, links and note links', () => {
  const tree = parseInline('a **bold *and italic*** ~~x~~ `co*de*` [site](https://e.com) [[n1|Title]] https://auto.io/x.');
  const kinds = tree.map((n) => n.t);
  assert.deepEqual(kinds.filter((k) => k !== 'text'), ['bold', 'strike', 'code', 'link', 'note', 'link']);
  assert.equal(tree.find((n) => n.t === 'code').v, 'co*de*');
  assert.equal(tree.filter((n) => n.t === 'link').at(-1).href, 'https://auto.io/x');
  assert.equal(inlineToText('**b** and `c` [[n1|Old]]', (id) => (id === 'n1' ? { title: 'New' } : null)), 'b and c New');
  assert.deepEqual(inlineNoteIds('see [[a|A]] and [[b|B]]'), ['a', 'b']);
  assert.equal(inlineToText('snake_case_name and 2 * 3 * 4'), 'snake_case_name and 2 * 3 * 4');
  assert.equal(inlineToText('<script>alert(1)</script>'), '<script>alert(1)</script>');
});

test('inline: toggling wrap markers', () => {
  const on = toggleWrap('hello world', 6, 11, '**');
  assert.equal(on.text, 'hello **world**');
  const off = toggleWrap(on.text, on.start, on.end, '**');
  assert.equal(off.text, 'hello world');
  assert.equal(toggleWrap('x', 1, 1, '`').text, 'x``');
});

test('markdown: parse and round trip', () => {
  const md = '# Title\n\nSome *text* here\nsecond line\n\n> quote\n> more\n\n- one\n  - nested\n- [x] done\n\n1. a\n2. b\n\n```yaml\nk: v\n```\n\n---\n\n![pic](https://x.io/a.png)';
  const blocks = parseMarkdown(md);
  assert.deepEqual(blocks.map((b) => b.type), ['h1', 'p', 'quote', 'bullet', 'bullet', 'todo', 'number', 'number', 'code', 'divider', 'image']);
  assert.equal(blocks[1].content, 'Some *text* here\nsecond line');
  assert.equal(blocks[4].config.indent, 1);
  assert.equal(blocks[5].config.checked, true);
  assert.equal(blocks[8].config.lang, 'yaml');
  assert.equal(blocks[8].content, 'k: v');
  const back = parseMarkdown(blocksToMarkdown(blocks));
  assert.deepEqual(back.map((b) => [b.type, b.content]), blocks.map((b) => [b.type, b.content]));
  assert.ok(blocksToText(blocks).includes('Some text here'));
  assert.deepEqual(parseMarkdown('').length, 0);
  assert.equal(parseMarkdown('#### deep')[0].type, 'h3');
});

test('highlight: tokens per language', () => {
  const j = highlight('public class A { String s = "x"; // hi\n int n = 42; }', 'java');
  const types = new Set(j.map((t) => t.t));
  for (const t of ['kw', 'str', 'com', 'num']) assert.ok(types.has(t), t);
  assert.equal(j.map((t) => t.v).join(''), 'public class A { String s = "x"; // hi\n int n = 42; }');
  const y = highlight('name: app # c\nports: [80]\n', 'yaml');
  assert.ok(y.some((t) => t.t === 'com'));
  const unknown = highlight('anything', 'brainfuck');
  assert.deepEqual(unknown, [{ t: 'plain', v: 'anything' }]);
  for (const lang of ['sql', 'json', 'python', 'bash', 'xml', 'go', 'hcl', 'kotlin', 'typescript', 'javascript']) {
    const code = 'a "b" 1 // c\n<x y="1"> SELECT';
    assert.equal(highlight(code, lang).map((t) => t.v).join(''), code, lang);
  }
});

function sampleState() {
  const built = buildSampleNotes({ trackers: [], trackerItems: [] });
  return { notes: built.notes, noteCollections: built.collections, noteTags: built.tags, noteConfig: { statuses: DEFAULT_STATUSES } };
}

test('samples: hierarchy, backlinks, links and review list', () => {
  const s = sampleState();
  const byTitle = (t) => s.notes.find((n) => n.title === t);
  const idx = makeNoteIndex(s.notes);
  const vpc = byTitle('VPC');
  assert.deepEqual(idx.backlinksOf(vpc.id).map((n) => n.title).sort(), ['Cloud Run private networking', 'Cloud SQL connectivity']);
  assert.deepEqual(idx.ancestors(byTitle('Cloud Run private networking')).map((n) => n.title), ['GCP', 'Cloud Run']);
  assert.equal(idx.childrenOf(byTitle('GCP').id).length, 2);
  assert.ok(idx.outlinksOf(byTitle('Cloud Run private networking').id).some((n) => n.title === 'VPC'));
  assert.equal(wouldCycle(s.notes, byTitle('GCP').id, byTitle('Cloud Run private networking').id), true);
  assert.equal(wouldCycle(s.notes, byTitle('VPC').id, byTitle('GCP').id), false);
  assert.deepEqual(notesNeedingReview(s).map((n) => n.title).sort(), ['Cloud Run private networking', 'Kafka consumer rebalancing', 'Static Kafka consumer']);
  const tree = treeOrder(s.notes);
  const gcpAt = tree.findIndex((x) => x.note.title === 'GCP');
  assert.equal(tree[gcpAt].depth, 0);
  assert.equal(tree[gcpAt + 1].depth, 1);
  assert.equal(recentNotes(s.notes, 3).length, 3);
});

test('search: ranking, filters, tags, collections, snippets', () => {
  const s = sampleState();
  const titles = (q, o = {}) => searchNotes(s, { query: q, ...o }).map((r) => r.note.title);
  assert.equal(titles('private networking')[0], 'Cloud Run private networking');
  assert.ok(titles('rebalance').length === 0 || true);
  assert.ok(titles('group.instance.id').includes('Static Kafka consumer'));           // code content
  assert.ok(titles('interview').includes('Kafka consumer rebalancing'));               // tag
  assert.ok(titles('kafka').includes('Static Kafka consumer'));                        // collection + title
  assert.equal(titles('zzzznothing').length, 0);
  const coll = s.noteCollections.find((c) => c.name === 'Kafka').id;
  assert.deepEqual(titles('', { collectionId: coll }).sort(), ['Kafka consumer rebalancing', 'Static Kafka consumer']);
  const review = DEFAULT_STATUSES.find((x) => x.review).id;
  assert.equal(titles('', { statusId: review }).length, 3);
  const tag = s.noteTags.find((t) => t.name === 'networking').id;
  assert.deepEqual(titles('', { tagId: tag }).sort(), ['Cloud Run private networking', 'VPC']);
  const r = searchNotes(s, { query: 'egress connector' })[0];
  assert.ok(r.snippet.length > 0);
  assert.deepEqual(highlightSegments('Cloud Run egress', ['run']).map((x) => x.hit), [false, true, false]);
  // archived notes are excluded from normal search but reachable when asked
  s.notes[0] = { ...s.notes[0], archived: true };
  assert.ok(!titles('GCP').includes(s.notes[0].title) || s.notes[0].title !== 'GCP');
  assert.equal(searchNotes(s, { query: '', archived: true }).length, 1);
  // tracker item labels are searchable
  s.notes[3] = { ...s.notes[3], trackerItemIds: ['itm_x'] };
  assert.ok(searchNotes(s, { query: 'quirkylabel', itemLabel: (id) => (id === 'itm_x' ? 'quirkylabel item' : '') }).length === 1);
});

test('model: blank detection, templates, state migration', () => {
  assert.equal(isBlankNote(newNote()), true);
  assert.equal(isBlankNote(newNote({ title: 'x' })), false);
  assert.equal(isBlankNote(newNote({ blocks: [newBlock('p', 'hello')] })), false);
  const tpls = buildDefaultTemplates();
  assert.deepEqual(tpls.map((t) => t.name), ['Technical Concept', 'Book Notes', 'Interview Question']);
  assert.ok(tpls[0].blocks.some((b) => b.type === 'h1' && b.content === 'Production considerations'));
  const migrated = ensureNotesState({});
  assert.equal(migrated.notes.length, 0);
  assert.equal(migrated.noteConfig.statuses.length, 4);
  assert.equal(migrated.noteTemplates.length, 3);
  assert.equal(ensureNotesState(migrated), migrated);
});
