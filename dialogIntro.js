var builder = require('botbuilder');

module.exports = [
    function (session) {
        session.endDialog("This is a Leave Bot. You can use it to <br\>1. Apply leave<br\>2. Check your leave status<br\>3. Apply medical leave(c) by uploading MC form directly");
    }
]