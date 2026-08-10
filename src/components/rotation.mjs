/**
 * Vekslingen mellom flere visninger, som ren regning.
 *
 * Ligger utenfor komponentene, uten React-import, slik at den kan testes med
 * `node --test` — samme grep som `playbackWatchdog.mjs`. Både karusellen og
 * bunnstripa er en `useEffect` med et intervall rundt denne funksjonen.
 *
 * @param {{ elapsed: number, index: number }} state Tilstanden nå
 * @param {{ tick: number, duration: number, count: number }} options
 *        `tick` er ms siden forrige kall, `duration` ms per visning,
 *        `count` antall visninger.
 * @returns {{ elapsed: number, index: number }} Neste tilstand
 */
export function advance({ elapsed, index }, { tick, duration, count }) {
    // Ingenting å veksle mellom. Tilstanden fryses, slik at komponentene trygt
    // kan skjule progress-baren på det samme vilkåret.
    if (count <= 1) {
        return { elapsed: 0, index: 0 };
    }
    // Lista kan ha krympet siden forrige tick — tavla kan lagres i admin mens
    // karusellen kjører. Uten dette peker index utenfor lista.
    if (index >= count) {
        return { elapsed: 0, index: 0 };
    }
    const next = elapsed + tick;
    if (next >= duration) {
        return { elapsed: 0, index: (index + 1) % count };
    }
    return { elapsed: next, index };
}
