const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const AlarmSchema = new Schema({
    phoneNumber: {type: String, required: true},
    currentState: {type: String, required: true},
    recurring: {type: Boolean, default: false},
    alarmTime: {type: Schema.Types.Mixed},
    createdAt: { type: Date, required: true, default: Date.now },
})
const Alarm = model('Alarm', AlarmSchema);
module.exports = Alarm;