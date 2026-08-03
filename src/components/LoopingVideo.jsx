import React, { useEffect, useState } from 'react';
import { createVideoBlobLoader } from './videoBlobLoader.mjs';

/**
 * Plays a video on loop without re-fetching it (issue #105).
 *
 * The video is downloaded once into a blob URL and looped from memory. Until it
 * is ready we render a placeholder with the same style, so the layout does not
 * shift and no <video> element streams in the meantime. If the download fails
 * repeatedly we fall back to the plain src rather than showing nothing.
 */
export default function LoopingVideo({ src, style }) {
    const [state, setState] = useState({ status: 'loading' });

    useEffect(() => {
        const loader = createVideoBlobLoader({ src });
        loader.start(setState);
        return () => loader.cancel();
    }, [src]);

    if (state.status === 'loading') {
        return <div style={style} aria-hidden="true" />;
    }

    return (
        <video
            src={state.status === 'ready' ? state.url : src}
            autoPlay
            loop
            muted
            playsInline
            style={style}
        />
    );
}
