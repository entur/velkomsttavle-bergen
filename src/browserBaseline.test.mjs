/**
 * Holder kildekoden innenfor motoren tavla faktisk kjører på.
 *
 * Tavla står ikke i Chrome. Den står på en Samsung-skjerm med Tizen, og
 * nettlesermotoren der er låst til modellåret. En API som Chrome har hatt i
 * årevis kan mangle fullstendig, og da kaster den — den degraderer ikke.
 *
 * Hvorfor dette er en test og ikke en byggeinnstilling: esbuild oversetter
 * *syntaks* når `build.target` er satt, men den polyfyller ikke *innebygde
 * metoder*. `Object.hasOwn` blir sendt ut som `Object.hasOwn` uansett target.
 * Bygget kan altså ikke fange dette; det må fanges i kilden.
 *
 * Bakgrunnen: `surfacePalette` brukte `Object.hasOwn` (Chromium 93). Den kalles
 * fra `App` sin komponentkropp, utenfor enhver ErrorBoundary, så kastet tok ned
 * hele React-treet og ga en helt hvit skjerm i resepsjonen — mens alt så riktig
 * ut i Chrome på utviklermaskinen.
 *
 * Grensa er utledet, ikke oppgitt: koden som virket på skjermen brukte `?.` og
 * `??`, som kom i Chromium 80, og den som feilet brukte `Object.hasOwn`, som kom
 * i 93. Motoren ligger altså mellom, og Tizen 6.5 med Chromium 85 passer. Får du
 * bekreftet en annen Tizen-versjon, juster lista under og skriv hvorfor.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));

/**
 * API-er som kom etter Chromium 85, med versjonen de kom i.
 *
 * Bare det som faktisk kaster på en gammel motor hører hjemme her. Syntaks —
 * `??=`, klassefelt, top-level await — dekkes av `build.target` i
 * vite.config.js, og står derfor ikke i denne lista.
 */
const FOR_NYE = [
    ['Object.hasOwn', 93],
    ['Object.groupBy', 117],
    ['Map.groupBy', 117],
    ['structuredClone', 98],
    ['.findLast(', 97],
    ['.findLastIndex(', 97],
    ['.toSorted(', 110],
    ['.toReversed(', 110],
    ['.toSpliced(', 110],
    ['.at(', 92],
    ['Array.fromAsync', 121],
    ['.withResolvers(', 119],
];

/** Kildefiler tavla sender til nettleseren. Tester kjører i Node og teller ikke. */
async function browserSources(dir = SRC) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await browserSources(full));
            continue;
        }
        if (!/\.(js|jsx|mjs)$/.test(entry.name)) {
            continue;
        }
        // Testfilene kjører i Node, ikke på skjermen, og står fritt til å bruke
        // hva som helst — denne fila bruker selv flere av navnene i lista.
        if (/\.(test|spec)\./.test(entry.name)) {
            continue;
        }
        files.push(full);
    }
    return files;
}

/**
 * Fjerner kommentarer før vi leter.
 *
 * Uten dette treffer vakta sin egen forklaring: kommentaren i `surfaces.js` som
 * forteller hvorfor `Object.hasOwn` ikke skal brukes, inneholder nødvendigvis
 * navnet. En vakt som roper på prosa blir svekket av den første som møter en
 * falsk positiv, og da vokter den ingenting.
 *
 * Grov med vilje. Den kan kappe en linje ved `//` inne i en streng — en URL —
 * og dermed overse et kall lenger ute på samme linje. Det er en teoretisk
 * blindsone vi tar: alternativet er en parser, og en API-sjekk er ikke verdt
 * det. Sjekken er uansett det andre laget; `vite.config.js` sitt target er det
 * første.
 */
function utenKommentarer(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
}

describe('nettlesergrense', () => {
    it('bruker ingen API-er som er nyere enn motoren på skjermen', async () => {
        const files = await browserSources();
        assert.ok(files.length > 20, `fant bare ${files.length} kildefiler — leter feil sted?`);

        const funn = [];
        for (const file of files) {
            const source = utenKommentarer(await readFile(file, 'utf8'));
            for (const [api, chromium] of FOR_NYE) {
                if (source.includes(api)) {
                    const relativ = file.slice(SRC.length + 1);
                    funn.push(`${relativ}: ${api} kom i Chromium ${chromium}`);
                }
            }
        }

        assert.deepEqual(funn, [], `\n${funn.join('\n')}\n`);
    });
});
