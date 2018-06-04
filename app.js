"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var https = require('https');
var fs = require('fs');
var apiServices = require('./apiServices');
var request = require('request-promise').defaults({ encoding: null });
var azure = require('botbuilder-azure');

const sitLeaveApplicationData = JSON.parse(fs.readFileSync('./sitLeaveApplicationData.json', 'utf8'));
const sitLeaveQuotaData = JSON.parse(fs.readFileSync('./sitLeaveQuotaData.json', 'utf8'));
const sitLeaveBot = JSON.parse(fs.readFileSync('./sitLeaveBot.json', 'utf8'));
const defaultArgs = { "intent": { "intent": "apply leave", "entities": [], "compositeEntities": [] } };
const datetimeV2Types = ["daterange", "date", "duration", "datetime", "datetimerange"];
var server = restify.createServer();
//leave type saving
var sitLeaveApplicationTypes = [];
var shortlistTypes = [];
var reqAttTypes = [];
for (var a in sitLeaveApplicationData) {
    sitLeaveApplicationTypes.push(sitLeaveApplicationData[a]["Leave Type"]);
    if (sitLeaveApplicationData[a]["Shortlist"].toLowerCase() == "y") {
        shortlistTypes.push(sitLeaveApplicationData[a]["Leave Type"].toLowerCase());
    };
    if (sitLeaveApplicationData[a]["Require Attachment"].toLowerCase() == "y") {
        reqAttTypes.push(sitLeaveApplicationData[a]["Leave Type"].toLowerCase());
    };
};
var sitLeaveQuotaTypes = [];
var sitLeaveQuotaShortlistTypes = [];
for (var a in sitLeaveQuotaData) {
    sitLeaveQuotaTypes.push(sitLeaveQuotaData[a]["Leave Quota"]);
    if (sitLeaveQuotaData[a]["Shortlist"].toLowerCase() == "y") {
        sitLeaveQuotaShortlistTypes.push(sitLeaveQuotaData[a]["Leave Quota"].toLowerCase());
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

// Table storage
var tableName = "LeaveBotStorage"; // You define
var storageName = process.env["Table-Storage-Name"]; // Obtain from Azure Portal
var storageKey = process.env["Azure-Table-Key"]; // Obtain from Azure Portal
var azureTableClient = new azure.AzureTableClient(tableName, storageName, storageKey);
var tableStorage = new azure.AzureBotStorage({ gzipData: false }, azureTableClient);
// var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector, [
    function (session, args, next) {
        if (!session.conversationData.apiToken) {
            session.conversationData.apiToken = args;
        }
        next();
    },
    function (session, args, next) {
        session.beginDialog('Help');
    }
]).set('storage', tableStorage);
var luisAppId = process.env.LuisAppId_LeaveBot;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';
var bingSpellCheckKey = process.env.BING_SPELL_CHECK_API_KEY;
var OCRKey = process.env.OCRKey;


// const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey + '&spellCheck=true&bing-spell-check-subscription-key=' + bingSpellCheckKey + '&verbose=true&timezoneOffset=0&q=';
const LuisModelUrl = `https://${luisAPIHostName}/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAPIKey}&verbose=true&timezoneOffset=0&q=`;
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
// bot.recognizer(recognizer);

bot.on("event", function (event) {
    if (event.name === "apiToken") {
        bot.beginDialog(event.address, '/', event.text);
    }
});
// main program
bot.dialog('dialogApiToken', require('./dialogApiToken'));
bot.dialog('Help', [
    function (session) {
        session.conversationData.attachments = [];
        var msg = new builder.Message(session)
            .text("This is a Leave Bot. You can use it to")
            .attachmentLayout(builder.AttachmentLayout.list)
            .attachments([
                new builder.HeroCard(session)
                    // .text("1. Apply leave")
                    .buttons([
                        builder.CardAction.imBack(session, "apply leave", "apply leave"),
                        builder.CardAction.imBack(session, "check leave status", "check leave status"),
                        builder.CardAction.imBack(session, "apply medical leave(c) by uploading MC form directly", `apply medical leave(c) by uploading MC form directly`)
                    ])
            ])
        builder.Prompts.text(session, msg);
        // builder.Prompts.choice(session, "This is a Leave Bot. You can use it to <br\>1. Apply leave<br\>2. Check your leave status<br\>3. Apply " + leaveTypeDisplayConvert("medical leave(c)") + " by uploading MC form directly", ["apply leave", "check leave status", "upload mc form"], { listStyle: 3 });
    },
    function (session, results) {
        if (session.message.text) {
            switch (session.message.text) {
                case "apply leave": {
                    session.beginDialog('ApplyLeave', defaultArgs);
                    break;
                }
                case "check leave status": {
                    session.beginDialog('ReqStatus')
                    break;
                }
                case "apply medical leave(c) by uploading MC form directly": {
                    session.beginDialog('OCR')
                    break;
                }
                default: {
                    builder.LuisRecognizer.recognize(session.message.text, LuisModelUrl, function (err, intents, entities, compositeEntities) {
                        session.send(intents[0].intent);
                        switch (intents[0].intent) {
                            case 'apply leave': {
                                session.cancelDialog(0, 'ApplyLeave', { "intent": { "intent": "apply leave", "entities": [...entities] } });
                                break;
                            }
                            case 'reqStatus': {
                                session.beginDialog('ReqStatus');
                                break;
                            }
                            default: {
                                session.cancelDialog(0, 'Help');
                                break;
                            }
                        }
                    });
                }
            }
        }

        // console.log("chosen result: %s", JSON.stringify(results));
        // if (results.response.entity.toLowerCase() == "apply leave") {
        //     session.cancelDialog(0, 'ApplyLeave', defaultArgs);
        //     session.endConversation();
        // }
        // else if (results.response.entity.toLowerCase() == "check leave status")
        //     session.cancelDialog(0, 'ReqStatus');
        // else if (results.response.entity.toLowerCase() == "upload mc form")
        //     session.cancelDialog(0, 'OCR');
        // else
        //     session.endConversation("Invalid input, conversation has ended");
    },
    function (session) {
        session.endDialog("Ending Help Dialog");
    }
]).triggerAction({
    matches: /^help$|^main help$^cancel$/i
});
bot.dialog('ReqStatus', [
    function (session, args, next) {
        session.conversationData.request = new Object();
        if (args) {
            console.log(JSON.stringify(args));
            session.beginDialog('ConvertingData', args);
        }
        next();
    },
    function (session, args, next) {
        if (session.conversationData.received && session.conversationData.received.leaveType) {
            session.conversationData.request.leaveType = session.conversationData.received.leaveType;
            next();
        } else {

            builder.Prompts.choice(session, "Which balance are you looking for?", ["show all balances"].concat(sitLeaveQuotaShortlistTypes), { listStyle: 3 });
        }
    },
    function (session, results, next) {
        if (results.response) {
            // add patrameter
            if (results.response.entity == "show all balances") {
                session.conversationData.request.leaveType = "";
                next();
            } else {
                session.conversationData.request.leaveType = results.response.entity.toLowerCase();
                next();
            }
        } else {
            next();
        }
    },
    function (session) {
        console.log(`${matchLeaveQuotaCode(session.conversationData.request.leaveType)} type: ${typeof (matchLeaveQuotaCode(session.conversationData.request.leaveType))}`);

        // session.endConversation("The API is currently not responding");
        // API goes here
        try {
            // session.send(session.conversationData.apiToken ? session.conversationData.apiToken : "aaa");
            apiServices.checkLeaveBalance(matchLeaveQuotaCode(session.conversationData.request.leaveType), session.conversationData.apiToken)
                .then((response) => {
                    // session.send(JSON.stringify(response));
                    if (Array.isArray(response)) {
                        var messages = response.map((item) => { return `${item.LeaveQuotaDesc}: ${item.LeaveRemainder} day(s)` });
                        session.send(messages.join("\n"));
                        session.cancelDialog(0, '/');
                    } else if (response && response.Type === "E") {
                        session.send(`Error: ${response.Message}`);
                        session.cancelDialog(0, '/');
                    }
                });
        }
        catch (err) {
            session.send(err.message);
        }
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
            var attachment = msg.attachments[0];
            var fileDownload = request(attachment.contentUrl);
            fileDownload.then(
                function (fileResponse) {
                    // validate the attachment
                    if (validateAttachment(attachment, fileResponse.length)) {
                        // convert to base64 string and save
                        var imageBase64Sting = new Buffer(fileResponse, 'binary').toString('base64');
                        session.conversationData.attachments.push({
                            contentType: attachment.contentType,
                            contentUrl: 'data:' + attachment.contentType + ';base64,' + imageBase64Sting,
                            name: attachment.name
                        });
                        console.log(`The attachment has been saved`);
                        // https calls to OCR
                        var ocrResponseStr = '';
                        var LUISResString = '';
                        var req = https.request(
                            {
                                host: 'southeastasia.api.cognitive.microsoft.com',
                                path: '/vision/v2.0/ocr?language=en&detectOrientation=true',
                                method: 'POST',
                                headers: {
                                    'Ocp-Apim-Subscription-Key': process.env.OCRKey,
                                    'Content-Type': 'application/octet-stream'
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
                                                                    // call 'ApplyLeave' Dialog with all recognized entities
                                                                    session.dialogData.ocrArgs = { "intent": { "intent": "apply leave", "entities": [...allEntities] } };
                                                                    console.log(JSON.stringify(session.dialogData.ocrArgs));
                                                                    session.cancelDialog(0, 'ApplyLeave', session.dialogData.ocrArgs);
                                                                } else {
                                                                    builder.Prompts.confirm(session, "I didn't recognize any key words, like medical certificate, in the attachment. Do you still want to proceed the applciation with this attachment?", { listStyle: 3 })
                                                                };
                                                            } else {
                                                                builder.Prompts.confirm(session, "I didn't recognize any key words, like medical certificate, in the attachment. Do you still want to proceed the applciation with this attachment?", { listStyle: 3 })
                                                            }
                                                        }
                                                    });
                                                }, 200 * (a + 1));
                                            })(a);
                                        }
                                        session.send("Please wait for few seconds for the Bot to work on your attachment");
                                    })
                                }
                            }
                        );
                        req.write(new Buffer(fileResponse, 'binary'));
                        req.end();
                    } else {
                        session.send("The attachment should be image type or a PDF file within 3MB. Please try again.");
                        session.replaceDialog('AddAttachment');
                    }
                }).catch(function (err) {
                    console.log('Error downloading attachment:', JSON.stringify(err));
                    session.endConversation("Sorry an error occured during downloading attachment");
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
]);
bot.dialog('ApplyLeave', [
    function (session, args) {
        console.log(JSON.stringify(args));
        session.conversationData.apply = new Object;
        var now = new Date();
        session.conversationData.offset = now.getTimezoneOffset() * 60 * 1000;
        console.log("offset is " + session.conversationData.offset / 60 / 60 / 1000 + " hours");
        session.beginDialog('ConvertingData', args);
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
        // currerently using list Entity in LUIS, this step is a dupilicate checking
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
        console.log(JSON.stringify(args));
        session.conversationData.received = new Object();
        session.conversationData.processing = new Object();
        session.conversationData.received.dateInfo = new Object();
        session.conversationData.processing.dateInfo = new Object();
        session.conversationData.received.leaveType = entityExtract(builder.EntityRecognizer.findEntity(args.intent.entities || {}, "leaveType"));
        session.conversationData.received.startDayType = entityExtract(findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities || {}, 'startDay', 'dayType')) || "FD";
        session.conversationData.received.endDayType = entityExtract(findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities || {}, 'endDay', 'dayType')) || "FD";

        // session.conversationData.received.dateInfo.startDate = findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities, 'startDay', 'builtin.datetimeV2.date');
        // session.conversationData.received.dateInfo.endDate = findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities, 'endDay', 'builtin.datetimeV2.date');
        // session.conversationData.processing.dateInfo.start = dateExtract(session.conversationData.received.dateInfo.startDate);
        // session.conversationData.processing.dateInfo.end = dateExtract(session.conversationData.received.dateInfo.endDate)
        for (var o in datetimeV2Types) {
            session.conversationData.received.dateInfo[datetimeV2Types[o]] = builder.EntityRecognizer.findEntity(args.intent.entities || {}, 'builtin.datetimeV2.' + datetimeV2Types[o]);
        };
        session.conversationData.processing.dateInfo = dateExtract(session.conversationData.received.dateInfo);
        console.log(`received: ${JSON.stringify(session.conversationData.received)}`);
        console.log(`processing: ${JSON.stringify(session.conversationData.processing)}`);
        session.endDialog();
    }
]);
bot.dialog('AskLeaveType', [
    function (session, args, next) {
        console.log(args);
        if (args != "all") {
            builder.Prompts.choice(session, "Please specify your leave type.", sitLeaveApplicationTypes.slice(0, 3).concat("show all leave types"), { listStyle: 3 });
        } else {
            builder.Prompts.choice(session, "Please specify your leave type.", sitLeaveApplicationTypes, { listStyle: 3 });
        }
    },
    function (session, results) {
        console.log("chosen result: %s", JSON.stringify(results));
        if (results.response.entity.toLowerCase() == "show all leave types")
            session.replaceDialog('AskLeaveType', "all")
        else {
            session.conversationData.received.leaveType = results.response.entity.toLowerCase();
            session.endDialog();
        }
    },
    function (session, results) {
        session.conversationData.received.leaveType = results.response.entity;
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
bot.dialog('AskDateType', [
    function (session, args) {
        session.dialogData.type = args;
        builder.Prompts.choice(session, "Please enter your " + session.dialogData.type + " date type", ["AM", "PM", "FD"]);
    },
    function (session, results) {
        console.log("Entered date: %s", JSON.stringify(results.response.entity));
        if (session.dialogData.type == "start")
            session.conversationData.received.startDayType = results.response.entity.toLowerCase();
        else
            session.conversationData.received.endDayType = results.response.entity.toLowerCase();
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
        var check = false;
        for (var a in sitLeaveApplicationTypes) {
            if (args.toLowerCase() == sitLeaveApplicationTypes[a].toLowerCase()) {
                check = true;
                // session.conversationData.apply.leaveType = args.toLowerCase();
                break;
            }
        };
        if (check) {
            console.log("Checked the applying leave type is %s", args.toLowerCase());
            session.endDialog();
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
                builder.Prompts.choice(session, "Please specify your medical leave, whether it is " + leaveTypeDisplayConvert("'Medical Leave (UC)'") + " or " + leaveTypeDisplayConvert("'Medical Leave (C)'"), ["Medical Leave(UC)", "Medical Leave(C)"], { listStyle: 3 });
                break;
            }
            case "ext maternity leave": {
                builder.Prompts.choice(session, "Please specify your Ext Maternity Leave, whether it is 'FP-SC' or 'UP-Non SC'", ["Ext Maternity(FP-SC)", "Ext Maternity(UP-Non SC)"], { listStyle: 3 });
                break;
            }
            default: {
                session.endDialog();
                break;
            }
        }
    },
    function (session, results) {
        session.conversationData.received.leaveType = results.response.entity.toLowerCase();
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
        if (checkEntity(session.conversationData.received.leaveType, reqAttTypes) && !session.conversationData.attachments) {
            session.send(`An attachment for applying ${leaveTypeDisplayConvert(session.conversationData.received.leaveType)} is required`);
            session.beginDialog('AddAttachment');
        }
        next();
    },
    function (session) {
        session.endDialog();
    }
]);
bot.dialog('AddAttachment', [
    function (session) {
        var askAttachment1 = new builder.Message(session)
            .text("Please upload an attachment.");
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
                    if (validateAttachment(attachment.contentType, fileResponse.length)) {
                        // convert to base64 string and save
                        var imageBase64Sting = new Buffer(fileResponse, 'binary').toString('base64');
                        session.conversationData.attachments.push({
                            attachmentContent: imageBase64Sting,
                            attachmentName: attachment.name
                            // content:,
                            // thumbnailUrl:
                        });
                        console.log(`The attachment has been saved`);
                        session.endDialog();
                    } else {
                        session.send("The attachment should be image type or a PDF file within 3MB. Please try again.");
                        session.replaceDialog('AddAttachment');
                    }
                }).catch(function (err) {
                    console.log('Error downloading attachment:', JSON.stringify(err));
                    session.endConversation("Sorry an error occured during downloading attachment");
                });
        } else {
            // No attachments were sent
            var reply = new builder.Message(session)
                .text('Please try again sending an attachment.');
            session.replaceDialog('AddAttachment');
        }
    }
]);
bot.dialog('DeleteAttachment', [
    function (session, args, next) {
        builder.Prompts.choice(session, "which attachment do you want to delete?", session.conversationData.attachments, { listStyle: 3 });
    },
    function (session, results, next) {
        console.log(JSON.stringify(results.response));
        session.endConversation();
    }
])
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
        session.send(`Hi ${session.message.user.name}, you are applying ${leaveTypeDisplayConvert(session.conversationData.received.leaveType)} from ${monConvert(session.conversationData.apply.startMon)}-${session.conversationData.apply.startDate}-${session.conversationData.apply.startYear} ${session.conversationData.received.startDayType} to ${monConvert(session.conversationData.apply.endMon)}-${session.conversationData.apply.endDate}-${session.conversationData.apply.endYear} ${session.conversationData.received.endDayType}`);
        builder.Prompts.confirm(session, "Please confirm if your application information is correct", { listStyle: 3 });
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
        switch (args) {
            case "date": {
                builder.Prompts.choice(session, "Please update your information", ["leave start date", "start day type", "leave end date", "end day type", "cancel application"], { listStyle: 3 });
                break;
            }
            default: {
                builder.Prompts.choice(session, "Please specify the part your want to update", ["date information", "leave type", "attachments", "cancel application"], { listStyle: 3 });
                break;
            }
        }
    },
    function (session, results) {
        switch (results.response.entity) {
            case "leave start date": {
                session.beginDialog('AskDate', "start");
                break;
            }
            case "start day type": {
                session.beginDialog('AskDateType', "start");
                break;
            }
            case "leave end date": {
                session.beginDialog('AskDate', "end");
                break;
            }
            case "end day type": {
                session.beginDialog('AskDateType', "end");
                break;
            }
            case "date information": {
                session.replaceDialog('CorrectingInfo', "date")
            }
            case "leave type": {
                session.beginDialog('AskLeaveType', "all");
                break;
            }
            case "attachments": {
                session.beginDialog('Attachments');
                break;
            }
            case "cancel application": {
                session.send("Request canceled");
                session.cancelDialog(0, '/');
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
    }
])
bot.dialog('ApplyConfirmed', [
    function (session) {
        var application = {
            "leaveType": matchLeaveApplicationCode(session.conversationData.received.leaveType),
            "startDate": `${session.conversationData.apply.startYear}-${session.conversationData.apply.startMon}-${session.conversationData.apply.startDate}`,
            "startType": session.conversationData.received.startDayType,
            "endDate": `${session.conversationData.apply.endYear}-${session.conversationData.apply.endMon}-${session.conversationData.apply.endDate}`,
            // "endType": "XX", //"FD"||"AM"||"PM"
            "notes": [ //if have, or otherwise it is an empty array
                // {
                //     "text": ""
                // }
            ],
            "attachments": session.conversationData.attachments,
            "confirmation": "N"
        }
        try {
            apiServices.applyLeave(application, session.conversationData.apiToken)
                .then((response) => {
                    try {
                        if (response.Et01messages) {
                            var messages = response.Et01messages.map((item) => {
                                switch (item.Type) {
                                    case "E":
                                        return "Error: " + item.Message;
                                    case "W":
                                        return "Warning: " + item.Message;
                                    case "S":
                                        return "Success:" + item.Message;
                                    default:
                                        return item.Message;
                                }
                            });
                            if (response.Et01messages[0].Type === "E") {
                                session.send(messages.join("\n"));
                                session.cancelDialog(0, '/');
                            } else if (response.Et01messages[0].Type === "W") {
                                session.send(messages.join("\n"));
                                builder.Prompts.confirm(session, "Proceed with warning?", { listStyle: 3 });
                            } else if (response.Et01messages[0].Type === "S") {
                                session.send(messages.join("\n"));
                                session.cancelDialog(0, '/');
                            }
                        }
                    }
                    catch (err) {
                        session.send(err.message);
                    }
                })
        }
        catch (err) {
            session.send(err.message);
        }
    },
    function (session, results, next) {
        if (results.response) {
            var application = {
                "leaveType": matchLeaveApplicationCode(session.conversationData.received.leaveType),
                "startDate": `${session.conversationData.apply.startYear}-${session.conversationData.apply.startMon}-${session.conversationData.apply.startDate}`,
                "startType": session.conversationData.received.startDayType,
                "endDate": `${session.conversationData.apply.endYear}-${session.conversationData.apply.endMon}-${session.conversationData.apply.endDate}`,
                // "endType": "XX", //"FD"||"AM"||"PM"
                "notes": [ //if have, or otherwise it is an empty array
                    // {
                    //     "text": ""
                    // }
                ],
                "attachments": session.conversationData.attachments,
                "confirmation": "Y"
            }
            try {
                apiServices.applyLeave(application, session.conversationData.apiToken)
                    .then((response) => {
                        try {
                            if (response.Et01messages) {
                                if (response.Et01messages[0].Type === "E") {
                                    session.send(`Error: ${response.Et01messages[0].Message}`);
                                    session.cancelDialog(0, '/');
                                } else if (response.Et01messages[0].Type === "W") {
                                    session.send(`Warning: ${response.Et01messages[0].Message}`);
                                    builder.Prompts.confirm(session, "Proceed with warning?", { listStyle: 3 });
                                } else if (response.Et01messages[0].Type === "S") {
                                    session.send(`Success: ${response.Et01messages[0].Message}`);
                                    session.cancelDialog(0, '/');
                                }
                            }
                        }
                        catch (err) {
                            session.send(err.message);
                        }
                    })
            }
            catch (err) {
                session.send(err.message);
            }
        } else {
            session.send("The application is canceled");
            session.cancelDialog(0, '/');
        }
    }
]);
bot.dialog('ListAttachments', [
    function (session, args, next) {
        if (session.conversationData.attachments) {
            var listAttachment1 = new builder.Message(session)
                .text("You have uploaded " + session.conversationData.attachments.length + "attachment(s)")
                // session.send(listAttachment1);
                // var listAttachment2 = new builder.Message(session)
                .attachmentLayout("list")//or carousel
                .attachments(session.conversationData.attachments);
            session.send(listAttachment1);
        } else {
            var listAttachment3 = new builder.Message(session)
                .text("You have not uploaded any attchments yet");
            session.send(listAttachment3)
        }
        builder.Prompts.choice(session, "What do you want to do withh the attachment(s)?", ["add attachment", "delete an attachment", "proceed with current attachment", "cancel application"], { listStyle: 3 });
    },
    function (session, results, next) {
        switch (results.response.entity) {
            case "add attachment": {
                session.replaceDialog('AddAttachment');
                break;
            }
            case "delete an attachment": {
                session.replaceDialog('DeleteAttachment');
                break;
            }
            case "cancel application": {
                session.endConversation();
            }
            case "proceed with current attachment": {
                session.endDialog();
            }
        }
    }
]);
function entityExtract(receivedEntity) {
    var o = new Object();
    if (receivedEntity && receivedEntity.resolution.values) {
        return receivedEntity.resolution.values[0].toLowerCase();
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
function validateAttachment(attachmentEntity, attachmentSize) {
    var fileTypeLimit = ["image/jpg", "image/jpeg", "image/png", "image/bmp", "image/gif", "image/tiff", "application/pdf"];
    var fileSizeLimit = 3 * 1024 * 1024; // 3 Mega Bites
    var fileNameLimit = /\./;
    var check = false;
    attachmentEntity.name.match()
    for (var a in fileTypeLimit) {
        if (attachmentEntity.contentType == fileTypeLimit[a] && Number(attachmentSize) <= fileSizeLimit) {
            check = true;
            break;
        }
    }
    return check;
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
function matchLeaveQuotaCode(leaveType) {
    var code = "";
    for (var a in sitLeaveQuotaData) {
        if (sitLeaveQuotaData[a]["Leave Quota"].toLowerCase() == leaveType.toLowerCase()) {
            code = sitLeaveQuotaData[a]["Leave Quota Code"];
            break;
        }
    }
    return code;
}
function matchLeaveApplicationCode(leaveType) {
    var code = "";
    for (var a in sitLeaveApplicationData) {
        if (sitLeaveApplicationData[a]["Leave Type"].toLowerCase() == leaveType.toLowerCase()) {
            code = sitLeaveApplicationData[a]["Type Code"];
            break;
        }
    }
    return code;
}

/* 
conversationData.received : save all information from the first message
    => leaveType : should be lowercase string type.
    => dateInfo : currerntly is the entity Object, should be futher replaced by Date Object or the millisecond number value
    => starDateType & endDateType : currerently is the entity Object, should be futher replaced by string ("morning|afternoon|full day")
conversationData.attachment : save the attachment Object with base 64 string
    {
        contentType: attachment.contentType,
        contentUrl: 'data:' + attachment.contentType + ';base64,' + imageBase64Sting,
        name: attachment.name
    }
conversationData.processing : save the middle information during processing with the Data, should only be used when needed
conversationData.apply : used in leave application, save all "ready to send" information, should be used after user confirmation, should not be modified in middle
conversationData.request: used in leave quota request, save all "ready to send information"
*/