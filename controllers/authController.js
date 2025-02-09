const { oauth2Client } = require('../credentials/googleCredentials');
const fs = require('fs');
const path = require('path');

exports.login = (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type:'offline',
        prompt: 'consent',
        scope: 'https://www.googleapis.com/auth/calendar'
    });

    res.redirect(url);
}

exports.redirect = (req, res) => {
    const code = req.query.code;
    oauth2Client.getToken(code, (err, tokens) => {
        if(err) {
            console.log('No se pudo obtener el token', err);
            res.send('Error');
            return;
        }

        if (!tokens.refresh_token) {
            console.error('No se recibió un refresh_token. Revisa la configuración de acceso.');
        } else {
            console.log('Refresh token recibido:', tokens.refresh_token);
        }

        oauth2Client.setCredentials(tokens);

        const tokensDir = path.join(__dirname, '../json');
        const tokensPath = path.join(tokensDir, 'tokens.json');
 
        if (!fs.existsSync(tokensDir)) {
            fs.mkdirSync(tokensDir, { recursive: true });
        }

        try {
            fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');
            console.log('✅ Tokens guardados en:', tokensPath);
        } catch (writeErr) {
            console.error('❌ Error al guardar tokens:', writeErr);
            res.status(500).send('Error al guardar los tokens');
            return;
        }

        res.send('Successfully logged in');
    })
}