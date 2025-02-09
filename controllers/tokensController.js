const { oauth2Client } = require('../credentials/googleCredentials');
const fs = require('fs');
const path = require('path');

const tokensDir = path.join(__dirname, '../json');
const tokensPath = path.join(tokensDir, 'tokens.json');

exports.loadTokens = () => {
    if (fs.existsSync(tokensPath)) {
        try {
            const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

            if (!tokens.access_token || !tokens.refresh_token) {
                console.error('⚠️ Los tokens son inválidos. Por favor, autentícate de nuevo.');
                return;
            }

            oauth2Client.setCredentials(tokens);
            console.log('✅ Tokens cargados correctamente.');
        } catch (error) {
            console.error('❌ Error al leer tokens.json:', error);
        }
    } else {
        console.error('No se encontraron tokens. Autentícate primero.');
    }
};

exports.loadSyncToken = () => {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

    if(tokens.syncToken) {
        return JSON.parse(fs.readFileSync(tokensPath, 'utf8')).syncToken;
    } else {
        console.log("NO SE ENCONTRO UN SYNC_TOKEN");
        return null;
    }
}

exports.saveSyncToken = (syncToken) => {
    try {
        if (!fs.existsSync(tokensPath)) {
            console.log('⚠️ No se encontraron tokens! Autenticate primero');
            return;
        }

        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        tokens.syncToken = syncToken;

        fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');
        console.log('✅ syncToken guardado correctamente.');
    } catch (error) {
        console.error('❌ Error al guardar el syncToken:', error);
    }
}

exports.clearSyncData = () => {
    try {
        if (!fs.existsSync(tokensPath)) {
            console.log('⚠️ No se encontraron tokens. No hay nada que limpiar.');
            return;
        }

        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

        if (tokens.syncToken) {
            delete tokens.syncToken;
            fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');
            console.log('✅ syncToken eliminado correctamente.');
        } else {
            console.log('⚠️ No se encontró syncToken en tokens.json.');
        }
    } catch(error) {
        console.error('❌ Error al limpiar el syncToken:', error);
    }
}