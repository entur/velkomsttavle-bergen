/**
 * Full-bredde bar som fylles fram til neste bytte.
 *
 * Delt av karusellen og bunnstripa. Fargen er `accent` på alle flater — én
 * accent er lettere å lese enn seks, og `surfaces.test.mjs` holder kontrasten
 * mot hver enkelt bakgrunn over 1.5.
 *
 * Rendres ikke når det ikke er noe å veksle mellom; det avgjør kalleren, som
 * er den som vet hvor mange visninger den har.
 */
function ProgressBar({ progress, palette }) {
    return (
        <div style={{ width: '100%', height: '6px', backgroundColor: palette.background, flex: '0 0 auto' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: palette.accent }} />
        </div>
    );
}

export default ProgressBar;
