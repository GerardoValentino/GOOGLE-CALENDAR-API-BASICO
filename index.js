require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const googleAuthRoutes = require('./routes/authGoogleRoutes');
const googleCalendarRoutes = require('./routes/googleCalendarRoutes');

const tokenController = require('./controllers/tokensController');
const { calendar, oauth2Client } = require('./credentials/googleCredentials');

app.use(bodyParser.json());

// Sincronización incremental/completa
async function syncCalendarEvents() {
    let syncToken = tokenController.loadSyncToken(); 
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
                params.syncToken = syncToken;
                console.log('Realizando sincronización incremental...');
            } else {
                console.log('Realizando sincronización completa...');
            }

            const response = await calendar.events.list(params);

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
                tokenController.saveSyncToken(syncToken);
                //console.log('Nuevo syncToken guardado:', syncToken);
            }
        } catch (error) {
            if (error.response && error.response.status === 410) {
                console.log('Sync token inválido. Realizando sincronización completa...');
                tokenController.clearSyncData(); // Limpiar datos locales
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

        // Para detener canales de notificaciones
        /*
        if(headers['x-goog-channel-id'] === "unique-channel-id-820b23e7-3379-4ce9-870c-6a149cfb9fa5") {
            console.log("Escuchando el canal con Id: unique-channel-id-820b23e7-3379-4ce9-870c-6a149cfb9fa5");
        } else {
            res.sendStatus(200);
            tokenController.loadTokens();
            await stopNotificationChannel(headers['x-goog-channel-id'], headers['x-goog-resource-id']);
            return;
        } */
        
        const resourceId = headers['x-goog-resource-id'];
        const resourceState = headers['x-goog-resource-state'];

        if (resourceState === 'sync') {
            console.log('Sincronización inicial recibida.');
            
        } else if (resourceState === 'exists') {
            console.log('Se creó o actualizó un recurso.');
            await getEventDetails();
            
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

// Función para crear un canal de notificaciones
async function createNotificationChannel(calendarId) {

    // Configuración del canal
    const channel = {
      id: `unique-channel-id-${uuidv4()}`,
      type: 'web_hook',
      address: `${process.env.PUBLIC_URL}/notifications`,
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


app.use('/', googleAuthRoutes);
app.use('/google-calendar/', googleCalendarRoutes);


app.listen(3000, () => {
    console.log("Google Calendar Notifications");
    console.log('Servidor escuchando en http://localhost:3000');
    console.log(`Expuesto a través de Ngrok en: ${process.env.PUBLIC_URL}`);
});

// FUNCION PARA CREAR UN NUEVO CANAL DE NOTIFICACIONES
/*
(async () => {
    tokenController.loadTokens();
    await createNotificationChannel('primary');
})(); */ 


const getEventDetails = async () => {
    try {
        tokenController.loadTokens();
        //console.log('Credenciales actuales:', oauth2Client.credentials);

        if (!oauth2Client.credentials.access_token && oauth2Client.credentials.refresh_token) {
            const tokens = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(tokens.credentials);
            //console.log('Access token renovado:', tokens.credentials.access_token);
        }

        await syncCalendarEvents();
    } catch (error) {
        console.error('Error durante la sincronización 3:', error.message);
    }
};
