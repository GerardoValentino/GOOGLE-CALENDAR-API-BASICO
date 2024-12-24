require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const schedule = require('node-schedule');
const fs = require('fs');
const app = express();

const publicURL = "https://a2b6-2806-264-3400-ece-cd57-44b3-f889-15c6.ngrok-free.app";

app.use(bodyParser.json());
const credentials = require('./credentials.json');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID, 
    process.env.SECRET_ID, 
    process.env.REDIRECT
);

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Configuración de webhook
app.post('/notifications', (req, res) => {
    try {
        const headers = req.headers;

        console.log('Estos son los headers @@=> ', headers);
        /*
        console.log('Notificación recibida');
        console.log('X-Goog-Channel-ID:', headers['x-goog-channel-id']);
        console.log('X-Goog-Resource-ID:', headers['x-goog-resource-id']);
        console.log('X-Goog-Resource-State:', headers['x-goog-resource-state']);
        */

        // Si es una sincronización inicial
        if (headers['x-goog-resource-state'] === 'sync') {
            console.log('Sincronización inicial recibida.');
        } else if (headers['x-goog-resource-state'] === 'exists') {
            console.log('Se creó o actualizó un recurso.');
        } 
        
        /*
        else if (headers['x-goog-resource-state'] === 'not_exists') {
            console.log('Un recurso fue eliminado.');
        } */

        res.sendStatus(200); // Responde con éxito
    } catch(error) {
        console.log("Ocurrio un problema en el endpoint de /notifications ==> ", error);
        res.sendStatus(500);
    }
});

function loadTokens() {
    if (fs.existsSync('tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf-8'));
        oauth2Client.setCredentials(tokens);
        console.log('Tokens cargados:', tokens);
    } else {
        console.error('No se encontraron tokens. Autentícate primero.');
    }
}

// Función para configurar el canal de notificaciones
async function watchCalendar() {
    try {
        if (!oauth2Client.credentials.access_token) {
            console.error('No se ha configurado un access_token. Autentícate primero.');
            throw new Error('No se ha configurado un access_token. Autentícate primero.');
        }

        const response = await calendar.events.watch({
            calendarId: "primary",
            requestBody: {
                id: 'unique-channel-id-' + Date.now(),
                type: 'web_hook',
                address: `${publicURL}/notifications`, // URL de tu webhook (asegúrate de usar HTTPS)
                //token: 'optional-verification-token', // Token opcional para verificar la fuente
                expiration: Date.now() + (86400000 * 32), // Expira en 32 dias
            },
        });
        console.log('Canal de notificaciones configurado:', response.data);
    } catch (error) {
        console.error('Error al configurar el canal de notificaciones:', error);
    }
}

// Programa la renovación para cada 31 días
schedule.scheduleJob('0 0 */31 * *', () => {
    console.log('Renovando el canal de notificaciones...');
    watchCalendar();
});

app.get('/', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type:'offline',
        scope: 'https://www.googleapis.com/auth/calendar'
    });

    res.redirect(url);
});

app.get('/redirect', (req, res) => {
    const code = req.query.code;
    oauth2Client.getToken(code, (err, tokens) => {
        if(err) {
            console.log('No se pudo obtener el token', err);
            res.send('Error');
            return;
        }

        oauth2Client.setCredentials(tokens);

        fs.writeFileSync('tokens.json', JSON.stringify(tokens));
        console.log('Tokens guardados:', tokens);

        res.send('Successfully logged in');
    })
})

app.get('/calendars', (req, res) => {
    const calendar = google.calendar({ 
        version: 'v3',
        auth: oauth2Client
    });

    calendar.calendarList.list({}, (err, response) => {
        if(err) {
            console.log('error fetching calendars', err);
            res.send('Error!');
            return;
        }

        const calendars = response.data.items;
        //res.json(calendars);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(calendars, null, 2));
    });
});

app.get('/events', (req, res) => {
    const calendarId = req.query.calendar ?? 'primary';
    const calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client,
    });

    calendar.events.list({
        calendarId,
        timeMin: (new Date()).toISOString(),
        maxResults: 15,
        singleEvents: true,
        orderBy: 'startTime'
    }, (err, response) => {
        if(err) {
            console.log('Cannot fetch events');
            res.send('Error');
            return;
        }

        const events = response.data.items;
        //res.json(events);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(events, null, 2));
    });
})

app.listen(3001, () => {
    console.log('Servidor escuchando en http://localhost:3001');
    console.log(`Expuesto a través de Ngrok en: ${publicURL}`);
    loadTokens();
    watchCalendar(); 
});