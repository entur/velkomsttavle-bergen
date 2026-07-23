import { useState, useEffect } from 'react';
import { formatNumber } from '../ts/main';
import { UmbrellaIcon, WindIcon } from "@entur/icons";
import { base, semantic } from "@entur/tokens";
import { Heading3, Label } from "@entur/typography";

const HIGHLIGHT = base.light.baseColors.shape.highlight;
const PEACH = base.light.baseColors.frame.highlightalt;

async function _fetch(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    return await response.json();
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function getYr(lat, lng) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`;
  return await _fetch(url);
}

// En rad «ikon + verdi» brukt i nå-kortet (hvit tekst på mørkeblått kort)
function DetailRow({ icon, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ffffff' }}>
            {icon}
            <Label style={{ margin: 0, color: '#ffffff' }}>{children}</Label>
        </div>
    );
}

const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

// Grupperer timeseriene per lokale dato og bygger et sammendrag per dag
function buildDailyForecast(timeseries, days = 4) {
    const byDate = new Map();
    for (const entry of timeseries) {
        const d = new Date(entry.time);
        const key = d.toDateString();
        if (!byDate.has(key)) byDate.set(key, { date: d, entries: [] });
        byDate.get(key).entries.push(entry);
    }

    const todayKey = new Date().toDateString();
    const result = [];
    for (const { date, entries } of byDate.values()) {
        if (date.toDateString() === todayKey) continue; // hopp over resten av i dag – dekkes av nå-kortet
        const temps = entries.map((e) => e.data.instant.details.air_temperature);
        const max = Math.max(...temps);
        const min = Math.min(...temps);

        // Velg symbol fra oppføringen nærmest kl. 12
        const midday = entries.reduce((best, e) =>
            Math.abs(new Date(e.time).getHours() - 12) < Math.abs(new Date(best.time).getHours() - 12) ? e : best
        );
        const symbol =
            midday.data.next_6_hours?.summary?.symbol_code ||
            midday.data.next_12_hours?.summary?.symbol_code ||
            midday.data.next_1_hours?.summary?.symbol_code;

        result.push({ date, weekday: WEEKDAYS[date.getDay()], max, min, symbol });
        if (result.length >= days) break;
    }
    return result;
}

export default function Weather({ location }) {
    const [weatherData, setWeatherData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function fetchWeather() {
            if (!location) return;
            setIsLoading(true);
            const data = await getYr(location.lat, location.lng);
            setWeatherData(data);
            setIsLoading(false);
        }

        fetchWeather();
    }, [location]);

    useEffect(() => {
        const interval = setInterval(() => {
            window.location.reload();
        }, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return <div className="w-full">laster inn...</div>;
    }

    if (!weatherData || !weatherData.properties || !weatherData.properties.timeseries) {
        return null;
    }

    const timeSeries = weatherData.properties.timeseries;
    const now = timeSeries[0];
    const nowDetails = now.data.instant.details;
    const nowSymbol = now.data.next_1_hours?.summary?.symbol_code || now.data.next_6_hours?.summary?.symbol_code;
    const nowPrecip = now.data.next_1_hours?.details?.precipitation_amount ?? 0;

    // De neste 6 timene (hopp over inneværende time som vises i nå-kortet)
    const hourly = timeSeries.slice(1, 7);
    const daily = buildDailyForecast(timeSeries, 4);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: '1.5rem 2rem',
            gap: '1.5rem',
            backgroundColor: semantic.fill.background.subdued.light
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
                    flex: '0 0 auto',
                    minHeight: 0,
                    overflow: 'hidden'
                }}>
                    <Heading3 style={{ margin: 0, color: HIGHLIGHT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Nå</Heading3>
                    {nowSymbol && (
                        <img
                            src={`/yrSymbols/${nowSymbol}.svg`}
                            alt={nowSymbol}
                            style={{ width: '120px', height: '120px', display: 'block' }}
                        />
                    )}
                    <div style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1, color: '#ffffff', margin: '0.25rem 0 1rem' }}>
                        {formatNumber(nowDetails.air_temperature, 'celsius')}
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <DetailRow icon={<WindIcon size={24} color="#ffffff" />}>
                            {formatNumber(nowDetails.wind_speed, 'meter-per-second')}
                        </DetailRow>
                        <DetailRow icon={<UmbrellaIcon size={24} color="#ffffff" />}>
                            {formatNumber(nowPrecip, 'millimeter')}
                        </DetailRow>
                    </div>
                </div>

                {/* Høyre kolonne: timesstripe over, dagsrad under – hver i sitt peach-kort */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '1.5rem' }}>
                    {/* Timesstripe */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, justifyContent: 'space-around', alignItems: 'center', minWidth: 0, backgroundColor: PEACH, borderRadius: '16px', padding: '1rem 1.5rem', overflow: 'hidden' }}>
                        {hourly.map((weather) => {
                            const symbolCode = weather.data.next_1_hours?.summary?.symbol_code || weather.data.next_6_hours?.summary?.symbol_code;
                            const precip = weather.data.next_1_hours?.details?.precipitation_amount ?? 0;
                            return (
                                <div key={weather.time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <Heading3 style={{ margin: 0 }}>{weather.time.substring(11, 16)}</Heading3>
                                    {symbolCode && (
                                        <img
                                            src={`/yrSymbols/${symbolCode}.svg`}
                                            alt={symbolCode}
                                            style={{ width: '70px', height: '70px', display: 'block' }}
                                        />
                                    )}
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>{formatNumber(weather.data.instant.details.air_temperature, 'celsius')}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: HIGHLIGHT }}>
                                        <UmbrellaIcon size={16} />
                                        <Label style={{ margin: 0 }}>{formatNumber(precip, 'millimeter')}</Label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Dagsrad */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: '0 0 auto', backgroundColor: PEACH, borderRadius: '16px', padding: '1rem 1.5rem' }}>
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
