"use strict";
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var https = require('https');
var fs = require('fs');
var apiServices = require('./apiServices');
var request = require('request-promise').defaults({ encoding: null });
var azure = require('botbuilder-azure');
var moment = require('moment');

const sitLeaveApplicationData = JSON.parse(fs.readFileSync('./sitLeaveApplicationData.json', 'utf8'));
const sitLeaveQuotaData = JSON.parse(fs.readFileSync('./sitLeaveQuotaData.json', 'utf8'));
const sitLeaveBot = JSON.parse(fs.readFileSync('./sitLeaveBot.json', 'utf8'));
const defaultArgs = { "intent": { "entities": [], "compositeEntities": [] } };
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
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});
server.post('api/messages', connector.listen());

server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
})

// Table storage
// var tableName = "LeaveBotStorage"; // You define
// var storageName = process.env["Table-Storage-Name"]; // Obtain from Azure Portal
// var storageKey = process.env["Azure-Table-Key"]; // Obtain from Azure Portal
// var azureTableClient = new azure.AzureTableClient(tableName, storageName, storageKey);
// var tableStorage = new azure.AzureBotStorage({ gzipData: false }, azureTableClient);
var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector, [
    function (session, args, next) {
        // session.send(`Args: ${JSON.stringify(args)}`)
        if (args) {
            session.userData.apiToken = args;
        }
        if (!session.userData.apiToken)
            session.endConversation(`Bot service is currently unavailable`);
        else
            next();
    },
    function (session) {
        // session.send(`apiToken: ${JSON.stringify(session.userData.apiToken)}`);
        session.beginDialog('Help');
    }
]).set('storage', inMemoryStorage);
// ]).set('storage', tableStorage);
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

bot.on('error', function (err) {
    bot.beginDialog(err.address, 'Error', err);
})
bot.dialog('Error', function (session, args) {
    session.send(`${JSON.stringify(args)}`);
    session.endConversation();
})
// main program
bot.dialog('dialogApiToken', require('./dialogApiToken'));
bot.dialog('Help', [
    function (session) {
        session.privateConversationData.attachments = [];
        var msg = new builder.Message(session)
            .text("Hi, I am Leave Bot. \nYou can apply leave by typing \n* 'take annual leave today afternoon'\n* 'take child care leave on 11 Jun'\n> \nCheck leave balance with\n* 'check annual leave balance'\n> \nType 'cancel' anywhere to return to here\n \nYou may also do these step by step:")
            .attachmentLayout(builder.AttachmentLayout.list)
            .attachments([
                new builder.HeroCard(session)
                    // .text("1. Apply leave")
                    .buttons([
                        builder.CardAction.imBack(session, "apply leave", "apply leave"),
                        builder.CardAction.imBack(session, "check leave balance", "check leave balance"),
                        builder.CardAction.imBack(session, "upload MC form", `upload MC form`)
                    ])
            ])
        builder.Prompts.text(session, msg);
        // builder.Prompts.choice(session, "This is a Leave Bot. You can use it to <br\>1. Apply leave<br\>2. Check your leave status<br\>3. Apply " + leaveTypeDisplayConvert("medical leave(c)") + " by uploading MC form directly", ["apply leave", "check leave balance", "upload mc form"], { listStyle: 3 });
    },
    function (session, results) {
        if (session.message.text) {
            switch (session.message.text) {
                case "apply leave": {
                    session.cancelDialog(0, 'ApplyLeave', defaultArgs);
                    break;
                }
                case "check leave balance": {
                    session.cancelDialog(0, 'CheckLeaveBalance', defaultArgs);
                    break;
                }
                case "upload MC form": {
                    session.cancelDialog(0, 'OCR')
                    break;
                }
                default: {
                    builder.LuisRecognizer.recognize(session.message.text, LuisModelUrl, function (err, intents, entities, compositeEntities) {
                        switch (intents[0].intent) {
                            case 'ApplyLeave': {
                                session.cancelDialog(0, 'ApplyLeave', { "intent": { "intent": "ApplyLeave", "entities": [...entities] } });
                                break;
                            }
                            case 'CheckLeaveBalance': {
                                session.cancelDialog(0, 'CheckLeaveBalance', { "intent": { "intent": "CheckLeaveBalance", "entities": [...entities] } });
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
        } else
            session.cancelDialog(0, '/');
        // console.log("chosen result: %s", JSON.stringify(results));
        // if (results.response.entity.toLowerCase() == "apply leave") {
        //     session.cancelDialog(0, 'ApplyLeave', defaultArgs);
        //     session.endConversation();
        // }
        // else if (results.response.entity.toLowerCase() == "check leave balance")
        //     session.cancelDialog(0, 'CheckLeaveBalance');
        // else if (results.response.entity.toLowerCase() == "upload mc form")
        //     session.cancelDialog(0, 'OCR');
        // else
        //     session.endConversation("Invalid input, conversation has ended");
    }
]).triggerAction({
    matches: /^help$|^main help$|^cancel$/i,
    confirmPrompt: "This will cancel your current application. Do you want to proceed?"
});
bot.dialog('CheckLeaveBalance', [
    function (session, args, next) {
        session.privateConversationData.request = new Object();
        if (args) {
            console.log(JSON.stringify(args));
            session.beginDialog('ConvertingData', args);
        }
        next();
    },
    function (session, args, next) {
        if (session.privateConversationData.received && session.privateConversationData.received.leaveType) {
            session.privateConversationData.request.leaveType = session.privateConversationData.received.leaveType;
            next();
        } else {

            builder.Prompts.choice(session, "Which balance are you looking for?", sitLeaveQuotaShortlistTypes.concat(["show all balances"]), { listStyle: 3 });
        }
    },
    function (session, results, next) {
        if (results.response) {
            // add patrameter
            if (results.response.entity == "show all balances") {
                session.privateConversationData.request.leaveType = "";
                next();
            } else {
                session.privateConversationData.request.leaveType = results.response.entity.toLowerCase();
                next();
            }
        } else {
            next();
        }
    },
    function (session) {
        console.log(`${matchLeaveQuotaCode(session.privateConversationData.request.leaveType)} type: ${typeof (matchLeaveQuotaCode(session.privateConversationData.request.leaveType))}`);

        // session.endConversation("The API is currently not responding");
        // API goes here
        try {
            // session.send(session.userData.apiToken ? session.userData.apiToken : "aaa");
            apiServices.checkLeaveBalance(matchLeaveQuotaCode(session.privateConversationData.request.leaveType), session.userData.apiToken)
                .then((response) => {
                    // session.send(JSON.stringify(response));
                    if (Array.isArray(response)) {
                        var messages = response.map((item) => { return `${item.LeaveQuotaDesc}: ${item.LeaveRemainder} day(s)` }).join("\n");
                        session.send(messages);
                        session.cancelDialog(0, '/');
                    } else if (response && response.Type === "E") {
                        session.send(`Error: ${response.Message}`);
                        session.cancelDialog(0, '/');
                    } else {
                        session.send(JSON.stringify(response));
                        session.cancelDialog(0, '/');
                    }
                });
        }
        catch (err) {
            session.send(`err: ${JSON.stringify(err)}`);
        }
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
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
                    if (validateOCRAttachment(attachment, fileResponse.length)) {
                        // convert to base64 string and save
                        session.dialogData.imageBase64Sting = new Buffer(fileResponse, 'binary').toString('base64');
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
                                        for (var index in ocrStr) {
                                            var num = index;
                                            setTimeout(function (num) {
                                                builder.LuisRecognizer.recognize(ocrStr[num].toString(), LuisModelUrl, function (err, intents, entities) {
                                                    if (err) {
                                                        console.log(err);
                                                    }
                                                    allIntents.push(...(intents.filter(i => i.score > 0.6 && i.intent !== "None")));
                                                    allEntities.push(...entities);
                                                    count++;
                                                    console.log(count);
                                                    if (count === ocrStr.length) {
                                                        if (allEntities) {
                                                            var entity = builder.EntityRecognizer.findEntity(allEntities, "leaveType");
                                                            if (entity && entityExtract(entity) == "medical leave") {
                                                                // call 'ApplyLeave' Dialog with all recognized entities
                                                                // dont save the time type entity & leave type entity
                                                                var desiredEntities = []
                                                                allEntities.forEach((item) => {
                                                                    if (item.type.match(/^builtin/))
                                                                        desiredEntities.push(item);
                                                                })
                                                                session.dialogData.ocrArgs = {
                                                                    "intent": {
                                                                        "intent": "ApplyLeave", "entities": [{
                                                                            entity: 'medical certificate',
                                                                            type: 'leaveType',
                                                                            startIndex: 1,
                                                                            endIndex: 19,
                                                                            resolution: { values: ['medical leave(c)'] }
                                                                        }, ...desiredEntities]
                                                                    }
                                                                };
                                                                console.log(JSON.stringify(session.dialogData.ocrArgs));
                                                                session.privateConversationData.attachments.push({
                                                                    contentType: attachment.contentType,
                                                                    contentUrl: 'data:' + attachment.contentType + ';base64,' + session.dialogData.imageBase64Sting,
                                                                    name: attachment.name
                                                                });
                                                                session.cancelDialog(0, 'ApplyLeave', session.dialogData.ocrArgs);
                                                            } else {
                                                                builder.Prompts.confirm(session, "I didn't recognize any key words, like medical certificate, in the attachment. Do you still want to proceed the appliciation with this attachment?", { listStyle: 3 })
                                                            };
                                                        } else {
                                                            builder.Prompts.confirm(session, "I didn't recognize any key words, like medical certificate, in the attachment. Do you still want to proceed the appliciation with this attachment?", { listStyle: 3 })
                                                        }
                                                    }
                                                });
                                            }, 300 * index, num);
                                        }
                                        session.send("Please wait for a few seconds while I read through your attachment");
                                    })
                                } else {
                                    res.on('data', (data) => {
                                        ocrResponseStr += data;
                                    });
                                    res.on('end', (err) => {
                                        session.send(ocrResponseStr.message || `Input data is not a valid image`);
                                        session.cancelDialog(0, '/');
                                    })
                                }
                            }
                        );
                        req.write(new Buffer(fileResponse, 'binary'));
                        req.end();
                    } else {
                        session.send("The attachment for bot to recognize should be image type within 3MB. Please try again.");
                        session.cancelDialog(0, '/');
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
            session.privateConversationData.attachments.push({
                contentType: attachment.contentType,
                contentUrl: 'data:' + attachment.contentType + ';base64,' + session.dialogData.imageBase64Sting,
                name: attachment.name
            });
            session.cancelDialog(0, 'ApplyLeave', defaultArgs);
        } else {
            session.cancelDialog(0, 'Help')
        };
    }
]);
bot.dialog('ApplyLeave', [
    function (session, args) {
        console.log(JSON.stringify(args));
        var now = new Date();
        session.privateConversationData.offset = now.getTimezoneOffset() * 60 * 1000;
        session.send("offset is " + session.privateConversationData.offset / 60 / 60 / 1000 + " hours");
        session.beginDialog('ConvertingData', args);
    },
    function (session, results, next) {
        if (session.privateConversationData.received.leaveType) {
            session.beginDialog('AskSpecificType');
        }
        else {
            session.beginDialog('AskLeaveType', "selected");
        }
    },
    function (session) {
        session.privateConversationData.processing.dateInfo.start = new Object();
        session.privateConversationData.processing.dateInfo.end = new Object();
        if (session.privateConversationData.processing.dateInfo.dateTime.length >= 2) {
            session.beginDialog('Daterange')
        } else if (session.privateConversationData.processing.dateInfo.dateTime.length == 1 && session.privateConversationData.processing.dateInfo.duration.length > 0) {
            session.beginDialog('DateAndDuration');
        } else if (session.privateConversationData.processing.dateInfo.dateTime.length == 1) {
            session.beginDialog('Date');
        } else if (session.privateConversationData.processing.dateInfo.duration.length > 0) {
            session.beginDialog('Duration');
        } else {
            session.beginDialog('NoDateInfo');
        }
    },
    function (session) {
        console.log(session.privateConversationData.processing);
        console.log(session.privateConversationData.processing);
        // currerently using list Entity in LUIS, this step is a dupilicate checking
        session.beginDialog('CheckLeaveType', session.privateConversationData.received.leaveType);
    },
    function (session) {
        session.beginDialog('CheckAttachment');
    },
    function (session) {
        session.beginDialog('CheckApplyInfo');
    },
    function (session) {
        session.privateConversationData.apply = new Object();
        session.replaceDialog('ApplyConfirmed');
    }
]);
bot.dialog('ConvertingData', [
    function (session, args, next) {
        console.log(JSON.stringify(args));
        session.privateConversationData.received = new Object();
        session.privateConversationData.processing = new Object();
        session.privateConversationData.received.dateInfo = new Object();
        session.privateConversationData.processing.dateInfo = new Object();
        session.privateConversationData.received.leaveType = entityExtract(builder.EntityRecognizer.findEntity(args.intent.entities || {}, "leaveType"));
        // session.privateConversationData.received.startDayType = entityExtract(findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities || {}, 'startDay', 'dayType')) || "FD";
        // session.privateConversationData.received.endDayType = entityExtract(findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities || {}, 'endDay', 'dayType')) || "FD";

        const datetimeV2Types = ["daterange", "date", "duration", "datetime", "datetimerange"];
        for (var o in datetimeV2Types) {
            session.privateConversationData.received.dateInfo[datetimeV2Types[o]] = builder.EntityRecognizer.findAllEntities(args.intent.entities || {}, 'builtin.datetimeV2.' + datetimeV2Types[o]);
        };
        session.privateConversationData.processing.dateInfo = dateExtract(session.privateConversationData.received.dateInfo);
        console.log(`received: ${JSON.stringify(session.privateConversationData.received)}`);
        console.log(`processing: ${JSON.stringify(session.privateConversationData.processing)}`);
        session.endDialog();
    }
]);
bot.dialog('AskDate', [
    function (session, args) {
        session.dialogData.type = args;
        builder.Prompts.time(session, "Please enter a leave " + session.dialogData.type + " date");
    },
    function (session, results) {
        // session.send("Entered date: %s", moment(results.response.resolution.start).utcOffset());
        session.privateConversationData.processing.dateInfo[session.dialogData.type].value = moment(results.response.resolution.start).subtract(session.privateConversationData.offset, 'ms').set({ h: 0, m: 0, s: 0, ms: 0 });
        if (session.privateConversationData.processing.dateInfo.end.hasOwnProperty()) {
            if (moment(session.privateConversationData.processing.dateInfo.end.value).isBefore(session.privateConversationData.processing.dateInfo.start)) {
                session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
                session.replaceDialog('AskDate', session, dialogData.type);
            } else if (moment(session.privateConversationData.processing.dateInfo.end.value).isSame(session.privateConversationData.processing.dateInfo.start)) {
                if (session.privateConversationData.processing.dateInfo.end.type == "AM" && session.privateConversationData.processing.dateInfo.start.type == "PM") {
                    session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
                    session.replaceDialog('AskDate', session, dialogData.type);
                }
            }
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
        console.log("Entered type: %s", JSON.stringify(results.response.entity));
        session.privateConversationData.processing.dateInfo[session.dialogData.type].type = results.response.entity;
        if (session.privateConversationData.processing.dateInfo.end) {
            if (moment(session.privateConversationData.processing.dateInfo.end.value).isBefore(session.privateConversationData.processing.dateInfo.start.value)) {
                session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
                session.replaceDialog('AskDateType', session, dialogData.type);
            } else if (moment(session.privateConversationData.processing.dateInfo.end.value).isSame(session.privateConversationData.processing.dateInfo.start.value)) {
                if (session.privateConversationData.processing.dateInfo.end.type == "AM" && session.privateConversationData.processing.dateInfo.start.type == "PM") {
                    session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
                    session.replaceDialog('AskDateType', session, dialogData.type);
                }
            }
        }
        session.endDialog();
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });;
bot.dialog('Daterange', [
    function (session) {
        var min = new Array();
        var minEntity = new Array();
        session.privateConversationData.processing.dateInfo.dateTime.forEach((item) => {
            var diff = Math.abs(moment(item.value).diff(moment()))
            if (!min[0] || diff < min[0]) {
                min[1] = min[0];
                minEntity[1] = minEntity[0];
                min[0] = diff;
                minEntity[0] = item;
            } else if (!min[1] || diff < min[1]) {
                min[1] = diff;
                minEntity[1] = item;
            }
        })
        if (moment(minEntity[1].value).isBefore(moment(minEntity[0].value))) {
            var temp = minEntity[1];
            minEntity[1] = minEntity[0];
            minEntity[0] = temp;
        } else if (moment(minEntity[1].value).isSame(moment(minEntity[0].value)) && (minEntity[1].type === "AM" || minEntity[0].type === "PM")) {
            var temp = minEntity[1];
            minEntity[1] = minEntity[0];
            minEntity[0] = temp;
        }

        session.privateConversationData.processing.dateInfo.start = minEntity[0];
        session.privateConversationData.processing.dateInfo.end = minEntity[1];
        session.endDialog();
    }
]);
bot.dialog('DateAndDuration', [
    function (session) {
        session.privateConversationData.processing.dateInfo.start = session.privateConversationData.processing.dateInfo.dateTime[0];
        var durationDays = session.privateConversationData.processing.dateInfo.duration[0] / 1000 / 3600 / 24;
        if (session.privateConversationData.processing.dateInfo.start.type === "AM" || session.privateConversationData.processing.dateInfo.start.type === "FD") {
            session.privateConversationData.processing.dateInfo.end = {
                "value": moment(session.privateConversationData.processing.dateInfo.start.value).add(Math.ceil(durationDays - 1), 'days')
            }
            if (durationDays % 1 != 0)
                session.privateConversationData.processing.dateInfo.end.type = "AM";
            else
                session.privateConversationData.processing.dateInfo.end.type = "FD";
        } else {//"PM"
            session.privateConversationData.processing.dateInfo.end = {
                "value": moment(session.privateConversationData.processing.dateInfo.start.value).add(Math.floor(durationDays), 'days')
            }
            if (durationDays % 1 != 0) {
                session.privateConversationData.processing.dateInfo.end.type = durationDays <= 0.5 ? "PM" : "FD";
            } else
                session.privateConversationData.processing.dateInfo.end.type = "AM";
        }
        session.endDialog();
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });;
bot.dialog('Date', [
    function (session) {
        session.privateConversationData.processing.dateInfo.start = session.privateConversationData.processing.dateInfo.dateTime[0];
        session.privateConversationData.processing.dateInfo.end = session.privateConversationData.processing.dateInfo.dateTime[0];
        session.endDialog();
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });
bot.dialog('Duration', [
    function (session) {
        session.send('You are applying a leave for %s days.', session.privateConversationData.processing.dateInfo.duration[0] / 24 / 3600 / 1000);
        session.privateConversationData.processing.dateInfo.start = { "value": moment(), "type": "FD" };
        session.beginDialog('AskDate', "start");
    },
    function (session) {
        var durationDays = session.privateConversationData.processing.dateInfo.duration[0] / 1000 / 3600 / 24;
        if (session.privateConversationData.processing.dateInfo.start.type === "AM" || session.privateConversationData.processing.dateInfo.start.type === "FD") {
            session.privateConversationData.processing.dateInfo.end = {
                "value": moment(session.privateConversationData.processing.dateInfo.start.value).add(Math.ceil(durationDays - 1), 'days')
            }
            if (durationDays % 1)
                session.privateConversationData.processing.dateInfo.end.type = "AM";
            else
                session.privateConversationData.processing.dateInfo.end.type = "FD";
        } else {//"PM"
            session.privateConversationData.processing.dateInfo.end = {
                "value": moment(session.privateConversationData.processing.dateInfo.start.value).add(Math.floor(durationDays), 'days')
            }
            if (durationDays % 1)
                session.privateConversationData.processing.dateInfo.end.type = "FD";
            else
                session.privateConversationData.processing.dateInfo.end.type = "AM";
        }
        session.endDialog();
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });
bot.dialog('NoDateInfo', [
    function (session) {
        session.privateConversationData.processing.dateInfo.start = { "value": moment(), "type": "FD" };
        session.beginDialog('AskDate', "start");
    },
    function (session) {
        builder.Prompts.choice(session, "Are you applying the leave for one day or multiple days", ["one day", "multiple days"], { listStyle: 3 })
    },
    function (session, results, next) {
        session.privateConversationData.processing.dateInfo.end = { "value": moment(), "type": "FD" };
        if (results.response.entity == "one day") {
            session.privateConversationData.processing.dateInfo.end = session.privateConversationData.processing.dateInfo.start;
            next();
        } else if (results.response.entity == "multiple days") {
            session.beginDialog('AskDate', "end");
        }
    },
    function (session, args) {
        session.endDialog();
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });
bot.dialog('CheckLeaveType', [
    function (session, args) {
        var check = false;
        for (var a in sitLeaveApplicationTypes) {
            if (args.toLowerCase() == sitLeaveApplicationTypes[a].toLowerCase()) {
                check = true;
                break;
            }
        };
        if (check) {
            console.log("Checked the applying leave type is %s", args.toLowerCase());
            session.endDialog();
        } else {
            session.send("Please check the leave type. You have entered %s <br\>which is not in SIT leave type", session.privateConversationData.leaveType);
            session.replaceDialog('AskLeaveType', "all");
        };
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
            session.privateConversationData.received.leaveType = results.response.entity.toLowerCase();
            session.endDialog();
        }
    },
    function (session, results) {
        session.privateConversationData.received.leaveType = results.response.entity;
        session.endDialog();
    },
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });
bot.dialog('AskSpecificType', [
    function (session) {
        switch (session.privateConversationData.received.leaveType) {
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
        session.privateConversationData.received.leaveType = results.response.entity.toLowerCase();
        session.endDialog();
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });
bot.dialog('Attachments', [
    function (session, args, next) {
        session.beginDialog('ListAttachments')
    }
]);
bot.dialog('CheckAttachment', [
    function (session, args, next) {
        if (checkEntity(session.privateConversationData.received.leaveType, reqAttTypes) && session.privateConversationData.attachments.length == 0) {
            session.send(`An attachment for applying ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} is required`);
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
                function (fileResponse) {                    // validate the attachment
                    if (validateAttachment(attachment, fileResponse.length)) {
                        // convert to base64 string and save
                        session.dialogData.imageBase64Sting = new Buffer(fileResponse, 'binary').toString('base64');
                        session.privateConversationData.attachments.push({
                            contentType: attachment.contentType,
                            contentUrl: 'data:' + attachment.contentType + ';base64,' + session.dialogData.imageBase64Sting,
                            name: attachment.name
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
        builder.Prompts.choice(session, "which attachment do you want to delete?", session.privateConversationData.attachments, { listStyle: 3 });
    },
    function (session, results, next) {
        console.log(JSON.stringify(results.response));
        session.endConversation();
    }
])
bot.dialog('ListAttachments', [
    function (session, args, next) {
        if (session.privateConversationData.attachments) {
            var listAttachment1 = new builder.Message(session)
                .text("You have uploaded " + session.privateConversationData.attachments.length + "attachment(s)")
                // session.send(listAttachment1);
                // var listAttachment2 = new builder.Message(session)
                .attachmentLayout("list")//or carousel
                .attachments(session.privateConversationData.attachments);
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
bot.dialog('CheckApplyInfo', [
    function (session) {
        session.send(`Hi ${session.message.user.name}, you are applying ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} from ${moment(session.privateConversationData.processing.dateInfo.start.value).format("DD-MMM-YYYY")} ${session.privateConversationData.processing.dateInfo.start.type} to ${moment(session.privateConversationData.processing.dateInfo.end.value).format("DD-MMM-YYYY")} ${session.privateConversationData.processing.dateInfo.end.type}`);
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
                builder.Prompts.choice(session, "Please specify the part your want to update", ["date information", "leave type", "add attachments", "cancel application"], { listStyle: 3 });
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
                break;
            }
            case "leave type": {
                session.beginDialog('AskLeaveType', "all");
                break;
            }
            case "add attachments": {
                session.beginDialog('AddAttachments');
                break;
            }
            // case "cancel application": {
            //     session.cancelDialog(0, '/');
            //     break;
            // }
            default: {
                session.send("Request cancelled").cancelDialog(0, '/');
                break;
            }
        };
    },
    function (session) {
        session.beginDialog("CheckAttachment");
    },
    function (session) {
        session.replaceDialog("CheckApplyInfo");
    }
])
    .cancelAction({
        matches: /^cancel$|^abort$/i,
        confirmPrompt: "This will cancel your current request. Are you sure?"
    });
bot.dialog('ApplyConfirmed', [
    function (session, args) {
        var attachments = [];
        var startDate = moment(session.privateConversationData.processing.dateInfo.start.value)
        var endDate = moment(session.privateConversationData.processing.dateInfo.end.value)
        var startType = session.privateConversationData.processing.dateInfo.start.type
        var endType = session.privateConversationData.processing.dateInfo.end.type
        session.privateConversationData.applications = [];

        if (session.privateConversationData.attachments.length > 0) {
            attachments = session.privateConversationData.attachments.map((item) => {
                return {
                    FileName: item.name,
                    Contents: item.contentUrl.split(";")[1].split(",")[1]
                };
            });
        }
        if (startType === "FD" | "AM" && endType === "FD" | "PM") {
            session.privateConversationData.applications.push({
                "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                "startDate": startDate.format('YYYY[-]M[-]D'),
                "endDate": endDate.format('YYYY[-]M[-]D'),
                "dayType": "FD",
                "notes": "",
                "attachments": attachments,
                "confirmation": ""
            })
        } else {
            if (startDate.isSame(endDate, 'days')) {
                session.privateConversationData.applications.push({
                    "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                    "startDate": startDate.format('YYYY[-]M[-]D'),
                    "endDate": endDate.format('YYYY[-]M[-]D'),
                    "dayType": startType,
                    "notes": "",
                    "attachments": attachments,
                    "confirmation": ""
                })
            } else {
                if (startType === "AM" | "FD" && endType === "AM") {
                    session.privateConversationData.applications = [{
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": startDate.format('YYYY[-]M[-]D'),
                        "endDate": moment(endDate).subtract(1, 'day').format('YYYY[-]M[-]D'),
                        "dayType": "FD",
                        "notes": "",
                        "attachments": attachments,
                        "confirmation": ""
                    },
                    {
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": endDate.format('YYYY[-]M[-]D'),
                        "endDate": endDate.format('YYYY[-]M[-]D'),
                        "dayType": "AM",
                        "notes": "",
                        "attachments": attachments,
                        "confirmation": ""
                    }];
                } else if (startType === "PM" && endType === "PM" | "FD") {
                    session.privateConversationData.applications = [{
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": startDate.format('YYYY[-]M[-]D'),
                        "endDate": startDate.format('YYYY[-]M[-]D'),
                        "dayType": "PM",
                        "notes": "",
                        "attachments": attachments,
                        "confirmation": ""
                    },
                    {
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": moment(startDate).add(1, 'day').format('YYYY[-]M[-]D'),
                        "endDate": endDate.format('YYYY[-]M[-]D'),
                        "dayType": "FD",
                        "notes": "",
                        "attachments": attachments,
                        "confirmation": ""
                    }];
                } else {
                    session.privateConversationData.applications = [{
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": startDate.format('YYYY[-]M[-]D'),
                        "endDate": startDate.format('YYYY[-]M[-]D'),
                        "dayType": "PM",
                        "notes": "",
                        "attachments": attachments,
                        "confirmation": ""
                    },
                    {
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": endDate.format('YYYY[-]M[-]D'),
                        "endDate": endDate.format('YYYY[-]M[-]D'),
                        "dayType": "AM",
                        "notes": "",
                        "attachments": attachments,
                        "confirmation": ""
                    }]
                    if (moment(startDate).add(1, 'd').isSameOrBefore(moment(endDate).subtract(1, 'd'))) {
                        session.privateConversationData.applications.splice(1, 0, {
                            "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                            "startDate": moment(startDate).add(1, 'd').format('YYYY[-]M[-]D'),
                            "endDate": moment(endDate).subtract(1, 'd').format('YYYY[-]M[-]D'),
                            "dayType": "FD",
                            "notes": "",
                            "attachments": attachments,
                            "confirmation": ""
                        })
                    }
                }
            }
        }
        session.replaceDialog('LeaveApplication', [0, ""]);
    }
]);
bot.dialog('LeaveApplication', [
    function (session, args, next) {
        session.dialogData.args = args
        try {
            session.privateConversationData.applications[args[0]].confirmation = args[1];
            apiServices.applyLeave(session.privateConversationData.applications[args[0]], session.userData.apiToken)
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
                                        return "Success: " + item.Message;
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
                                if (args[0] >= session.privateConversationData.applications.length - 1) {
                                session.send(messages.join("\n")); 
                                session.cancelDialog(0, '/');
                                } else {
                                    session.replaceDialog('LeaveApplication',[args[0]+1,""])
                                }
                            }
                        } else {
                            session.send(JSON.stringify(response));
                            // session.send(`Unexpected Error from API service`);
                            session.cancelDialog(0, '/');
                        }
                    }
                    catch (err) {
                        session.send(`Unexpected Error of submitting the application`);
                        session.cancelDialog(0, '/');
                    }
                })
        }
        catch (err) {
            session.send(`err: ${JSON.stringify(err)}`);
            session.cancelDialog(0, '/');
        }

    },
    function (session, results) {
        if (results.response) {
            session.replaceDialog('LeaveApplication', [session.dialogData.args[0], "Y"]);
        } else {
            session.send("The application is canceled");
            session.cancelDialog(0, '/');
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
    var o = {
        "dateTime": [],
        "duration": []
    };
    for (var p in receivedDateEntityList) {
        // each item is an IEntity[] list
        switch (p) {
            case "daterange": {
                //1. get nearest entity
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                //2. save as 2 seperatre entities
                var dateItem = nearestEntityList.map((item) => {
                    var x = moment(item.start);
                    var y = moment(item.end);
                    return [
                        {
                            "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "FD"
                        }, {
                            "value": y.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "FD"
                        }
                    ];
                })
                for (var a in dateItem)
                    o.dateTime.push(...dateItem[a]);
                break;
            };
            case "datetimerange": {
                //1. get nearest entity
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                var dateItem = nearestEntityList.map((item) => {
                    var x = moment(item.start);
                    var y = moment(item.end);
                    if (x.isSame(y, "day")) {
                        if (x.isSameOrAfter(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 })) && y.isSameOrAfter(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 }))) {
                            return [{
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "PM"
                            }]
                        } else if (x.isSameOrBefore(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 })) && y.isSameOrBefore(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 }))) {
                            return [{
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "AM"
                            }]
                        } else {
                            return [{
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "FD"
                            }]
                        }
                    } else {
                        return [correctDateType(item.start, "start"), correctDateType(item.end, "end")];
                    }
                })
                for (var a in dateItem)
                    o.dateTime.push(...dateItem[a]);
                //2. check
                //+ startDate == endDate save as 1 entity
                // - startTime & endTime <= 12PM => AM
                // - startTime & endTime >= 12PM => PM
                // - Else => FD
                //+ startDate != endDate save as 2 seperatre entities
                // - startTime < 12:00pm : FD; else PM
                // - endTime > 12:00PM : FD; else AM
                break;
            };
            case "date": {
                //1. get nearest entity
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                //2. save as an entity
                var dateItem = nearestEntityList.map((item) => {
                    return {
                        "value": moment(item.value).set({ h: 0, m: 0, s: 0, ms: 0 }),
                        "type": "FD"
                    };
                })
                o.dateTime.push(...dateItem);
                break;
            };
            case "datetime": {
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                //2. save as an entity
                var dateItem = nearestEntityList.map((item) => {
                    var x = moment(item.value)
                    if (x.isSameOrBefore(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                        return {
                            "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "AM"
                        }
                    } else {
                        return {
                            "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "PM"
                        }
                    }
                })
                o.dateTime.push(...dateItem);
                break;
            };
            case "duration": {
                o.duration.push(...receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        // save as millisecond number
                        return Number(item.resolution.values[0].value) * 1000;
                    }));
                break;
            };
            default:
                break;
        }
    }

    //check no duplicated item
    var q = {
        "dateTime": [],
        "duration": o.duration
    }
    o.dateTime.forEach((item) => {
        var check = true;
        for (var a in q.dateTime) {
            if (item.value == q.dateTime[a].value && item.type == q.dateTime[a].type)
                check = false;
        }
        if (check)
            q.dateTime.push(item)
    })
    return q;
    // {
    //     "dateTime": [{
    //         "value": "2018-06-07 12:00:00",
    //         "type": "FD"
    //     },{}...],
    //     "duration": [4320000, ... ]
    // }
};
function correctDateType(entity, startOrEnd) {
    var x = moment(entity.value);
    switch (startOrEnd) {
        case "start": {
            if (x.isBefore(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "FD"
                }
            } else {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "PM"
                }
            }
            break;
        };
        case "end": {
            if (x.isAfter(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "FD"
                }
            } else {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "AM"
                }
            }
            break;
        };
        default:
            break;
    }
}
function getNearestDateEntity(fromList) {
    var now = new Date();
    var minDiff = 0;
    var entity = new Object();
    for (var i in fromList) {
        if (minDiff == 0) {
            minDiff = Math.abs(new Date(fromList[i].value || fromList[i].start) - now);
            entity = fromList[i];
        } else {
            var diff = Math.abs(new Date(fromList[i].value || fromList[i].start) - now)
            if (diff < minDiff) {
                minDiff = diff;
                entity = fromList[i];
            }
        }
    }
    return entity || null;
}
function leaveTypeDisplayConvert(t) {
    return t.split('').map(function (value, index, array) {
        var temp = value.charCodeAt(0).toString(16).toUpperCase();
        return '&#x' + temp + ";";
        return value;
    }).join('');
};
function checkEntity(string, list) {
    var check = false;
    for (var a in list) {
        if (string.toString().toLowerCase() == list[a].toString().toLowerCase()) {
            check = list[a].toString();
            break;
        }
    }
    return check;
};
function deleteAttachment(attachmentArray, n) {
    if (attachmentArray && attachmentArray > 0) {
        attachmentArray.splice(n, 1);
    }
    return attachmentArray;
}
function validateAttachment(attachmentEntity, attachmentSize) {
    var fileTypeLimit = ["image/jpg", "image/jpeg", "image/png", "image/bmp", "image/gif", "image/tiff", "application/pdf"];
    var fileSizeLimit = 3 * 1024 * 1024; // 3 Mega Bites
    var fileNameLimit = /^[^\.]+\.[^\.]+$/;
    // var fileNameLimit = /^[^\.]+(\.[^\.]+)?$/; //match with no type suffix
    var check = false;
    for (var a in fileTypeLimit) {
        if (attachmentEntity.contentType == fileTypeLimit[a] && Number(attachmentSize) <= fileSizeLimit && attachmentEntity.name.match(fileNameLimit)) {
            check = true;
            break;
        }
    }
    return check;
}
function validateOCRAttachment(attachmentEntity, attachmentSize) {
    var fileTypeLimit = ["image/jpg", "image/jpeg", "image/png", "image/bmp", "image/gif"];
    var fileSizeLimit = 3 * 1024 * 1024; // 3 Mega Bites
    var fileNameLimit = /^[^\.]+\.[^\.]+$/;
    // var fileNameLimit = /^[^\.]+(\.[^\.]+)?$/; //match with no type suffix
    var check = false;
    for (var a in fileTypeLimit) {
        if (attachmentEntity.contentType == fileTypeLimit[a] && Number(attachmentSize) <= fileSizeLimit && attachmentEntity.name.match(fileNameLimit)) {
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
privateConversationData.received : save all information from the first message
    .leaveType : should be lowercase leave type description.
    .dateInfo : currerntly is the entity Object, should be futher replaced by Date Object or the millisecond number value
    .starDateType & endDateType : currerently is the entity Object, should be futher replaced by string ("AM|PM|FD")
privateConversationData.attachment : save the attachment Object with base 64 string
    [
        {
            contentType: attachment.contentType,
            contentUrl: 'data:' + attachment.contentType + ';base64,' + session.dialogData.imageBase64Sting,
            name: attachment.name
        }
    ]
privateConversationData.processing : save the middle information during processing with the Data, should only be used when needed

privateConversationData.apply : used in leave application, save all "ready to send" information, should be used after user confirmation, should not be modified in middle
privateConversationData.request: used in leave quota request, save all "ready to send information"
    .leaveType : should be lowercase leave type description.

dateExtract builtin.datetimeV2.
    daterange
        => save the nearest entity
        {
            "type": "daterange",
            "start": "2018-06-05",
            "end": "2018-06-06"
        }
    datetimerange
        => gets the nearest entity
        => extract(startDate, endDate, startTime, endTime)
            datetimerange
                if interval is small => 1 datetime / date
                if the interval is large => 2 datetime

                2 date / datetime
                1 date / datetime => duration?
            // if(startTime < 12pm) startDateType = am else pm;if (endTime <= 12pm) endDateType = am else pm
            // if(startDate == endDate && startDateType != endDateType) -> save the entity as {"dayType":"FD", "value":startDate}
    date
        => save the nearest entity
        {
            "type": "date",
            "value": Date("2018-07-08")
        }
    
    datetime
        => save the nearest
    duration
        => save the milisecond value
    timerange
        => N.A.
    time
        => N.A.
    set
        => N.A.
Date scenarios
    1. received (recognized from LUIS) Possible types, the types are checking in order: builtin.datetimeV2.
        daterange 
            => only one entity recognized ? Step 1 : Step 2
                Step 1
                    => save start and end date 
                    => done
                Step 2
                    => take the first one and do Step 1
        date
            => only one entity recognized? Step 1 : Step 2
                Step 1
                    => 
                Step 2
                    =>
        datetimerange
            => only one entity recognized? Step 1 : Step 2
        duration      => 
        timerange     => N.A. may proceed to ask date
        datetime      => N.A.
        time          => N.A.
        set           => N.A.
    2. futher inputed 
*/