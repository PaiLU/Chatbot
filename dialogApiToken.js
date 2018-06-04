module.exports = [
    function (session, args) {
        session.conversationData.apiToken = args;
        // session.send(args);
        console.log(`API Token from the API dialog ${args}`)
        session.endDialog();
    }
]