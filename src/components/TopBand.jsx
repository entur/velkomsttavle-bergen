import LoopingVideo from './LoopingVideo';
import { logoSrcFor } from '../boards/boardTheme';

/** Toppfeltet er 40vh i begge variantene, så resten av layouten ikke flytter seg. */
const SIZE = { width: '100vw', height: '40vh' };

/**
 * Toppen av tavla: enten intro-videoen eller Entur-logoen.
 *
 * Logofila følger flatens modus: den hvite og korale logoen på mørke flater,
 * den fargede på lyse.
 *
 * Videoen dekker hele feltet, så bakgrunnen bak den vises bare når videoen ikke
 * kan spilles av. Den følger likevel flaten, slik at fallbacket ikke blir
 * mørkeblått på en lys tavle.
 */
function TopBand({ kind, palette }) {
    const band = { ...SIZE, backgroundColor: palette.background };

    if (kind === 'logo') {
        return (
            <div style={{ ...band, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoSrcFor(palette.mode)} alt="Entur" style={{ maxHeight: '50%', maxWidth: '60%' }} />
            </div>
        );
    }
    return <LoopingVideo src="/entur.mp4" style={{ ...band, display: 'block', objectFit: 'cover' }} />;
}

export default TopBand;
