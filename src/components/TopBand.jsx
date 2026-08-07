import LoopingVideo from './LoopingVideo';
import { bandTheme } from '../boards/boardTheme';

/** Toppfeltet er 40vh i begge variantene, så resten av layouten ikke flytter seg. */
const SIZE = { width: '100vw', height: '40vh' };

/**
 * Toppen av tavla: enten intro-videoen eller Entur-logoen.
 *
 * Logofila følger temaet: public/logo.svg er hvit og koral og hører til det
 * mørkeblå feltet, public/logo-on-light.svg har mørkeblått ordmerke og hører til
 * lavendel.
 *
 * Videoen dekker hele feltet, så bakgrunnen bak den vises bare når videoen ikke
 * kan spilles av. Den følger likevel temaet, slik at fallbacket ikke blir
 * mørkeblått på en lys tavle.
 */
function TopBand({ kind, theme }) {
    const { background, logoSrc } = bandTheme(theme);
    const band = { ...SIZE, backgroundColor: background };

    if (kind === 'logo') {
        return (
            <div style={{ ...band, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoSrc} alt="Entur" style={{ maxHeight: '50%', maxWidth: '60%' }} />
            </div>
        );
    }
    return <LoopingVideo src="/entur.mp4" style={{ ...band, display: 'block', objectFit: 'cover' }} />;
}

export default TopBand;
