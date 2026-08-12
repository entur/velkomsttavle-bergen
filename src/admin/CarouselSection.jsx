import { SmallAlertBox } from '@entur/alert';
import { SecondaryButton } from '@entur/button';
import { Paragraph } from '@entur/typography';

import FormSection from './FormSection';
import ModuleCard from './ModuleCard';
import StopPlaceField from './StopPlaceField';
import SurfacePicker from './SurfacePicker';
import WeatherFields from './WeatherFields';
import { MODULE_LABELS } from '../boards/boardConfig';
import { availableCarouselTypes, carouselCards } from '../boards/boardDraft';

/**
 * Karusellen: ett kort per modul, og en rad med det som kan legges til.
 *
 * «Legg til» er én knapp per modul som ikke er lagt til, ikke en nedtrekksmeny
 * med en knapp ved siden av — det er ett klikk i stedet for tre, og raden
 * tømmer seg selv etter hvert.
 *
 * Været mangler i raden når det står i bunnstripa. Det er ikke en sperre, det
 * er `availableCarouselTypes` som ikke tilbyr det: været bor ett sted.
 */
function CarouselSection({ draft, errors, update, onAdd, onRemove, onStopPlaceChange }) {
    const cards = carouselCards(draft);
    const available = availableCarouselTypes(draft);

    return (
        <FormSection
            title="Karusellen"
            help="Feltet i midten som bytter mellom modulene. Kortene står i samme faste rekkefølge som skjermen viser dem i."
        >
            {cards.length === 0 && (
                <Paragraph>
                    Ingen moduler. Karusellen vises ikke på skjermen, og
                    velkomstmeldingen får plassen.
                </Paragraph>
            )}

            {cards.includes('weather') && (
                <ModuleCard title={MODULE_LABELS.weather} onRemove={() => onRemove('weather')}>
                    <WeatherFields draft={draft} errors={errors} update={update} />
                </ModuleCard>
            )}

            {cards.includes('floorplan') && (
                <ModuleCard title={MODULE_LABELS.floorplan} onRemove={() => onRemove('floorplan')}>
                    {/* Ingen velger: repoet har nøyaktig én plantegning, og
                        synken i scripts/sync-floorplan.mjs er hardkodet mot
                        den. En velger med ett valg er bare støy. */}
                    <Paragraph>Bergen, 3. etasje — den eneste plantegningen som finnes.</Paragraph>
                    {errors.floorplan && (
                        <SmallAlertBox variant="negative">{errors.floorplan}</SmallAlertBox>
                    )}
                </ModuleCard>
            )}

            {cards.includes('departures') && (
                <ModuleCard title={MODULE_LABELS.departures} onRemove={() => onRemove('departures')}>
                    <div style={{ maxWidth: '28rem' }}>
                        <StopPlaceField
                            value={{ id: draft.stopPlaceId, name: draft.stopPlaceName }}
                            onChange={onStopPlaceChange}
                            error={errors.stopPlace}
                        />
                    </div>
                </ModuleCard>
            )}

            {available.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>Legg til:</span>
                    {available.map((type) => (
                        <SecondaryButton key={type} type="button" onClick={() => onAdd(type)}>
                            {MODULE_LABELS[type]}
                        </SecondaryButton>
                    ))}
                </div>
            )}

            <SurfacePicker
                name="carouselSurface"
                label="Farge"
                value={draft.carouselSurface}
                onChange={(surface) => update('carouselSurface', surface)}
                error={errors.carouselSurface}
            />
        </FormSection>
    );
}

export default CarouselSection;
