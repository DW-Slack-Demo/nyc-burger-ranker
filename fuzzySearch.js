// Forgiving search over the recommended spots: ignores case, accents,
// punctuation and spacing, and tolerates small typos ("minneta tavrn").

export function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function allowedTypos(length) {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

// How well one query word matches one word of the text, from 0 (no match) to 1.
function wordScore(queryWord, word) {
  if (word === queryWord) return 1;
  if (word.startsWith(queryWord)) return 0.9;
  if (queryWord.length >= 3 && word.includes(queryWord)) return 0.7;
  const typos = allowedTypos(queryWord.length);
  if (typos === 0) return 0;
  // Compare against the word cut to the query's length too, so a typo'd
  // prefix like "minnet" still finds "minetta".
  const distance = Math.min(
    editDistance(queryWord, word),
    editDistance(queryWord, word.slice(0, queryWord.length))
  );
  return distance <= typos ? 0.6 - distance * 0.1 : 0;
}

function textScore(query, text) {
  const target = normalize(text);
  if (!target) return 0;
  if (target === query) return 2;
  // Spacing-insensitive: "shakeshack" or "j g melon" still find their spot.
  const squashedQuery = query.replace(/ /g, '');
  const squashedTarget = target.replace(/ /g, '');
  if (squashedTarget === squashedQuery) return 1.9;
  if (squashedQuery.length >= 3 && squashedTarget.startsWith(squashedQuery)) return 1.5;

  const words = target.split(' ');
  let total = 0;
  for (const queryWord of query.split(' ')) {
    const best = Math.max(...words.map(word => wordScore(queryWord, word)));
    if (best === 0) return 0; // every typed word has to match something
    total += best;
  }
  return total / query.split(' ').length;
}

export function fuzzySearch(items, rawQuery, limit = 5) {
  const query = normalize(rawQuery);
  if (!query) return [];
  return items
    .map(item => ({
      item,
      // Name matches rank above address matches.
      score: Math.max(textScore(query, item.name), textScore(query, item.address) * 0.8),
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => result.item);
}
