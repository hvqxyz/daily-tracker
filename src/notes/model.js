// Knowledge notes are their own entity — independent of trackers and the
// planner. They can *reference* tracker items and activities, but never
// belong to one. Content is a list of typed blocks (not one text blob).

import { newId } from '../trackers/engine/ids.js';

export const BLOCK_TYPES = [
  { type: 'p', label: 'Text', hint: 'Plain paragraph', keys: 'text paragraph' },
  { type: 'h1', label: 'Heading 1', hint: 'Big section heading', keys: 'h1 heading title' },
  { type: 'h2', label: 'Heading 2', hint: 'Section heading', keys: 'h2 heading' },
  { type: 'h3', label: 'Heading 3', hint: 'Small heading', keys: 'h3 heading' },
  { type: 'bullet', label: 'Bulleted list', hint: 'A simple list', keys: 'bullet list ul' },
  { type: 'number', label: 'Numbered list', hint: 'An ordered list', keys: 'number ordered list ol' },
  { type: 'todo', label: 'Checklist', hint: 'Track tasks', keys: 'todo task check checklist' },
  { type: 'quote', label: 'Quote', hint: 'Capture a quote', keys: 'quote blockquote' },
  { type: 'callout', label: 'Callout', hint: 'Highlight something important', keys: 'callout note warning tip important' },
  { type: 'code', label: 'Code block', hint: 'Code with syntax highlighting', keys: 'code snippet pre' },
  { type: 'divider', label: 'Divider', hint: 'A horizontal line', keys: 'divider line hr separator' },
  { type: 'embed', label: 'Link / embed', hint: 'A web link or video', keys: 'link embed url bookmark video youtube' },
  { type: 'image', label: 'Image', hint: 'Upload or link an image', keys: 'image picture photo' },
  { type: 'file', label: 'Attachment', hint: 'Attach a small file', keys: 'file attachment upload' },
];

export const TEXT_TYPES = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout'];
export const LIST_TYPES = ['bullet', 'number', 'todo'];
export const CALLOUT_VARIANTS = [
  { value: 'info', icon: '💡', label: 'Info' },
  { value: 'warn', icon: '⚠️', label: 'Warning' },
  { value: 'tip', icon: '✅', label: 'Tip' },
  { value: 'danger', icon: '🛑', label: 'Danger' },
];
export const CODE_LANGUAGES = ['text', 'java', 'kotlin', 'javascript', 'typescript', 'python', 'sql', 'yaml', 'json', 'bash', 'xml', 'go', 'hcl'];

export const isTextType = (type) => TEXT_TYPES.includes(type);
export const isListType = (type) => LIST_TYPES.includes(type);

export const MAX_ATTACHMENT_BYTES = 400 * 1024;

export function newBlock(type = 'p', content = '', config = {}) {
  return { id: newId('blk'), type, content, config: { ...config } };
}

export const DEFAULT_STATUSES = [
  { id: 'st_captured', label: 'Captured', icon: '📝', color: '#898781', review: false },
  { id: 'st_learning', label: 'Learning', icon: '🟡', color: '#c99a2e', review: false },
  { id: 'st_know', label: 'Know', icon: '🟢', color: '#199e70', review: false },
  { id: 'st_review', label: 'Need Review', icon: '🔴', color: '#d03b3b', review: true },
];

// -- templates: only starting structures, stored (and editable) like user data --

const h = (level, text) => newBlock(`h${level}`, text);
const p = (text = '') => newBlock('p', text);

export function buildDefaultTemplates() {
  const mk = (name, icon, headings) => ({
    id: newId('ntpl'),
    name,
    icon,
    blocks: headings.flatMap((t) => [h(1, t), p('')]),
  });
  return [
    mk('Technical Concept', '🧩', ['Definition', 'Why?', 'How it works', 'Example', 'Production considerations', 'Common mistakes', 'Interview questions', 'Resources']),
    mk('Book Notes', '📖', ['Summary', 'Main ideas', 'What I learned', 'Important quotes', 'How I can apply it', 'Related ideas']),
    mk('Interview Question', '🎤', ['Question', 'Short answer', 'Deep answer', 'Example', 'Follow-up questions', 'Related concepts']),
  ];
}

export function newNote(fields = {}) {
  const now = Date.now();
  return {
    id: newId('n'),
    title: '',
    icon: '',
    statusId: null,
    collectionIds: [],
    tagIds: [],
    parentId: null,
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    openedAt: now,
    rev: 0,
    relations: [],
    trackerItemIds: [],
    blocks: [newBlock('p')],
    versions: [],
    ...fields,
  };
}

/** Copies of a template's blocks with fresh ids. */
export function cloneBlocks(blocks) {
  return blocks.map((b) => ({ ...b, id: newId('blk'), config: { ...(b.config || {}) } }));
}

export function isBlankNote(note) {
  return !note.title.trim() && note.blocks.every((b) => !b.content && !['divider', 'image', 'file', 'embed'].includes(b.type));
}
