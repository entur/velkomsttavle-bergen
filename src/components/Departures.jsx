import { Fragment, useEffect, useState } from 'react';
import { Heading3, Paragraph } from '@entur/typography';
import { colors } from '@entur/tokens';
import { ContrastContext } from '@entur/layout';
import { TravelTag } from '@entur/travel';
import { ValidationExclamationCircleFilledIcon } from '@entur/icons';

import { badgeText, categoryFill } from '../departures/categoryFill';
import { travelTagTransport } from '../departures/travelTagTransport';
import { countdownLabel } from '../departures/departureCountdown';
import { isDelayed } from '../departures/departureMapper';
import { warningStyle } from '../departures/warningStyle';

/**
 * Hvor ofte nedtellingen regnes om. Ingen nettverkskall — det er ren regning
 * på data vi allerede har. Å binde den til hentingen ville enten gitt et tall
 * som står stille i et minutt, eller seksti ganger så mange kall som nødvendig.
 */
const TICK_MS = 15 * 1000;

const klokke = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

function tid(date) {
    return date instanceof Date ? klokke.format(date) : '';
}

/**
 * Linjemerket. Ikonet forteller transportmiddelet, fargen linjekategorien.
 *
 * Bane NOR-fargen settes som CSS-variabler og ikke som `backgroundColor`, fordi
 * det er dem `TravelTag` selv leser. Komponenten bygger sin egen stil som
 * `{ ...dynamicCssVars, ...style }` — vår `style` spres sist og vinner. Verifisert
 * i kilden til @entur/travel@8.
 *
 * Uten kategorikode sender vi ingen fyll, og `TravelTag` fargelegger etter
 * transportmiddel. Den logikken eier Entur; vi kopierer den ikke.
 *
 * `ContrastContext.Provider` er nødvendig nettopp for det tilfellet: TravelTag
 * velger mellom standard- og contrast-paletten med `useContrast()`, og
 * `Departures` ligger utenfor `<Contrast>`-wrapperen i `MiddleBand`. Uten
 * provideren får bussmerket standardfyllet `#c5044e`, som er kontrast 2.61 mot
 * mørkeblå flate og 1.65 mot den lysere — altså borte. Vi setter bare
 * konteksten, ikke `<Contrast>` selv, som også ville satt bakgrunn og
 * tekstfarge på griden rundt.
 *
 * `--text-color` settes i ALLE tilfeller, også uten kategorifyll. Overlater vi
 * den til stilarket, kommer den fra `:where(.eds-contrast) .eds-travel-tag` —
 * en av reglene Tizen forkaster — og merket ville sett ulikt ut på skjermen og
 * i Chrome.
 */
function LineBadge({ lineCode, transportMode, theme }) {
    const dark = theme === 'dark';
    const fill = categoryFill(lineCode, theme);
    return (
        <ContrastContext.Provider value={dark}>
            <TravelTag
                className="avgangstavle-traveltag"
                transport={travelTagTransport(transportMode)}
                style={{
                    '--text-color': badgeText(theme),
                    ...(fill && {
                        '--background-color': fill.background,
                        border: fill.border,
                    }),
                }}
            >
                {lineCode || '–'}
            </TravelTag>
        </ContrastContext.Provider>
    );
}

/**
 * Gul brikke ved forsinkelse, rød ved innstilling.
 *
 * Aldri farget tekst: gul mot lavendel er kontrast 1.10, altså usynlig. Som
 * fylt brikke med mørkeblå tekst er den 10.25.
 */
function Chip({ label, tone, theme }) {
    const dark = theme === 'dark';
    const fill = tone === 'cancelled'
        ? (dark ? colors.validation.lavaContrast : colors.validation.lava)
        : colors.validation.canary;
    // Gul har mørk tekst i begge temaer. Rød har hvit tekst i lyst tema, der
    // fyllet er mettet, og mørk i mørkt, der fyllet er lyst.
    const text = tone === 'cancelled' && !dark ? '#ffffff' : colors.brand.blue;
    return (
        <span style={{
            backgroundColor: fill, color: text,
            border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
            borderRadius: '999px', padding: '0.15rem 0.75rem',
            fontSize: '1.375rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

/**
 * Avvikstekst fra Journey Planner, med varselikon.
 *
 * Formen følger `warningStyle`: gul tekst uten fyll på mørke flater, gul boks
 * med mørkeblå tekst på lyse. Ikonet arver `color`, så det bytter med teksten.
 *
 * Ingen `opacity` her, i motsetning til den gamle `↳`-linja: kontrasten er målt
 * til 10.25, og en gjennomsiktighet på 0.85 ville spist av den uten å gi noe.
 */
function Avviksmelding({ text, theme }) {
    return (
        <span style={{ display: 'block', marginTop: '0.35rem' }}>
            <span style={{
                ...warningStyle(theme),
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                borderRadius: '8px', padding: '0.1rem 0.6rem',
                fontSize: '1.25rem', lineHeight: 1.4,
            }}>
                {/* I en flex-container blir 1em tolket som flex-basis, ikke en låst
                    størrelse — uten flexShrink: 0 klemmer teksten sirkelen til en oval. */}
                <ValidationExclamationCircleFilledIcon aria-hidden="true" style={{ flexShrink: 0 }} />
                {text}
            </span>
        </span>
    );
}

/**
 * Spornummeret. Uthevet når toget er flyttet fra planlagt spor.
 *
 * Pilleformen er den samme `Chip` bruker, slik at et endret spor leses som en
 * markering og ikke som en annen skrifttype.
 */
function Spor({ platform, changed, theme }) {
    if (!platform) {
        return <span />;
    }
    if (!changed) {
        return <span style={{ whiteSpace: 'nowrap' }}>Spor {platform}</span>;
    }
    return (
        <span style={{
            ...warningStyle(theme),
            whiteSpace: 'nowrap', borderRadius: '999px',
            padding: '0.15rem 0.75rem', fontWeight: 700,
        }}>
            Spor {platform}
        </span>
    );
}

function Melding({ palette, children }) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paragraph style={{ color: palette.text }}>{children}</Paragraph>
        </div>
    );
}

function Departures({ departures, stopPlaceName, palette }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), TICK_MS);
        return () => clearInterval(id);
    }, []);

    if (departures === null) {
        return <Melding palette={palette}>Henter avganger …</Melding>;
    }
    if (departures.length === 0) {
        return <Melding palette={palette}>Ingen avganger de neste 3 timene</Melding>;
    }

    return (
        <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '1.5rem 2.5rem', color: palette.text, overflow: 'hidden' }}>
            <Heading3 style={{ color: palette.text, margin: '0 0 1rem' }}>
                Avganger fra {stopPlaceName}
            </Heading3>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                columnGap: '1.5rem', rowGap: '0.75rem',
                alignItems: 'center', fontSize: '1.75rem',
            }}>
                {departures.map((departure, index) => {
                    const nedtelling = countdownLabel(departure.expectedAt, now);
                    const forsinket = isDelayed(departure);
                    return (
                        <Fragment key={`${departure.lineCode}-${departure.aimedAt?.toISOString() ?? index}`}>
                            <LineBadge lineCode={departure.lineCode} transportMode={departure.transportMode} theme={palette.mode} />
                            <span>
                                {departure.destination}
                                {departure.situation && (
                                    <Avviksmelding text={departure.situation} theme={palette.mode} />
                                )}
                            </span>
                            <Spor
                                platform={departure.platform}
                                changed={departure.platformChanged}
                                theme={palette.mode}
                            />
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                                {departure.cancelled && <Chip label="Innstilt" tone="cancelled" theme={palette.mode} />}
                                {!departure.cancelled && nedtelling && <Chip label={nedtelling} tone="delayed" theme={palette.mode} />}
                                {(departure.cancelled || forsinket) && (
                                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{tid(departure.aimedAt)}</span>
                                )}
                                {!departure.cancelled && (
                                    <span style={{ fontWeight: 700 }}>{tid(departure.expectedAt)}</span>
                                )}
                                {!departure.realtime && !departure.cancelled && (
                                    <span style={{ fontSize: '1rem', opacity: 0.7 }}>rutetid</span>
                                )}
                            </span>
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default Departures;
