import { useState, useEffect, useRef } from 'react';

import ProgressBar from './ProgressBar';
import { advance } from './rotation.mjs';

const SLIDE_DURATION = 30000; // 30 sek per slide
const TICK = 100; // ms mellom hver progress-oppdatering

/**
 * Karusell som bytter mellom flere slides på et fast intervall, med en
 * full-bredde progress-bar øverst som fylles fram til neste bytte.
 *
 * Bakgrunn og tekstfarge kommer inn som `palette` fra `App`. Komponenten slår
 * den ikke opp selv: `Weather` rendres nå i to felt med hver sin flate, og da
 * må flaten følge med ovenfra.
 *
 * slides: Array<{ node: React.ReactNode }>
 */
function Carousel({ slides, palette }) {
    const [state, setState] = useState({ elapsed: 0, index: 0 });
    const stateRef = useRef(state);

    useEffect(() => {
        const id = setInterval(() => {
            const next = advance(stateRef.current, {
                tick: TICK,
                duration: SLIDE_DURATION,
                count: slides.length,
            });
            // `advance` fryser tilstanden (count <= 1) ved å gi en FERSK
            // { elapsed: 0, index: 0 } hvert kall — aldri det samme objektet
            // tilbake. Uten denne sjekken ville setState kjørt 10 ganger i
            // sekundet i evigheten på en tavle med bare én slide.
            if (next.elapsed === stateRef.current.elapsed && next.index === stateRef.current.index) {
                return;
            }
            stateRef.current = next;
            setState(next);
        }, TICK);
        return () => clearInterval(id);
    }, [slides.length]);

    // En tavle uten karusell-moduler er lovlig: velger man bare video og
    // hilsen, skal feltet falle bort framfor at slides[index] krasjer. Vakten
    // må stå etter hooks-kallene — de må kjøre ubetinget, ellers bryter React
    // sine regler når lista går fra tom til ikke-tom.
    if (slides.length === 0) {
        return null;
    }

    // `advance` fryser indeksen på 0 når lista krymper, men tilstanden kan være
    // ett tick gammel her. Klemmen gjør at renderingen aldri ser utenfor lista.
    const index = Math.min(state.index, slides.length - 1);

    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: palette.background, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {slides.length > 1 && (
                <ProgressBar progress={state.elapsed / SLIDE_DURATION} palette={palette} />
            )}
            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {slides[index].node}
            </div>
        </div>
    );
}

export default Carousel;
