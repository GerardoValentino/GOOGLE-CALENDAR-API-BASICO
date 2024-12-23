require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');

const app = express();
const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.SECRET_ID, process.env.REDIRECT);

app.get('/', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type:'offline',
        scope: 'https://www.googleapis.com/auth/calendar.readonly'
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

app.listen(3000, () => {
    console.log('Servidor corriendo en puerto 3000...');
})