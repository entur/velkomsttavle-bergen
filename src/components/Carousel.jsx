import { useState, useEffect, useRef } from 'react';
import { base } from '@entur/tokens';

import { carouselPalette } from '../boards/carouselTheme';

const CORAL = base.light.baseColors.shape.highlight; // #ff5959
const SLIDE_DURATION = 30000; // 30 sek per slide
const TICK = 100; // ms mellom hver progress-oppdatering

/**
 * Karusell som bytter mellom flere slides på et fast intervall.
 * Øverst i lavendel-feltet, i skillet mot den mørkeblå seksjonen, ligger en
 * full-bredde progress-bar som fylles fram til neste bytte. Under den en
 * ikon-rad der aktivt ikon er koral og inaktive tar farge fra temaet.
 *
 * Bakgrunn og ikonfarger kommer fra `carouselPalette`. Inaktive ikoner var
 * tidligere `#ffffff` uansett tema, altså hvitt på lavendel med kontrast 1.39 —
 * praktisk talt usynlig. Paletten har en test som holder den feilen borte.
 *
 * slides: Array<{ key: string, Icon: React.ComponentType, node: React.ReactNode }>
 */
function Carousel({ slides, theme }) {
    const [index, setIndex] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef(0);

    useEffect(() => {
        const id = setInterval(() => {
            elapsedRef.current += TICK;
            if (elapsedRef.current >= SLIDE_DURATION) {
                elapsedRef.current = 0;
                setIndex((i) => (i + 1) % slides.length);
            }
            setElapsed(elapsedRef.current);
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

    const palette = carouselPalette(theme);
    const progress = elapsed / SLIDE_DURATION;

    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: palette.background, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: '6px', backgroundColor: palette.background, flex: '0 0 auto' }}>
                <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: CORAL }} />
            </div>
            <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', padding: '0.75rem 0', flex: '0 0 auto' }}>
                {slides.map((slide, i) => {
                    const Icon = slide.Icon;
                    return (
                        <Icon
                            key={slide.key}
                            size={48}
                            color={i === index ? palette.iconActive : palette.iconInactive}
                        />
                    );
                })}
            </div>
            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {slides[index].node}
            </div>
        </div>
    );
}

export default Carousel;
