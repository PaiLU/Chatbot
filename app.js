"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var https = require('https');
var fs = require('fs');
var request = require('request-promise').defaults({ encoding: null });

const sitLeaveTypeData = JSON.parse(fs.readFileSync('./sitLeaveTypeData.json', 'utf8'));
const sitLeaveBot = JSON.parse(fs.readFileSync('./sitLeaveBot.json', 'utf8'));
const defaultArgs = { "intent": { "intent": "apply leave", "entities": [] } };
const datetimeV2Types = ["daterange", "date", "duration", "datetime", "datetimerange"];
var server = restify.createServer();
//leave type saving
var sitLeaveTypes = [];
var shortlistTypes = [];
var reqAttTypes = [];
var needSpecifyTypes = [];
//saving types to lists
for (var a in sitLeaveTypeData) {
    sitLeaveTypes.push(sitLeaveTypeData[a]["Leave Type"]);
    if (sitLeaveTypeData[a]["Shortlist"].toLowerCase() == "y") {
        shortlistTypes.push(sitLeaveTypeData[a]["Shortlist"]);
    };
    if (sitLeaveTypeData[a]["Require Attachment"].toLowerCase() == "y") {
        reqAttTypes.push(sitLeaveTypeData[a]["Leave Type"]);
    };
    if (sitLeaveTypeData[a]["LUIS Leave Type"].toLowerCase() != sitLeaveTypeData[a]["Leave Type"].toLowerCase()) {
        var add = true;
        for (var b in needSpecifyTypes) {
            if (sitLeaveTypeData[a]["LUIS Leave Type"] == needSpecifyTypes[b])
                add = false;
        };
        if (add) {
            needSpecifyTypes.push(sitLeaveTypeData[a]["LUIS Leave Type"]);
        }
    };
};

var connector = new builder.ChatConnector({
    // appId: process.env.MICROSOFT_APP_ID,
    // appPassword: process.env.MICROSOFT_APP_PASSWORD
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});
server.post('api/messages', connector.listen());

server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
})

var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector, function (session) {
    console.log("Name: " + session.message.user.name + "\n")
    session.cancelDialog(0, 'Help');
}).set('storage', inMemoryStorage);
var luisAppId = process.env.LuisAppId_LeaveBot;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';
var bingSpellCheckKey = process.env.BING_SPELL_CHECK_API_KEY;
var OCRKey = process.env.OCRKey;

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey + '&spellCheck=true&bing-spell-check-subscription-key=' + bingSpellCheckKey + '&verbose=true&timezoneOffset=0&q=';
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
bot.dialog('Help', [
    function (session) {
        builder.Prompts.choice(session, "This is a Leave Bot. You can use it to <br\>1. Apply leave<br\>2. Check your leave status<br\>3. Apply medical leave(c) by uploading MC form directly", ["apply leave", "check leave status", "upload mc form"], { listStyle: 3 });
    },
    function (session, results) {
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity.toLowerCase() == "apply leave") {
            session.cancelDialog(0, 'ApplyLeave', defaultArgs);
            session.endConversation();
        }
        else if (results.response.entity.toLowerCase() == "check leave status")
            session.cancelDialog(0, 'ReqStatus');
        else if (results.response.entity.toLowerCase() == "upload mc form")
            session.cancelDialog(0, 'OCR');
        else
            session.endConversation("Invalid input, conversation has ended");
    }
]).triggerAction({
    matches: /^help$|^main help$/i
});
bot.dialog('ReqStatus', [
    function (session, args, next) {
        session.conversationData.request = new Object();
        if (args) {
            console.log(JSON.stringify(args));
            session.beginDialog('ConvertingData', args);
            next();
        } else {
            builder.Prompts.choice(session, "Which balance are you looking for?", ["show all balances"].concat(shortlistTypes), { listStyle: 3 });
        };
    },
    function (session, results, next) {
        if (results.response) {
            console.log(results);
            // add patrameter
            if (results.response == "show all balances") {
                session.conversationData.request.leaveType = "all"
            } else {
                session.conversationData.request.leaveType = results.response.resolution;
                next();

            }
        } else {
            if (session.conversationData.received) {
            }
            next();
        }
    },
    function (session) {
        //fake API
        var options = {
            host: 'leavebot-sit-api.azurewebsites.net',
            port: 80,
            path: '/api/leave/' + "6",
            // path:'/api/leave/'+session.message.user.id,
            method: 'GET'
        };
        https.request(options, function (res) {
            res.setEncoding('utf8');
            res.on('data', function (data) {
                var received = JSON.parse(data);
                console.log(typeof (received) + " " + received);
                if (received == "entity not found") {
                    session.send("The API is not responding");
                } else {
                    session.endConversation("Name: %s<br\>Your remaining annual leaves: %s day(s)<br\>Your remaining sick leaves: %s day(s)<br\>Your current pending annual leave: %s day(s) <br\>Your current pending sick leave: %s day(s)", session.message.user.name, received.annualLeave || 0, received.sickLeave || 0, received.pending.annualLeave || 0, received.pending.sickLeave || 0);
                }
            });
        }).end();
    }
]).triggerAction({
    matches: ['reqStatus']
});
bot.dialog('OCR', [
    function (session, args) {
        builder.Prompts.attachment(session, "Please upload your attachment.");
    },
    function (session, results, next) {
        var msg = session.message;
        if (msg.attachments.length) {

            // Message with attachment, proceed to download it.
            // Skype & MS Teams attachment URLs are secured by a JwtToken, so we need to pass the token from our bot.
            var attachment = msg.attachments[0];
            var fileDownload = request(attachment.contentUrl);
            console.log(JSON.stringify(attachment))

            fileDownload.then(
                function (fileResponse) {
                    // Send reply with attachment type & size
                    // var reply = new builder.Message(session)
                    //     .text('Attachment of %s type and size of %s bytes received.', attachment.contentType, fileResponse.length);
                    // session.send(reply);

                    // https calls
                    var ocrResponseStr = '';
                    var LUISResString = '';
                    var req = https.request(
                        {
                            host: 'southeastasia.api.cognitive.microsoft.com',
                            path: '/vision/v1.0/ocr?language=en&detectOrientation=true',
                            method: 'POST',
                            headers: {
                                'host': 'southeastasia.api.cognitive.microsoft.com',
                                'Ocp-Apim-Subscription-Key': process.env.OCRKey,
                                "Content-Type": 'application/octet-stream'
                            }
                        }, function (res) {
                            res.setEncoding('utf8');
                            if (res.statusCode === 200) {
                                res.on('data', function (data) {
                                    ocrResponseStr += data;
                                });
                                res.on('end', (err) => {
                                    var ocrResponseObj = JSON.parse(ocrResponseStr);
                                    var ocrStr = parseOcrObject(ocrResponseObj);
                                    console.log(ocrStr.length);
                                    // send Text to LUIS (TBC)
                                    // var luisLengthLimit = 500;
                                    // if (ocrStr.length >=luisLengthLimit)
                                    //     ocrStr = ocrStr.slice(0,luisLengthLimit);
                                    var allIntents = [];
                                    var allEntities = [];
                                    var count = 0;
                                    for (var a in ocrStr) {
                                        (function (num) {
                                            setTimeout(function () {
                                                console.log(num);
                                                builder.LuisRecognizer.recognize(ocrStr[num].toString(), LuisModelUrl, function (err, intents, entities) {
                                                    if (err) {
                                                        console.log(err);
                                                    }
                                                    allIntents.push(...(intents.filter(i => i.score > 0.6 && i.intent !== "None")));
                                                    allEntities.push(...entities);
                                                    count++;
                                                    if (count === ocrStr.length) {
                                                        if (allEntities) {
                                                            var entity = builder.EntityRecognizer.findEntity(allEntities, "leaveType");
                                                            if (entity && entityExtract(entity) == "medical leave") {
                                                                session.dialogData.ocrArgs = { "intent": { "intent": "apply leave", "entities": [...allEntities] } };
                                                                session.cancelDialog(0, 'ApplyLeave', session.dialogData.ocrArgs);
                                                            } else {
                                                                builder.Prompts.confirm(session, "I didn't recognize any key words, like medical certificate, in the attachment. Do you still want to proceed the applciation with this attachment?", { listStyle: 3 })
                                                            };
                                                        } else {
                                                            builder.Prompts.confirm(session, "I didn't recognize any key words, like medical certificate, in the attachment. Do you still want to proceed the applciation with this attachment?", { listStyle: 3 })
                                                        }
                                                    }
                                                });
                                            }, 80 * (a + 1));
                                        })(a);
                                    }
                                    session.send("Please wait for few seconds for the Bot to work on your attachment");
                                })
                            }
                        }
                    );
                    req.write(fileResponse);
                    req.end();

                    // // echo back uploaded image as base64 string
                    // var imageBase64Sting = new Buffer(fileResponse, 'binary').toString('base64');
                    // var echoImage = new builder.Message(session).text('You sent: ').addAttachment({
                    //     contentType: attachment.contentType,
                    //     contentUrl: 'data:' + attachment.contentType + ';base64,' + imageBase64Sting,
                    //     name: 'Uploaded image'
                    // });
                    // session.send(echoImage);
                }).catch(function (err) {
                    console.log('Error downloading attachment:', { statusCode: err.statusCode, message: err.response.statusMessage });
                });
        } else {
            // No attachments were sent
            var reply = new builder.Message(session)
                .text('Please try again sending an attachment.');
            session.cancelDialog(0, 'Help');
        }
    }, function (session, results, next) {
        if (results.response) {
            session.cancelDialog(0, 'ApplyLeave', defaultArgs);
        } else {
            session.cancelDialog(0, 'Help')
        };
    }
])

bot.dialog('ApplyLeave', [
    function (session, args) {
        console.log(JSON.stringify(args));
        session.beginDialog('ConvertingData', args);
        session.conversationData.apply = new Object;
        var now = new Date();
        session.conversationData.processing.dateInfo.now = Date.parse(now);
        session.conversationData.offset = now.getTimezoneOffset() * 60 * 1000;
        console.log("offset is " + session.conversationData.offset / 60 / 60 / 1000 + " hours");
    },
    function (session, results, next) {
        if (session.conversationData.received.leaveType) {
            session.beginDialog('AskSpecificType');
        }
        else {
            session.beginDialog('AskLeaveType', "selected");
        }
    },
    function (session) {
        if (session.conversationData.received.dateInfo.daterange) {
            session.beginDialog('Daterange');
        } else if (session.conversationData.received.dateInfo.date && session.conversationData.received.dateInfo.duration) {
            session.beginDialog('DateAndDuration');
        } else if (session.conversationData.received.dateInfo.date) {
            session.beginDialog('Date');
        } else if (session.conversationData.received.dateInfo.duration) {
            session.beginDialog('Duration');
        } else {
            session.beginDialog('NoDateInfo');
        }
    },
    function (session) {
        session.beginDialog('CheckLeaveType', session.conversationData.received.leaveType);
    },
    function (session) {
        session.beginDialog('CheckAttachment');
    },
    function (session) {
        session.beginDialog('CheckApplyInfo');
    },
    function (session) {
        session.beginDialog('ApplyConfirmed');
    }
]).triggerAction({
    matches: ['apply leave']
});
bot.dialog('ConvertingData', [
    function (session, args, next) {
        session.conversationData.received = new Object();
        session.conversationData.processing = new Object();
        session.conversationData.received.dateInfo = new Object();
        session.conversationData.received.leaveType = entityExtract(builder.EntityRecognizer.findEntity(args.intent.entities || {}, "leaveType"));
        session.conversationData.received.startDayType = findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities, 'startDay', 'dayType');
        session.conversationData.received.endDayType = findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities, 'endDay', 'dayType');

        // session.conversationData.received.dateInfo.startDate = findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities, 'startDay', 'builtin.datetimeV2.date');
        // session.conversationData.received.dateInfo.endDate = findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities, 'endDay', 'builtin.datetimeV2.date');
        // session.conversationData.processing.dateInfo.start = dateExtract(session.conversationData.received.dateInfo.startDate);
        // session.conversationData.processing.dateInfo.end = dateExtract(session.conversationData.received.dateInfo.endDate)
        var a = new Object();
        for (var o in datetimeV2Types) {
            a[datetimeV2Types[o]] = builder.EntityRecognizer.findEntity(args.intent.entities || {}, 'builtin.datetimeV2.' + datetimeV2Types[o]);
        };
        session.conversationData.processing.dateInfo = dateExtract(a);
        console.log("start: " + new Date(session.conversationData.processing.dateInfo.start) + "end: " + new Date(session.conversationData.processing.dateInfo.end));
        session.endDialog();
    }
]);
bot.dialog('AskLeaveType', [
    function (session, args, next) {
        console.log(args);
        if (args != "all") {
            builder.Prompts.choice(session, "Please specify your leave type.", sitLeaveTypes.slice(0, 3).concat("show all leave types"), { listStyle: 3 });
        } else {
            builder.Prompts.choice(session, "Please specify your leave type.", sitLeaveTypes, { listStyle: 3 });
        }
    },
    function (session, results) {
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity == "show all leave types")
            session.replaceDialog('AskLeaveType', "all")
        else {
            session.conversationData.apply.leaveType = results.response.entity;
            session.endDialog();
        }
    },
    function (session, results) {
        session.conversationData.apply.leaveType = results.response.entity;
        session.endDialog();
    },
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('AskDate', [
    function (session, args) {
        session.dialogData.type = args;
        builder.Prompts.time(session, "Please enter a leave " + session.dialogData.type + " date");
    },
    function (session, results) {
        console.log("Entered date: %s", JSON.stringify(results.response));
        session.dialogData.test = results.response.resolution.start;
        session.dialogData.test.setHours(0, 0, 0, 0);
        session.conversationData.processing.dateInfo[session.dialogData.type] = Date.parse(session.dialogData.test);
        if (session.dialogData.type == "end")
            session.conversationData.processing.dateInfo[session.dialogData.type] += 1000 * 60 * 60 * 24 - 1000;
        if (session.conversationData.processing.dateInfo.end < session.conversationData.processing.dateInfo.start) {
            session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
            session.replaceDialog('AskDate', session, dialogData.type);
        }
        session.endDialog();
    }
]);
bot.dialog('Daterange', [
    function (session) {
        console.log("start: " + new Date(session.conversationData.processing.dateInfo.start) + "end: " + new Date(session.conversationData.processing.dateInfo.end));
        session.endDialog();
    }
]);
bot.dialog('DateAndDuration', [
    function (session) {
        session.conversationData.processing.dateInfo.start = session.conversationData.processing.dateInfo.date + session.conversationData.offset
        session.conversationData.processing.dateInfo.end = session.conversationData.processing.dateInfo.start + session.conversationData.processing.dateInfo.duration - 1000;
        console.log("start: " + new Date(session.conversationData.processing.dateInfo.start) + "end: " + new Date(session.conversationData.processing.dateInfo.end));
        session.endDialog();
    }
]);
bot.dialog('Date', [
    function (session) {
        session.conversationData.processing.dateInfo.start = session.conversationData.processing.dateInfo.date + session.conversationData.offset;
        session.conversationData.processing.dateInfo.end = session.conversationData.processing.dateInfo.start + 1000 * 60 * 60 * 24 - 1000;
        console.log("start: " + new Date(session.conversationData.processing.dateInfo.start) + "end: " + new Date(session.conversationData.processing.dateInfo.end));
        session.endDialog();
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('Duration', [
    function (session) {
        session.send('You are applying a leave for %s days.', session.conversationData.processing.dateInfo.duration / 86400000);
        session.beginDialog('AskDate', "start");
    },
    function (session) {
        session.conversationData.processing.dateInfo.end = session.conversationData.processing.dateInfo.start + session.conversationData.processing.dateInfo.duration - 1000;
        console.log("start: " + new Date(session.conversationData.processing.dateInfo.start) + "end: " + new Date(session.conversationData.processing.dateInfo.end));
        session.endDialog()
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('NoDateInfo', [
    function (session) {
        session.beginDialog('AskDate', "start");
    },
    function (session) {
        builder.Prompts.choice(session, "Are you applying the leave for one day or multiple days", ["one day", "multiple days"], { listStyle: 3 })
    },
    function (session, results, next) {
        if (results.response.entity == "one day") {
            session.conversationData.processing.dateInfo.end = session.conversationData.processing.dateInfo.start + 1000 * 60 * 60 * 24 - 1000;
            next();
        } else if (results.response.entity == "multiple days") {
            session.beginDialog('AskDate', "end");
        }
    },
    function (session, args) {
        console.log("start: " + new Date(session.conversationData.processing.dateInfo.start) + "end: " + new Date(session.conversationData.processing.dateInfo.end));
        session.endDialog();
    }
]).cancelAction({
    matches: /^cancel$|^abort$/i,
    confirmPrompt: "This will cancel your current request. Are you sure?"
});
bot.dialog('CheckLeaveType', [
    function (session, args) {
        session.dialogData.check = false;
        for (var a in sitLeaveTypes) {
            if (args.toLowerCase() == sitLeaveTypes[a].toLowerCase()) {
                session.dialogData.check = true;
                session.conversationData.apply.leaveType = args.toLowerCase();;
                break;
            }
        };
        if (session.dialogData.check) {
            console.log("Checked the applying leave type is %s", args.toLowerCase());
            session.endDialogWithResult(args.toLowerCase());
        } else {
            session.send("Please check the leave type. You have entered %s <br\>which is not in SIT leave type", session.conversationData.leaveType);
            session.replaceDialog('AskLeaveType', "all");
        };
    }
]);
bot.dialog('AskSpecificType', [
    function (session) {
        switch (session.conversationData.received.leaveType) {
            case "medical leave": {
                builder.Prompts.choice(session, "Please specify your medical leave, whether it is " + leaveTypeDisplayConvert("'Medical Leave (UC)'") + " or " + leaveTypeDisplayConvert("'Medical Leave (C)'"), ["Medical Leave (UC)", "Medical Leave (C)"], { listStyle: 3 });
                break;
            }
            case "ext maternity leave": {
                builder.Prompts.choice(session, "Please specify your Ext Maternity Leave, whether it is 'FP-SC' or 'UP-Non SC'", ["Ext Maternity(FP-SC)", "Ext Maternity(UP-Non SC)"], { listStyle: 3 });
                break;
            }
            default: {
                session.conversationData.processing.leaveType = session.conversationData.received.leaveType;
                session.endDialog();
                break;
            }
        }
    },
    function (session, results) {
        session.conversationData.processing.leaveType = results.response.entity;
        session.endDialog();
    }
]);
bot.dialog('Attachments', [
    function (session, args, next) {
        session.beginDialog('ListAttachments')
    }
]);
bot.dialog('CheckAttachment', [
    function (session, args, next) {
        if (checkEntity(session.conversationData.apply.leaveType, reqAttTypes)) {

        }
        // else{
        //     var msg = "Attachment for applying "+ session.conversationData.apply.leaveType+ " is not really required.";
        //     session.send(msg);
        // };
        next();
    },
    function (session) {
        session.endDialog();
    }
]);
bot.dialog('AskAttachment', [
    function (session) {
        var askAttachment1 = new builder.Message(session)
            .text("Please upload a supporting attachment.");
        builder.Prompts.attachment(session, askAttachment1);
    },
    function (session, results) {
        var msg = session.message;
        if (msg.attachments.length) {
            var attachment = msg.attachments[0];
            var fileDownload = request(attachment.contentUrl);
            fileDownload.then(
                function (fileResponse) {
                    // Send reply with attachment type & size
                    var reply = new builder.Message(session)
                        .text('Attachment of %s type and size of %s bytes received.', attachment.contentType, fileResponse.length);
                    session.send(reply);
                    // https calls
                    var ocrResponseStr = '';
                    var req = https.request(
                        {
                            host: 'westcentralus.api.cognitive.microsoft.com',
                            path: '/vision/v1.0/ocr?language=en&detectOrientation=true',
                            method: 'POST',
                            headers: {
                                'host': 'westcentralus.api.cognitive.microsoft.com',
                                'Ocp-Apim-Subscription-Key': OCRKey,
                                "Content-Type": 'application/octet-stream'
                            }
                        }, function (res) {
                            res.setEncoding('utf8');
                            if (res.statusCode === 200) {
                                res.on('data', function (data) {
                                    ocrResponseStr += data;
                                });
                                res.on('end', (err) => {
                                    var ocrResponseObj = JSON.parse(ocrResponseStr);
                                    var ocrStr = parseOcrObject(ocrResponseObj);
                                    session.send("Recognized from your attachment:<br \>" + ocrStr);
                                    // send Text to LUIS (TBC)
                                    // var reqLUIS = https.request(
                                    //     {
                                    //         host:luisAPIHostName,
                                    //         path:'/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey + '&spellCheck=true&bing-spell-check-subscription-key=' + bingSpellCheckKey + '&verbose=true&timezoneOffset=0&q='+ocrStr,
                                    //         method:'GET'
                                    //     }, (res)=>{
                                    //         res.setEncoding('utf8');
                                    //         var LUISResString = '';
                                    //         if(res.statusCode ===200){
                                    //             res.on('data',function(data){
                                    //                 LUISResString += data;
                                    //             });
                                    //             res.on('end',(err)=>{
                                    //                 var LUISResObj = JSON.parse(LUISResString);
                                    //                 console.log(LUISResObj);
                                    //             })
                                    //         }
                                    //     }
                                    // )
                                })
                            }
                        }
                    );
                    req.write(fileResponse);
                    req.end();
                    // convert to base64 string
                    var imageBase64Sting = new Buffer(fileResponse, 'binary').toString('base64');
                    session.conversationData.attachments.push({
                        contentType: attachment.contentType,
                        contentUrl: 'data:' + attachment.contentType + ';base64,' + imageBase64Sting,
                        name: 'Uploaded image'
                    });
                    session.send("The aattachment has been saved");
                    next();
                }).catch(function (err) {
                    console.log('Error downloading attachment:', { statusCode: err.statusCode, message: err.response.statusMessage });
                });
        } else {
            // No attachments were sent
            var reply = new builder.Message(session)
                .text('Please try again sending an attachment.');
            session.replaceDialog('Help');
        }
        var att = results.response[0];
        var contentType = /^image\//
        if (!!att.contentType.match(contentType)) {
            session.conversationData.apply.attachments =
                {
                    contentType: att.contentType,
                    contentUrl: att.contentUrl,
                    name: att.name
                };
            session.endDialog();
        } else {
            session.send("Sorry, any non-image type attachment is not acceptable")
            session.replaceDialog('AskAttachment')
        }
    }
]);
bot.dialog('CheckApplyInfo', [
    function (session) {
        session.conversationData.apply.start = new Date(session.conversationData.processing.dateInfo.start);
        session.conversationData.apply.end = new Date(session.conversationData.processing.dateInfo.end);
        session.conversationData.apply.startDate = session.conversationData.apply.start.getDate();
        session.conversationData.apply.startMon = session.conversationData.apply.start.getMonth() + 1;
        session.conversationData.apply.startYear = session.conversationData.apply.start.getFullYear();
        session.conversationData.apply.endDate = session.conversationData.apply.end.getDate();
        session.conversationData.apply.endMon = session.conversationData.apply.end.getMonth() + 1;
        session.conversationData.apply.endYear = session.conversationData.apply.end.getFullYear();
        session.send('Hi %s<br\>You are applying %s from %s-%s-%s to %s-%s-%s <br\>', session.message.user.name, leaveTypeDisplayConvert(session.conversationData.apply.leaveType), monConvert(session.conversationData.apply.startMon), session.conversationData.apply.startDate, session.conversationData.apply.startYear, monConvert(session.conversationData.apply.endMon), session.conversationData.apply.endDate, session.conversationData.apply.endYear);
        builder.Prompts.confirm(session, "Please confirm if your request information is correct", { listStyle: 3 });
    },
    function (session, results) {
        if (results.response)
            session.endDialog();
        else {
            session.replaceDialog('CorrectingInfo');
        }
    }
]);
bot.dialog('CorrectingInfo', [
    function (session, args) {
        if (args && args == "date") {
            builder.Prompts.choice(session, "Please update your information", ["leave start date", "leave ending date", "cancel request"], { listStyle: 3 });
        }
        else {
            builder.Prompts.choice(session, "Please specify the part your want to update", ["leave starting date", "leave ending date", "leave type", "attachment", "cancel request"], { listStyle: 3 });
        }
    },
    function (session, results) {
        switch (results.response.entity) {
            case "leave starting date": {
                session.beginDialog('AskDate', "start");
                break;
            }
            case "leave ending date": {
                session.beginDialog('AskDate', "end");
                break;
            }
            case "leave type": {
                session.beginDialog('AskLeaveType', "all");
                break;
            }
            case "attachment": {
                session.beginDialog('AskAttachment');
                break;
            }
            case "cancel request": {
                session.send("Request canceled");
                session.cancelDialog(0, 'Help');
                break;
            }
            default: {
                session.endConversation();
                break;
            }
        };
    },
    function (session) {
        session.replaceDialog("CheckApplyInfo");
    },
    function (session) {
        session.endDialog();
    }
])
bot.dialog('ApplyConfirmed', [
    function (session) {
        session.send('Hi %s<br\>You are applying %s from %s-%s-%s to %s-%s-%s <br\>The information has been sent to the server successfully.', session.message.user.name, leaveTypeDisplayConvert(session.conversationData.apply.leaveType), monConvert(session.conversationData.apply.startMon), session.conversationData.apply.startDate, session.conversationData.apply.startYear, monConvert(session.conversationData.apply.endMon), session.conversationData.apply.endDate, session.conversationData.apply.endYear);
        //get api url+
        session.endConversation();
    }
]);
bot.dialog('ListAttachments', [
    function (session, args, next) {
        if (session.conversationData.attachments) {
            var listAttachment1 = new builder.Message(session)
                .text("You have uploaded " + session.conversationData.attachments.length + "attachments");
            if (session.conversationData.attachments.length > 0) {
                session.send(listAttachment1);
                var listAttachment2 = new builder.Message(session)
                    .attachmentLayout("list")//or carousel
                    .attachments(session.conversationData.attachments);
                session.send(listAttachment2)
            }
        } else {
            var listAttachment3 = new builder.Message(session)
                .text("You have not uploaded any attchments yet")
        }
    }
]);
function entityExtract(receivedEntity) {
    var o = new Object();
    if (receivedEntity.resolution.values) {
        return receivedEntity.resolution.values[0]
    } else
        return null;
};
function dateExtract(receivedDateEntityList) {
    var o = new Object;
    for (var p in receivedDateEntityList) {
        if (receivedDateEntityList[p] && receivedDateEntityList[p].length > 0 && receivedDateEntityList[p].resolution.values.length > 0) {
            var i = receivedDateEntityList[p].resolution.values.length;
            switch (p) {
                case "daterange": {
                    o.start = Date.parse(receivedDateEntityList[p].resolution.values[i]["start"]);
                    o.end = Date.parse(receivedDateEntityList[p].resolution.values[i]["end"]);
                    break;
                };
                case "date": {
                    o.date = Date.parse(receivedDateEntityList[p].resolution.values[i].value);
                    break;
                };
                case "duration": {
                    o.duration = Number(receivedDateEntityList[p].resolution.values[i].value) * 1000
                    break;
                };
                case "datetime": {
                    break;
                };
                case "datetimerange": {
                    break;
                };
                default:
                    break;
            }
        }
    }
    // returned value is the millisecond
    return o;
};

function monConvert(m) {
    switch (m) {
        case 1: {
            return "Jan";
            break;
        }
        case 2: {
            return "Feb";
            break;
        }
        case 3: {
            return "Mar";
            break;
        }
        case 4: {
            return "Apr";
            break;
        }
        case 5: {
            return "May";
            break;
        }
        case 6: {
            return "Jun";
            break;
        }
        case 7: {
            return "Jul";
            break;
        }
        case 8: {
            return "Aug";
            break;
        }
        case 9: {
            return "Sep";
            break;
        }
        case 10: {
            return "Oct";
            break;
        }
        case 11: {
            return "Nov";
            break;
        }
        case 12: {
            return "Dec";
            break
        }
    }
};
function leaveTypeDisplayConvert(t) {
    return t.split('').map(function (value, index, array) {
        var temp = value.charCodeAt(0).toString(16).toUpperCase();
        return '&#x' + temp + ";";
        return value;
    }).join('');
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
var phraseList = [];
for (var a in sitLeaveBot.model_features) {
    phraseList.push({
        "name": sitLeaveBot.model_features[a].name,
        "words": sitLeaveBot.model_features[a].words.split(",")
    })
};
function checkLeaveType(entity, types, phraseList) {
    var combinedList = [];
    for (var a in types) {
        combinedList.name.push(types[a]);
        for (var b in phraseList) {
            if (types[a].toLowerCase() == phraseList[b].name.toLowerCase())
                combinedList.words.push()
        }
    }
    if (checkEntity(entity, combinedList))
        return null;
}
function checkEntity(entity, entityList) {
    var check = false;
    for (var a in entityList) {
        if (entity.toString().toLowerCase() == entityList[a].toString().toLowerCase()) {
            check = entityList[a].toString();
            break;
        }
    }
    return check;
};
function findCompositeEntities(compositeEntities, entities, parentType, childType) {
    var matched;
    // find entity word from compositeEntities
    if (compositeEntities.length != 0) {
        for (var a in compositeEntities) {
            if (compositeEntities[a].children && compositeEntities[a].children.length != 0) {
                for (var b in compositeEntities[a].children) {
                    if (parentType == compositeEntities[a].parentType && childType == compositeEntities[a].children[b].type) {
                        // find startIndex and endIndex from entities use parentType
                        if (entities.length != 0) {
                            for (var c in entities) {
                                if (entities[c].type == parentType && entities[c].entity == compositeEntities[a].value) {
                                    // match result from children type
                                    for (var d in entities) {
                                        if (entities[d].type == compositeEntities[a].children[b].type && entities[d].entity == entities[c].entity && entities[d].startIndex == entities[c].startIndex && entities[d].endIndex == entities[c].endIndex) {
                                            // save matched result
                                            matched = (entities[d]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return matched;
    } else
        return null;
}

function deleteAttachment(attachmentArray, n) {
    if (attachmentArray && attachmentArray > 0) {
        attachmentArray.splice(n, 1);
    }
    return attachmentArray;
}
function addAttachment(attachmentArray, attachmentItem) {
    return attachmentArray.push(attachmentItem);
}
function validateAttachmentType(attachment) {
    var fileTyptLimit = ["image/jpg", "image/jpeg", "image/png", "image/bmp", "image/gif", "image/tiff", "application/pdf"]
    for (var a in fileTypeLimit) {
        var check = false;
        if (attachment.contentType == fileTyptLimit)
            check = true;
        return check
    }
}
function validateAttachmentSize(attachment) {
    for (var a in fileTypeLimit) {
        var fileSizeLimit = 3 * 1024 * 1024
        var check = false;
        if (sizeOf(attachment.contentType) <= fileSizeLimit)
            check = true;
        return check
    }
}
function parseOcrObject(ocrObj) {
    var lines = [];
    for (var i = 0; i < ocrObj.regions.length; i++) {
        for (var j = 0; j < ocrObj.regions[i].lines.length; j++) {
            var cLine = ''
            for (var k = 0; k < ocrObj.regions[i].lines[j].words.length; k++) {
                cLine += " " + ocrObj.regions[i].lines[j].words[k].text;
            }
            lines.push(cLine);
        }
    }
    return lines;
}