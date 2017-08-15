require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
})
var connector = new builder.ChatConnector({
        appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
    //appId: process.env.MY_APP_ID,
    //appPassword: process.env.MY_APP_PASSWORD
});

// Listen for messages from users and Receive messages
server.post('/api/messages', connector.listen());

/*var bot = new builder.UniversalBot(connector, [
    function (session) {
        builder.Prompts.time(session, 'Hi! What is your time');},
    function (session, results) {
        var testtime = builder.EntityRecognizer.resolveTime([results.response]);
        var hello = 'hello';
        session.send('%s',testtime);
        session.beginDialog('testing',[testtime,hello]);
    },
    function(session,results){
        session.endDialog('Hello %s!', results.response);
    }
]);
bot.dialog('testing',[
    function(session,args){
        session.send('This is tesing dialog with input %s',args[0]);
        session.dialogData.profile = args[0];
        session.endDialogWithResult({response:session.dialogData.profile});
    }
]);*/

var bot = new builder.UniversalBot(connector, function(session){
    session.send('Hi, this is a leave apllication bot. Talk to me with your request or type \'help\' anytime if you need assistance');
})
// Connect to LUIS bot
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

// Set time object and get time zone offset
var d = new Date();
//var halfDayOffset = -12*60*60*1000;
var offset = d.getTimezoneOffset()*60*1000;
var d1 = Object() , d2 = Object();
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
            session.beginDialog();
            //既不是range 也不是 date, 要求重新输入
        }
    },
    function(session,conversationData){
        session.send('start date:%s,%s. <br/>end date:%s,%s.',conversationData.startDate,typeof(conversationData.startDate),conversationData.endDate,typeof(conversationData.endDate));
        //get api url
        
        session.endConversation();
    }
]).triggerAction({
    matches: 'applyLeave'
})
.beginDialogAction('helpApplyLeaveAction','helpApplyLeave',{
    matches: /^help$/i
});
bot.dialog('helpApplyLeave',function(session){
    session.endDialog('You can type sentences like \'I want to apply leave from 2 Aug to 5 Aug\' to apply for leaves. <br\>You can also type \'main help\' for more helps, but that will cancel your current request.');
});
bot.dialog('Range',[
    function(session,args,next){
        session.send('Range operating...');
        //先默认value[1]是对的，之后要改
        d1.obj = new Date(args.resolution.values[1]['start']);
        d1.d = Date.parse(d1.obj)+offset;
        d1.t = new Date(d.setTime(d1.d));
        d2.obj = new Date(args.resolution.values[1]['end']);
        d2.d = Date.parse(d2.obj)+offset;
        d2.t = new Date(d.setTime(d2.d));
        //session.dialogData.startDate = d1.t;
        //session.dialogData.endDate = d2.t;
        next();
    },
    function(session){
        session.endDialogWithResult(session.dialogData);
    }
]);
bot.dialog('DateAndDuration',[
    function(session,args,next){
        session.send('Date and duration operating...');
        const d1_obj = new Date(args[0].resolution.values[1]['value']);
        var d1 = Date.parse(d1_obj)+offset;
        var d1_t = new Date(d.setTime(d1));
        session.dialogData.startDate = d1_t;
        var d3 = Number(args[1].resolution.values[0].value)*1000;
        var d2_t = new Date(d.setTime(d1 + d3));
        session.dialogData.endDate = d2_t;
        next();
    },
    function(session){
        session.endDialogWithResult(session.dialogData);
    }
]);
bot.dialog('Date',[
    function(session,args){
        session.send('Date operating...');     
        var x = JSON.stringify(args);
        session.send('%s',x);
        d1.obj = new Date(args.resolution.values[1]['value']);
        d1.d = Date.parse(d1.obj) + offset;
        session.send('%s',typeof(d1.d));
        d1.t = new Date(d.setTime(d1.d));
        session.send('%s',d1.t);      
        builder.Prompts.time(session, 'When will you be back?');
    },
    function(session,args,next){
        d2.obj = new Date(args.response.resolution.start);
        d2.obj = dateAdd("h ",-6,d2.obj)
        /*d2.d = Date.parse(d2.obj)+halfDayOffset;
        session.send('%s',typeof(d2.d));
        d2.t = new Date(d.setTime(d2.d));
        session.send('%s',typeof(d2.t));*/
        d2.t = d2.obj;
        if (d2.t < d1.t){
            d2.t = dateAdd("y ",1,d2.t);
        }
        session.conversationData.startDate = d1.t;  
        session.conversationData.endDate = d2.t;        
        session.send('%s,%s',session.conversationData.startDate,typeof(session.conversationData.startDate));
        next();
    },
    function(session){
        session.endDialogWithResult(session.conversationData);
    }
]);
bot.dialog('AskForDate',[
    function(session,args,next){
        session.send('Duration operating...');
        session.dialogData.duration =  Number(args.resolution.values[0].value)/86400;
        next()
    },
    function(session){
        session.send('You will be on leave for %s days.', session.dialogData.duration);
        builder.Prompts.time(session,'When is your first day of leave?');
    },
    function(session,results){
        session.dialogData.startDate = new Date(result.response);
        var d1 = Date.parse(session.dialogData.startDate);
        d.setTime(d1);
        session.dialogData.startDate = d;
        d.setTime(d1 + Number(args[1].resolution.values[0].value)*1000);
        session.dialogData.endDate = d;
        session.endDialogWithResult(session.dialogData)
    }
]);
bot.dialog('requestLeaveStatus',[
    function(session,args,next){
        session.send("We are analyzing your request:\'%s\'",session.message.text);
        session.send
    }
])
.triggerAction({
    matches:'requestLeaveStatus'
})
.beginDialogAction('helpRequestLeaveStatusAction','helpRequestLeaveStatus',{
    matches:/^help$/i
});
bot.dialog('helpRequestLeaveStatus',function(session){
    session.endDialog('You can type sentences like \'Get my outstanding leave status\' to check your outstanding leave status.');
});
bot.dialog('help',[
    function(session){
        session.send('You can enter your requests like \'I want to take a leave from 2 Aug to 5 Aug\' to apply leave;<br>Or you can enter \'Get my outstanding leave status\' to check your outstanding leave status.');
        session.endDialog('Ending main help');
    }
]).triggerAction({matches: /^help$|^main help$/i,});
/*
bot.dialog('BookFlight', [
    function (session, args, next) {
        session.send('Welcome to the Flight Booking Engine! We are analyzing your message: \'%s\'', session.message.text);

        // try extracting entities
        var ToLocation = builder.EntityRecognizer.findEntity(args.intent.entities || {} , 'Location::ToLocation');
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

        var message = 'Looking for flights ';
        message += 'to %s...';
        session.endDialog(message, destination);
    }
    
]).triggerAction({
    matches: 'BookFlight'
});*/

server.get('/', restify.plugins.serveStatic({
 directory: __dirname,
 default: '/index.html'
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