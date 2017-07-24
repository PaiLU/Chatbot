// This loads the environment variables from the .env file

require('dotenv-extended').load();
//Add your requirement
var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MY_APP_ID,
    appPassword: process.env.MY_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Receive messages from the user only
var bot = new builder.UniversalBot(connector, function (session) {
    session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
});

var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

bot.dialog('BookFlight', [
    function (session, args, next) {
        session.send('Welcome to the Flight Booking Engine! We are analyzing your message: \'%s\'', session.message.text);

        // try extracting entities
        var ToLocation = builder.EntityRecognizer.findEntity(args.intent.entities, 'ToLocation');
        if (ToLocation) {
            // city entity detected, continue to next step
            session.dialogData.searchType = 'ToLocation';
            next({ response: ToLocation.entity });
        }  else {
            // no entities detected, ask user for a destination
            builder.Prompts.text(session, 'Please enter your destination');
        }
    }, 

    function (session, results) {
        var destination = results.response;

        var message = 'Looking for flights';
        message += 'to %s...';
        session.send(message, destination);
    }
    
]).triggerAction({
    matches: 'BookFlight'
});



//var bot = new builder.UniversalBot(connector);
/*// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("You said: %s", session.message.text);
});
//Create bot dialogs
bot.dialog('/',function(session){
    session.send("Hello World");
});*/
//var bot = new builder.TextBot();
/*bot.dialog('/', function (session) {
    if (!session.userData.name) {
        session.beginDialog('/profile');
    } else {
        session.send('Hello %s!', session.userData.name);
        session.userData.name = null;
    }
});
bot.dialog('/profile', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.beginDialog('/');
    }
]);

*/

server.get('/', restify.plugins.serveStatic({
 directory: __dirname,
 default: '/index.html'
}));
