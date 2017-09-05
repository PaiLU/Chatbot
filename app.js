"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var server = restify.createServer();
server.listen(process.env.port || 3978, function(){
    console.log('%s listening to %s', server.name, server.url);
})
var connector = new builder.ChatConnector({
    // appId: process.env.MICROSOFT_APP_ID,
    // appPassword: process.env.MICROSOFT_APP_PASSWORD,
    appId: process.env.MY_APP_ID,
    appPassword: process.env.MY_APP_PASSWORD,
});
server.post('api/messages',connector.listen());
var bot = new builder.UniversalBot(connector, function(session){
    session.send('Hi, this is a leave bot. I can\'t understand what you are entered. <br\>Talk to me with your request or type \'help\' anytime if you need assistance');
});
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL_LeaveBot);
bot.recognizer(recognizer);

var d = new Date();
var offset = d.getTimezoneOffset()*60*1000;
var d1 = Object() , d2 = Object();

bot.dialog('help',[
    function(session){
        session.endDialog('main help context');
    }
]).triggerAction({
    matches: /^help$|^main help$/i
})
bot.dialog('reqStatus', [
    function(session, args, next){
        session.endConversation("getting status");
    }
])
.triggerAction({
    matches: 'reqStatus'
})
.beginDialogAction('helpReqStatusAaction','helpReqStatus',{
    matches: /^help$/i
});
bot.dialog('helpReqStatus', function(session){
    session.endDialog('helpReqStatus context');
});

bot.dialog('applyAnnualLeave',[
    function(session, args, next){
        session.conversationData.leaveType = "Annual Leave";
        session.beginDialog('applyLeave',args);
    }
])
.triggerAction({
    matches: 'applyAnnualLeave'
})
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});

bot.dialog('applySickLeave',[
    function(session, args, next){
        session.conversationData.leaveType = "Sick Leave";
        session.send("applying sick leave")
        session.beginDialog('applyLeave',args);
    }
])
.triggerAction({
    matches: "applySickLeave"
})
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches:/^help$/i
})

bot.dialog('helpApplyLeave',function(session){
    session.endDialog('helpApplyLeave context')
});
bot.dialog('applyLeave',[
    function(session,args,next){
        session.send("We are analyzing your request:\'%s\'",session.message.text);        
        var daterange = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.daterange');
        var date = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.date');
        var duration =builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.duration');
        if (daterange){
            session.beginDialog('Range',daterange);
        }else if(date && duration){
            session.beginDialog('DateAndDuration',[date,duration]);
        }else if(date){
            session.beginDialog('Date',date);
        }else if(duration){
            session.beginDialog('AskForDate',duration);
        }else{
            session.send('nothing operating...');    
            session.endConversation('I can\'t understand what you are entered. <br\>Talk to me with your request like \'I want to apply leave from 2 Aug to 5 Aug\' to apply for leaves.');
            //既不是range 也不是 date, 要求重新输入
        }
    },
    function(session,results){
        var apply = new Object();
        apply.startDate = results.startDate.getDate();
        apply.startMon = results.startDate.getMonth()+1;
        apply.startYear = results.startDate.getFullYear();
        apply.endDate = results.endDate.getDate();
        apply.endMon = results.endDate.getMonth()+1;
        apply.endYear = results.endDate.getFullYear();
        apply.duration = apply.endDate - apply.startDate;
        if (results.startDate > results.endDate){
            session.send('I can\'t send your request:;leave from %s-%s-%s to %s-%s-%s for a duration for %s days',apply.startDate,apply.startMon,apply.startYear,apply.endDate,apply.endMon,apply.endYear,apply.duration);
            session.endConversation('Please restart...');
        };
        session.send('You are applying %s leave from %s-%s-%s to %s-%s-%s for a duration for %s days',session.conversationData.leaveType, apply.startDate,apply.startMon,apply.startYear,apply.endDate,apply.endMon,apply.endYear,apply.duration);
        //get api url
        session.send('The information has gathered, and sent to server successfully.');
        session.endConversation();
    }
])
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
bot.dialog('Range',[
    function(session,args,next){
        session.send('You have entered the leave starting date and the ending date...');
        //默认values[1]是对的
        d1.obj = new Date(args.resolution.values[1]['start']);
        d1.d = Date.parse(d1.obj)+offset;
        d1.t = new Date(d.setTime(d1.d));
        d2.obj = new Date(args.resolution.values[1]['end']);
        d2.d = Date.parse(d2.obj)+offset;
        d2.t = new Date(d.setTime(d2.d));
        session.dialogData.startDate = d1.t;
        session.dialogData.endDate = d2.t;
        next();
    },
    function(session){
        session.endDialogWithResult(session.dialogData);
    }
]);
bot.dialog('DateAndDuration',[
    function(session,args,next){
        session.send('You have entered the leave staring date and duration...');
        d1.obj = new Date(args[0].resolution.values[1]['value']);
        d1.d = Date.parse(d1.obj)+offset;
        d1.t = new Date(d.setTime(d1.d));
        session.dialogData.startDate = d1.t;
        d2.d = Number(args[1].resolution.values[0].value)*1000;
        d2.t = new Date(d.setTime(d1.d + d2.d));
        session.dialogData.endDate = d2.t;
        next();
    },
    function(session){
        session.endDialogWithResult(session.dialogData);
    }
]);
bot.dialog('Date',[
    function(session,args){
        session.send('You have entered the leave starting date...');     
        var x = JSON.stringify(args);
        //session.send('%s',x);
        d1.obj = new Date(args.resolution.values[1]['value']);
        d1.d = Date.parse(d1.obj) + offset;
        //session.send('%s',typeof(d1.d));
        d1.t = new Date(d.setTime(d1.d));
        //session.send('%s',d1.t);      
        builder.Prompts.time(session, 'When will you be back?');
    },
    function(session,args,next){
        d2.obj = new Date(args.response.resolution.start);
        d2.t = dateAdd("h ",-12,d2.obj);
        if (d2.t < d1.t){
            d2.t = dateAdd("y ",1,d2.t);
        }
        session.conversationData.startDate = d1.t;  
        session.conversationData.endDate = d2.t;        
        //session.send('%s,%s',session.conversationData.startDate,typeof(session.conversationData.startDate));
        next();
    },
    function(session){
        session.endDialogWithResult(session.conversationData);
    }
]);
bot.dialog('AskForDate',[
    function(session,args,next){
        session.send('You have entered a range...');
        session.dialogData.duration =  Number(args.resolution.values[0].value)/86400;
        next()
    },
    function(session){
        session.send('You will be on leave for %s days.', session.dialogData.duration);
        builder.Prompts.time(session,'When is your first day of leave?');
    },
    function(session,results){
        session.dialogData.startDate = new Date(result.response);
        d1.d = Date.parse(session.dialogData.startDate);
        d.setTime(d1.d);
        session.dialogData.startDate = d;
        d.setTime(d1.d + Number(args[1].resolution.values[0].value)*1000);
        session.dialogData.endDate = d;
        session.endDialogWithResult(session.dialogData)
    }
]);
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