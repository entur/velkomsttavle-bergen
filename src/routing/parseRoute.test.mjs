import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_BOARD_ID, parseRoute } from './parseRoute.js';

describe('parseRoute', () => {
    it('gir default-tavla på rot, med kanonisk sti', () => {
        assert.deepEqual(parseRoute('/'), {
            kind: 'board',
            boardId: DEFAULT_BOARD_ID,
            canonical: `/t/${DEFAULT_BOARD_ID}`,
        });
    });

    it('leser tavle-id fra /t/<id>', () => {
        assert.deepEqual(parseRoute('/t/billettkontor-bergen'), {
            kind: 'board',
            boardId: 'billettkontor-bergen',
        });
    });

    it('tåler etterfølgende skråstrek', () => {
        assert.equal(parseRoute('/t/bergen-3/').boardId, 'bergen-3');
        assert.equal(parseRoute('/admin/').kind, 'admin');
    });

    it('kjenner igjen admin-rutene', () => {
        assert.deepEqual(parseRoute('/admin'), { kind: 'admin' });
        assert.deepEqual(parseRoute('/admin/t/bergen-3'), {
            kind: 'adminBoard',
            boardId: 'bergen-3',
        });
    });

    it('lar ikke /admin/t/<id> bli tolket som en tavle', () => {
        assert.equal(parseRoute('/admin/t/bergen-3').kind, 'adminBoard');
    });

    it('avviser id-er med tegn som ikke er lovlige i en slug', () => {
        assert.equal(parseRoute('/t/Bergen 3').kind, 'notFound');
        assert.equal(parseRoute('/t/bergen_3').kind, 'notFound');
    });

    it('gir notFound for alt annet', () => {
        assert.deepEqual(parseRoute('/t/'), { kind: 'notFound', pathname: '/t/' });
        assert.deepEqual(parseRoute('/noe'), { kind: 'notFound', pathname: '/noe' });
    });
});
