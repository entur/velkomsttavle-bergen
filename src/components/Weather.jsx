import { formatNumber } from '../ts/main';
import { UmbrellaIcon, WindIcon } from "@entur/icons";
import { Heading3, Label } from "@entur/typography";

import { dailyForecast, hourlyForecast, nowSummary } from '../weather/forecastViews.mjs';

// En rad «ikon + verdi» i nå-blokka. Fargen kommer utenfra: blokka har ingen
// egen flate lenger, så teksten står på flaten feltet har valgt.
function DetailRow({ icon, color, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color }}>
            {icon}
            <Label style={{ margin: 0, color }}>{children}</Label>
        </div>
    );
}

/**
 * Rendrer værvarselet. Henter ingenting selv: karusellen avmonterer og
 * remonterer denne komponenten omtrent hvert 60. sekund, så hentingen bor i
 * `App` (se `src/weather/metForecast.js`) og kommer inn som prop.
 *
 * @param {{ weather: unknown|null }} props Rått svar fra locationforecast
 */
export default function Weather({ weather, palette }) {
    if (!weather || !weather.properties || !weather.properties.timeseries) {
        return <div className="w-full">laster inn...</div>;
    }

    const timeSeries = weather.properties.timeseries;
    const now = nowSummary(timeSeries);
    // `nowSummary` gir null når timeseries er tom (dokumentert i
    // forecastViews.mjs). `WeatherStripe` vokter for det samme; uten vakten
    // her ville de to forbrukerne av samme hjelpefunksjon ikke lenger vært
    // like trygge mot det den selv sier den kan returnere.
    if (!now) {
        return <div className="w-full">laster inn...</div>;
    }
    const hourly = hourlyForecast(timeSeries, 6);
    const daily = dailyForecast(timeSeries, 4);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: '1.5rem 2rem',
            gap: '1.5rem',
            // Ingen egen bakgrunn: den hører til karusellen. Maler modulen sin
            // egen, blir været et lavendelpanel som svever på mørk bunn.
            //
            // Arv rekker ikke for Entur-typografien: `.eds-h3` og `.eds-label`
            // setter `color: #181c56` i sin egen regel, og en arvet farge taper
            // mot den. Hver Heading3 og Label under må få `palette.text`
            // eksplisitt — ellers står klokkeslettene mørkeblå på mørkeblå.
            color: palette.text,
        }}>
            {/* Nå til venstre, timesstripe + dagsrad stablet til høyre */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '2rem', alignItems: 'stretch' }}>
                {/* Nå */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Paddingen er luft mellom blokkene, ikke kortkant: ingen av
                    // de tre blokkene har egen flate.
                    padding: '1.5rem 3rem',
                    flex: '0 0 auto',
                    minHeight: 0,
                    overflow: 'hidden'
                }}>
                    <Heading3 style={{ margin: 0, color: palette.text, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Nå</Heading3>
                    {now.symbol && (
                        <img
                            src={`/yrSymbols/${now.symbol}.svg`}
                            alt={now.symbol}
                            style={{ width: '120px', height: '120px', display: 'block' }}
                        />
                    )}
                    <div style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1, margin: '0.25rem 0 1rem' }}>
                        {formatNumber(now.temperature, 'celsius')}
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <DetailRow color={palette.text} icon={<WindIcon size={24} color={palette.text} />}>
                            {formatNumber(now.wind, 'meter-per-second')}
                        </DetailRow>
                        <DetailRow color={palette.text} icon={<UmbrellaIcon size={24} color={palette.text} />}>
                            {formatNumber(now.precipitation, 'millimeter')}
                        </DetailRow>
                    </div>
                </div>

                {/* Høyre kolonne: timesstripe over, dagsrad under */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '1.5rem' }}>
                    {/* Timesstripe */}
                    <div style={{
                        display: 'flex', flex: 1, minHeight: 0, justifyContent: 'space-around', alignItems: 'center', minWidth: 0,
                        padding: '1rem 1.5rem', overflow: 'hidden'
                    }}>
                        {hourly.map(({ time, symbol, temperature, precipitation }) => (
                            <div key={time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <Heading3 style={{ margin: 0, color: palette.text }}>{time.substring(11, 16)}</Heading3>
                                {symbol && (
                                    <img
                                        src={`/yrSymbols/${symbol}.svg`}
                                        alt={symbol}
                                        style={{ width: '70px', height: '70px', display: 'block' }}
                                    />
                                )}
                                <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>{formatNumber(temperature, 'celsius')}</div>
                                {/* Nedbøren var korall mot det hvite panelet. Uten panelet
                                    står den på flaten selv, og korall mot lavendel er
                                    kontrast 1.56 — paraplyen får skille den ut i stedet. */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <UmbrellaIcon size={16} color={palette.text} />
                                    <Label style={{ margin: 0, color: palette.text }}>{formatNumber(precipitation, 'millimeter')}</Label>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Dagsrad */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: '0 0 auto',
                        padding: '1rem 1.5rem'
                    }}>
                        {daily.map((day) => (
                            <div key={day.date.toDateString()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                <Heading3 style={{ margin: 0, color: palette.text, textTransform: 'capitalize' }}>{day.weekday}</Heading3>
                                {day.symbol && (
                                    <img
                                        src={`/yrSymbols/${day.symbol}.svg`}
                                        alt={day.symbol}
                                        style={{ width: '52px', height: '52px', display: 'block' }}
                                    />
                                )}
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
                                    {formatNumber(day.max, 'celsius')} / {formatNumber(day.min, 'celsius')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
