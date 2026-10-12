import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { URL } from 'node:url';

const pages = JSON.parse(
  readFileSync(new URL('../src/game/bbc-pages.json', import.meta.url), 'utf8'),
);
const directory = new URL('../public/screens/bbc/', import.meta.url);
mkdirSync(directory, { recursive: true });
const escape = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
for (const [id, lines] of Object.entries(pages)) {
  const text = lines
    .flatMap(([line, ink], index) =>
      line
        ? [
            `  <text x="18" y="${12 + index * 12}" dominant-baseline="hanging" fill="${ink}">${escape(line)}</text>`,
          ]
        : [],
    )
    .join('\n');
  writeFileSync(
    new URL(`${id}.svg`, directory),
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">\n<rect width="320" height="240" rx="14" fill="#060807"/>\n<g font-family="monospace" font-weight="bold" font-size="11">\n${text}\n</g>\n</svg>\n`,
  );
}
