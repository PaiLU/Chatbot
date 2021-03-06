"use strict"
var builder = require('botbuilder');
var fs = require('fs');
var moment = require('moment');
var request = require('request-promise').defaults({ encoding: null });
var checkEntity = require('./functionDefault').checkEntity;
var leaveTypeDisplayConvert = require('./functionDefault').leaveTypeDisplayConvert;
var apiServices = require('./apiServices');
var logger = require('./logger');

const sitLeaveApplicationData = JSON.parse(fs.readFileSync('./sitLeaveApplicationData.json', 'utf8'));
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
const sitLeaveQuotaData = JSON.parse(fs.readFileSync('./sitLeaveQuotaData.json', 'utf8'));
var sitLeaveQuotaTypes = [];
var sitLeaveQuotaShortlistTypes = [];
for (var a in sitLeaveQuotaData) {
    sitLeaveQuotaTypes.push(sitLeaveQuotaData[a]["Leave Quota"]);
    if (sitLeaveQuotaData[a]["Shortlist"].toLowerCase() == "y") {
        sitLeaveQuotaShortlistTypes.push(sitLeaveQuotaData[a]["Leave Quota"].toLowerCase());
    };
};
module.exports.Daterange = [
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
];
module.exports.DateAndDuration = [
    function (session) {
        session.privateConversationData.processing.dateInfo.start = session.privateConversationData.processing.dateInfo.dateTime[0];
        session.beginDialog('AddDuration', session.privateConversationData.processing.dateInfo.duration[0])
    },
    function (session) {
        session.endDialog();
    }
];
module.exports.Date = [
    function (session) {
        session.privateConversationData.processing.dateInfo.start = session.privateConversationData.processing.dateInfo.dateTime[0];
        session.privateConversationData.processing.dateInfo.end = session.privateConversationData.processing.dateInfo.dateTime[0];
            session.privateConversationData.processing.dateInfo.duration[0] = 1 * 24 * 60 * 60 * 1000;
        session.endDialog();
    }
];
module.exports.Duration = [
    function (session) {
        session.send('You are applying a leave for %s days.', session.privateConversationData.processing.dateInfo.duration[0] / 24 / 3600 / 1000);
        session.privateConversationData.processing.dateInfo.start = { "value": moment(), "type": "FD" };
        session.beginDialog('AskDate', "start");
    },
    function (session) {
        session.beginDialog('AddDuration', session.privateConversationData.processing.dateInfo.duration[0])
    },
    function (session) {
        session.endDialog();
    }
];
module.exports.AddDuration = [
    function (session, args) {
        var durationDays = args / 1000 / 3600 / 24;
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
]
module.exports.NoDateInfo = [
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
            session.privateConversationData.processing.dateInfo.duration[0] = 1 * 24 * 60 * 60 * 1000
            next();
        } else if (results.response.entity == "multiple days") {
            session.beginDialog('AskDate', "end");
        }
    },
    function (session, args) {
        session.endDialog();
    }
];
module.exports.AskDate = [
    function (session, args) {
        session.dialogData.type = args;
        session.privateConversationData.offset = moment().utcOffset()
        builder.Prompts.text(session, "Please enter a leave " + session.dialogData.type + " date in a format of dd-MMM-yyyy (e.g: 14-Jun-2018)");
    },
    function (session, results) {
        var ampm = /\bam|pm\b/;
        var matched = session.message.text.toLowerCase().match(ampm)
        var text = session.message.text.toLowerCase().split(matched).join((matched == 'am') ? 'morning' : 'afternoon')
        var recognized = builder.EntityRecognizer.recognizeTime(text);
        session.dialogData.recognizedType = "FD";
        if (session.message.text && recognized) {
            session.dialogData.recognizedUTC = moment(recognized.resolution.start).add(session.privateConversationData.offset, 'm');
            console.log(`${JSON.stringify(session.dialogData.recognizedUTC)}`);
            if (session.dialogData.recognizedUTC.isSame(moment(session.dialogData.recognizedUTC).set({ h: 12, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm'))) {
                session.dialogData.recognizedType = "FD";
            } else if (session.dialogData.recognizedUTC.isBefore(moment(session.dialogData.recognizedUTC).set({ h: 12, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm'))) {
                session.dialogData.recognizedType = "AM";
            } else {
                session.dialogData.recognizedType = "PM";
            }
            session.dialogData.recognizedUTC.set({ h: 0, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm');
            // switch (session.dialogData.type) {
            //     case "start": {
            //         if (session.privateConversationData.processing.dateInfo.duration[0]) {
            //             session.privateConversationData.processing.dateInfo.start.value = moment(recognized.resolution.start).add(session.privateConversationData.offset, 'm').set({ h: 0, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm');
            //             session.privateConversationData.processing.dateInfo.start.type = session.dialogData.recognizedType;
            //             session.beginDialog('AddDuration', session.privateConversationData.processing.dateInfo.duration[0]);
            //         }
            //         if (session.privateConversationData.processing.dateInfo.end.hasOwnProperty('value')) {
            //             if (moment(session.privateConversationData.processing.dateInfo.end.value).isBefore(moment(session.dialogData.recognizedUTC))) {
            //                 session.replaceDialog('AskDate', session.dialogData.type);
            //             };
            //             if (moment(session.privateConversationData.processing.dateInfo.end.value).isSame(moment(session.dialogData.recognizedUTC))) {
            //                 if ((session.privateConversationData.processing.dateInfo.end.type == "AM") && (session.dialogData.recognizedType == "PM"))
            //                     session.replaceDialog('AskDate', session.dialogData.type);
            //             };
            //         }
            //         session.privateConversationData.processing.dateInfo.start.value = moment(recognized.resolution.start).add(session.privateConversationData.offset, 'm').set({ h: 0, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm');
            //         session.privateConversationData.processing.dateInfo.start.type = session.dialogData.recognizedType;
            //         break;
            //     }
            //     default: {//"end"
            //         if (moment(session.dialogData.recognizedUTC).isBefore(moment(session.privateConversationData.processing.dateInfo.start.value))) {
            //             session.replaceDialog('AskDate', session.dialogData.type);
            //         };
            //         if (moment(session.dialogData.recognizedUTC).isSame(moment(session.privateConversationData.processing.dateInfo.start.value))) {
            //             if ((session.privateConversationData.processing.dateInfo.end.type == "AM") && (session.privateConversationData.processing.dateInfo.start.type == "PM"))
            //                 session.replaceDialog('AskDate', session.dialogData.type);
            //         };
            //         session.privateConversationData.processing.dateInfo.end.value = moment(recognized.resolution.start).add(session.privateConversationData.offset, 'm').set({ h: 0, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm');
            //         session.privateConversationData.processing.dateInfo.end.type = session.dialogData.recognizedType;
            //         break;
            //     }
            // }
            if (session.dialogData.type == "start" && session.privateConversationData.processing.dateInfo.duration[0]) {
                session.privateConversationData.processing.dateInfo.start.value = moment(recognized.resolution.start).add(session.privateConversationData.offset, 'm').set({ h: 0, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm');
                session.privateConversationData.processing.dateInfo.start.type = session.dialogData.recognizedType;
                session.beginDialog('AddDuration', session.privateConversationData.processing.dateInfo.duration[0]);
            } else {
                //     if (session.privateConversationData.processing.dateInfo.end.hasOwnProperty('value')) {
                //         if (moment(session.privateConversationData.processing.dateInfo.end.value).isBefore(session.privateConversationData.processing.dateInfo.start.value)) {
                //             session.send(`Sorry, I can't proceed with leave end date ahead of leave start date. Please change your leave ${(session.dialogData.type == "start") ? "end" : "start"} day first.`);
                //             session.replaceDialog('AskDate', session.dialogData.type);
                //         } else if ((moment(session.privateConversationData.processing.dateInfo.end.value).isSame(session.privateConversationData.processing.dateInfo.start.value)) && (session.privateConversationData.processing.dateInfo.end.type == "AM" && session.privateConversationData.processing.dateInfo.start.type == "PM")) {
                //             session.send("Sorry, I can't proceed with leave end date ahead of leave start date. Please re-enter.");
                //             session.replaceDialog('AskDate', session.dialogData.type);
                //         }
                //     }
                session.privateConversationData.processing.dateInfo[session.dialogData.type].value = moment(recognized.resolution.start).add(session.privateConversationData.offset, 'm').set({ h: 0, m: 0, s: 0, ms: 0 }).add(session.privateConversationData.offset, 'm');
                session.privateConversationData.processing.dateInfo[session.dialogData.type].type = session.dialogData.recognizedType;
            }
            session.endDialog();
        } else {
            session.send("I didn't recognize the date you entered. Please try again using a format of dd-MMM-yyyy, (e.g: 14-Jun-2018)");
            session.replaceDialog('AskDate', session.dialogData.type);
        }
    }
];
module.exports.AskRemark = [
    function (session) {
        session.privateConversationData.processing.remarks = ""
        var msg = new builder.Message(session)
            .text(`Please enter any remarks for this application or type "No" if you don't have any remarks`)
            .attachmentLayout(builder.AttachmentLayout.list)
            .attachments([
                new builder.HeroCard(session)
                    .buttons([
                        builder.CardAction.imBack(session, "no", "no")
                    ])
            ])
        builder.Prompts.text(session, msg);
    },
    function (session, results) {
        switch (session.message.text.toLowerCase()) {
            case "no": {
                session.privateConversationData.processing.remarks = "";
                break;
            }
            default: {
                session.privateConversationData.processing.remarks = session.message.text;
                break;
            }
        }
        session.endDialog();
    }
]
module.exports.CheckLeaveType = [
    function (session, args) {
        var check = false;
        if (checkEntity(args, sitLeaveApplicationTypes)) {
            console.log("Checked the applying leave type is %s", args.toLowerCase());
            session.endDialog();
        } else if (checkEntity(args, sitLeaveQuotaTypes)) {
            session.send("Please apply Exam/Study and Volunteer Leave via S-PORT.");
            session.cancelDialog(0, '/');
        } else {
            session.send("Please check the leave type. You have entered %s <br\>which is not in SIT leave type", session.privateConversationData.received.leaveType);
            session.replaceDialog('AskLeaveType', "all");
        };
    }
];
module.exports.AskLeaveType = [
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
];
module.exports.AskSpecificType = [
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
];
module.exports.CheckAttachment = [
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
];
module.exports.AddAttachment = [
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
                        session.send("The attachment should be of file type JPG, JPEG, PNG, BMP, GIF, TIFF, or PDF and within 3MB. Please try again.");
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
];
module.exports.ListAttachments = [
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
];
module.exports.CheckApplyInfo = [
    function (session) {
        if (moment(session.privateConversationData.processing.dateInfo.start.value).isSame(moment(session.privateConversationData.processing.dateInfo.end.value)))
            var msg = `Hi ${session.message.user.name}, you are applying ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} on ${moment(session.privateConversationData.processing.dateInfo.start.value).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.processing.dateInfo.start.type)}`;
        else
            var msg = `Hi ${session.message.user.name}, you are applying ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} from ${moment(session.privateConversationData.processing.dateInfo.start.value).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.processing.dateInfo.start.type)} to ${moment(session.privateConversationData.processing.dateInfo.end.value).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.processing.dateInfo.end.type)}`;
        session.send(msg);
        builder.Prompts.confirm(session, "Please confirm if your application information is correct", { listStyle: 3 });
    },
    function (session, results) {
        if (results.response)
            session.endDialog();
        else {
            session.replaceDialog('CorrectingInfo');
        }
    }
];
module.exports.CorrectingInfo = [
    function (session, args) {
        switch (args) {
            case "date": {
                builder.Prompts.choice(session, "Please update your information", ["start date", "end date"], { listStyle: 3 });
                break;
            }
            default: {
                builder.Prompts.choice(session, "Please specify the part you want to update", ["start date", "end date", "leave type", "add attachments", "cancel application"], { listStyle: 3 });
                break;
            }
        }
    },
    function (session, results) {
        switch (results.response.entity.toLowerCase()) {
            case "start date": {
                session.beginDialog('AskDate', "start");
                break;
            }
            case "end date": {
                session.beginDialog('AskDate', "end");
                break;
            }
            case "leave type": {
                session.beginDialog('AskLeaveType', "all");
                break;
            }
            case "add attachments": {
                session.beginDialog('AddAttachment');
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
];
module.exports.ApplyConfirmed = [
    function (session, args) {
        session.privateConversationData.apply = new Object();
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
        if ((startType === "FD" || startType === "AM") && (endType === "FD" || endType === "PM")) {
            session.privateConversationData.applications.push({
                "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                "startDate": startDate.format('YYYY[-]M[-]D'),
                "endDate": endDate.format('YYYY[-]M[-]D'),
                "dayType": "FD",
                "notes": session.privateConversationData.processing.remarks,
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
                    "notes": session.privateConversationData.processing.remarks,
                    "attachments": attachments,
                    "confirmation": ""
                })
            } else {
                if ((startType === "AM" || startType === "FD") && endType === "AM") {
                    session.privateConversationData.applications = [{
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": startDate.format('YYYY[-]M[-]D'),
                        "endDate": moment(endDate).subtract(1, 'day').format('YYYY[-]M[-]D'),
                        "dayType": "FD",
                        "notes": session.privateConversationData.processing.remarks,
                        "attachments": attachments,
                        "confirmation": ""
                    },
                    {
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": endDate.format('YYYY[-]M[-]D'),
                        "endDate": endDate.format('YYYY[-]M[-]D'),
                        "dayType": "AM",
                        "notes": session.privateConversationData.processing.remarks,
                        "attachments": attachments,
                        "confirmation": ""
                    }];
                } else if (startType === "PM" && (endType === "PM" || endType === "FD")) {
                    session.privateConversationData.applications = [{
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": startDate.format('YYYY[-]M[-]D'),
                        "endDate": startDate.format('YYYY[-]M[-]D'),
                        "dayType": "PM",
                        "notes": session.privateConversationData.processing.remarks,
                        "attachments": attachments,
                        "confirmation": ""
                    },
                    {
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": moment(startDate).add(1, 'day').format('YYYY[-]M[-]D'),
                        "endDate": endDate.format('YYYY[-]M[-]D'),
                        "dayType": "FD",
                        "notes": session.privateConversationData.processing.remarks,
                        "attachments": attachments,
                        "confirmation": ""
                    }];
                } else {
                    session.privateConversationData.applications = [{
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": startDate.format('YYYY[-]M[-]D'),
                        "endDate": startDate.format('YYYY[-]M[-]D'),
                        "dayType": "PM",
                        "notes": session.privateConversationData.processing.remarks,
                        "attachments": attachments,
                        "confirmation": ""
                    },
                    {
                        "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                        "startDate": endDate.format('YYYY[-]M[-]D'),
                        "endDate": endDate.format('YYYY[-]M[-]D'),
                        "dayType": "AM",
                        "notes": session.privateConversationData.processing.remarks,
                        "attachments": attachments,
                        "confirmation": ""
                    }]
                    if (moment(startDate).add(1, 'd').isSameOrBefore(moment(endDate).subtract(1, 'd'))) {
                        session.privateConversationData.applications.splice(1, 0, {
                            "leaveType": matchLeaveApplicationCode(session.privateConversationData.received.leaveType),
                            "startDate": moment(startDate).add(1, 'd').format('YYYY[-]M[-]D'),
                            "endDate": moment(endDate).subtract(1, 'd').format('YYYY[-]M[-]D'),
                            "dayType": "FD",
                            "notes": session.privateConversationData.processing.remarks,
                            "attachments": attachments,
                            "confirmation": ""
                        })
                    }
                }
            }
        }
        if (session.privateConversationData.applications.length >= 2) {
            session.send(`The leave application has been separated into ${session.privateConversationData.applications.length} applications.`)
        }
        session.replaceDialog('LeaveApplication', [0, ""]);
    }
];
module.exports.LeaveApplication = [
    function (session, args, next) {
        session.sendTyping();
        session.dialogData.args = args;
        session.dialogData.messageType = "";
        try {
            session.privateConversationData.applications[args[0]].confirmation = args[1];
            apiServices.applyLeave(session.privateConversationData.applications[args[0]], session.userData.apiToken)
                .then((response) => {
                    try {
                        if (response.Et01messages) {
                            if (response.Et01messages[0].Type === "E") {
                                session.dialogData.messageType = "E";
                                var message = response.Et01messages.map((item) => {
                                    switch (item.Type) {
                                        case "E":
                                            return `**Error:** ${item.Message}`;
                                    }
                                }).join("\n");
                                session.sendTyping();
                                if (moment(session.privateConversationData.applications[args[0]].startDate).isSame(moment(session.privateConversationData.applications[args[0]].endDate)))
                                    var msg = `Your ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} application on ${moment(session.privateConversationData.applications[args[0]].startDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} failed\n${message}`;
                                else
                                    var msg = `Your ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} application from ${moment(session.privateConversationData.applications[args[0]].startDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} to ${moment(session.privateConversationData.applications[args[0]].endDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} failed\n${message}`;
                                session.send(msg);
                                if (args[0] >= session.privateConversationData.applications.length - 1) {
                                    session.cancelDialog(0, '/');
                                } else {
                                    builder.Prompts.confirm(session, "Proceed with the next application?", { listStyle: 3 });
                                }
                            } else if (response.Et01messages[0].Type === "W") {
                                session.dialogData.messageType = "W";
                                var message = response.Et01messages.map((item) => {
                                    switch (item.Type) {
                                        case "W":
                                            return `Warning: ${item.Message}`;
                                    }
                                }).join("\n");
                                if (moment(session.privateConversationData.applications[args[0]].startDate).isSame(moment(session.privateConversationData.applications[args[0]].endDate)))
                                    var msg = `Your ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} application on ${moment(session.privateConversationData.applications[args[0]].startDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} got following warnings\n${message}`;
                                else
                                    var msg = `Your ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} application from ${moment(session.privateConversationData.applications[args[0]].startDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} to ${moment(session.privateConversationData.applications[args[0]].endDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} got following warnings\n${message}`;
                                session.send(msg);
                                builder.Prompts.confirm(session, "Proceed with warning?", { listStyle: 3 });
                            } else if (response.Et01messages[0].Type === "S") {

                                var message = response.Et01messages.map((item) => {
                                    switch (item.Type) {
                                        case "S":
                                            return `Success: ${item.Message}`;
                                    }
                                }).join("\n");
                                if (moment(session.privateConversationData.applications[args[0]].startDate).isSame(moment(session.privateConversationData.applications[args[0]].endDate)))
                                    var msg = `Your ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} application on ${moment(session.privateConversationData.applications[args[0]].startDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} was sent successfully`;
                                else
                                    var msg = `Your ${leaveTypeDisplayConvert(session.privateConversationData.received.leaveType)} application from ${moment(session.privateConversationData.applications[args[0]].startDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} to ${moment(session.privateConversationData.applications[args[0]].endDate).format("DD-MMM-YYYY")} ${dateTypeDisplayConvert(session.privateConversationData.applications[args[0]].dayType)} was sent successfully`;
                                session.send(msg);
                                if (args[0] >= session.privateConversationData.applications.length - 1) {
                                    session.cancelDialog(0, '/');
                                } else {
                                    session.replaceDialog('LeaveApplication', [args[0] + 1, ""])
                                }
                            }
                        } else {
                            session.send(`Error:${JSON.stringify(response)}`);

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
            switch (session.dialogData.messageType) {
                case "E": {
                    session.replaceDialog('LeaveApplication', [session.dialogData.args[0] + 1, ""]);
                    break;
                }
                case "W": {
                    session.replaceDialog('LeaveApplication', [session.dialogData.args[0], "Y"]);
                    break;
                }
            }
        } else {
            session.send("The application is canceled");
            session.cancelDialog(0, '/');
        }
    }
];
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
function dateTypeDisplayConvert(t) {
    switch (t) {
        case "FD": {
            return "full day";
        }
        default: {
            return t;
        }
    }
}
module.exports.main = [
    function (session, args) {
        console.log(JSON.stringify(args));
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
        // currerently using list Entity in LUIS, this step is a dupilicate checking
        session.beginDialog('CheckLeaveType', session.privateConversationData.received.leaveType);
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
        session.beginDialog('CheckAttachment');
    },
    function (session) {
        session.beginDialog('AskRemark');
    },
    function (session) {
        session.beginDialog('CheckApplyInfo');
    },
    function (session) {
        session.replaceDialog('ApplyConfirmed');
    }
    
]