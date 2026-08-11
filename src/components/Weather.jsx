import { formatNumber } from '../ts/main';
import { UmbrellaIcon, WindIcon } from "@entur/icons";
import { base } from "@entur/tokens";
import { Heading3, Label } from "@entur/typography";

import { dailyForecast, hourlyForecast, nowSummary } from '../weather/forecastViews.mjs';

const HIGHLIGHT = base.light.baseColors.shape.highlight;

// En rad «ikon + verdi» brukt i nå-kortet (hvit tekst på mørkeblått kort)
function DetailRow({ icon, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff' }}>
            {icon}
            <Label style={{ margin: 0, color: '#ffffff' }}>{children}</Label>
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
    const dark = palette.mode === 'dark';

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
            color: palette.text,
        }}>
            {/* Nå-kort til venstre, timesstripe + dagsrad stablet til høyre */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '2rem', alignItems: 'stretch' }}>
                {/* Nå-kort */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem 3rem',
                    borderRadius: '16px',
                    background: `linear-gradient(160deg, ${base.light.baseColors.frame.contrastalt} 0%, ${base.light.baseColors.frame.contrast} 100%)`,
                    boxShadow: '0 8px 24px rgba(24,28,86,0.25)',
                    // Kortet er mørkeblått og forsvinner mot en mørk karusell.
                    // Kanten er det eneste som skiller dem i mørkt tema.
                    border: dark ? `2px solid ${palette.panel}` : 'none',
                    flex: '0 0 auto',
                    minHeight: 0,
                    overflow: 'hidden'
                }}>
                    <Heading3 style={{ margin: 0, color: HIGHLIGHT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Nå</Heading3>
                    {now.symbol && (
                        <img
                            src={`/yrSymbols/${now.symbol}.svg`}
                            alt={now.symbol}
                            style={{ width: '120px', height: '120px', display: 'block' }}
                        />
                    )}
                    <div style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1, color: '#ffffff', margin: '0.25rem 0 1rem' }}>
                        {formatNumber(now.temperature, 'celsius')}
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <DetailRow icon={<WindIcon size={24} color="#ffffff" />}>
                            {formatNumber(now.wind, 'meter-per-second')}
                        </DetailRow>
                        <DetailRow icon={<UmbrellaIcon size={24} color="#ffffff" />}>
                            {formatNumber(now.precipitation, 'millimeter')}
                        </DetailRow>
                    </div>
                </div>

                {/* Høyre kolonne: timesstripe over, dagsrad under – hver i sitt panelkort */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '1.5rem' }}>
                    {/* Timesstripe */}
                    <div style={{
                        display: 'flex', flex: 1, minHeight: 0, justifyContent: 'space-around', alignItems: 'center', minWidth: 0,
                        // palette.panel, ikke en fast fersken: «fersken» er selv en mulig
                        // bakgrunn, og et ferskent kort på ferskent felt er usynlig.
                        // surfaces.test.mjs holder panelet synlig mot hver bakgrunn.
                        backgroundColor: palette.panel,
                        color: palette.text,
                        borderRadius: '16px', padding: '1rem 1.5rem', overflow: 'hidden'
                    }}>
                        {hourly.map(({ time, symbol, temperature, precipitation }) => (
                            <div key={time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <Heading3 style={{ margin: 0 }}>{time.substring(11, 16)}</Heading3>
                                {symbol && (
                                    <img
                                        src={`/yrSymbols/${symbol}.svg`}
                                        alt={symbol}
                                        style={{ width: '70px', height: '70px', display: 'block' }}
                                    />
                                )}
                                <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>{formatNumber(temperature, 'celsius')}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: HIGHLIGHT }}>
                                    <UmbrellaIcon size={16} />
                                    <Label style={{ margin: 0 }}>{formatNumber(precipitation, 'millimeter')}</Label>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Dagsrad */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: '0 0 auto',
                        // palette.panel, ikke en fast fersken: «fersken» er selv en mulig
                        // bakgrunn, og et ferskent kort på ferskent felt er usynlig.
                        // surfaces.test.mjs holder panelet synlig mot hver bakgrunn.
                        backgroundColor: palette.panel,
                        color: palette.text,
                        borderRadius: '16px', padding: '1rem 1.5rem'
                    }}>
                        {daily.map((day) => (
                            <div key={day.date.toDateString()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                <Heading3 style={{ margin: 0, textTransform: 'capitalize' }}>{day.weekday}</Heading3>
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
