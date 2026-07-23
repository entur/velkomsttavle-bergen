import { useState, useEffect } from 'react';
import { base, semantic } from '@entur/tokens';

const CORAL = base.light.baseColors.shape.highlight; // #ff5959
const LAVENDER = semantic.fill.background.subdued.light; // #d9dae8
const SLIDE_DURATION = 30000; // 30 sek per slide
const TICK = 100; // ms mellom hver progress-oppdatering

/**
 * Karusell som bytter mellom flere slides på et fast intervall.
 * Viser en ikon-rad øverst (aktivt ikon i koral, inaktive i hvitt) med en
 * lineær progress-bar under som fylles fram til neste bytte.
 *
 * slides: Array<{ key: string, Icon: React.ComponentType, node: React.ReactNode }>
 */
function Carousel({ slides }) {
    const [index, setIndex] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            setElapsed((prev) => {
                const next = prev + TICK;
                if (next >= SLIDE_DURATION) {
                    setIndex((i) => (i + 1) % slides.length);
                    return 0;
                }
                return next;
            });
        }, TICK);
        return () => clearInterval(id);
    }, [slides.length]);

    const progress = elapsed / SLIDE_DURATION;

    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: LAVENDER, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 0' }}>
                <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                    {slides.map((slide, i) => {
                        const Icon = slide.Icon;
                        return (
                            <Icon
                                key={slide.key}
                                size={32}
                                color={i === index ? CORAL : '#ffffff'}
                            />
                        );
                    })}
                </div>
                <div style={{ width: '160px', height: '4px', backgroundColor: '#ffffff', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: CORAL }} />
                </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {slides[index].node}
            </div>
        </div>
    );
}

export default Carousel;
