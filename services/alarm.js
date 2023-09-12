require('dotenv').config();
const schedule = require('node-schedule');
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const Alarm = require('../models/alarm')

// default alarm settings
const maxAttempts = 5;
const snoozeInterval = 540000 // 9 minutes in milliseconds


module.exports = {
    createAlarm: async function(phoneNumber, alarmTime, recurring = true) {
        // Delete any existing alarms linked to the number
        await Alarm.deleteMany({phoneNumber: phoneNumber})

        // Store alarm in database
        const newAlarm = new Alarm({
            phoneNumber: phoneNumber,
            currentState: 'ready',
            recurring: recurring,
            alarmTime: alarmTime,
        })
        await newAlarm.save();

        // Create the cron job for the alarm
        createAlarmJob(newAlarm)
    },

    // Change the alarm state to default state
    // 'ready' if the alarm is recurring
    // 'off' if the alarm is not recurring
    stopAlarm: async function(phoneNumber) {
        const alarm = await Alarm.findOne({phoneNumber: phoneNumber});
        if(alarm.recurring){
            alarm.currentState = 'ready'
            alarm.save();
        }
        else {
            alarm.currentState = 'off'
            alarm.save();
            // Cancels the cron job so the alarm does not trigger for the next morning
            if(schedule.scheduledJobs[phoneNumber]){
                schedule.scheduledJobs[phoneNumber].cancel()
            }
        }
    },
    // Creates cron jobs for alarms that are 'ready' and restarts call cycle for alarms that are ongoing
    syncCronJobs: async function()  {
        const readyAlarms = await Alarm.find({currentState: 'ready'});
        const ongoingAlarms = await Alarm.find({currentState: 'on'});

        for(const alarm of readyAlarms) {
            createAlarmJob(alarm);
        }
        for(const alarm of ongoingAlarms) {
            executeCallCycle(alarm.phoneNumber);
        }
    },
}

async function executeCallCycle(phoneNumber, attempt = 0) {
    const alarm = await Alarm.findOne({phoneNumber: phoneNumber});
    // If max attempts reached, stop the alarm
    if (attempt == maxAttempts) {
        return module.exports.stopAlarm(alarm.phoneNumber);
    }
    // If alarm has already been turned off, break the call cycle
    else if(alarm.currentState != 'on') return;

    // Call alarm phone number and route to /voiceResponse to detect user input
    await twilio.calls.create({
        url: process.env.SERVER_URL + '/voiceResponse',
        to: alarm.phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
    })

    // Wait for 5 minutes (or whatever snoozeInterval is set at) and then execute next call cycle
    setTimeout(function () {
        executeCallCycle(alarm.phoneNumber, attempt + 1);
    }, snoozeInterval);
}


async function createAlarmJob(alarm) {
    // Create alarm job which will run at the specified time
    schedule.scheduleJob(alarm.phoneNumber, alarm.alarmTime, async function () {
        // Find updated alarm in database and start call cycle if its ready
        alarm = await Alarm.findOne({phoneNumber: alarm.phoneNumber});
        if (alarm.currentState != 'ready') return;
        alarm.currentState = 'on'
        await alarm.save();
        executeCallCycle(alarm.phoneNumber);
    });
}