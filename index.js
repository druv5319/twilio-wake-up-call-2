require('dotenv').config();
const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const schedule = require('node-schedule');
const mongoose = require('mongoose');
mongoose.connect(process.env.DATABASE_CONNECTION_STRING);
const app = express();
app.use(express.urlencoded({
    extended: true
}));

const {createAlarm, stopAlarm, syncCronJobs} = require('./services/alarm')

// Turn on alarm jobs from the database
syncCronJobs();

// Executed when phone call is answered
app.post('/voiceResponse', async (req, res) => {
    const twiml = new VoiceResponse();
    const gather = twiml.gather({
        action: '/stopAlarm',
        input: 'dtmf',
        numDigits: 1
    })
    gather.say('Good morning! Press any number to stop the alarm.')

    res.type('text/xml');
    res.send(twiml.toString());
})

// Executed when digits have been 
app.post('/stopAlarm', async (req, res) => {
    if(req.body?.Digits) {
        // Stop the alarm
        const phoneNumber = req.body['To']
        stopAlarm(phoneNumber)

        // Hang up call
        const twiml = new VoiceResponse();
        twiml.say("Stopping Alarm. Goodbye.")
        twiml.hangup()
        res.type('text/xml');
        res.send(twiml.toString());
    }
})


app.listen(3000, () => {
    console.log(`Listening on port 3000`);
});

const alarmTime = new schedule.RecurrenceRule();
alarmTime.hour = 14;
alarmTime.minute = 25;
alarmTime.tz = 'America/New_York';


// createAlarm('<YOUR_PHONE_NUMBER>', alarmTime, false)