// Firebase-web-konfigen er offentlig informasjon by design: den havner i
// klient-bundelen uansett, og apiKey er en prosjekt-identifikator, ikke en
// hemmelighet. Sikkerheten ligger i firestore.rules.
export const firebaseConfig = {
    apiKey: 'AIzaSyC1LfyEG-0OdpSQylKPbwz3AC2UM4_wL9s',
    // Må være firebaseapp.com-domenet: det er den eneste redirect-URI-en som er
    // registrert på OAuth-klienten. Å bytte til `ent-tavleber-prd.web.app` gir
    // `redirect_uri_mismatch` fra Google (verifisert), og krever at URI-en først
    // registreres i Google Cloud Console. Se issue om same-origin auth.
    authDomain: 'ent-tavleber-prd.firebaseapp.com',
    projectId: 'ent-tavleber-prd',
    storageBucket: 'ent-tavleber-prd.appspot.com',
    messagingSenderId: '475486887854',
    appId: '1:475486887854:web:eb13c21d24e1fe9df7323f',
};
