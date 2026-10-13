/** Shuffled sets use every recording, without repeats at the set boundary. */
export function createVariantPicker(count: number, random = Math.random) {
  if (count < 1) throw new Error('Sound has no variants');
  let bag: number[] = [];
  let last = -1;
  return () => {
    if (!bag.length) {
      bag = Array.from({ length: count }, (_, i) => i);
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (count > 1 && bag[bag.length - 1] === last)
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    last = bag.pop()!;
    return last;
  };
}
