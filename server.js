const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path'); // Nécessaire pour les chemins de fichiers

const app = express();
app.use(cors());

// --- CONFIGURATION DU SERVEUR WEB (POUR RENDER) ---
// Dit à Render de servir tes fichiers (index.html, images, etc.)
app.use(express.static(path.join(__dirname, './')));

// Route principale pour afficher ton site
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- BASE DE DONNÉES ---
// Note: Sur Render Free, db.json sera réinitialisé au redémarrage
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ pepites: [] }).write();

// --- CONFIGURATION DES CLÉS ---
const API_KEY_1 = 'ada81820a2a49262e8a10dbd5e3a38da'; 
const API_KEY_2 = '7999234d3c7b31ea2ce94469a0079357'; 
const API_HOST = 'v3.football.api-sports.io';
const PORT = process.env.PORT || 3000; // Utilise le port de Render ou 3000

// --- TA LOGIQUE MATHÉMATIQUE (GARDÉE INTACTE) ---
function detecterCycleAlternance(h2hData) {
    if (!h2hData || h2hData.length < 3) return null;
    const resultats = h2hData.slice(0, 6).map(match => {
        if (match.goals.home === match.goals.away) return 'N';
        return (match.goals.home > match.goals.away) ? 'H' : 'A';
    });
    if (resultats.includes('N')) return null;
    let estAlternance = true;
    for (let i = 0; i < resultats.length - 1; i++) {
        if (resultats[i] === resultats[i+1]) { estAlternance = false; break; }
    }
    if (estAlternance) {
        if (resultats.length >= 5) return `💎 CYCLE HISTORIQUE (${resultats.length})`;
        if (resultats.length === 4) return `🔥 CYCLE DE 4 (5ème imminent)`;
        return `✅ ALTERNANCE (Cycle de 3)`;
    }
    return null;
}

// --- SCANNER AMÉLIORÉ ---
async function executerScan(cleAUtiliser, numeroCle) {
    console.log(`🔎 Scan avec la Clé ${numeroCle} en cours...`);
    try {
        const dateToday = new Date().toISOString().split('T')[0];
        const resp = await axios.get(`https://${API_HOST}/fixtures?date=${dateToday}`, {
            headers: { 'x-apisports-key': cleAUtiliser }
        });

        const fixtures = resp.data.response;
        if (!fixtures) return;

        let debut = (numeroCle === 1) ? 0 : 96;
        let fin = (numeroCle === 1) ? 95 : 190;

        for (let i = debut; i < Math.min(fixtures.length, fin); i++) {
            const f = fixtures[i];
            if (f.fixture.status.short !== 'NS') continue;

            try {
                const h2hResp = await axios.get(`https://${API_HOST}/fixtures/headtohead?h2h=${f.teams.home.id}-${f.teams.away.id}&last=6`, {
                    headers: { 'x-apisports-key': cleAUtiliser }
                });

                const status = detecterCycleAlternance(h2hResp.data.response);
                if (status) {
                    const existe = db.get('pepites').find({ idFixture: f.fixture.id }).value();
                    if (!existe) {
                        db.get('pepites').push({
                            idFixture: f.fixture.id,
                            ligue: f.league.name,
                            equipes: `${f.teams.home.name} vs ${f.teams.away.name}`,
                            status: status,
                            date: f.fixture.date 
                        }).write();
                        console.log(`✨ Nouvelle pépite sauvegardée !`);
                    }
                }
            } catch (e) { continue; }
        }
        console.log(`🏁 Fin du scan avec la Clé ${numeroCle}.`);
    } catch (error) { console.error(`❌ Erreur API Clé ${numeroCle}:`, error.message); }
}

// --- ROUTES API ---
// IMPORTANT: Ton index.html doit appeler ce lien pour remplir le tableau
app.get('/api/cycles', (req, res) => {
    res.json(db.get('pepites').value());
});

// --- PLANNING (ABIDJAN) ---
cron.schedule('5 0 * * *', () => executerScan(API_KEY_1, 1));
cron.schedule('0 12 * * *', () => executerScan(API_KEY_2, 2));

app.listen(PORT, async () => {
    console.log(`🚀 L'ARSENAL DU DIGITAL : MODE 200 QUOTAS ACTIF`);
    // On lance un scan au démarrage pour remplir le tableau immédiatement
    await executerScan(API_KEY_1, 1);
});