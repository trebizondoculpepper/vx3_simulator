// Logbook entries written after the Helmholtz-Blatz field gets away from the
// operator. Deadpan, in the VXJunkies tradition: report it like a blown fuse.
export const consequences: readonly string[] = [
  'Field collapse. The bench is now 4 cm shorter. Measured it twice.',
  'Breaker tripped. The kettle in the next room has boiled. It was not plugged in.',
  'Lost about forty minutes. The clock agrees with me, which is worse.',
  'Every screw on the bench is now left-handed. Ordering a new set of drivers.',
  'The cat came in from the garden. We do not have a cat.',
  'Mild Blatz bleed. All the ink in my notebook has moved one page forward.',
  'Field inverted for a moment. The shed smells strongly of 1987.',
  'Spindle stalled. Radio picked up a shipping forecast for a sea I have never heard of.',
  'Breaker tripped. Garage door now opens from the other side.',
  'Neighbour came round to complain about the noise. There was no noise. He was very specific about it.',
  'Collapse. One of my socks is still warm. Both feet were nowhere near the rig.',
  'Field went resonant. My reflection was slightly late for about an hour.',
  'Tripped out. Found a VX3 service manual on the bench. Mine is still on the shelf. This one is annotated in my handwriting.',
  'Minor event. The fuse that blew was one I had not fitted yet.',
  'Lost lock. The ceiling light now hums in a key I can only describe as disappointed.',
];

export function pickConsequence(random: () => number = Math.random): string {
  return consequences[Math.floor(random() * consequences.length)];
}
