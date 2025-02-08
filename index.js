require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const schedule = require('node-schedule');
const fs = require('fs');
const app = express();

const publicURL = "https://5eea-177-227-56-238.ngrok-free.app";

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

function loadTokens() {
    if (fs.existsSync('tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf-8'));
        oauth2Client.setCredentials(tokens);
        //console.log('Tokens cargados:', tokens);
    } else {
        console.error('No se encontraron tokens. Autentícate primero.');
    }
}

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
            events.forEach(event => {
                if (event.status === 'cancelled') {
                    console.log(`Evento eliminado: ${event.id}`);
                } else {
                    console.log(`Evento sincronizado: ${event.summary}`);
                }
            });

            // Manejar paginación
            pageToken = response.data.nextPageToken || null;

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
                console.error('Error durante la sincronización 2:', error.message);
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
        res.status(500).send(`Error durante la sincronización 1: ${error.message}`);
    }
});

async function stopNotificationChannel(channelId, resourceId) {
    try {
        await calendar.channels.stop({
            requestBody: {
                id: channelId,
                resourceId: resourceId,
            },
        });
        console.log(`Canal detenido: ${channelId}`);
    } catch (error) {
        console.error(`Error al detener el canal ${channelId}:`, error);
    }
}

// Configuración de webhook
app.post('/notifications', async (req, res) => {
    try {
        const headers = req.headers;

        //console.log("@@@=> headers: ", headers);
        
        /*
        if(headers['x-goog-channel-id'] === "unique-channel-id-3c863dfb-5cdd-40be-a73e-8aca87e40029") {
            console.log("Escuchando el canal con Id: unique-channel-id-3c863dfb-5cdd-40be-a73e-8aca87e40029");
        } else {
            console.log("No existe un especialista con este channel Id")
            //res.sendStatus(200);
            //loadTokens();
            //await stopNotificationChannel(headers['x-goog-channel-id'], headers['x-goog-resource-id']);
            //return;
        } */
        
        const resourceId = headers['x-goog-resource-id'];
        const resourceState = headers['x-goog-resource-state'];

        if (resourceState === 'sync') {
            console.log('Sincronización inicial recibida.');
            /*
            const response = await axios.post('http://localhost:3000/api/google/calendar/webhook', req.body, {
                headers: {
                    'x-goog-channel-expiration': req.headers['x-goog-channel-expiration'],
                    'x-goog-channel-id': req.headers['x-goog-channel-id'],
                    'x-goog-message-number': req.headers['x-goog-message-number'],
                    'x-goog-resource-id': req.headers['x-goog-resource-id'],
                    'x-goog-resource-state': req.headers['x-goog-resource-state'],
                    'x-goog-resource-uri': req.headers['x-goog-resource-uri'],
                    //'content-type': req.headers['content-type'], // Si estás enviando un cuerpo JSON
                },
            });
            if(response) console.log("Conexion exitosa"); */
        } else if (resourceState === 'exists') {
            console.log('Se creó o actualizó un recurso.');
            await getEventDetails();
            
            /*
            const response = await axios.post('http://localhost:3000/api/google/calendar/webhook', req.body, {
                headers: {
                    'x-goog-channel-expiration': req.headers['x-goog-channel-expiration'],
                    'x-goog-channel-id': req.headers['x-goog-channel-id'],
                    'x-goog-message-number': req.headers['x-goog-message-number'],
                    'x-goog-resource-id': req.headers['x-goog-resource-id'],
                    'x-goog-resource-state': req.headers['x-goog-resource-state'],
                    'x-goog-resource-uri': req.headers['x-goog-resource-uri'],
                    //'content-type': req.headers['content-type'], // Si estás enviando un cuerpo JSON
                },
            });
            if(response) console.log("Un recurso fue actualizado"); */

        } else if (resourceState === 'not_exists') {
            console.log('Un recurso fue eliminado.');
            console.log('ID del recurso eliminado:', resourceId);
        }

        res.sendStatus(200);
        //channelInitId.push(headers['x-goog-channel-id']);
        //if(channelInitId.length > 1) res.sendStatus(200)
    } catch(error) {
        console.log("Ocurrio un problema en el endpoint de /notifications ==> ", error);
        res.sendStatus(500);
    }
});

// Función para crear un canal de notificaciones
async function createNotificationChannel(calendarId) {

    // Configuración del canal
    const channel = {
      id: `unique-channel-id-${uuidv4()}`,
      type: 'web_hook',
      address: `${publicURL}/notifications`,
      expiration: Date.now() + (86400000 * 32) // expira en 32 dias
    };
  
    try {
      const response = await calendar.events.watch({
        calendarId,
        requestBody: channel,
      });
  
      console.log('Canal de notificaciones creado:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al crear el canal:', error);
      throw error;
    }
  }
 

// Programa la renovación para cada 31 días
//schedule.scheduleJob('0 0 */31 * *', () => {
//    console.log('Renovando el canal de notificaciones...');
//    watchCalendar();
//});

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

app.listen(3000, () => {
    console.log("Google Calendar Notifications");
    console.log('Servidor escuchando en http://localhost:3000');
    console.log(`Expuesto a través de Ngrok en: ${publicURL}`);
});


(async () => {
    loadTokens();
    await createNotificationChannel('primary');
})();


const getEventDetails = async () => {
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
        console.error('Error durante la sincronización 3:', error.message);
    }
};
