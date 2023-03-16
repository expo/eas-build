import { uniq } from './uniq.js';

export function duplicates<T = any>(items: T[]): T[] {
  const uniqueItems = uniq(items);
  if (uniqueItems.length === items.length) {
    return [];
  }

  const visitedItemsSet = new Set<T>();
  const duplicatedItemsSet = new Set<T>();
  for (const item of items) {
    if (visitedItemsSet.has(item)) {
      duplicatedItemsSet.add(item);
    } else {
      visitedItemsSet.add(item);
    }
  }
  return [...duplicatedItemsSet];
}
