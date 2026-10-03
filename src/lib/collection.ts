import type { Place } from '../types';

export type PlaceItem = Place & { type: 'place' | 'hotel' };
export type CollectionSort = 'name' | 'priority' | 'rating' | 'visited' | 'distance';
export type CollectionGroup = 'none' | 'category' | 'tracker' | 'alphabet';
export type CollectionDensity = 'rows' | 'cards';

export const sortLabels: Record<CollectionSort, string> = {
  name: 'Name (A–Z)', priority: 'Highest priority', rating: 'Highest rated', visited: 'Recently visited', distance: 'Nearest',
};

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function matchesCollectionSearch(item: { name?: string; title?: string; address?: string; details?: string; notes?: string; category?: string; scope?: string }, query: string) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize([item.name, item.title, item.address, item.details, item.notes, item.category, item.scope].join(' '));
  return terms.every(term => haystack.includes(term));
}

export function sortCollection(items: PlaceItem[], sort: CollectionSort, distance: (item: PlaceItem) => number) {
  return [...items].sort((a, b) => {
    let order = 0;
    if (sort === 'priority') order = (Number(b.priority) || 0) - (Number(a.priority) || 0);
    if (sort === 'rating') order = (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (sort === 'visited') order = (b.date || '').localeCompare(a.date || '');
    if (sort === 'distance') order = distance(a) - distance(b);
    return order || collator.compare(a.name, b.name) || collator.compare(`${a.type}:${a.id}`, `${b.type}:${b.id}`);
  });
}

export function groupCollection(items: PlaceItem[], grouping: CollectionGroup) {
  if (grouping === 'none') return [{ label: '', items }];
  const groups = new Map<string, PlaceItem[]>();
  for (const item of items) {
    const initial = normalize(item.name).charAt(0).toUpperCase();
    const label = grouping === 'category' ? item.category || 'Other' : grouping === 'tracker' ? item.scope || 'Other' : /^[A-Z]$/.test(initial) ? initial : '#';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return [...groups].sort(([a], [b]) => a === '#' ? 1 : b === '#' ? -1 : collator.compare(a, b)).map(([label, entries]) => ({ label, items: entries }));
}

export function photoCount(item: Place) {
  return item.photoDetails?.length || (item.photos || '').split(',').filter(Boolean).length;
}
