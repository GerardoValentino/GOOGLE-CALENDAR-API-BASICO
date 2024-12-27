require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const schedule = require('node-schedule');
const fs = require('fs');
const app = express();

const publicURL = "https://4fe7-2806-264-3400-ece-495-715d-b56e-3520.ngrok-free.app";

// Ruta para almacenar el syncToken
const SYNC_TOKEN_FILE = './syncToken.json';

app.use(bodyParser.json());
const credentials = require('./credentials.json');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID, 
    process.env.SECRET_ID, 
    process.env.REDIRECT
);

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Función para cargar el syncToken
function loadSyncToken() {
    if (fs.existsSync(SYNC_TOKEN_FILE)) {
        return JSON.parse(fs.readFileSync(SYNC_TOKEN_FILE, 'utf8')).syncToken;
    }
    return null;
}

// Función para guardar el syncToken
function saveSyncToken(syncToken) {
    fs.writeFileSync(SYNC_TOKEN_FILE, JSON.stringify({ syncToken }), 'utf8');
}

// Función para limpiar el syncToken y datos locales
function clearSyncData() {
    if (fs.existsSync(SYNC_TOKEN_FILE)) {
        fs.unlinkSync(SYNC_TOKEN_FILE);
    }
    console.log('Datos de sincronización limpiados.');
}

// Sincronización incremental/completa
async function syncCalendarEvents() {
    let syncToken = loadSyncToken(); // Cargar el syncToken
    let pageToken = null;

    do {
        try {
            const params = {
                calendarId: 'primary',
                maxResults: 10,
                singleEvents: true,
                pageToken: pageToken,
            };

            if (syncToken) {
                params.syncToken = syncToken; // Sincronización incremental
                console.log('Realizando sincronización incremental...');
            } else {
                console.log('Realizando sincronización completa...');
            }

            // Solicitar eventos
            const response = await calendar.events.list(params);

            // Procesar eventos
            const events = response.data.items;
            console.log("evento @@=>", events);
            events.forEach(event => {
                if (event.status === 'cancelled') {
                    console.log(`Evento eliminado: ${event.id}`);
                } else {
                    console.log(`Evento sincronizado: ${event.summary}`);
                }
            });

            // Manejar paginación
            pageToken = response.data.nextPageToken;

            // Guardar el nuevo syncToken al final de la última página
            if (!pageToken) {
                syncToken = response.data.nextSyncToken;
                saveSyncToken(syncToken);
                console.log('Nuevo syncToken guardado:', syncToken);
            }
        } catch (error) {
            if (error.response && error.response.status === 410) {
                console.log('Sync token inválido. Realizando sincronización completa...');
                clearSyncData(); // Limpiar datos locales
                syncToken = null; // Forzar sincronización completa
            } else {
                console.error('Error durante la sincronización:', error.message);
                throw error;
            }
        }
    } while (pageToken);
}

// Endpoint para manejar sincronización manual
app.get('/sync', async (req, res) => {
    try {
        await syncCalendarEvents();
        res.status(200).send('Sincronización completa.');
    } catch (error) {
        res.status(500).send(`Error durante la sincronización: ${error.message}`);
    }
});

async function getEventDetails(resourceId) {
    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            maxResults: 10,
        });

        const event = response.data.items.find((item) => item.id === resourceId);

        console.log("EVENTOS @=> ", response.data.items);

        if (!event) {
            console.log('No se encontró un evento con el resourceId:', resourceId);
            return null;
        }

        return {
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start.dateTime || event.start.date, // Fecha/hora de inicio
            end: event.end.dateTime || event.end.date, // Fecha/hora de fin
        };
    } catch (error) {
        console.error('Error al obtener detalles del evento:', error);
        throw error;
    }
}

// Configuración de webhook
app.post('/notifications', async (req, res) => {
    try {
        const headers = req.headers;

        console.log('Estos son los headers @@=> ', headers);
        /*
        console.log('Notificación recibida');
        console.log('X-Goog-Channel-ID:', headers['x-goog-channel-id']);
        console.log('X-Goog-Resource-ID:', headers['x-goog-resource-id']);
        console.log('X-Goog-Resource-State:', headers['x-goog-resource-state']);
        */

        const resourceId = headers['x-goog-resource-id'];
        const resourceState = headers['x-goog-resource-state'];

        if (resourceState === 'sync') {
            console.log('Sincronización inicial recibida.');
        } else if (resourceState === 'exists') {
            console.log('Se creó o actualizó un recurso.');
            //const eventDetails = await getEventDetails(resourceId);
            //console.log('Detalles del evento:', eventDetails);
        } else if (resourceState === 'not_exists') {
            console.log('Un recurso fue eliminado.');
            console.log('ID del recurso eliminado:', resourceId);
        }

        res.sendStatus(200);
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
        prompt: 'consent',
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

        if (!tokens.refresh_token) {
            console.error('No se recibió un refresh_token. Revisa la configuración de acceso.');
        } else {
            console.log('Refresh token recibido:', tokens.refresh_token);
        }

        oauth2Client.setCredentials(tokens);

        fs.writeFileSync('tokens.json', JSON.stringify(tokens, null, 2));
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
});

app.listen(3001, () => {
    console.log('Servidor escuchando en http://localhost:3001');
    console.log(`Expuesto a través de Ngrok en: ${publicURL}`);
    loadTokens();
    watchCalendar();
});

(async () => {
    try {
        console.log('Cargando tokens...');
        loadTokens();
        console.log('Verificando credenciales...');
        console.log('Credenciales actuales:', oauth2Client.credentials);

        if (!oauth2Client.credentials.access_token && oauth2Client.credentials.refresh_token) {
            console.log('Renovando access token...');
            const tokens = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(tokens.credentials);
            console.log('Access token renovado:', tokens.credentials.access_token);
        }

        console.log('Iniciando sincronización...');
        await syncCalendarEvents();
    } catch (error) {
        console.error('Error durante la sincronización:', error.message);
    }
})();
