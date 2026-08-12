/**
 * Logofila et felt skal bruke, gitt modusen flaten har.
 *
 * public/logo.svg er hvit og koral og hører til mørke flater;
 * public/logo-on-light.svg har mørkeblått ordmerke og hører til lyse. Den siste
 * lå der fra før, for admin-sidene.
 *
 * Bakgrunn, tekstfarge og Contrast-valget kom tidligere herfra også. De kommer
 * nå fra `surfacePalette()`, som bærer `mode` for hver av de seks flatene.
 * Logoen er det eneste et felt trenger som ikke kan leses ut av paletten.
 */
export function logoSrcFor(mode) {
    return mode === 'light' ? '/logo-on-light.svg' : '/logo.svg';
}
