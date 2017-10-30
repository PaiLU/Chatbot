"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var http = require('http');
// var getName = require('./name');
var server = restify.createServer();

var connector = new builder.ChatConnector({
    // appId: process.env.MICROSOFT_APP_ID,
    // appPassword: process.env.MICROSOFT_APP_PASSWORD,
    appId: process.env.MY_APP_ID,
    appPassword: process.env.MY_APP_PASSWORD,
});
server.post('api/messages',connector.listen());

server.listen(process.env.port || 3978, function(){
    console.log('%s listening to %s', server.name, server.url);
})
var bot = new builder.UniversalBot(connector, function(session){
    if(session.message.user.name)
        session.endConversation("Hi %s <br\>You can apply leave or ask for your leave balance <br\>Type &#39;help&#39; anytime if you need assistance", session.message.user.name);
    else
        session.endConversation("Please log onto SharePoint to utilize the LeaveBot");
});
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL_LeaveBot);
bot.recognizer(recognizer);

var d = new Date();
var offset = d.getTimezoneOffset()*60*1000;
var d1 = Object() , d2 = Object();

bot.dialog('help',[
    function(session){
        session.endDialog('You can apply leave by specifying your leave type and starting, ending date. <br\>Or ask for your leave balance by sentences like&#34;Get my leave balance&#34;');
    }
]).triggerAction({
    matches: /^help$|^main help$/i
})
bot.dialog('reqStatus', [
    function(session, args, next){
        var options = {
            host: 'heypiapi.azurewebsites.net',
            port: 80,
            // path: '/contacts',
            // host: 'localhost',
            // port: 3000,
            path:'/api/leave',
            method: 'GET'
        };
        http.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (data) {
                var receive = JSON.parse(data);
                session.endConversation("Your Employee ID: %s <br\>Name: %s<br\>Your remaining annual leaves: %s day(s)<br\>Your current pending leaves: %s day(s)", receive[0].id, session.message.user.name, receive[0].annualLeave, receive[0].pending||0);
            });
        }).end();
    }
])
.triggerAction({
    matches: 'reqStatus'
});
// .beginDialogAction('helpReqStatusAaction','helpReqStatus',{
//     matches: /^help$/i
// });
// bot.dialog('helpReqStatus', function(session){
//     session.endDialog('helpReqStatus context');
// });

bot.dialog('applyLeave',[
    function(session,args,next){
        if(session.message.user.name){
        //session.send("We are analyzing your request:\'%s\'",session.message.text);
        var daterange = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.daterange');
        var date = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.date');
        var duration =builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.duration');
        var leaveType = args.intent["intent"].match(/^apply(\w+)Leave$/);
        session.conversationData.leaveType = leaveType[1]+' Leave';
        if (daterange){
            session.beginDialog('Range',daterange);
        }else if(date && duration){
            session.beginDialog('DateAndDuration',[date,duration]);
        }else if(date){
            session.beginDialog('Date',date);
        }else if(duration){
            session.beginDialog('AskForDate',duration);
        }else{
            session.endConversation('Please specify your leave type and starting, ending date<br\>For Example: I want to apply Annual leave from 2 Aug 2017 to 5 Aug 2017.');
        }}
        else session.endConversation("Please log onto SharePoint to utilize the LeaveBot");
    },
    function(session,results){
        var apply = new Object();
        apply.start = results.startDate;
        apply.end = results.endDate;
        apply.startDate = results.startDate.getDate();
        apply.startMon = results.startDate.getMonth()+1;
        apply.startYear = results.startDate.getFullYear();
        apply.endDate = results.endDate.getDate();
        apply.endMon = results.endDate.getMonth()+1;
        apply.endYear = results.endDate.getFullYear();
        apply.duration =   (results.endDate - results.startDate)/1000/60/60/24;
        if (results.startDate > results.endDate){
            session.send('I can&#39;t send your request:;leave from %s-%s-%s to %s-%s-%s for a duration for %s days',apply.startDate,apply.startMon,apply.startYear,apply.endDate,apply.endMon,apply.endYear,apply.duration);
            session.endConversation('Please restart...');
        };
        session.send('You are applying %s from %s-%s-%s to %s-%s-%s <br\>The information has gathered, and sent to server successfully.',session.conversationData.leaveType, apply.startDate,apply.startMon,apply.startYear,apply.endDate,apply.endMon,apply.endYear);
        //get api url+
        session.endConversation();
    }
])
.triggerAction({
    matches: ['applyAdoptionLeave','applyAnnualLeave','applyChildcareLeave','applyMaternityLeave','applySharedParentalLeave','applySickLeave','applyUnpaidinfantCareLeave']
})
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
bot.dialog('helpApplyLeave',function(session){
    session.endDialog('You can apply leave by specifying your leave type and starting, ending date.')
});

bot.dialog('Range',[
    function(session,args,next){
        if(args.resolution.values[1] != null){
            d1.obj = new Date(args.resolution.values[1]['start']);
            d2.obj = new Date(args.resolution.values[1]['end']);
        }else{
            d1.obj = new Date(args.resolution.values[0]['start']);
            d2.obj = new Date(args.resolution.values[0]['end']);
        }
        d1.d = Date.parse(d1.obj)+offset;
        d1.t = new Date(d.setTime(d1.d));
        d2.d = Date.parse(d2.obj)+offset;
        d2.t = new Date(d.setTime(d2.d));
        session.dialogData.startDate = d1.t;
        session.dialogData.endDate = d2.t;
        session.endDialogWithResult(session.dialogData);
    }
]);
bot.dialog('DateAndDuration',[
    function(session,args,next){
        if(args[0].resolution.values[1] != null){
            d1.obj = new Date(args[0].resolution.values[1]['value']);
        }else{
            d1.obj = new Date(args[0].resolution.values[0]['value']);
        }
        d1.d = Date.parse(d1.obj)+offset;
        d1.t = new Date(d.setTime(d1.d));
        session.dialogData.startDate = d1.t;
        d2.d = Number(args[1].resolution.values[0].value)*1000;
        d2.t = new Date(d.setTime(d1.d + d2.d));
        session.dialogData.endDate = d2.t;
        session.endDialogWithResult(session.dialogData);
    }
]);
bot.dialog('Date',[
    function(session,args){
        if(args.resolution.values[1] != null){
            d1.obj = new Date(args.resolution.values[1]['value']);
        }else{
            d1.obj = new Date(args.resolution.values[0]['value']);
        }
        d1.d = Date.parse(d1.obj) + offset;
        d1.t = new Date(d.setTime(d1.d));
        session.send('You are applying leave from %s', d1.t);
        builder.Prompts.time(session, 'Please enter youe leave ending date.');
    },
    function(session,results,next){
        d2.obj = new Date(results.response.resolution.start);
        d2.t = dateAdd("h ",-12,d2.obj);
        if (d2.t < d1.t){
            d2.t = dateAdd("y ",1,d2.t);
        }
        session.conversationData.startDate = d1.t;  
        session.conversationData.endDate = d2.t;        
        next();
    },
    function(session){
        session.endDialogWithResult(session.conversationData);
    }
]).beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
bot.dialog('AskForDate',[
    function(session,args,next){
        session.dialogData.duration =  Number(args.resolution.values[0].value);
        session.send('You are applying a leave for %s days.', session.dialogData.duration/86400);
        builder.Prompts.time(session,'When is your first day of leave?');
    },
    function(session,results){
        session.dialogData.startDate = new Date(results.response.resolution.start);
        d1.d = Date.parse(session.dialogData.startDate);
        d.setTime(d1.d);
        session.dialogData.startDate = d;
        d.setTime(d1.d + Number(session.dialogData.duration)*1000);
        session.dialogData.endDate = d;
        session.endDialogWithResult(session.dialogData);
    }
]).beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
server.get('/', restify.plugins.serveStatic({
    directory: __dirname,
    default: './index.html'
   }));

function dateAdd(interval, number, date) {
    switch (interval) {
    case "y ": {
        date.setFullYear(date.getFullYear() + number);
        return date;
        break;
    }
    case "q ": {
        date.setMonth(date.getMonth() + number * 3);
        return date;
        break;
    }
    case "m ": {
        date.setMonth(date.getMonth() + number);
        return date;
        break;
    }
    case "w ": {
        date.setDate(date.getDate() + number * 7);
        return date;
        break;
    }
    case "d ": {
        date.setDate(date.getDate() + number);
        return date;
        break;
    }
    case "h ": {
        date.setHours(date.getHours() + number);
        return date;
        break;
    }
    case "min ": {
        date.setMinutes(date.getMinutes() + number);
        return date;
        break;
    }
    case "s ": {
        date.setSeconds(date.getSeconds() + number);
        return date;
        break;
    }
    default: {
        date.setDate(d.getDate() + number);
        return date;
        break;
    }
    }
}