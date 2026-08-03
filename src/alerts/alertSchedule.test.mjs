import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    alertStatus,
    groupAlertsByStatus,
    selectVisibleAlerts,
} from './alertSchedule.js';

const NOW = new Date('2026-08-03T10:00:00Z');

function alert(overrides = {}) {
    return {
        id: 'a1',
        title: 'Tittel',
        body: 'Tekst',
        level: 'information',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: null,
        enabled: true,
        ...overrides,
    };
}

describe('alertStatus', () => {
    it('er visible innenfor tidsrommet', () => {
        assert.equal(alertStatus(alert(), NOW), 'visible');
    });

    it('er planned før startsAt', () => {
        const future = alert({ startsAt: new Date('2026-08-03T12:00:00Z') });
        assert.equal(alertStatus(future, NOW), 'planned');
    });

    it('er expired når endsAt har passert', () => {
        const past = alert({ endsAt: new Date('2026-08-03T09:00:00Z') });
        assert.equal(alertStatus(past, NOW), 'expired');
    });

    it('er disabled når bryteren er av, selv innenfor tidsrommet', () => {
        assert.equal(alertStatus(alert({ enabled: false }), NOW), 'disabled');
    });

    it('er expired framfor disabled når begge gjelder', () => {
        const both = alert({
            enabled: false,
            endsAt: new Date('2026-08-03T09:00:00Z'),
        });
        assert.equal(alertStatus(both, NOW), 'expired');
    });

    it('regner startsAt lik now som visible', () => {
        assert.equal(alertStatus(alert({ startsAt: NOW }), NOW), 'visible');
    });

    it('regner endsAt lik now som expired', () => {
        assert.equal(alertStatus(alert({ endsAt: NOW }), NOW), 'expired');
    });

    it('behandler manglende startsAt som expired framfor å krasje', () => {
        assert.equal(alertStatus(alert({ startsAt: null }), NOW), 'expired');
    });
});

describe('selectVisibleAlerts', () => {
    it('slipper gjennom varsel med åpen slutt', () => {
        const result = selectVisibleAlerts([alert({ endsAt: null })], NOW);
        assert.equal(result.length, 1);
    });

    it('filtrerer bort avslåtte varsler', () => {
        const result = selectVisibleAlerts([alert({ enabled: false })], NOW);
        assert.deepEqual(result, []);
    });

    it('filtrerer bort varsler som ikke har startet', () => {
        const future = alert({ startsAt: new Date('2026-08-03T12:00:00Z') });
        assert.deepEqual(selectVisibleAlerts([future], NOW), []);
    });

    it('filtrerer bort utløpte varsler', () => {
        const past = alert({ endsAt: new Date('2026-08-03T09:00:00Z') });
        assert.deepEqual(selectVisibleAlerts([past], NOW), []);
    });

    it('sorterer alvorligste nivå først', () => {
        const alerts = [
            alert({ id: 'info', level: 'information' }),
            alert({ id: 'ok', level: 'success' }),
            alert({ id: 'krit', level: 'negative' }),
            alert({ id: 'adv', level: 'warning' }),
        ];
        const order = selectVisibleAlerts(alerts, NOW).map((a) => a.id);
        assert.deepEqual(order, ['krit', 'adv', 'info', 'ok']);
    });

    it('sorterer nyeste først innenfor samme nivå', () => {
        const alerts = [
            alert({ id: 'gammel', startsAt: new Date('2026-08-01T08:00:00Z') }),
            alert({ id: 'ny', startsAt: new Date('2026-08-03T09:00:00Z') }),
        ];
        const order = selectVisibleAlerts(alerts, NOW).map((a) => a.id);
        assert.deepEqual(order, ['ny', 'gammel']);
    });

    it('sorterer et ukjent nivå sist framfor å krasje', () => {
        const alerts = [
            alert({ id: 'rart', level: 'ukjent-fra-framtida' }),
            alert({ id: 'info', level: 'information' }),
        ];
        const order = selectVisibleAlerts(alerts, NOW).map((a) => a.id);
        assert.deepEqual(order, ['info', 'rart']);
    });

    it('endrer ikke lista den får inn', () => {
        const alerts = [
            alert({ id: 'ok', level: 'success' }),
            alert({ id: 'krit', level: 'negative' }),
        ];
        selectVisibleAlerts(alerts, NOW);
        assert.deepEqual(alerts.map((a) => a.id), ['ok', 'krit']);
    });

    it('tåler tom liste', () => {
        assert.deepEqual(selectVisibleAlerts([], NOW), []);
    });
});

describe('groupAlertsByStatus', () => {
    it('fordeler varsler på de fire gruppene', () => {
        const alerts = [
            alert({ id: 'naa' }),
            alert({ id: 'senere', startsAt: new Date('2026-08-04T08:00:00Z') }),
            alert({ id: 'av', enabled: false }),
            alert({ id: 'ferdig', endsAt: new Date('2026-08-02T08:00:00Z') }),
        ];
        const groups = groupAlertsByStatus(alerts, NOW);
        assert.deepEqual(groups.visible.map((a) => a.id), ['naa']);
        assert.deepEqual(groups.planned.map((a) => a.id), ['senere']);
        assert.deepEqual(groups.disabled.map((a) => a.id), ['av']);
        assert.deepEqual(groups.expired.map((a) => a.id), ['ferdig']);
    });

    it('gir tomme grupper for tom liste', () => {
        const groups = groupAlertsByStatus([], NOW);
        assert.deepEqual(groups, {
            visible: [],
            planned: [],
            disabled: [],
            expired: [],
        });
    });

    it('sorterer innenfor hver gruppe', () => {
        const alerts = [
            alert({ id: 'ok', level: 'success' }),
            alert({ id: 'krit', level: 'negative' }),
        ];
        const groups = groupAlertsByStatus(alerts, NOW);
        assert.deepEqual(groups.visible.map((a) => a.id), ['krit', 'ok']);
    });
});
