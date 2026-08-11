/**
 * WCAG-kontrast mellom to hex-farger.
 *
 * Bor utenfor testfilene fordi to av dem trenger den: `surfaces.test.mjs`
 * måler de seks flatene, `warningStyle.test.mjs` måler den gule uthevinga mot
 * de samme flatene. Én formel, ett sted.
 *
 * Fila blir lest av `browserBaseline.test.mjs` som en hvilken som helst
 * kildefil, siden navnet ikke inneholder `.test.`. Det er greit — den holder
 * seg til `parseInt`, `Math` og `String.replace`, som alle er eldre enn
 * grensa. Vite bunter den ikke, for ingenting i appen importerer den.
 */
export function contrast(a, b) {
    const lum = (hex) => {
        const c = hex.replace('#', '').match(/../g)
            .map((x) => parseInt(x, 16) / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
