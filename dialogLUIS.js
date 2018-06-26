"use strict"
require('dotenv-extended').load();
var builder = require('botbuilder');

var luisAppId = process.env.LuisAppId_LeaveBot;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';
var bingSpellCheckKey = process.env.BING_SPELL_CHECK_API_KEY;
const LuisModelUrl = `https://${luisAPIHostName}/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAPIKey}&verbose=true&timezoneOffset=0&q=`;
// const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey + '&spellCheck=true&bing-spell-check-subscription-key=' + bingSpellCheckKey + '&verbose=true&timezoneOffset=0&q=';

module.exports = [
    function (session, args) {
        builder.LuisRecognizer.recognize(args, LuisModelUrl, function (err, intents, entities, compositeEntities) {
            switch (intents[0].intent) {
                case 'ApplyLeave': {
                    session.privateConversationData.attachments = [];
                    session.cancelDialog(0, 'ApplyLeave', { "intent": { "intent": "ApplyLeave", "entities": [...entities] } });
                    break;
                }
                case 'CheckLeaveBalance': {
                    session.cancelDialog(0, 'CheckLeaveBalance', { "intent": { "intent": "CheckLeaveBalance", "entities": [...entities] } });
                    break;
                }
                case 'OCR': {
                    session.privateConversationData.attachments = [];
                    session.cancelDialog(0, 'OCR', { "intent": { "intent": "CheckLeaveBalance", "entities": [...entities] } });
                    break;
                }
                default: {
                    session.send(`Sorry I didn't get you.`)
                    session.cancelDialog(0, 'Help');
                    break;
                }
            }
        });
    }
]