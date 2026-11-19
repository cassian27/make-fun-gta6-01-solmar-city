// SOLMAR CITY — random.js
// A small seeded random number generator (mulberry32) plus the helpers the
// city builder and the screenshot scenes use. The same seed gives the same
// city, the same traffic and the same staged scenes, which is what makes the
// screenshots repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A random-number source with named helpers, so call sites read plainly.
export function createRng(seed) {
  const next = createRandom(seed);
  return {
    next,
    // Float in [lo, hi).
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    // Integer in [lo, hi] inclusive.
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    // One element of an array, uniformly.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // True with probability p.
    chance(p) {
      return next() < p;
    },
  };
}
