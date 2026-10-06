// Example knowledge used for fresh installs (and the "Load example notes"
// button). Purely data: collections, tags and notes built with the same model
// a user creates by hand.

import { DEFAULT_STATUSES, newBlock, newNote } from './model.js';
import { newId } from '../trackers/engine/ids.js';
import { inlineToText } from './inline.js';

const P = (t) => newBlock('p', t);
const H = (n, t) => newBlock(`h${n}`, t);
const B = (t) => newBlock('bullet', t);
const T = (t, checked = false) => newBlock('todo', t, { checked });

export function buildSampleNotes({ trackers = [], trackerItems = [], existing = { collections: [], tags: [] } } = {}) {
  const collections = [...existing.collections];
  const tags = [...existing.tags];
  const coll = (name, icon) => {
    let c = collections.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!c) { c = { id: newId('nc'), name, icon }; collections.push(c); }
    return c.id;
  };
  const tag = (name) => {
    let t = tags.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!t) { t = { id: newId('nt'), name }; tags.push(t); }
    return t.id;
  };

  const learning = trackers.find((t) => t.name.toLowerCase().startsWith('learning'));
  const topicField = learning?.fields.find((f) => f.name === 'Topic');
  const itemFor = (topic) => trackerItems.find((i) => i.trackerId === learning?.id && i.values?.[topicField?.id] === topic)?.id;

  const ids = { gcp: newId('n'), run: newId('n'), net: newId('n'), vpc: newId('n'), sql: newId('n') };
  const link = (key, title) => `[[${ids[key]}|${title}]]`;
  const st = (label) => DEFAULT_STATUSES.find((s) => s.label === label).id;
  const now = Date.now();
  let tick = 0;
  const stamp = () => now - (tick += 1) * 3600e3;
  const make = (fields) => { const t = stamp(); return newNote({ createdAt: t, updatedAt: t, openedAt: t, ...fields }); };

  const notes = [
    make({
      id: ids.gcp, title: 'GCP', icon: '☁️', statusId: st('Learning'), collectionIds: [coll('GCP', '☁️')], tagIds: [tag('gcp')],
      blocks: [P('Map of what I am learning about Google Cloud. Start with the sub-notes below.'), B(`${link('run', 'Cloud Run')} — serverless containers`), B(`${link('sql', 'Cloud SQL connectivity')} — managed databases`)],
    }),
    make({
      id: ids.run, title: 'Cloud Run', icon: '🏃', parentId: ids.gcp, statusId: st('Learning'), collectionIds: [coll('GCP', '☁️')], tagIds: [tag('gcp')],
      trackerItemIds: [itemFor('Cloud Run')].filter(Boolean),
      blocks: [H(2, 'Overview'), P('Cloud Run runs stateless containers and scales them to zero. Revisions are immutable; traffic can be split between them.'), H(2, 'Details'), B('Concurrency per instance is configurable'), B('Deploys create a new revision'), P(`Private access is covered in ${link('net', 'Cloud Run private networking')}.`)],
    }),
    make({
      id: ids.net, title: 'Cloud Run private networking', icon: '🔒', parentId: ids.run, statusId: st('Need Review'),
      collectionIds: [coll('GCP', '☁️')], tagIds: [tag('gcp'), tag('networking'), tag('interview')],
      trackerItemIds: [itemFor('Cloud Run')].filter(Boolean),
      relations: [{ targetId: ids.vpc, type: 'related' }],
      blocks: [
        H(2, 'Overview'),
        P(`Cloud Run can reach private resources through **VPC networking** (see ${link('vpc', 'VPC')}). Traffic leaves the service through a connector or Direct VPC egress.`),
        newBlock('callout', 'Make sure the egress setting matches the architecture: `PRIVATE_RANGES_ONLY` keeps public traffic off the VPC.', { variant: 'warn' }),
        H(2, 'Example'),
        newBlock('code', 'apiVersion: serving.knative.dev/v1\nkind: Service\nspec:\n  template:\n    metadata:\n      annotations:\n        run.googleapis.com/vpc-access-egress: private-ranges-only  # only RFC1918 goes via VPC', { lang: 'yaml' }),
        H(2, 'Checklist'),
        T('Understand the VPC connector', true), T('Understand private egress'), T('Understand Cloud SQL private IP'),
        H(2, 'Interview questions'),
        newBlock('number', 'When would you choose all-traffic egress?'), newBlock('number', 'How does Cloud Run reach a private Cloud SQL instance?'),
      ],
    }),
    make({
      id: ids.vpc, title: 'VPC', icon: '🌐', statusId: st('Know'), collectionIds: [coll('GCP', '☁️')], tagIds: [tag('gcp'), tag('networking')],
      blocks: [P('A Virtual Private Cloud is a private, global network. Subnets are regional; firewall rules are stateful.'), newBlock('quote', 'Networks are global, subnets are regional.')],
    }),
    make({
      id: ids.sql, title: 'Cloud SQL connectivity', icon: '🗄️', statusId: st('Learning'), collectionIds: [coll('GCP', '☁️')], tagIds: [tag('gcp'), tag('interview')],
      trackerItemIds: [itemFor('Cloud SQL')].filter(Boolean), parentId: ids.gcp,
      blocks: [P(`Connect over private IP inside the ${link('vpc', 'VPC')}, or use the Cloud SQL connector for IAM auth.`), newBlock('code', 'HikariConfig cfg = new HikariConfig();\ncfg.setMaximumPoolSize(10);\ncfg.setConnectionTimeout(30_000);', { lang: 'java' })],
    }),
    make({
      title: 'Static Kafka consumer', icon: '📨', statusId: st('Need Review'), collectionIds: [coll('Kafka', '📨')], tagIds: [tag('interview'), tag('review')],
      blocks: [P('A static consumer keeps the same identity across restarts using `group.instance.id`, so a quick restart does not trigger a rebalance.'), newBlock('code', 'group.instance.id=orders-consumer-1\nsession.timeout.ms=45000', { lang: 'text' })],
    }),
    make({
      title: 'Kafka consumer rebalancing', icon: '⚖️', statusId: st('Need Review'), collectionIds: [coll('Kafka', '📨')], tagIds: [tag('interview'), tag('important')],
      blocks: [H(2, 'Why it happens'), B('A consumer joins or leaves the group'), B('Partitions are added'), B('A member misses its heartbeat'), newBlock('callout', 'Cooperative rebalancing avoids the stop-the-world pause of the eager protocol.', { variant: 'tip' })],
    }),
    make({
      title: 'How to improve English', icon: '🇬🇧', statusId: st('Captured'), favorite: true, collectionIds: [coll('English', '🇬🇧'), coll('Personal', '🧠')],
      blocks: [B('Read a little every day'), B('Write down new phrases and reuse them the same week'), T('Find a speaking partner')],
    }),
  ];

  return { notes, collections, tags };
}

export function sampleTitles(notes) {
  return notes.map((n) => inlineToText(n.title));
}
