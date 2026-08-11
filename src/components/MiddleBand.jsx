import { Contrast } from '@entur/layout';
import { Heading2, LeadParagraph } from '@entur/typography';

import AlertBanner from './AlertBanner';
import ErrorBoundary from './ErrorBoundary';
import OpeningHours from './OpeningHours';
import { bandTheme } from '../boards/boardTheme';

/**
 * Feltet under toppen: varsler øverst i full bredde, og under dem
 * ansatt-illustrasjonen til venstre for overskrift, hilsen og åpningstider.
 *
 * Illustrasjonen er et selvstendig valg på tavla, ikke en del av hilsenen: en
 * tavle med bare åpningstider kan ha den, og en tavle med hilsen kan la være.
 *
 * Det lyse temaet dropper <Contrast>-wrapperen. Den setter både bakgrunn og
 * hvit tekstfarge, og uten den finner typografien Entur-blå selv.
 *
 * justifyContent: 'flex-start' er bevisst, ikke 'center'. Feltet har
 * maxHeight + overflow: hidden, så noe MÅ klippes bort når stacken
 * (varsler + hilsen) er høyere enn 45vh. Med 'center' klippes det
 * symmetrisk fra begge kanter, og siden selectVisibleAlerts sorterer
 * alvorligste varsel øverst, er det nettopp det alvorligste varselet
 * som forsvinner over den øvre kanten først. Med 'flex-start' klippes
 * det i stedet nedenfra: hilsenen og de minst alvorlige varslene
 * lengst ned ryker først, og prioritert rekkefølge bevares. Ikke
 * endre denne tilbake til 'center'.
 *
 * Uten karusell-moduler får feltet plassen karusellen ellers hadde
 * hatt (flex: 1 i stedet for maxHeight), men klippes fortsatt nedenfra.
 */
function MiddleBand({ theme, boardId, heading, greetingText, openingHoursDays, staffImageSrc, hasCarousel, hasBottom }) {
    const { background, color, contrast } = bandTheme(theme);
    const style = {
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: background,
        color,
        flexDirection: 'column',
        padding: '1.5rem 0',
        overflow: 'hidden',
        ...middleHeight(hasCarousel, hasBottom),
    };

    const content = (
        <>
            <ErrorBoundary>
                <AlertBanner boardId={boardId} />
            </ErrorBoundary>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {staffImageSrc && (
                    // Dekorativ illustrasjon: tom alt, ikke «Staff». Ingen skjermleser
                    // står foran denne skjermen, og et meningsløst alt er verre enn ingen.
                    <img
                        src={staffImageSrc}
                        alt=""
                        style={{ maxHeight: '18vh', maxWidth: '40%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                )}
                {/* Overskriften står der uansett hvilke moduler tavla har. */}
                <ErrorBoundary>
                    <div style={{ marginLeft: staffImageSrc ? '2rem' : 0 }}>
                        <Heading2>{heading}</Heading2>
                        {greetingText && <LeadParagraph>{greetingText}</LeadParagraph>}
                        {openingHoursDays?.length > 0 && <OpeningHours days={openingHoursDays} />}
                    </div>
                </ErrorBoundary>
            </div>
        </>
    );

    return contrast ? <Contrast style={style}>{content}</Contrast> : <div style={style}>{content}</div>;
}

/**
 * Hvor mye plass midtfeltet får.
 *
 * Toppen er faste 40vh og stripa faste 16vh, så taket må ned når begge feltene
 * under er der — ellers har karusellen ingenting igjen. Uten karusell tar
 * midtfeltet resten, med eller uten stripe.
 *
 * Tallene er målt på 1920×1080, ikke utledet. 28vh er ikke pent valgt: med varsel,
 * hilsen og åpningstider oppe vil midtfeltet ha 42vh, og 40 + 42 + 16 lar det stå
 * 2vh igjen til karusellen. Noe MÅ klippes på en tavle med alle fire feltene, og
 * taket avgjør hva. 28vh gir karusellen 16vh — nok til at en plantegning er til å
 * kjenne igjen — og klipper åpningstidene nederst i midtfeltet, som er den minst
 * kritiske raden. Et tak på 35vh ga karusellen 5vh og en plantegning på 22 piksler.
 *
 * Endrer du tallet, se på en tavle med varsel, hilsen og åpningstider samtidig.
 */
function middleHeight(hasCarousel, hasBottom) {
    if (!hasCarousel) {
        return { flex: 1, minHeight: 0 };
    }
    return { maxHeight: hasBottom ? '28vh' : '45vh' };
}

export default MiddleBand;
