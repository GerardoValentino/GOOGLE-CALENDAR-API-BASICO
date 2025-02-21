const app = require('./index');
const { createNotificationChannel } = require('./controllers/notificationsController');
const tokenController = require('./controllers/tokensController');

const port = process.env.PORT || 8000;

// FUNCION PARA CREAR UN NUEVO CANAL DE NOTIFICACIONES
/*
(async () => {
    tokenController.loadTokens();
    await createNotificationChannel('primary');
})(); */

const server = app.listen(port, () => {
    console.log("Google Calendar Notifications");
    console.log('Servidor escuchando en http://localhost:3000');
    console.log(`Expuesto a través de Ngrok en: ${process.env.PUBLIC_URL}`);
});


process.on('unhandledRejection', error => {
    console.log('UNHANDLED REJECTION! 😟 Apagando...');
    console.log(error.name, error.message);
    server.close(() => {
        process.exit(1); // Apagar la app
    })
})