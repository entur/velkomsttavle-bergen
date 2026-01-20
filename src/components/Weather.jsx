import { useState, useEffect } from 'react';
import { formatNumber } from '../ts/main';
import {ThermometerIcon, UmbrellaIcon, WindIcon} from "@entur/icons";
import {GridContainer, GridItem} from "@entur/grid";
import {semantic} from "@entur/tokens";
import {Heading3, Label} from "@entur/typography";

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
        }, 60 * 60 * 1000); // 1 hour in milliseconds
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return <div className="w-full">laster inn...</div>;
    }

    if (!weatherData || !weatherData.properties || !weatherData.properties.timeseries) {
        return null;
    }

    // Show next 6 hours (3-8)
    const timeSeries = weatherData.properties.timeseries.slice(3, 9);

    return (
        <div style={{ display: 'flex', justifyContent: 'center',  width: '100%', backgroundColor: semantic.fill.background.subdued.light }}>
            {timeSeries.map((weather) => {
                const temperature = weather.data.instant.details.air_temperature;
                const symbolCode = weather.data.next_1_hours.summary.symbol_code;
                return (
                    <div key={weather.time} style={{ padding: '20px' }}>
                        <GridContainer spacing={"medium"} style={{ display: 'flex', justifyContent: 'center' }}>
                            <GridItem small={6} medium={6} large={6}>
                                <Heading3>{weather.time.substring(11, 16)}</Heading3>
                                <img
                                    src={`/yrSymbols/${symbolCode}.svg`}
                                    alt={symbolCode}
                                    style={{ width: '100%', maxWidth: '120px', height: 'auto', aspectRatio: '1 / 1', display: 'block', margin: '0 auto' }}
                                />
                                <GridContainer spacing={"medium"} style={{ display: 'flex', justifyContent: 'left' }}>
                                    <GridItem small={2} medium={2} large={2}>
                                        <ThermometerIcon size={ 20 }/>
                                    </GridItem>
                                    <GridItem small={2} medium={2} large={2}>
                                        <Label>{formatNumber(temperature, 'celsius')}</Label>
                                    </GridItem>
                                </GridContainer>
                                <GridContainer spacing={"medium"} style={{ display: 'flex', justifyContent: 'left' }}>
                                    <GridItem small={2} medium={2} large={2}>
                                        <UmbrellaIcon size={ 20 } />
                                    </GridItem>
                                    <GridItem small={2} medium={2} large={2}>
                                        <Label>{formatNumber(weather.data.next_1_hours.details.precipitation_amount, 'millimeter')}</Label>
                                    </GridItem>
                                </GridContainer>
                                <GridContainer spacing={"medium"} style={{ display: 'flex', justifyContent: 'left' }}>
                                    <GridItem small={2} medium={2} large={2}>
                                        <WindIcon size={ 20 } />
                                    </GridItem>
                                    <GridItem small={2} medium={2} large={2}>
                                        <Label>{formatNumber(weather.data.instant.details.wind_speed, 'meter-per-second')}</Label>
                                    </GridItem>
                                </GridContainer>

                            </GridItem>
                        </GridContainer>
                    </div>
                );
            })}
        </div>
    );
}
