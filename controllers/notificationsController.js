const { v4: uuidv4 } = require('uuid');
const tokenController = require('./tokensController');
const { calendar, oauth2Client } = require('../credentials/googleCredentials');

// ============== GOOGLE CALENDAR NOTIFICATIONS FUNCTIONS ==============

exports.createNotificationChannel = async (calendarId) => {
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

// Sincronizacion incremental o completa
const syncCalendarEvents = async () => {
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

exports.syncCalendarEvents = syncCalendarEvents;

exports.getEventDetails = async () => {
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

exports.stopNotificationChannel = async (channelId, resourceId) => {
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