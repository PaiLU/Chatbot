// "use strict";
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
    if(session.message.user.name){
        session.endConversation("Hi %s (User id: %s)<br\>You can apply leave or ask for your leave balance <br\>Type &#39;help&#39; anytime if you need assistance", session.message.user.name||"",session.message.user.id||"");
    }
    else
        session.endConversation("Please log onto SharePoint to utilize the LeaveBot");
});
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL_LeaveBot);
bot.recognizer(recognizer);
    
bot.dialog('Help',[
    function(session){
        builder.Prompts.choice(session,"You can use LeaveBot to <br\>1. Apply leave<br\>2. Check your leave status<br\>You may also enter your enquires by sending messages to LeaveBot","Apply leave|Check leave status",{listStyle:3});
    },
    function(session,results){
        if (results.response.entity == "Apply leave")
            session.beginDialog('HelpApplyLeave');
        else if(results.response.entity == "Check leave status")
            session.beginDialog('ReqStatus');
        else
            session.endConversation("Invalid input, conversation has ended");
    }
]).triggerAction({
    matches: /^help$|^main help$/i
});
bot.dialog('ReqStatus', [
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
                var received = JSON.parse(data);
                session.endConversation("Your Employee ID: %s <br\>Name: %s<br\>Your remaining annual leaves: %s day(s)<br\>Your current pending leaves: %s day(s)", received.id, session.message.user.name,received.annualLeave, received.pending||0);
            });
        }).end();
    }
])
.triggerAction({
    matches: 'reqStatus'
});

bot.dialog('applyLeave',[
    function(session,args,next){
        if(session.message.user.name){

            session.conversationData.received = new Object;
            session.conversationData.processing = new Object;
            session.conversationData.processing.d = new Date();
            session.conversationData.processing.now = Date.parse(session.conversationData.processing.d);
            session.conversationData.offset = session.conversationData.processing.d.getTimezoneOffset()*60*1000;
            console.log(session.conversationData.offset);
            session.conversationData.apply = new Object;
            session.conversationData.received.daterange = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.daterange');
            session.conversationData.received.date = builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.date');
            session.conversationData.received.duration =builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.duration');
            session.conversationData.received.datetime =builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.datetime');
            session.conversationData.received.datetimerange =builder.EntityRecognizer.findEntity(args.intent.entities|| {},'builtin.datetimeV2.datetimerange');
            console.log(JSON.stringify(session.conversationData.received));
            session.conversationData.processing = recConv(session.conversationData.received);
            console.log(JSON.stringify(session.conversationData.processing));
            var leaveType = args.intent["intent"].match(/^apply(\w*)Leave$/);
            if(leaveType[1]) {
                session.conversationData.apply.leaveType = leaveType[1]+' Leave';
                next();
            }
            else
                session.beginDialog('AskLeaveType');
        }
        else 
            session.endConversation("Please login to utilize the LeaveBot");
    },
    function(session,next){
        if (session.conversationData.received.daterange){
            session.beginDialog('Daterange');
        }else if(session.conversationData.received.date && session.conversationData.received.duration){
            session.beginDialog('DateAndDuration');
        }else if(session.conversationData.received.date){
            session.beginDialog('Date');
        }else if(session.conversationData.received.duration){
            session.beginDialog('Duration');
        }else{
            if(session.conversationData.apply.leaveType)
            session.endConversation('Please specify your leave starting and ending date and try again<br\>For Example: I want to apply Annual leave from 2 Aug 2017 to 5 Aug 2017.');
        }
    },
    function(session,results,next){
        // session.conversationData.apply.duration =   (results.endDate - results.startDate)/1000/60/60/24;
        // if (results.startDate > results.endDate){
        //     session.send('I can&#39;t send your request:;leave from %s-%s-%s to %s-%s-%s for a duration for %s days',session.conversationData.apply.startDate,session.conversationData.applydate.startMon,session.conversationData.applydate.startYear,session.conversationData.applydate.endDate,session.conversationData.applydate.endMon,session.conversationData.applydate.endYear,session.conversationData.applydate.duration);
        //     session.endConversation('Please restart...');
        // };
        session.beginDialog('CheckApplyDate');
        // next();
    },
    function(session){
        session.beginDialog('ApplyConfirmed')
    }
])
.triggerAction({
    matches: ['applyLeave','applyAdoptionLeave','applyAnnualLeave','applyChildcareLeave','applyMaternityLeave','applySharedParentalLeave','applySickLeave','applyUnpaidinfantCareLeave']
})
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
bot.dialog('HelpApplyLeave',function(session){
    session.endDialog("You can apply leave by specifying your leave type and starting, ending date.<br\>For Example: Apply annual leave from 2 Aug 2017 to 5 Aug 2017.")
});

bot.dialog('AskLeaveType',[ 
    function(session){
        builder.Prompts.choice(session,"Please specify your leave type.",["Sick Leave","Annual Leave","Other Leave Types"],{listStyle:3});
    },
    function(session, results){
        if (results.response.entity == "Other Leave Types")
            builder.Prompts.choice(session,"Please specify your leave type.",["Adoption Leave","Childcare Leave","Maternity Leave","SharedParental Leave","UnpaidInfantCareLeave","Back"],{listStyle:3});
        else{ 
            session.conversationData.apply.leaveType = results.response.entity;
            session.endDialog();
        }
    },
    function(session, results){
        if (results.response.entity == "Back")
            session.replaceDialog('AskLeaveType')
        else{ 
            session.conversationData.apply.leaveType = results.response.entity;
            session.endDialog();
        }
    },
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('AskForDate',[
    function(session,args){
        session.dialogData.data = new Object;
        session.dialogData.data.type = args;
        if (session.dialogData.data.type == "start")
            builder.Prompts.time(session,"Please enter a leave start date");
        else if(session.dialogData.data.type == "end")
            builder.Prompts.time(session,"Please enter a leave end date");
        else 
            session.endConversation("system error<br\>%s",JSON.stringify(session.dialogData));;
    },
    function(session,results){
        console.log("%s",JSON.stringify(results.response));
        var temp = Date.parse(results.response.resolution.start)+session.conversationData.offset;
        if (temp < session.conversationData.processing.now){
            console.log("%s, %s",Date(temp), Date(session.conversationData.processing.now));
            temp = dateAdd("y ", 1, results.response.resolution.start);
        };
        session.dialogData.data.date = temp;
        session.endDialogWithResult(session.dialogData.data);
    }
]);

bot.dialog('Daterange',[
    function(session,next){
        // session.conversationData.apply.start = Date.parse(session.conversationData.processing.start)+session.conversationData.offset;
        // session.conversationData.apply.end = Date.parse(session.conversationData.processing.end)+session.conversationData.offset;
        console.log(JSON.stringify(session.conversationData.processing));
        session.endDialog();
    }
]);
bot.dialog('DateAndDuration',[
    function(session,next){
        // session.conversationData.apply.start = Date.parse(session.conversationData.processing.date)+session.conversationData.offset;
        session.conversationData.processing.start = session.conversationData.processing.date + session.conversationData.offset
        session.conversationData.processing.end = session.conversationData.processing.start + session.conversationData.processing.duration;
        console.log(JSON.stringify(session.conversationData.processing));
        session.endDialog();
    }
]);
bot.dialog('Date',[
    function(session){
        session.conversationData.processing.start = session.conversationData.processing.date + session.conversationData.offset;
        // session.send("You are applying leave from %s-%s-%s(dd-mm-yyyy)<br\>When will be your last day of leave?",session.conversationData.apply.start.getDate(),session.conversationData.apply.start.getMonth()+1,session.conversationData.apply.start.getFullYear());
        console.log(JSON.stringify(session.conversationData.processing));
        session.beginDialog('AskForDate',"end");
    },
    function(session,args){
        console.log("Return back from AskForDate Dialog\n%s",JSON.stringify(args));
        session.conversationData.processing.end = args.date;
        console.log(JSON.stringify(session.conversationData.processing));
        // session.conversationData.processing.start = new Date(results.response.resolution.start);
        // d2.t = dateAdd("h ",-12,d2.obj);
        // if (d2.t < d1.t){
        //     d2.t = dateAdd("y ",1,d2.t);
        // }
        // session.conversationData.startDate = d1.t;  
        // session.conversationData.endDate = d2.t;        
        session.endDialog();
    }
]);
// .beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
//     matches: /^help$/i
// }).cancelAction({
//     matches: /^cancel$|^abort$/i,
//     confirmPrompt: "This will cancel your current request. Are you sure?"
// });
bot.dialog('Duration',[
    function(session,next){
        session.send('You are applying a leave for %s days.', session.conversationData.processing.duration/86400000);
        session.beginDialog('AskForDate',"start");
    },
    function(session,args){
        console.log(JSON.stringify(args));
        session.conversationData.processing.start = args.date;
        session.conversationData.processing.end = session.conversationData.processing.start + session.conversationData.processing.duration;
        console.log(JSON.stringify(session.conversationData.processing));
        session.endDialog()
    }
]).beginDialogAction('helpApplyLeaveAction','HelpApplyLeave',{
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
        session.conversationData.apply.start = new Date(session.conversationData.processing.start);
        session.conversationData.apply.end = new Date(session.conversationData.processing.end);
        if (session.conversationData.processing.end < session.conversationData.processing.start)
            session.conversationData.apply.end = dateAdd("y ",1,session.conversationData.apply.end);
        session.conversationData.apply.startDate = session.conversationData.apply.start.getDate();
        session.conversationData.apply.startMon = session.conversationData.apply.start.getMonth()+1;
        session.conversationData.apply.startYear = session.conversationData.apply.start.getFullYear();
        session.conversationData.apply.endDate = session.conversationData.apply.end.getDate();
        session.conversationData.apply.endMon = session.conversationData.apply.end.getMonth()+1;
        session.conversationData.apply.endYear = session.conversationData.apply.end.getFullYear();
        session.send("Hi %s (User id: %s)<br\>You are applying %s from %s-%s-%s to %s-%s-%s",session.message.user.name,session.message.user.id,session.conversationData.apply.leaveType, session.conversationData.apply.startDate,session.conversationData.apply.startMon,session.conversationData.apply.startYear,session.conversationData.apply.endDate,session.conversationData.apply.endMon,session.conversationData.apply.endYear);
        builder.Prompts.confirm(session,"Please confirm if your request information is correct",{listStyle:3});
    },
    function(session,results){
        if(results.response)
            session.endDialog();
        else{
            // session.send("Please re-enter your request");
            console.log(JSON.stringify(session.conversationData.apply))
            builder.Prompts.choice(session,"Please specify the part your want to update",["Leave start date","Leave ending date","Leave Type","Cancle request"],{listStyle:3});
        }
    },
    function(session,results,next){
        switch (results.response.entity){
            case "Leave start date" :{
                session.beginDialog('AskForDate',"start");
                next();
                break;
            }
            case "Leave ending date" :{
                session.beginDialog('AskForDate',"end");
                next();
                break;
            }
            case "Leave Type":{
                session.beginDialog('AskLeaveType');
                break;
            }
            case "Cancle request" :{
                session.endConversation();
                break;
            }
            default: {
                session.replaceDialog('/');
                next();
                break;
            }
        };
    },
    function(session, args){
        console.log("%s",JSON.stringify(args));
        session.conversationData.processing[args.type] = args.date;
        session.replaceDialog("CheckApplyDate");
    }
]);
bot.dialog('ApplyConfirmed',[
    function(session){
        session.send('Hi %s (User id: %s)<br\>You are applying %s from %s-%s-%s to %s-%s-%s <br\>The information has gathered, and sent to server successfully.',session.message.user.name,session.message.user.id,session.conversationData.apply.leaveType, session.conversationData.apply.startDate,session.conversationData.apply.startMon,session.conversationData.apply.startYear,session.conversationData.apply.endDate,session.conversationData.apply.endMon,session.conversationData.apply.endYear);
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
};
function recConv(received){
    var p;
    var o= new Object;
    for (p in received){
        if (received[p]){
        // console.log("%s,%s",typeof(received[p]),JSON.stringify(received[p]));
        var i;
        if (received[p].resolution.values[1] != null)
            i=1;
        else i=0;
        switch (p){
            case "daterange":{
                o.start = Date.parse(received[p].resolution.values[i]['start']);
                o.end = Date.parse(received[p].resolution.values[i]['end']);
                break;
            };
            case "date":{
                o.date = Date.parse(received[p].resolution.values[i].value);
                break;
            };
            case "duration":{
                o.duration = Number(received[p].resolution.values[i].value)*1000
                break;
            };
            case "datetime":{
                break;
            };
            case "datetimerange":{
                break;
            }
        }
    }}
    console.log(JSON.stringify(o));
    return o;
};
function checkDate(p){
    if (!isNaN(p)){
        var o = new Date(p);
        console.log(o);
        return o;
    }
    else{
        console.log(JSON.stringify(p));
        return p;
    }
}