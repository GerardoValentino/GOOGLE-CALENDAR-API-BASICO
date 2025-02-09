require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const googleAuthRoutes = require('./routes/authGoogleRoutes');
const googleCalendarRoutes = require('./routes/googleCalendarRoutes');
const { syncCalendarEvents, getEventDetails, stopNotificationChannel } = require('./controllers/notificationsController');
const tokenController = require('./controllers/tokensController');
const AppError = require('./utils/appError');

app.use(bodyParser.json());

// Endpoint para manejar sincronización manual
app.get('/sync', async (req, res) => {
    try {
        await syncCalendarEvents();
        res.status(200).send('Sincronización completa.');
    } catch (error) {
        res.status(500).send(`Error durante la sincronización 1: ${error.message}`);
    }
});

app.post('/notifications', async (req, res) => {
    try {
        const headers = req.headers;

        // Para detener canales de notificaciones
        
        if(headers['x-goog-channel-id'] === "unique-channel-id-1226704c-6d13-4c5c-9318-2d475c96aeea") {
            console.log("unique-channel-id-1226704c-6d13-4c5c-9318-2d475c96aeea");
            res.sendStatus(200);
            tokenController.loadTokens();
            await stopNotificationChannel(headers['x-goog-channel-id'], headers['x-goog-resource-id']);
            return;
        }
        
        const resourceState = headers['x-goog-resource-state'];

        if (resourceState === 'sync') {
            console.log('Sincronización inicial recibida.');
            
        } else if (resourceState === 'exists') {
            console.log('Se creó o actualizó un recurso.');
            console.log(headers['x-goog-channel-id'])
            await getEventDetails();
            
        } else if (resourceState === 'not_exists') {
            console.log('Un recurso fue eliminado.');
        }

        res.sendStatus(200);
    } catch(error) {
        console.log("Ocurrio un problema en el endpoint de /notifications ==> ", error);
        res.sendStatus(500);
    }
});


app.use('/', googleAuthRoutes);
app.use('/google-calendar/', googleCalendarRoutes);

app.all('*', (req, res, next) => {
    next(new AppError(`No se pudo encontrar ${req.originalUrl} en este servidor!`, 404));
});

module.exports = app;
