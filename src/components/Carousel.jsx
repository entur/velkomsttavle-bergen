import { useState, useEffect, useRef } from 'react';
import { base, semantic } from '@entur/tokens';

const CORAL = base.light.baseColors.shape.highlight; // #ff5959
const LAVENDER = semantic.fill.background.subdued.light; // #d9dae8
const SLIDE_DURATION = 30000; // 30 sek per slide
const TICK = 100; // ms mellom hver progress-oppdatering

/**
 * Karusell som bytter mellom flere slides på et fast intervall.
 * Øverst i lavendel-feltet, i skillet mot den mørkeblå seksjonen, ligger en
 * full-bredde progress-bar som fylles fram til neste bytte. Under den en
 * ikon-rad der aktivt ikon er koral og inaktive er hvite.
 *
 * slides: Array<{ key: string, Icon: React.ComponentType, node: React.ReactNode }>
 */
function Carousel({ slides }) {
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

    const progress = elapsed / SLIDE_DURATION;

    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: LAVENDER, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: '6px', backgroundColor: LAVENDER, flex: '0 0 auto' }}>
                <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: CORAL }} />
            </div>
            <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', padding: '0.75rem 0', flex: '0 0 auto' }}>
                {slides.map((slide, i) => {
                    const Icon = slide.Icon;
                    return (
                        <Icon
                            key={slide.key}
                            size={48}
                            color={i === index ? CORAL : '#ffffff'}
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
