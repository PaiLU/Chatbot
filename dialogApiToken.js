module.exports = [
    function (session, args) {
        session.conversationData.apiToken = args;
        session.endDialog();
    }
]