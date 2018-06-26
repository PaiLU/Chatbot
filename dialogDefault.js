require('dotenv').load();
const builder = require('botbuilder');
const apiServices = require('./apiServices');
const defaultArgs = { "intent": { "entities": [], "compositeEntities": [] } };

module.exports = [
    function (session, args) {
        if (args) {
            session.userData.apiToken = args;
            var msg = `Hi, I am Leave Bot.`;
        } else
            var msg = `Anything else I can help you with?`;
        if (!session.userData.apiToken)
            session.endConversation(`Bot service is currently unavailable`);
        else {
            if (args) {
                session.send(msg);
                session.cancelDialog(0, 'Help');
            }
            else
                builder.Prompts.text(session, msg);
        }
    },
    function (session) {
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
                session.cancelDialog(0, 'OCR');
                break;
            }
            default: {
                session.cancelDialog(0, 'LUIS', session.message.text);
                break;
            }
        }
    }
]