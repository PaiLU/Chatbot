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
        session.endConversation("Hi %s (User id: %s)<br\>You can apply leave or ask for your leave balance <br\>Type &#39;help&#39; anytime if you need assistance", session.message.user.name||"",session.message.user.id||"");
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
        builder.Prompts.choice(session,"You can use LeaveBot to <br\>1. Apply leave<br\>2. Check your leave status<br\>You may also enter your enquires by sending messages to LeaveBot","Apply leave|Check leave status",{listStyle:3});
    },
    function(session,results){
        if (results.response.entity == "Apply leave")
            session.beginDialog("helpApplyLeave");
        else if(results.response.entity == "Check leave status")
            session.beginDialog("reqStatus");
        else
            session.endConversation("Invalid input, conversation has ended");
    }
]).triggerAction({
    matches: /^help$|^main help$/i
});
bot.dialog('reqStatus', [
    function(session, args, next){
        var options = {
            host: 'heypiapi.azurewebsites.net',
            port: 80,
            // path: '/contacts',
            // host: 'localhost',
            // port: 3000,
            path:'/api/leave/'+session.message.user.id,
            method: 'GET'
        };
        http.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (data) {
                var receive = JSON.parse(data);
                session.endConversation("Your Employee ID: %s <br\>Name: %s<br\>Your remaining annual leaves: %s day(s)<br\>Your current pending leaves: %s day(s)", receive.id, session.message.user.name,receive.annualLeave, receive.pending||0);
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
            session.conversationData.daterange = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.daterange');
            session.conversationData.date = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.date');
            session.conversationData.duration =builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.duration');
            var leaveType = args.intent["intent"].match(/^apply(\w*)Leave$/);
            if(leaveType[1]) {
                session.conversationData.leaveType = leaveType[1]||'whatever'+' Leave';
                next();}
            else
                session.beginDialog('AskLeaveType');
        }
        else 
            session.endConversation("Please login to utilize the LeaveBot");
    },
    function(session){
        if (session.conversationData.daterange){
            session.beginDialog('Range',session.conversationData.daterange);
        }else if(session.conversationData.date && session.conversationData.duration){
            session.beginDialog('DateAndDuration',[session.conversationData.date,session.conversationData.duration]);
        }else if(session.conversationData.date){
            session.beginDialog('Date',session.conversationData.date);
        }else if(session.conversationData.duration){
            session.beginDialog('AskForDate',session.conversationData.duration);
        }else{
            if(session.conversationData.leaveType)
            session.endConversation('Please specify your leave type and starting, ending date and try again<br\>For Example: I want to apply Annual leave from 2 Aug 2017 to 5 Aug 2017.');
        }
    },
    function(session,results,next){
        session.conversationData.applydate = new Object();
        session.conversationData.applydate.start = results.startDate;
        session.conversationData.applydate.end = results.endDate;
        session.conversationData.applydate.startDate = results.startDate.getDate();
        session.conversationData.applydate.startMon = results.startDate.getMonth()+1;
        session.conversationData.applydate.startYear = results.startDate.getFullYear();
        session.conversationData.applydate.endDate = results.endDate.getDate();
        session.conversationData.applydate.endMon = results.endDate.getMonth()+1;
        session.conversationData.applydate.endYear = results.endDate.getFullYear();
        session.conversationData.applydate.duration =   (results.endDate - results.startDate)/1000/60/60/24;
        if (results.startDate > results.endDate){
            session.send('I can&#39;t send your request:;leave from %s-%s-%s to %s-%s-%s for a duration for %s days',session.conversationData.applydate.startDate,session.conversationData.applydate.startMon,session.conversationData.applydate.startYear,session.conversationData.applydate.endDate,session.conversationData.applydate.endMon,session.conversationData.applydate.endYear,session.conversationData.applydate.duration);
            session.endConversation('Please restart...');
        };
        session.beginDialog('CheckApplyDate');
        // next();
    },
    function(session){
        session.beginDialog('ConfirmedApply')
    }
])
.triggerAction({
    matches: ['applyLeave','applyAdoptionLeave','applyAnnualLeave','applyChildcareLeave','applyMaternityLeave','applySharedParentalLeave','applySickLeave','applyUnpaidinfantCareLeave']
})
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
bot.dialog('helpApplyLeave',function(session){
    session.endDialog("You can apply leave by specifying your leave type and starting, ending date.<br\>For Example: Apply annual leave from 2 Aug 2017 to 5 Aug 2017.")
});

bot.dialog('AskLeaveType',[ 
    function(session){
        builder.Prompts.choice(session,"Please specify your leave type first.",["Sick Leave","Annual Leave","Other Leave Types"],{listStyle:3});
    },
    function(session, results){
        if(results.response){
            if (results.response.entity == "Other Leave Types")
                builder.Prompts.choice(session,"Please specify your leave type first.",["Adoption Leave","Childcare Leave","Maternity Leave","SharedParental Leave","UnpaidInfantCareLeave","back"],{listStyle:3});
            else{ 
                session.conversationData.leaveType = results.response.entity;
                session.endDialog();
        }}
        else{
            session.send("Please enter a valid leave type");
            session.replaceDialog('AskLeaveType');
            session.endDialog();};
    },
    function(session, results){
        if(results.response){
            if (results.response.entity == "back")
                session.replaceDialog('AskLeaveType')
            else{ 
                session.conversationData.leaveType = results.response.entity;
                session.endDialog();
        }}
        else{
            session.send("Please enter a valid leave type");
            session.replaceDialog('AskLeaveType');
            session.endDialog();};  
    },
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});

bot.dialog('Range',[
    function(session,args,next){
        if(args.resolution.values[1] != null){
            d1.obj = new Date(args.resolution.values[1]['start']);
            d2.obj = new Date(args.resolution.values[1]['end']);
        }else{
            d1.obj = new Date(args.resolution.values[0]['start']);
            d2.obj = new Date(args.resolution.values[0]['end']);
        };
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
}).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
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
}).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
// server.get('/', restify.plugins.serveStatic({
//     directory: __dirname,
//     default: './index.html'
//    }));
bot.dialog('CheckApplyDate',[
    function(session,next){
        session.send("Hi %s (User id: %s)<br\>You are applying %s from %s-%s-%s to %s-%s-%s",session.message.user.name,session.message.user.id,session.conversationData.leaveType, session.conversationData.applydate.startDate,session.conversationData.applydate.startMon,session.conversationData.applydate.startYear,session.conversationData.applydate.endDate,session.conversationData.applydate.endMon,session.conversationData.applydate.endYear);
        builder.Prompts.confirm(session,"Please confirm if your request information is correct",{listStyle:3});
    },
    function(session,results){
        if(results.response)
            session.endDialog();
        else{
            session.send("Please re-enter your request");
            session.endConversation();
            // builder.Prompts.choice(session,"Please specify the part your want to update",["Leave start date","Leave ending date","Cancle request"],{listStyle:3});
        }
    }
    // function(session,results){
    //     switch (results.response.entity){
    //         case "Leave start date" :{
    //             session.beginDialog('AskForDate',"startdate");
    //             next();
    //             break;
    //         }
    //         case "Leave ending date" :{
    //             session.beginDialog('AskForDate',"enddate");
    //             next();
    //             break;
    //         }
    //         case "Cancle request" :{
    //             session.endConversation();
    //             next()
    //             break;
    //         }
    //         default: {
    //             session.replaceDialog('/');
    //             next();
    //             break;
    //         }
    //     };
    //     session.
    // }
]);
bot.dialog('ConfirmedApply',[
    function(session){
        session.send('Hi %s (User id: %s)<br\>You are applying %s from %s-%s-%s to %s-%s-%s <br\>The information has gathered, and sent to server successfully.',session.message.user.name,session.message.user.id,session.conversationData.leaveType, session.conversationData.applydate.startDate,session.conversationData.applydate.startMon,session.conversationData.applydate.startYear,session.conversationData.applydate.endDate,session.conversationData.applydate.endMon,session.conversationData.applydate.endYear);
        //get api url+
        session.endConversation();
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