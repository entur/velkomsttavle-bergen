/**
 * Oversettelsen mellom tavlas config og den flate formen skjemafeltene jobber
 * med, og operasjonene skjemaet gjør på draften.
 *
 * Uten JSX og uten Firebase-import, slik at den kan testes med `node --test`.
 * Logikken lå tidligere i BoardConfigForm.jsx og var derfor utestet — `node
 * --test` globber ikke `.jsx`.
 */
import {
    FLOORPLAN_PLANS,
    GREETING_AUTO,
    findModule,
} from './boardConfig.js';
import { normalizeDays } from './openingHours.js';

/** Config → den flate formen skjemafeltene jobber med. */
export function draftFrom(board) {
    const greeting = findModule(board.middle, 'greeting');
    const openingHours = findModule(board.middle, 'openingHours');
    const weather = findModule(board.carousel, 'weather');
    const bottomWeather = findModule(board.bottom, 'weather');
    const weatherModule = bottomWeather ?? weather;
    const floorplan = findModule(board.carousel, 'floorplan');
    const departures = findModule(board.carousel, 'departures');
    return {
        id: board.id,
        name: board.name,
        placeName: board.placeName,
        topKind: board.top.kind,
        topSurface: board.topSurface,
        middleSurface: board.middleSurface,
        staffImage: board.staffImage,
        greetingEnabled: Boolean(greeting),
        greetingAuto: !greeting || greeting.text === GREETING_AUTO,
        greetingText: greeting && greeting.text !== GREETING_AUTO ? greeting.text : '',
        openingHoursEnabled: Boolean(openingHours),
        days: normalizeDays(openingHours ? openingHours.days : []),
        // Været bor ett sted. Ett felt med tre verdier gjør regelen strukturell:
        // kortene i karusellen og valget i bunnstripa utledes begge av den, så
        // været kan ikke stå to steder samtidig.
        weatherPlacement: bottomWeather ? 'stripe' : (weather ? 'karusell' : 'av'),
        weatherName: weatherModule ? weatherModule.name : '',
        // Koordinatene er strenger i skjemaet: et halvskrevet «60.» er ikke et
        // tall, og feltet skal ikke hoppe mens man skriver.
        weatherLat: weatherModule ? String(weatherModule.lat) : '',
        weatherLng: weatherModule ? String(weatherModule.lng) : '',
        floorplanEnabled: Boolean(floorplan),
        floorplanPlan: floorplan ? floorplan.plan : FLOORPLAN_PLANS[0],
        departuresEnabled: Boolean(departures),
        stopPlaceId: departures ? departures.stopPlaceId : '',
        stopPlaceName: departures ? departures.stopPlaceName : '',
        carouselSurface: board.carouselSurface,
        bottomSurface: board.bottomSurface,
    };
}

/** Den flate formen → config, slik repositoryet vil ha den. */
export function configFrom(draft) {
    const middle = [];
    if (draft.greetingEnabled) {
        middle.push({
            type: 'greeting',
            text: draft.greetingAuto ? GREETING_AUTO : draft.greetingText.trim(),
        });
    }
    if (draft.openingHoursEnabled) {
        middle.push({ type: 'openingHours', days: draft.days });
    }

    // Bygges uansett plassering, også når `weatherPlacement` er 'av' — den
    // brukes bare bak de to plasseringssjekkene under, og forkastes stille
    // (Number('') === 0 slipper aldri ut, den skrives aldri til noen liste).
    const weatherModule = {
        type: 'weather',
        name: draft.weatherName.trim(),
        lat: Number(draft.weatherLat),
        lng: Number(draft.weatherLng),
    };

    const carousel = [];
    if (draft.weatherPlacement === 'karusell') {
        carousel.push(weatherModule);
    }
    if (draft.floorplanEnabled) {
        carousel.push({ type: 'floorplan', plan: draft.floorplanPlan });
    }
    if (draft.departuresEnabled) {
        carousel.push({
            type: 'departures',
            stopPlaceId: draft.stopPlaceId,
            stopPlaceName: draft.stopPlaceName.trim(),
        });
    }

    const bottom = draft.weatherPlacement === 'stripe' ? [weatherModule] : [];

    return {
        id: draft.id,
        name: draft.name.trim(),
        placeName: draft.placeName.trim(),
        topSurface: draft.topSurface,
        middleSurface: draft.middleSurface,
        staffImage: draft.staffImage,
        top: { kind: draft.topKind },
        carouselSurface: draft.carouselSurface,
        bottomSurface: draft.bottomSurface,
        middle,
        carousel,
        bottom,
    };
}
