import { useState, useEffect, useRef } from 'react';
import { UmbrellaIcon, WindIcon } from '@entur/icons';
import { base } from '@entur/tokens';
import { Label } from '@entur/typography';

import ProgressBar from './ProgressBar';
import { advance } from './rotation.mjs';
import { dailyForecast, hourlyForecast, nowSummary } from '../weather/forecastViews.mjs';

const HIGHLIGHT = base.light.baseColors.shape.highlight;

/**
 * 15 sekunder, ikke karusellens 30: hver visning er liten og lest på tre
 * sekunder, og med 30 ville stripa stått stille gjennom nesten en hel
 * karusellslide.
 */
const VIEW_DURATION = 15000;
const TICK = 100;

/**
 * Været i bunnstripa: «nå» fast til venstre, og en høyre side som veksler
 * mellom de neste seks timene og de neste fire dagene.
 *
 * Henter ingenting selv. `weather` kommer fra samme polling i `App` som
 * karusellværet — se kommentaren der om hvorfor den ikke kan ligge her.
 *
 * Ingen egen bakgrunn: den hører til feltet. Maler modulen sin egen, blir været
 * et panel som svever på stripa.
 */
function WeatherStripe({ weather, palette }) {
    const timeseries = weather?.properties?.timeseries;
    const now = nowSummary(timeseries);
    const hourly = hourlyForecast(timeseries, 6);
    // Sent på kvelden finnes det ikke flere hele dager. Da faller
    // dagsvisningen bort og timesvisningen står alene — samme regel som
    // karusellen har for én slide.
    const daily = dailyForecast(timeseries, 4);
    const views = daily.length > 0 ? ['hours', 'days'] : ['hours'];

    const [state, setState] = useState({ elapsed: 0, index: 0 });
    const stateRef = useRef(state);

    useEffect(() => {
        const id = setInterval(() => {
            stateRef.current = advance(stateRef.current, {
                tick: TICK,
                duration: VIEW_DURATION,
                count: views.length,
            });
            setState(stateRef.current);
        }, TICK);
        return () => clearInterval(id);
    }, [views.length]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', boxSizing: 'border-box', color: palette.text }}>
            {views.length > 1 && (
                <ProgressBar progress={state.elapsed / VIEW_DURATION} palette={palette} />
            )}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '1.5rem', padding: '0.75rem 2rem' }}>
                <NowCard now={now} palette={palette} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', backgroundColor: palette.panel, borderRadius: '12px', padding: '0.5rem 1.5rem', overflow: 'hidden' }}>
                    {views[Math.min(state.index, views.length - 1)] === 'hours'
                        ? hourly.map((hour) => <HourCell key={hour.time} hour={hour} />)
                        : daily.map((day) => <DayCell key={day.date.toDateString()} day={day} />)}
                </div>
            </div>
        </div>
    );
}

/**
 * Nå-kortet står fast. Uten data viser det «–» framfor å forsvinne: feltet skal
 * beholde høyden, slik at layouten ikke hopper når varselet kommer.
 */
function NowCard({ now, palette }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '0 0 auto', backgroundColor: palette.panel, borderRadius: '12px', padding: '0.5rem 1.5rem' }}>
            {now?.symbol && (
                <img src={`/yrSymbols/${now.symbol}.svg`} alt={now.symbol} style={{ width: '64px', height: '64px', display: 'block' }} />
            )}
            <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>
                {now ? `${Math.round(now.temperature)}°` : '–'}
            </div>
            {now && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <WindIcon size={20} color={palette.text} />
                        <Label style={{ margin: 0, color: palette.text }}>{now.wind} m/s</Label>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <UmbrellaIcon size={20} color={palette.text} />
                        <Label style={{ margin: 0, color: palette.text }}>{now.precipitation} mm</Label>
                    </span>
                </div>
            )}
        </div>
    );
}

function HourCell({ hour }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{hour.time.substring(11, 16)}</span>
            {hour.symbol && (
                <img src={`/yrSymbols/${hour.symbol}.svg`} alt={hour.symbol} style={{ width: '44px', height: '44px', display: 'block' }} />
            )}
            <span style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{Math.round(hour.temperature)}°</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: HIGHLIGHT, fontSize: '0.95rem' }}>
                <UmbrellaIcon size={14} />
                {hour.precipitation} mm
            </span>
        </div>
    );
}

function DayCell({ day }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'capitalize' }}>{day.weekday}</span>
            {day.symbol && (
                <img src={`/yrSymbols/${day.symbol}.svg`} alt={day.symbol} style={{ width: '44px', height: '44px', display: 'block' }} />
            )}
            <span style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {Math.round(day.max)}° / {Math.round(day.min)}°
            </span>
        </div>
    );
}

export default WeatherStripe;
