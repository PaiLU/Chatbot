module.exports = [
    function (session, args) {
        session.conversationData.apiToken = args;
        // session.send(args);
        session.endDialog();
    }
]