"use strict";
require('dotenv-extended').load();
var fs = require('fs');
var https = require('https')
const sitLeaveTypeData = JSON.parse(fs.readFileSync('./sitLeaveTypeData.json'));
var otherUtterances = JSON.parse(fs.readFileSync('./utterances.json'));
var newLUIS = new Object();

newLUIS["luis_schema_version"] = "3.0.0";
newLUIS["versionId"] = "1.2";
newLUIS["name"] = "LeaveBot";
newLUIS["desc"] = "";
newLUIS["culture"] = "en-us";
newLUIS["entities"] = [];
newLUIS["patternAnyEntities"] = [];
newLUIS["regex_entities"] = [];
newLUIS["prebuiltEntities"] = [{ "name": "datetimeV2", "roles": [] }];
newLUIS["regex_features"] = [];
newLUIS["model_features"] = [];
newLUIS["patterns"] = [];

newLUIS["intents"] = [];
newLUIS["composites"] = [];
newLUIS["closedLists"] = [];
newLUIS["utterances"] = [];

newLUIS.composites.push(
    {
        "name": "endDay",
        "children": [
            "datetimeV2",
            "dayType"
        ],
        "roles": []
    },
    {
        "name": "startDay",
        "children": [
            "datetimeV2",
            "dayType"
        ],
        "roles": []
    }
);
newLUIS.closedLists.push({
    "name": "dayType",
    "subLists": [
        {
            "canonicalForm": "AM",
            "list": [
                "morning",
                "am"
            ]
        },
        {
            "canonicalForm": "PM",
            "list": [
                "afternoon",
                "pm"
            ]
        },
        {
            "canonicalForm": "FD",
            "list": [
                "full day",
                "fullday",
                "whole day",
                "fd"
            ]
        }
    ],
    "roles": []
});
newLUIS.closedLists.push({
    "name": "leaveType",
    "subLists": [],
    "roles": []
});
newLUIS.intents.push({
    "name": "apply leave"
})
for (var a in newLUIS.closedLists) {
    switch (newLUIS.closedLists[a].name) {
        case "leaveType": {
            for (var b in sitLeaveTypeData) {
                newLUIS.closedLists[a].subLists.push({
                    "canonicalForm": sitLeaveTypeData[b]["Leave Type"].toLowerCase(),
                    "list": []
                });
            }
            // push additional entity to leaveType
            var additional = [{ "name": "medical leave" }, { "name": "ext maternity" }]
            for (var c in additional) {
                newLUIS.closedLists[a].subLists.push({
                    "canonicalForm": additional[c].name.toLowerCase(),
                    "list": []
                });
            }
            break;
        }
    }
}
var beforeListEntity1 = ["", "take ", "apply "];
var allLeaveTypes = []
for (var a in sitLeaveTypeData) {
    allLeaveTypes.push(sitLeaveTypeData[a]["Leave Type"].toLowerCase())
};
allLeaveTypes.concat("medical leave", "ext maternity");
var beforeEntityText = [];
for (var a in beforeListEntity1) {
    for (var b in allLeaveTypes) {
        beforeEntityText.push(beforeListEntity1[a] + allLeaveTypes[b]);
    }
}
var dayType = ["full day", "morning", "afternoon"];
var startDate = "2 jan"
var endDate = "8 jan"
var duration = "2 days"
var count = 0;
for (var a in beforeEntityText) {
    for (var b in dayType) {
        for (var c in dayType) {
            newLUIS.utterances.push(makeUtterance1("apply leave", beforeEntityText[a], startDate, dayType[b], endDate, dayType[c]))
            count++;
        };
        newLUIS.utterances.push(makeUtterance2("apply leave", beforeEntityText[a], " on ", startDate, dayType[b]));
        count++;
        newLUIS.utterances.push(makeUtterance2("apply leave", beforeEntityText[a], " ", startDate, dayType[b]));
        count++;
    };
    newLUIS.utterances.push(makeUtterance3("apply leave", beforeEntityText[a], duration));
    count++;
    newLUIS.utterances.push(makeUtterance3("apply leave", beforeEntityText[a], duration));
    count++;
};

newLUIS.intents.push({
    "name": "reqStatus"
});
var req_beforeEntityText = ["", "get ", "what is my ", "check "]
var req_afterEntityText = [" balance", " status"]
for (var a in req_beforeEntityText) {
    for (var b in sitLeaveTypeData) {
        for (var c in req_afterEntityText) {
            newLUIS.utterances.push(makeListedEntityUtterance("reqStatus", req_beforeEntityText[a], sitLeaveTypeData[b]["Leave Type"].toLowerCase(), req_afterEntityText[c]));
        }
    }
}

newLUIS.intents.push({
    "name": "help"
});
newLUIS.utterances.push({
    "text": "help me",
    "intent": "help",
    "entities": []
})
newLUIS.intents.push({
    "name": "None"
});


var jsonData = JSON.stringify(newLUIS);
fs.writeFile('LeaveBot_importing.json', jsonData, function (err) {
    if (err) {
        return console.log(err);
    }
});
console.log("Done on generating " + "sitLeaveBot_importing.json\n" + "total " + newLUIS.utterances.length + " utterances\n"+
count +" utternces on apply leave");

function makeUtterance1(intent, beforeEntityText, entityText1, entityText2, entityText3, entityText4) {
    var a = {
        "text": beforeEntityText + " from " + entityText1 + " " + entityText2 + " to " + entityText3 + " " + entityText4,
        "intent": intent,
        "entities": [
            {
                "entity": "startDay",
                "startPos": beforeEntityText.length + 6,
                "endPos": beforeEntityText.length + 6 + entityText1.length - 1
            }, {
                "entity": "startDay",
                "startPos": beforeEntityText.length + 6 + entityText1.length + 1,
                "endPos": beforeEntityText.length + 6 + entityText1.length + 1 + entityText2.length - 1
            }, {
                "entity": "endDay",
                "startPos": beforeEntityText.length + 6 + entityText1.length + 1 + entityText2.length + 4,
                "endPos": beforeEntityText.length + 6 + entityText1.length + 1 + entityText2.length + 4 + entityText3.length - 1
            }, {
                "entity": "endDay",
                "startPos": beforeEntityText.length + 6 + entityText1.length + 1 + entityText2.length + 4 + entityText3.length + 1,
                "endPos": beforeEntityText.length + 6 + entityText1.length + 1 + entityText2.length + 4 + entityText3.length + 1 + entityText4.length - 1
            }
        ]
    };
    return a;
}
function makeUtterance2(intent, beforeEntityText, between01, entityText1, entityText2) {
    var a = {
        "text": beforeEntityText + between01 + entityText1 + " " + entityText2,
        "intent": intent,
        "entities": [
            {
                "entity": "startDay",
                "startPos": beforeEntityText.length + between01.length,
                "endPos": beforeEntityText.length + between01.length + entityText1.length - 1
            }, {
                "entity": "startDay",
                "startPos": beforeEntityText.length + between01.length + entityText1.length + 1,
                "endPos": beforeEntityText.length + between01.length + entityText1.length + 1 + entityText2.length - 1
            }
        ]
    };
    return a;
}
function makeUtterance3(intent, beforeEntityText, period) {
    var a = {
        "text": beforeEntityText + " for " + period,
        "intent": intent,
        "entities": []
    };
    return a;
}
function makeListedEntityUtterance(intent, beforeEntityText, entityText, afterEntityText) {
    var a = {
        "text": beforeEntityText + entityText + afterEntityText,
        "intent": intent,
        "entities": []
    };
    return a;
}
function addEntityToUtterance(entity, entityText, startPos) {
    var a = new Object();
    a.entity = entity;
    a.starPos = startPos;
    a.endPos = startPos + entityText.length;
    return a;
}