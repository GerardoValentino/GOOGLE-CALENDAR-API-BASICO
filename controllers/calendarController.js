const { google } = require('googleapis');
const { oauth2Client } = require('../credentials/googleCredentials');

exports.calendars = (req, res) => {
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
}

exports.events = (req, res) => {
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
}