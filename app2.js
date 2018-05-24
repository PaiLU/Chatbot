"use strict";
require('dotenv-extended').load();
var fs = require('fs');
var https = require('https')
const sitLeaveTypeData = JSON.parse(fs.readFileSync('./sitLeaveTypeData.json'));
var otherUtterances = JSON.parse(fs.readFileSync('./utterances.json'));
var previousLUIS = JSON.parse(fs.readFileSync('./sitLeaveBot.json'));
var newLUIS = previousLUIS;

for (var a in previousLUIS) {
    console.log(typeof(previousLUIS[a]))
    if (typeof (previousLUIS[a]) === "object")
        newLUIS[a] = [];
    if (typeof (previousLUIS[a]) === "string")
        newLUIS[a] = "";
}

var appVersion = (0.1 + Number(previousLUIS["versionId"])).toFixed(1).toString();
newLUIS["luis_schema_version"] = previousLUIS["luis_schema_version"];
newLUIS["versionId"] = appVersion;
newLUIS["name"] = previousLUIS["name"];
newLUIS["desc"] = previousLUIS["desc"];
newLUIS["culture"] = previousLUIS["culture"];
newLUIS["regex_entities"] = previousLUIS["regex_entities"];
newLUIS["bing_entities"] = previousLUIS["bing_entities"];
newLUIS["regex_features"] = previousLUIS["regex_features"];
newLUIS["model_features"] = previousLUIS["model_features"];
newLUIS["entities"] = [];
newLUIS["closedLists"] = [];
newLUIS["composites"] = [];
newLUIS["intents"] = [];
newLUIS["utterances"] = [];

// import closedLists


//import applyLeave intent and entities(leaveTypes)
var sitLeaveType = [];
var leaveTypeChild = [];
newLUIS.intents.push({ "name": "applyLeave" });
for (var a in sitLeaveTypeData) {
    sitLeaveType.push(sitLeaveTypeData[a]["Leave Type"]);
    var leave_beforeEntityText = ["", "take ", "apply "];
    var leave_afterEntityText = ["", " from 2 jan to 3 feb", " from 2 jan for 8 days", " for 3 days", " on tomorrow"];
    for (var b in leave_beforeEntityText) {
        for (var c in leave_afterEntityText)
            newLUIS.utterances.push(makeUtterance("applyLeave", "Leave Type", leave_beforeEntityText[b], sitLeaveTypeData[a]["Leave Type"], leave_afterEntityText[c]));
    };
    if (sitLeaveTypeData[a]["Leave Type"].toLowerCase() != sitLeaveTypeData[a]["LUIS Leave Type"].toLowerCase()) {
        var add = true;
        for (var b in leaveTypeChild) {
            if (sitLeaveTypeData[a]["LUIS Leave Type"] == leaveTypeChild[b])
                add = false;
        };
        if (add) {
            leaveTypeChild.push(sitLeaveTypeData[a]["LUIS Leave Type"]);
            for (var b in leave_beforeEntityText) {
                for (var c in leave_afterEntityText)
                    newLUIS.utterances.push(makeUtterance("applyLeave", "Leave Type::" + sitLeaveTypeData[a]["LUIS Leave Type"], leave_beforeEntityText[b], sitLeaveTypeData[a]["Leave Type"], leave_afterEntityText[c]));
            }
        }
    }
}
console.log(leaveTypeChild);
console.log(sitLeaveType);
console.log(checkEntity("Medical Leave(UC)", sitLeaveType))
newLUIS.entities.push({ "name": "Leave Type", "children": leaveTypeChild })

// import other intents and utternces (reqStatus, help)
var req_beforeEntityText = ["", "get ", "what is my ", "check "]
var req_afterEntityText = [" balance", " status"]
for (var a in req_beforeEntityText) {
    for (var b in sitLeaveType) {
        for (var c in req_afterEntityText) {
            newLUIS.utterances.push(makeUtterance("reqStatus", "Leave Type", req_beforeEntityText[a], sitLeaveType[b], req_afterEntityText[c]));
        }
    }
}
for (var a in req_beforeEntityText) {
    for (var b in leaveTypeChild) {
        for (var c in req_afterEntityText) {
            newLUIS.utterances.push(makeUtterance("reqStatus", "Leave Type::" + leaveTypeChild[b], req_beforeEntityText[a], leaveTypeChild[b], req_afterEntityText[c]));
        }
    }
}
for (var a in otherUtterances) {
    newLUIS.intents.push({ "name": a });
    for (var o in otherUtterances[a])
        newLUIS.utterances.push(otherUtterances[a][o]);
};

var jsonData = JSON.stringify(newLUIS);
// fs.writeFile('sitLeaveBot_importing.json', jsonData, function(err) {
//     if(err) {
//         return console.log(err);
//     }
// });
console.log("Done on generating " + "sitLeaveBot_importing.json");

function makeUtterance(intent, entities, text) {
    var a = {
        "text": beforeEntityText + entityText + afterEntityText,
        "intent": intent,
        "entities": [
            {
                "entity": entity,
                "startPos": beforeEntityText.length,
                "endPos": beforeEntityText.length + entityText.length - 1
            }
        ]
    };
    return a;
}
function checkEntity(entity, entityList) {
    var check = false;
    for (var a in entityList) {
        if (entity.toString().toLowerCase() == entityList[a].toString().toLowerCase()) {
            check = true;
            break;
        }
    }
    return check;
}