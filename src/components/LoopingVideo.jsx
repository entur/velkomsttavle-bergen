import React, { useEffect, useRef, useState } from 'react';
import { createVideoBlobLoader } from './videoBlobLoader.mjs';
import { createPlaybackWatchdog } from './playbackWatchdog.mjs';

/**
 * Plays a video on loop without re-fetching it (issue #105).
 *
 * The video is downloaded once into a blob URL and looped from memory, so a loop
 * restart cannot reach the network.
 *
 * Not every browser can play a blob: URL though — the Samsung display the board
 * runs on cannot, and showed black indefinitely because the download had
 * succeeded and nothing checked whether a picture ever appeared. So the blob is
 * treated as a proposal: if it does not produce a frame, we drop back to the
 * plain src, which every browser handles.
 */
export default function LoopingVideo({ src, style }) {
    const [state, setState] = useState({ status: 'loading' });
    const [blobRejected, setBlobRejected] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        const loader = createVideoBlobLoader({ src });
        loader.start(setState);
        return () => loader.cancel();
    }, [src]);

    const usingBlob = state.status === 'ready' && !blobRejected;

    useEffect(() => {
        if (!usingBlob || !videoRef.current) return;
        const watchdog = createPlaybackWatchdog({
            media: videoRef.current,
            timeoutMs: 6000,
            onStall: () => setBlobRejected(true),
        });
        watchdog.start();
        return () => watchdog.stop();
    }, [usingBlob]);

    if (state.status === 'loading') {
        return <div style={style} aria-hidden="true" />;
    }

    const source = usingBlob ? state.url : src;

    return (
        <video
            // Keyed on the source: swapping the src attribute alone does not
            // reliably make a media element load the new one.
            key={source}
            ref={videoRef}
            src={source}
            autoPlay
            loop
            muted
            playsInline
            style={style}
        />
    );
}
