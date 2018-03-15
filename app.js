"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var http = require('http');
var fs = require('fs');
const sitLeaveType = JSON.parse(fs.readFileSync('./allLeaveType.json','utf8'));
const defaultArgs = {"action":"*:applyLeave","intent":{"intent":"applyLeave","entities":[]},"libraryName":"*"  };
const dateType = ["daterange","date","duration","datetime","datetimerange"];
var server = restify.createServer();
var leaveType = [];
var allLeaveType = [];
var needAttachment = [];
for (var a in sitLeaveType.leaveType)
    leaveType.push(sitLeaveType.leaveType[a].name);
for (var a in sitLeaveType.allLeaveType){
    allLeaveType.push(sitLeaveType.allLeaveType[a].name);
    if (sitLeaveType.allLeaveType[a].attachment == "y"){
        needAttachment.push(sitLeaveType.allLeaveType[a].name);
    }
};
console.log("leaveType" + leaveType +"\nallleavetype" + allLeaveType +"\nneedAttachment"+needAttachment);
var connector = new builder.ChatConnector({
    // appId: process.env.MICROSOFT_APP_ID,
    // appPassword: process.env.MICROSOFT_APP_PASSWORD
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});
server.post('api/messages',connector.listen());

server.listen(process.env.port || 3978, function(){
    console.log('%s listening to %s', server.name, server.url);
})

var bot = new builder.UniversalBot(connector, function(session){
    if(session.message.user.name){
        session.beginDialog('Help');
    }
    else
        session.endConversation("Please log onto DWS to utilize the LeaveBot");
});
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey +'&verbose=true&timezoneOffset=480&q=';
// const LuisModelUrl = 'https://southeastasia.api.cognitive.microsoft.com/luis/v2.0/apps/1439e3ec-8b09-4161-b18e-bf1af6c04a13?subscription-key=48ef37e72f774496aa1349261621df5c&verbose=true&timezoneOffset=480&q=';
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// main program
bot.dialog('applyLeave',[
    function(session,args){
        if(session.message.user.name){

            session.conversationData.received = new Object;
            session.conversationData.processing = new Object;
            session.conversationData.processing.d = new Date();
            session.conversationData.processing.now = Date.parse(session.conversationData.processing.d);
            session.conversationData.offset = session.conversationData.processing.d.getTimezoneOffset()*60*1000;
            console.log("offset is " +session.conversationData.offset/60/60/1000 + " hours");
            console.log(JSON.stringify(args));
            session.conversationData.apply = new Object;
            for (var a in dateType){
                session.conversationData.received[dateType[a]]= builder.EntityRecognizer.findEntity(args.intent.entities||{},'builtin.datetimeV2.'+dateType[a]);
            };
            for (var a in leaveType){
                if (builder.EntityRecognizer.findEntity(args.intent.entities||{}, leaveType[a])){
                    console.log("Leave type: "+leaveType[a]);
                    session.conversationData.received.leaveType = leaveType[a];
                };
            }; 
            console.log(JSON.stringify(session.conversationData.received));
            session.conversationData.processing = dateConvert(session.conversationData.received);
            console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end));
            if(session.conversationData.received.leaveType) {
                session.beginDialog('AskSpecificType');
            }
            else{
                session.beginDialog('AskLeaveType');
            }
        }
        else 
            session.endConversation("Please login to utilize the LeaveBot");
    },
    function(session){
        if (session.conversationData.received.daterange){
            session.beginDialog('Daterange');
        }else if(session.conversationData.received.date && session.conversationData.received.duration){
            session.beginDialog('DateAndDuration');
        }else if(session.conversationData.received.date){
            session.beginDialog('Date');
        }else if(session.conversationData.received.duration){
            session.beginDialog('Duration');
        }else if(session.conversationData.received.leaveType){
            session.beginDialog('NoDateInfo');
        }else {
            session.send("Sorry, I didn't get any information.");
            session.replaceDialog('Help');
        }
    },
    function(session){
        session.beginDialog('CheckLeaveType');
    },
    function(session,args, next){
        for (var a in needAttachment){
            if (session.conversationData.apply.leaveType == needAttachment[a])
                session.beginDialog('AskAttachment');
        };
        next();
    },
    function(session){
        session.beginDialog('CheckApplyDate');
    },
    function(session){
        session.beginDialog('ApplyConfirmed');
    }
]).triggerAction({
    matches: ['applyLeave']
});
bot.dialog('Help',[
    function(session){
        builder.Prompts.choice(session,"This is a Leave Bot. You can use it to <br\>1. Apply leave<br\>2. Check your leave status<br\><br\>You may also enter your enquires by sending messages to LeaveBot","apply leave|check leave status",{listStyle:3});
    },
    function(session,results){
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity == "apply leave"){
            session.send("You can apply leave by specifying your leave type and starting, ending date.<br\>For Example: Take annual leave from 2 Aug to 5 Aug");
            // session.replaceDialog('applyLeave',defaultArgs);
            session.endConversation();
        }
        else if(results.response.entity == "check leave status")
            session.replaceDialog('ReqStatus');
        else
            session.endConversation("Invalid input, conversation has ended");
    }
]).triggerAction({
    matches: /^help$|^main help$/i
});
bot.dialog('ReqStatus', [
    function(session, args, next){
        var options = {
            host: 'leavebot-sit-api.azurewebsites.net',
            port: 80,
            path:'/api/leave/'+session.message.user.id,
            method: 'GET'
        };
        http.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (data) {
                var received = JSON.parse(data);
                session.endConversation("Name: %s<br\>Your remaining annual leaves: %s day(s)<br\>Your remaining sick leaves: %s day(s)<br\>Your current pending annual leave: %s day(s) <br\>Your current pending sick leave: %s day(s)",  session.message.user.name,received.annualLeave||0,received.sickLeave||0,received.pending.annualLeave||0, received.pending.sickLeave||0);
            });
        }).end();
    }
]).triggerAction({
    matches: ['reqStatus']
});
bot.dialog('AskLeaveType',[ 
    function(session){
        builder.Prompts.choice(session,"Please specify your leave type.",["annual leave","medical leave(uc)","show all leave types"],{listStyle:3});
    },
    function(session, results){
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity == "show all leave types")
            builder.Prompts.choice(session,"Please specify your leave type.",allLeaveType,{listStyle:3});
        else{ 
            session.conversationData.apply.leaveType = results.response.entity;
            session.endDialog();
        }
    },
    function(session, results){
        session.conversationData.apply.leaveType = results.response.entity;
        session.endDialog();
    },
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('AskDate',[
    function(session,args){
        session.dialogData.type = args;
        builder.Prompts.time(session,"Please enter a leave "+ session.dialogData.type + " date");
    },
    function(session,results){
        console.log("Entered date: %s",JSON.stringify(results.response));
        session.conversationData.processing[session.dialogData.type] = Date.parse(results.response.resolution.start);
        if (session.dialogData.type == "end")
            session.conversationData.processing[session.dialogData.type] += 1000*60*60*24-1000;
        session.endDialog();
    }
]);
bot.dialog('Daterange',[
    function(session){
        console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end)); 
        session.endDialog();
    }
]);
bot.dialog('DateAndDuration',[
    function(session){
        session.conversationData.processing.start = session.conversationData.processing.date + session.conversationData.offset
        session.conversationData.processing.end = session.conversationData.processing.start + session.conversationData.processing.duration - 1000;
        console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end));
        session.endDialog();
    }
]);
bot.dialog('Date',[
    function(session){
        session.conversationData.processing.start = session.conversationData.processing.date + session.conversationData.offset;
        session.conversationData.processing.end = session.conversationData.processing.start + 1000*60*60*24-1000;
        console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end));
        session.endDialog();
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('Duration',[
    function(session){
        session.send('You are applying a leave for %s days.', session.conversationData.processing.duration/86400000);
        session.beginDialog('AskDate',"start");
    },
    function(session){
        session.conversationData.processing.end = session.conversationData.processing.start + session.conversationData.processing.duration -1000;
        console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end));
        session.endDialog()
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('NoDateInfo',[
    
    function(session){
        // session.send("Please specify your leave starting and ending date next time.<br\>For Example: I want to apply Annual leave from 2 Aug 2017 to 5 Aug 2017.<br\>Now please let me guide you through");
        session.beginDialog('AskDate',"start");
    },
    function(session,args){
        session.beginDialog('AskDate',"end");
    },
    function(session,args){
        console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end)); 
        session.endDialog();
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('CheckApplyDate',[
    function(session){
        session.conversationData.apply.start = new Date(session.conversationData.processing.start);
        session.conversationData.apply.end = new Date(session.conversationData.processing.end);
        session.conversationData.apply.startDate = session.conversationData.apply.start.getDate();
        session.conversationData.apply.startMon = session.conversationData.apply.start.getMonth()+1;
        session.conversationData.apply.startYear = session.conversationData.apply.start.getFullYear();
        session.conversationData.apply.endDate = session.conversationData.apply.end.getDate();
        session.conversationData.apply.endMon = session.conversationData.apply.end.getMonth()+1;
        session.conversationData.apply.endYear = session.conversationData.apply.end.getFullYear();
        session.send('Hi %s<br\>You are applying %s from %s-%s-%s to %s-%s-%s <br\>',session.message.user.name,session.conversationData.apply.leaveType,monConvert(session.conversationData.apply.startMon), session.conversationData.apply.startDate,session.conversationData.apply.startYear,monConvert(session.conversationData.apply.endMon),session.conversationData.apply.endDate,session.conversationData.apply.endYear);
        if (session.conversationData.processing.end < session.conversationData.processing.start){
            session.send("Sorry, I can't proceed with a leave start date is behind a leave end date");
            session.replaceDialog('CorrectingInfo',"date");
        }else
            builder.Prompts.confirm(session,"Please confirm if your request information is correct",{listStyle:3});
    },
    function(session,results){
        if(results.response)
            session.endDialog();
        else{
            session.replaceDialog('CorrectingInfo');
        }
    }
]);
bot.dialog('CheckLeaveType',[
    function(session){
        session.dialogData.check = 0;
        for (var a in allLeaveType){
            if (session.conversationData.apply.leaveType == allLeaveType[a])
                session.dialogData.check = 1;
        };
        if (session.dialogData.check){
            console.log("Double checked the appling leave type is %s", session.conversationData.apply.leaveType);
        }else{
            session.send("Please check the leave type. You have entered %s <br\>which is not in SIT leave type", session.conversationData.apply.leaveType);
            session.replaceDialog('AskLeaveType');
        };
        session.endDialog();
    }
]);
bot.dialog('AskSpecificType',[
    function(session){
        if(session.conversationData.received.leaveType == "medical leave")
            builder.Prompts.choice(session,"Please specify your medical leave, whether it is 'medical leave uc' or 'medical leave c'",["medical leave(uc)","medical leave(c)"],{listStyle:3});
        else if(session.conversationData.received.leaveType == "ext maternity leave")
            builder.Prompts.choice(session,"Please specify your ext maternity leave, whether it is 'fp-sc' or 'up-non sc'",["ext maternity(fp-sc)","ext maternity(up-non sc)"],{listStyle:3});
        else{
            session.conversationData.apply.leaveType = session.conversationData.received.leaveType;
            session.endDialog();
        }
    },
    function(session,results){
        session.conversationData.apply.leaveType = results.response.entity;
        session.endDialog();
    }
]);
bot.dialog('AskAttachment',[
    function(session){
        var msg = "Please upload supporting attachment for applying "+session.conversationData.apply.leaveType;
        builder.Prompts.attachment(session, msg);
    },
    function(session,results){
        var att = results.response[0];
        session.conversationData.apply.attachments = {
                    contentType: att.contentType,
                    contentUrl: att.contentUrl,
                    name: att.name
                }
        session.endDialog();
    }
]);
bot.dialog('CorrectingInfo',[
    function(session,args){
        if (args && args == "date"){
            builder.Prompts.choice(session,"Please update your information",["leave start date","leave ending date","cancel request"],{listStyle:3});
        }
        else {
            builder.Prompts.choice(session,"Please specify the part your want to update",["leave start date","leave ending date","leave type","attachment","cancel request"],{listStyle:3});
        }
    },
    function(session,results){
        switch (results.response.entity){
            case "leave start date" :{
                session.beginDialog('AskDate',"start");
                break;
            }
            case "leave ending date" :{
                session.beginDialog('AskDate',"end");
                break;
            }
            case "leave type":{
                session.beginDialog('AskLeaveType');
                break;
            }
            case "attachment":{
                session.beginDialog('AskAttachment');
                break;
            }
            case "cancel request" :{
                session.endConversation();
                break;
            }
            default: {
                session.endConversation();
                break;
            }
        };
    },
    function(session){
        session.replaceDialog("CheckApplyDate");
    }
])
bot.dialog('ApplyConfirmed',[
    function(session){
        session.send('Hi %s<br\>You are applying %s from %s-%s-%s to %s-%s-%s <br\>The information has been sent to the server successfully.',session.message.user.name,session.conversationData.apply.leaveType,monConvert(session.conversationData.apply.startMon), session.conversationData.apply.startDate,session.conversationData.apply.startYear,monConvert(session.conversationData.apply.endMon),session.conversationData.apply.endDate,session.conversationData.apply.endYear);
        //get api url+
        session.endConversation();
    }
]);

function dateConvert(received){
    var o= new Object;
    for (var p in received){
        if (received[p] && received[p]!=null && p!="leaveType"){
            var i;
            if (received[p].resolution.values[1] != null)
                i=1;
            else i=0;
            switch (p){
                case "daterange":{
                    o.start = Date.parse(received[p].resolution.values[i]["start"]);
                    o.end = Date.parse(received[p].resolution.values[i]["end"]);
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
                };
                default :
                    break;
            }
        }
    }
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
};

function checkAttachment(t){
    var check = false;
    for (var a in needAttachment){
        if (t == needAttachment[a])
        check = true;
    };
    return check;
};
function monConvert(m){
    switch (m){
        case 1 : return "Jan";
        case 2 : return "Feb";
        case 3 : return "Mar";
        case 4 : return "Apr";
        case 5 : return "May";
        case 6 : return "Jun";
        case 7 : return "Jul";
        case 8 : return "Aug";
        case 9 : return "Sep";
        case 10 : return "Oct";
        case 11 : return "Nov";
        case 12 : return "Dec";
    }
};
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