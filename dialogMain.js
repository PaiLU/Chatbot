require('dotenv').load();
const builder = require('botbuilder');
const apiServices = require('./apiServices');

var luisAppId = process.env.LuisAppId_LeaveBot;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';
var bingSpellCheckKey = process.env.BING_SPELL_CHECK_API_KEY;
var OCRKey = process.env.OCRKey;

const luisModelUrlNoSpellCheck = `https://${luisAPIHostName}/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAPIKey}&verbose=true&timezoneOffset=0&q=`;
// const luisModelUrl = `https://${luisHostName}/luis/v2.0/apps/${luisAppId}?subscription-key=${luisSubscriptionKey}` +
    `&spellCheck=true&bing-spell-check-subscription-key=${bingSpellCheckSubscriptionKey}&verbose=true&timezoneOffset=0&q=`;

module.exports = [
    function (session) {
        if (session.message.text) {
            builder.LuisRecognizer.recognize(session.message.text, luisModelUrlNoSpellCheck, function (err, intents, entities, compositeEntities) {
                session.send(intents[0].intent);
                switch (intents[0].intent) {
                    case 'apply leave':
                        break;
                    case 'reqStatus':
                        apiServices.checkLeaveBalance('', session.conversationData.apiToken)
                            .then((value) => {
                                session.send(JSON.stringify(value));
                            });
                        break;
                    default:
                        break;
                }
            });
        }
    }
]