
var restify = require('restify');
var builder = require('botbuilder');


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

server.get('/', restify.plugins.serveStatic({
 directory: __dirname,
 default: '/index.html'
}));