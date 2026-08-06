import LoopingVideo from './LoopingVideo';
import { base } from '@entur/tokens';

const CONTRAST = base.light.baseColors.frame.contrast;

/** Toppfeltet er 40vh i begge variantene, så resten av layouten ikke flytter seg. */
const BAND = { width: '100vw', height: '40vh', backgroundColor: CONTRAST };

/**
 * Toppen av tavla: enten intro-videoen eller Entur-logoen.
 *
 * Logoen i public/logo.svg er hvit og koral, altså tegnet for mørk bakgrunn —
 * derfor står den på det samme mørkeblå feltet som videoen faller tilbake på.
 */
function TopBand({ kind }) {
    if (kind === 'logo') {
        return (
            <div style={{ ...BAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logo.svg" alt="Entur" style={{ maxHeight: '50%', maxWidth: '60%' }} />
            </div>
        );
    }
    return <LoopingVideo src="/entur.mp4" style={{ ...BAND, display: 'block', objectFit: 'cover' }} />;
}

export default TopBand;
