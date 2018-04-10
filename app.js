"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var http = require('http');
var fs = require('fs');
const sitLeaveType = JSON.parse(fs.readFileSync('./allLeaveType.json','utf8'));
const defaultArgs = {"intent":{"intent":"applyLeave","entities":[]}};
const dateType = ["daterange","date","duration","datetime","datetimerange"];
var server = restify.createServer();
var leaveType = [];
var allLeaveType = [];
var needAttachmentType = [];
for (var a in sitLeaveType.leaveType)
    leaveType.push(sitLeaveType.leaveType[a].name);
for (var a in sitLeaveType.allLeaveType){
    allLeaveType.push(sitLeaveType.allLeaveType[a].name);
    if (sitLeaveType.allLeaveType[a].attachment == "y"){
        needAttachmentType.push(sitLeaveType.allLeaveType[a].name);
    }
};
console.log("leaveType " + leaveType +"\nallleavetype " + allLeaveType +"\nneedAttachmentType "+needAttachmentType);
//Bot configration
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
        // if(session.message.user.name){
            console.log("Name: "+session.message.user.name+"\n")
            session.beginDialog('Help');
        // }
        // else
        //     session.endConversation("Please log onto DWS to utilize the LeaveBot");
    });
    var luisAppId = process.env.LuisAppId;
    var luisAPIKey = process.env.LuisAPIKey;
    var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

    const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey +'&verbose=true&timezoneOffset=480&q=';
    var recognizer = new builder.LuisRecognizer(LuisModelUrl);
    bot.recognizer(recognizer);

bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address, '/');
            }
        });
    }
});
// main program
bot.dialog('Help',[
    function(session){
        builder.Prompts.choice(session,"This is a Leave Bot. You can use it to <br\>1. Apply leave<br\>2. Check your leave status<br\><br\>You may also enter your enquires by sending messages to LeaveBot","apply leave|check leave status",{listStyle:3});
    },
    function(session,results){
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity == "apply leave"){
            // session.send("You can apply leave by specifying your leave type and starting, ending date.<br\>For Example: Take annual leave from 2 Aug to 5 Aug");
            session.cancelDialog(0,'applyLeave',defaultArgs);
            session.endConversation();
        }
        else if(results.response.entity == "check leave status")
            session.cancelDialog(0,'ReqStatus');
        else
            session.endConversation("Invalid input, conversation has ended");
    }
]).triggerAction({
    matches: /^help$|^main help$/i
});
bot.dialog('ReqStatus', [
    function(session, args, next){
        session.conversationData.apply = new Object;
        if(args){
            console.log(JSON.stringify(args));
            for (var a in leaveType){
                if (builder.EntityRecognizer.findEntity(args.intent.entities||{}, leaveType[a])){
                    console.log("Leave type: "+leaveType[a]);
                    session.conversationData.apply.leaveType = leaveType[a];
                    next();
                };  
            }; 
        }else{
            builder.Prompts.choice(session,"Which balance are you looking for?",["show all balances"].concat(allLeaveType.slice(0,3)),{listStyle:3});
        };
    },
    function(session,results,next){
        next();
    },
    function(session){
        var options = {
            host: 'leavebot-sit-api.azurewebsites.net',
            port: 80,
            path:'/api/leave/'+"6",
            // path:'/api/leave/'+session.message.user.id,
            method: 'GET'
        };
        http.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (data) {
                var received = JSON.parse(data);
                console.log(typeof(received)+" "+received);
                if (received == "entity not found"){
                    session.send("The API is not responding");
                } else {
                    session.endConversation("Name: %s<br\>Your remaining annual leaves: %s day(s)<br\>Your remaining sick leaves: %s day(s)<br\>Your current pending annual leave: %s day(s) <br\>Your current pending sick leave: %s day(s)",  session.message.user.name,received.annualLeave||0,received.sickLeave||0,received.pending.annualLeave||0, received.pending.sickLeave||0);
                }
            });
        }).end();
    }
]).triggerAction({
    matches: ['reqStatus']
});
bot.dialog('applyLeave',[
    function(session,args){
        session.conversationData.received = new Object;
        session.conversationData.processing = new Object;
        session.conversationData.apply = new Object;
        session.conversationData.processing.d = new Date();
        session.conversationData.processing.now = Date.parse(session.conversationData.processing.d);
        session.conversationData.offset = session.conversationData.processing.d.getTimezoneOffset()*60*1000;
        console.log("offset is " +session.conversationData.offset/60/60/1000 + " hours");
        console.log(JSON.stringify(args));
        session.beginDialog('ConvertingData',args)
    },
    function(session,results,next){
        if(session.conversationData.received.leaveType) {
            session.beginDialog('AskSpecificType');
        }
        else{
            session.beginDialog('AskLeaveType',"selected");
        }
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
        }else{
            session.beginDialog('NoDateInfo');
        }
    },
    function(session){
        session.beginDialog('CheckLeaveType');
    },
    function(session){
        session.beginDialog('CheckAttachment');
    },
    function(session){
        session.beginDialog('CheckApplyInfo');
    },
    function(session){
        session.beginDialog('ApplyConfirmed');
    }
]).triggerAction({
    matches: ['applyLeave']
});
bot.dialog('ConvertingData',[
    function(session,args,next){
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
        session.endDialog();
    }
]);
bot.dialog('AskLeaveType',[
    function(session,args,next){
        console.log(args);
        if (args != "all"){
            builder.Prompts.choice(session,"Please specify your leave type.",allLeaveType.slice(0,3).concat("show all leave types"),{listStyle:3});
        }else{
            builder.Prompts.choice(session,"Please specify your leave type.",allLeaveType,{listStyle:3});
        }
    },
    function(session, results){
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity == "show all leave types")
            session.replaceDialog('AskLeaveType',"all")
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
        session.dialogData.test = results.response.resolution.start;
        session.dialogData.test.setHours(0,0,0,0);
        session.conversationData.processing[session.dialogData.type] = Date.parse(session.dialogData.test);
        if (session.dialogData.type == "end")
            session.conversationData.processing[session.dialogData.type] += 1000*60*60*24-1000;
        if(session.conversationData.processing.end<session.conversationData.processing.start){
            session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
            session.replaceDialog('AskDate',session,dialogData.type);
        }
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
        session.beginDialog('AskDate',"start");
    },
    function(session){
        builder.Prompts.choice(session,"Are you applying the leave for one day or multiple days",["one day","multiple days"],{listStyle:3})
    },
    function(session,results,next){
        if(results.response.entity == "one day"){
            session.conversationData.processing.end = session.conversationData.processing.start + 1000*60*60*24-1000;
            next();
        } else if(results.response.entity == "multiple days"){
            session.beginDialog('AskDate',"end");
        }
    },
    function(session,args){
        console.log("start: " + new Date(session.conversationData.processing.start) + "end: " + new Date(session.conversationData.processing.end));
        session.endDialog();
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('CheckLeaveType',[
    function(session){
        session.dialogData.check = 0;
        for (var a in allLeaveType){
            if (session.conversationData.apply.leaveType == allLeaveType[a])
                session.dialogData.check = 1;
        };
        if (session.dialogData.check){
            console.log("Double checked the applying leave type is %s", session.conversationData.apply.leaveType);
        }else{
            session.send("Please check the leave type. You have entered %s <br\>which is not in SIT leave type", session.conversationData.apply.leaveType);
            session.replaceDialog('AskLeaveType',"all");
        };
        session.endDialog();
    }
]);
bot.dialog('AskSpecificType',[
    function(session){
        switch(session.conversationData.received.leaveType){
            case "medical leave" :{
                builder.Prompts.choice(session,"Please specify your medical leave, whether it is 'medical leave (unconditional)' or 'medical leave (conditional)'",["medical leave (unconditional)","medical leave (conditional)"],{listStyle:3});
                break;
            }
            case "ext maternity leave":{
                builder.Prompts.choice(session,"Please specify your ext maternity leave, whether it is 'fp-sc' or 'up-non sc'",["ext maternity(fp-sc)","ext maternity(up-non sc)"],{listStyle:3});
                break;
            }
            default:{
                session.conversationData.apply.leaveType = session.conversationData.received.leaveType;
                session.endDialog();
                break;
            }
        }
    },
    function(session,results){
        session.conversationData.apply.leaveType = results.response.entity;
        session.endDialog();
    }
]);
bot.dialog('CheckAttachment',[
    function(session,args, next){
        if (checkAttachment(session.conversationData.apply.leaveType)){
            session.beginDialog('AskAttachment');
        } 
        // else{
        //     var msg = "Attachment for applying "+ session.conversationData.apply.leaveType+ " is not really required.";
        //     session.send(msg);
        // };
        next();
    },
    function(session){
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
                };
        session.endDialog();
    }
]);
bot.dialog('CheckApplyInfo',[
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
bot.dialog('CorrectingInfo',[
    function(session,args){
        if (args && args == "date"){
            builder.Prompts.choice(session,"Please update your information",["leave start date","leave ending date","cancel request"],{listStyle:3});
        }
        else {
            builder.Prompts.choice(session,"Please specify the part your want to update",["leave starting date","leave ending date","leave type","attachment","cancel request"],{listStyle:3});
        }
    },
    function(session,results){
        switch (results.response.entity){
            case "leave starting date" :{
                session.beginDialog('AskDate',"start");
                break;
            }
            case "leave ending date" :{
                session.beginDialog('AskDate',"end");
                break;
            }
            case "leave type":{
                session.beginDialog('AskLeaveType',"all");
                break;
            }
            case "attachment":{
                session.beginDialog('AskAttachment');
                break;
            }
            case "cancel request" :{
                session.send("Request canceled");
                session.cancelDialog(0,'Help');
                break;
            }
            default: {
                session.endConversation();
                break;
            }
        };
    },
    function(session){
        session.replaceDialog("CheckApplyInfo");
    },
    function(session){
        session.endDialog();
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
function checkAttachment(type){
    var check = false;
    for (var a in needAttachmentType){
        if (type == needAttachmentType[a])
        check = true;
    };
    return check;
};
function monConvert(m){
    switch (m){
        case 1 : {
            return "Jan";
            break;
        }
        case 2 : {
            return "Feb";
            break;
        }
        case 3 : {
            return "Mar";
            break;
        }
        case 4 : {
            return "Apr";
            break;
        }
        case 5 : {
            return "May";
            break;
        }
        case 6 : {
            return "Jun";
            break;
        }
        case 7 : {
            return "Jul";
            break;
        }
        case 8 : {
            return "Aug";
            break;
        }
        case 9 : {
            return "Sep";
            break;
        }
        case 10 : {
            return "Oct";
            break;
        }
        case 11 : {
            return "Nov";
            break;
        }
        case 12 : {
            return "Dec";
            break
        }
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