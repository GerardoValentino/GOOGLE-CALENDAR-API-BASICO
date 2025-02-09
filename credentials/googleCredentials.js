const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID, 
    process.env.SECRET_ID, 
    process.env.REDIRECT
);

exports.oauth2Client = oauth2Client;

exports.calendar = google.calendar({ 
    version: 'v3', 
    auth: oauth2Client
});