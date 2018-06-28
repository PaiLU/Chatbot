"use strict"
var builder = require('botbuilder');
var fs = require('fs');
var checkEntity = require('./functionDefault').checkEntity;
var apiServices = require('./apiServices');

const sitLeaveQuotaData = JSON.parse(fs.readFileSync('./sitLeaveQuotaData.json', 'utf8'));
var sitLeaveQuotaTypes = [];
var sitLeaveQuotaShortlistTypes = [];
for (var a in sitLeaveQuotaData) {
    sitLeaveQuotaTypes.push(sitLeaveQuotaData[a]["Leave Quota"]);
    if (sitLeaveQuotaData[a]["Shortlist"].toLowerCase() == "y") {
        sitLeaveQuotaShortlistTypes.push(sitLeaveQuotaData[a]["Leave Quota"].toLowerCase());
    };
};
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
module.exports = [
    function (session, args, next) {
        session.privateConversationData.request = new Object();
        if (args) {
            console.log(JSON.stringify(args));
            session.beginDialog('ConvertingData', args);
        }
        next();
    },
    function (session, args, next) {
        if (session.privateConversationData.received && checkEntity(session.privateConversationData.received.leaveType, sitLeaveQuotaTypes)) {
            session.privateConversationData.request.leaveType = session.privateConversationData.received.leaveType;
            next();
        } else {
            builder.Prompts.choice(session, "Which leave balance are you looking for?", sitLeaveQuotaShortlistTypes.concat(["show all balances"]), { listStyle: 3 });
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
        session.sendTyping();
        // session.endConversation("The API is currently not responding");
        // API goes here
        try {
            // session.send(session.userData.apiToken ? session.userData.apiToken : "aaa");
            apiServices.checkLeaveBalance(matchLeaveQuotaCode(session.privateConversationData.request.leaveType), session.userData.apiToken)
                .then((response) => {
                    // session.send(JSON.stringify(response));
                    session.sendTyping();
                    if (Array.isArray(response)) {
                        var messages = response.map((item) => { return `${item.LeaveQuotaDesc}: ${item.LeaveRemainder} day(s)` }).join("\n");
                        session.send(messages);
                        session.replaceDialog('/');
                    } else if (response && response.Type === "E") {
                        session.send(`**Error:** ${response.Message}`);
                        session.replaceDialog('/');
                    } else {
                        session.send(JSON.stringify(response));
                        session.replaceDialog('/');
                    }
                });
        }
        catch (err) {
            session.send(`err: ${JSON.stringify(err)}`);
        }
    }
]