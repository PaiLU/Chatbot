var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Receive messages from the user
var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.beginDialog('dialogIntro');
    },
    function (session) {
        session.beginDialog('dialogMain');
    }
]);

// bot.on('conversationUpdate', function (message) {
//     if (message.membersAdded) {
//         message.membersAdded.forEach(function (identity) {
//             if (identity.id === message.address.bot.id) {
//                 bot.beginDialog(message.address, '/');
//             }
//         });
//     }
// });

bot.on("event", function (event) {
    if (event.name === "apiToken") {
        bot.beginDialog(event.address, 'dialogApiToken', event.text);
        bot.beginDialog(event.address, '/');
    }
})

bot.dialog('dialogIntro', require('./dialogIntro'));
bot.dialog('dialogMain', require('./dialogMain'));
bot.dialog('dialogApiToken', require('./dialogApiToken'));