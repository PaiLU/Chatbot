/*//Add your requirement
var restify = require('restify');
var builder = require('botbuilder');

//Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

//Create chat bot
var connector = new builder.ChatConnector
({ appId:'f529a65d-4900-451c-b04e-36371442f69a',appPassword:'S4qOp6L0ifSfbbbi8O58Bvk'});

// Listen for messages from users 
var bot = new builder.UniversalBot(connector);
server.post('/api/messages',connector.listen());

//Create bot dialogs
bot.dialog('/',function(session){
    session.send("Hello World");
}); */

var restify = require('restify');
var builder = require('botbuilder');

/*// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
*/
var appId = process.env.MY_APP_ID || "Missing your app ID";
var appPassword = process.env.MY_APP_PASSWOARD || "Missing your app Password";
//Create chat bot
var connector = new builder.BotConnectorBot({ 
    appId: process.env.MY_APP_ID, 
    appPassword: process.env.MY_APP_PASSWOARD
});
connector.add('/',new builder.SimpleDialog( function(session){
    session.send('Hello World');
}));

// Setup Restify Server
var server = restify.createServer();
server.post('/api/messages', connector.verifyBotFramework(), connector.listen());
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
// Listen for messages from users 
//server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
//var bot = new builder.UniversalBot(connector, function (session) {
//    session.send("You said: %s", session.message.text);
//});