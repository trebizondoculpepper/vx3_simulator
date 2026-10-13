import { describe, expect, it } from 'vitest';
import { createTapeTransport, tapeSpeed, tapeVolume } from './tape-transport';
const tracks = ['one', 'two', 'three', 'four'].map((title) => ({
  title,
  url: title,
  loopStartSeconds: 0.25,
  loopEndSeconds: 10.25,
}));
describe('cassette music transport', () => {
  it('stops without rewinding and resumes the same position', () => {
    const tape = createTapeTransport(tracks);
    tape.advance(3);
    expect(tape.position).toBe(0);
    tape.press('play');
    tape.advance(3);
    tape.press('stop');
    tape.advance(50);
    expect(tape.position).toBe(3);
    tape.press('play');
    tape.advance(2);
    expect(tape.position).toBe(5);
  });
  it('fast-forwards at five times normal speed and one-quarter gain', () => {
    const tape = createTapeTransport(tracks);
    tape.press('fast-forward');
    tape.advance(3);
    expect(tape.index).toBe(1);
    expect(tape.position).toBe(5);
    expect(tapeSpeed('fast-forward')).toBe(5);
    expect(tapeVolume('fast-forward')).toBe(tapeVolume('play') / 4);
    tape.press('play');
    tape.advance(1);
    expect(tape.position).toBe(6);
  });
  it('plays the tracks in order and repeats the cassette', () => {
    const tape = createTapeTransport(tracks);
    tape.press('play');
    tape.advance(41);
    expect(tape.index).toBe(0);
    expect(tape.position).toBe(1);
  });
});
