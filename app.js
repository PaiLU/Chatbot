"use strict";
require('dotenv-extended').load();
var restify = require('restify');
const builder = require('botbuilder');

var server = restify.createServer();
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});
server.post('api/messages', connector.listen());
server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Table storage
// var azure = require('botbuilder-azure');
// var tableName = "LeaveBotStorage"; // You define
// var storageName = process.env["Table-Storage-Name"]; // Obtain from Azure Portal
// var storageKey = process.env["Azure-Table-Key"]; // Obtain from Azure Portal
// var azureTableClient = new azure.AzureTableClient(tableName, storageName, storageKey);
// var tableStorage = new azure.AzureBotStorage({ gzipData: false }, azureTableClient);
var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector)
    .set('storage', inMemoryStorage);
// .set('storage', tableStorage);
bot.on("event", function (event) {
    if (event.name === "apiToken") {
        bot.beginDialog(event.address, '/', event.text);
    }
});
bot.dialog('/', require('./dialogDefault'))
// main program
bot.dialog('dialogApiToken', require('./dialogApiToken'));
bot.dialog('Help', require('./dialogHelp')).triggerAction({
    matches: /^help$|^main help$|^cancel$/i
});
bot.dialog('LUIS',require('./dialogLUIS'));
bot.dialog('CheckLeaveBalance', require('./dialogCheckBalance'));
bot.dialog('OCR', require('./dialogOCR'));

bot.dialog('ConvertingData',require('./dialogConvertingData'));

bot.dialog('ApplyLeave', require('./dialogApplyLeave').main);
bot.dialog('LeaveApplication', require('./dialogApplyLeave').LeaveApplication);
bot.dialog('ApplyConfirmed', require('./dialogApplyLeave').ApplyConfirmed);
bot.dialog('CheckApplyInfo', require('./dialogApplyLeave').CheckApplyInfo);
// bot.dialog('ListAttachments', require('./dialogApplyLeave').ListAttachments);
bot.dialog('AddAttachment', require('./dialogApplyLeave').AddAttachment);
bot.dialog('CheckAttachment', require('./dialogApplyLeave').CheckAttachment);
bot.dialog('AskSpecificType', require('./dialogApplyLeave').AskSpecificType);
bot.dialog('AskLeaveType', require('./dialogApplyLeave').AskLeaveType);
bot.dialog('CheckLeaveType', require('./dialogApplyLeave').CheckLeaveType);
bot.dialog('AskDateType', require('./dialogApplyLeave').AskDateType);
bot.dialog('AskDate', require('./dialogApplyLeave').AskDate);
bot.dialog('NoDateInfo', require('./dialogApplyLeave').NoDateInfo);
bot.dialog('Duration', require('./dialogApplyLeave').Duration);
bot.dialog('Date', require('./dialogApplyLeave').Date);
bot.dialog('DateAndDuration', require('./dialogApplyLeave').DateAndDuration);
bot.dialog('Daterange', require('./dialogApplyLeave').Daterange);
bot.dialog('CorrectingInfo', require('./dialogApplyLeave').CorrectingInfo);
bot.dialog('AskRemark', require('./dialogApplyLeave').AskRemark);