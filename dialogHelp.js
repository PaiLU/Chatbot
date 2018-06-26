"use strict"
var builder = require('botbuilder');
const defaultArgs = { "intent": { "entities": [], "compositeEntities": [] } };
module.exports = [
    function (session) {
        var msg = new builder.Message(session)
            .text("You can apply leave by typing \n* 'take annual leave today afternoon'\n* 'take child care leave on 11 Jun'\n> \nCheck leave balance with\n* 'check annual leave balance'\n> \nType **'cancel'** anywhere to return here\n \nYou may also do these step by step:")
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
                    session.privateConversationData.attachments = [];
                    session.cancelDialog(0, 'ApplyLeave', defaultArgs);
                    break;
                }
                case "check leave balance": {
                    session.cancelDialog(0, 'CheckLeaveBalance', defaultArgs);
                    break;
                }
                case "upload MC form": {
                    session.privateConversationData.attachments = [];
                    session.cancelDialog(0, 'OCR')
                    break;
                }
                default: {
                    session.cancelDialog(0,'LUIS',session.message.text)
                }
            }
        } else
            session.replaceDialog('Help');
    }
]