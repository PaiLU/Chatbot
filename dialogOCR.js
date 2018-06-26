"use strict"
var builder = require('botbuilder');
var https = require('https');
var request = require('request-promise').defaults({ encoding: null });

var OCRKey = process.env.OCRKey;
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
module.exports = [
    [
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
                            var req = https.request(
                                {
                                    host: 'southeastasia.api.cognitive.microsoft.com',
                                    path: '/vision/v2.0/ocr?language=en&detectOrientation=true',
                                    method: 'POST',
                                    headers: {
                                        'Ocp-Apim-Subscription-Key': OCRKey,
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
                                                                    session.replaceDialog('ApplyLeave', session.dialogData.ocrArgs);
                                                                } else {
                                                                    builder.Prompts.confirm(session, `I didn't recognize any key words, like 'medical certificate', in the attachment. Do you still want to proceed with the application with this attachment?`, { listStyle: 3 })
                                                                };
                                                            } else {
                                                                builder.Prompts.confirm(session, `I didn't recognize any key words, like 'medical certificate', in the attachment. Do you still want to proceed with the application with this attachment?`, { listStyle: 3 })
                                                            }
                                                        }
                                                    });
                                                }, 300 * index, num);
                                            }
                                            session.send("Please wait for a few seconds while I read through your attachment");
                                            session.sendTyping();
                                        })
                                    } else {
                                        res.on('data', (data) => {
                                            ocrResponseStr += data;
                                        });
                                        res.on('end', (err) => {
                                            session.send(ocrResponseStr.message || `Input data is not a valid image`);
                                            session.cancelDialog(0, 'Help');
                                        })
                                    }
                                }
                            );
                            req.write(new Buffer(fileResponse, 'binary'));
                            req.end();
                        } else {
                            session.send("The attachment should be of file type JPG, JPEG, PNG, BMP or GIF and within 3MB. Please try again.");
                            session.replaceDialog('OCR');
                        }
                    }).catch(function (err) {
                        console.log('Error downloading attachment:', JSON.stringify(err));
                        session.endConversation("Sorry an error occured during downloading attachment");
                    });
            } else {
                // No attachments were sent
                var reply = new builder.Message(session)
                    .text('Please try again sending an attachment.');
                session.replaceDialog('Help');
            }
        }, function (session, results, next) {
            if (results.response) {
                session.privateConversationData.attachments.push({
                    contentType: attachment.contentType,
                    contentUrl: 'data:' + attachment.contentType + ';base64,' + session.dialogData.imageBase64Sting,
                    name: attachment.name
                });
                session.cancelDialog(0, 'ApplyLeave', { "intent": { "entities": [], "compositeEntities": [] } });
            } else {
                session.cancelDialog(0, 'Help')
            };
        }
    ]
]