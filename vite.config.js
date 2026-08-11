import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    // Serveres fra rot på Firebase Hosting
    base: '/',
    build: {
        // Tavla kjører på en Samsung-skjerm med Tizen, ikke i Chrome, og motoren
        // der er låst til modellåret. Uten dette bygger Vite for en langt nyere
        // baseline enn skjermen har, og syntaks den ikke kjenner gir en hvit
        // skjerm i resepsjonen uten noe varsel underveis.
        //
        // Merk hva dette IKKE dekker: esbuild oversetter syntaks, men polyfyller
        // ikke innebygde metoder. `Object.hasOwn` blir sendt ut som den er
        // uansett target. Den siden er det `src/browserBaseline.test.mjs` som
        // vokter.
        target: 'chrome85',
    },
    server: {
        port: 3000
    }
})

