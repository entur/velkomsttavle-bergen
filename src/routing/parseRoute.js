/**
 * Hvilken rute en pathname peker på.
 *
 * Ligger utenfor `main.jsx`, uten React- og Firebase-importer, slik at den kan
 * testes med `node --test`. Ingen router-avhengighet: kiosken skal ikke laste
 * kode den aldri bruker, og fire statiske former er tre regexer.
 */

/** Tavla som `/` skal vise. Skal kunne fjernes når skjermen peker på /t/<id>. */
export const DEFAULT_BOARD_ID = 'bergen-3';

// Samme tegnsett som id-forslaget i admin lager. Snevert med vilje: id-en er en
// URL, og en id med mellomrom eller store bokstaver er en felle.
const BOARD = /^\/t\/([a-z0-9-]+)\/?$/;
const ADMIN_BOARD = /^\/admin\/t\/([a-z0-9-]+)\/?$/;
const ADMIN = /^\/admin\/?$/;

export function parseRoute(pathname) {
    if (pathname === '/' || pathname === '') {
        return {
            kind: 'board',
            boardId: DEFAULT_BOARD_ID,
            canonical: `/t/${DEFAULT_BOARD_ID}`,
        };
    }

    // Admin-rutene først: /admin/t/<id> begynner ikke på /t/, men rekkefølgen
    // gjør det umulig å innføre en tavle-rute som spiser dem senere.
    const adminBoard = ADMIN_BOARD.exec(pathname);
    if (adminBoard) {
        return { kind: 'adminBoard', boardId: adminBoard[1] };
    }
    if (ADMIN.test(pathname)) {
        return { kind: 'admin' };
    }

    const board = BOARD.exec(pathname);
    if (board) {
        return { kind: 'board', boardId: board[1] };
    }

    return { kind: 'notFound', pathname };
}
