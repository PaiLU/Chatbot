require('dotenv').load();
const builder = require('botbuilder');
const apiServices = require('./apiServices');

const luisHostName = process.env.LuisHostName;
const luisAppId = process.env.LuisAppId;
const luisSubscriptionKey = process.env.LuisSubscriptionKey;
const bingSpellCheckSubscriptionKey = process.env.BingSpellCheckSubscriptionKey;

const luisModelUrlNoSpellCheck = `https://${luisHostName}/luis/v2.0/apps/${luisAppId}?subscription-key=${luisSubscriptionKey}&verbose=true&timezoneOffset=0&q=`;
const luisModelUrl = `https://${luisHostName}/luis/v2.0/apps/${luisAppId}?subscription-key=${luisSubscriptionKey}` +
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