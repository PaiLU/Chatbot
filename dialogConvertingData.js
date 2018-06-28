"use strict"
var builder = require('botbuilder');
var moment = require('moment');
var entityExtract = require('./functionDefault').entityExtract;
function dateExtract(receivedDateEntityList) {
    var o = {
        "dateTime": [],
        "duration": []
    };
    for (var p in receivedDateEntityList) {
        // each item is an IEntity[] list
        switch (p) {
            case "daterange": {
                //1. get nearest entity
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                //2. save as 2 seperatre entities
                var dateItem = nearestEntityList.map((item) => {
                    var x = moment(item.start);
                    var y = moment(item.end);
                    return [
                        {
                            "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "FD"
                        }, {
                            "value": y.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "FD"
                        }
                    ];
                })
                for (var a in dateItem)
                    o.dateTime.push(...dateItem[a]);
                break;
            };
            case "datetimerange": {
                //1. get nearest entity
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                var dateItem = nearestEntityList.map((item) => {
                    var x = moment(item.start);
                    var y = moment(item.end);
                    if (x.isSame(y, "day")) {
                        if (x.isSameOrAfter(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 })) && y.isSameOrAfter(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 }))) {
                            return [{
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "PM"
                            }]
                        } else if (x.isSameOrBefore(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 })) && y.isSameOrBefore(moment(x).set({ h: 12, m: 0, s: 0, ms: 0 }))) {
                            return [{
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "AM"
                            }]
                        } else {
                            return [{
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "FD"
                            }]
                        }
                    } else {
                        if (x.isBefore(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                            return {
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "FD"
                            }
                        } else {
                            return {
                                "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                                "type": "PM"
                            }
                        }
                        return [correctDateType(item.start, "start"), correctDateType(item.end, "end")];
                    }
                })
                for (var a in dateItem)
                    o.dateTime.push(...dateItem[a]);
                //2. check
                //+ startDate == endDate save as 1 entity
                // - startTime & endTime <= 12PM => AM
                // - startTime & endTime >= 12PM => PM
                // - Else => FD
                //+ startDate != endDate save as 2 seperatre entities
                // - startTime < 12:00pm : FD; else PM
                // - endTime > 12:00PM : FD; else AM
                break;
            };
            case "date": {
                //1. get nearest entity
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                //2. save as an entity
                var dateItem = nearestEntityList.map((item) => {
                    return {
                        "value": moment(item.value).set({ h: 0, m: 0, s: 0, ms: 0 }),
                        "type": "FD"
                    };
                })
                o.dateTime.push(...dateItem);
                break;
            };
            case "datetime": {
                var nearestEntityList = receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        return getNearestDateEntity(item.resolution.values);
                    });
                //2. save as an entity
                var dateItem = nearestEntityList.map((item) => {
                    var x = moment(item.value)
                    if (x.isSameOrBefore(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                        return {
                            "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "AM"
                        }
                    } else {
                        return {
                            "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                            "type": "PM"
                        }
                    }
                })
                o.dateTime.push(...dateItem);
                break;
            };
            case "duration": {
                o.duration.push(...receivedDateEntityList[p].map(
                    // each item is an IEntity item
                    (item) => {
                        // save as millisecond number
                        return Number(item.resolution.values[0].value) * 1000;
                    }));
                break;
            };
            default:
                break;
        }
    }

    //check no duplicated item
    var q = {
        "dateTime": [],
        "duration": o.duration
    }
    o.dateTime.forEach((item) => {
        var check = true;
        for (var a in q.dateTime) {
            if (item.value == q.dateTime[a].value && item.type == q.dateTime[a].type)
                check = false;
        }
        if (check)
            q.dateTime.push(item)
    })
    return q;
    // {
    //     "dateTime": [{
    //         "value": "2018-06-07 12:00:00",
    //         "type": "FD"
    //     },{}...],
    //     "duration": [4320000, ... ]
    // }
};
function correctDateType(entity, startOrEnd) {
    var x = moment(entity.value);
    switch (startOrEnd) {
        case "start": {
            if (x.isBefore(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "FD"
                }
            } else {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "PM"
                }
            }
            break;
        };
        case "end": {
            if (x.isAfter(moment(x).set({ h: 0, m: 0, s: 0, ms: 0 }))) {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "FD"
                }
            } else {
                return {
                    "value": x.set({ h: 0, m: 0, s: 0, ms: 0 }),
                    "type": "AM"
                }
            }
            break;
        };
        default:
            break;
    }
}
function getNearestDateEntity(fromList) {
    var now = moment();
    var minDiff = 0;
    var entity = new Object();
    for (var i in fromList) {
        if (minDiff == 0) {
            minDiff = Math.abs(new Date(fromList[i].value || fromList[i].start) - now);
            entity = fromList[i];
        } else {
            var diff = Math.abs(new Date(fromList[i].value || fromList[i].start) - now)
            if (diff < minDiff) {
                minDiff = diff;
                entity = fromList[i];
            }
        }
    }
    return entity || null;
}
module.exports = [
    function (session, args, next) {
        console.log(JSON.stringify(args));
        session.privateConversationData.received = new Object();
        session.privateConversationData.processing = new Object();
        session.privateConversationData.received.dateInfo = new Object();
        session.privateConversationData.processing.dateInfo = new Object();
        session.privateConversationData.received.leaveType = entityExtract(builder.EntityRecognizer.findEntity(args.intent.entities || {}, "leaveType"));
        // session.privateConversationData.received.startDayType = entityExtract(findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities || {}, 'startDay', 'dayType')) || "FD";
        // session.privateConversationData.received.endDayType = entityExtract(findCompositeEntities(args.intent.compositeEntities || {}, args.intent.entities || {}, 'endDay', 'dayType')) || "FD";

        const datetimeV2Types = ["daterange", "date", "duration", "datetime", "datetimerange"];
        for (var o in datetimeV2Types) {
            session.privateConversationData.received.dateInfo[datetimeV2Types[o]] = builder.EntityRecognizer.findAllEntities(args.intent.entities || {}, 'builtin.datetimeV2.' + datetimeV2Types[o]);
        };
        session.privateConversationData.processing.dateInfo = dateExtract(session.privateConversationData.received.dateInfo);
        console.log(`received: ${JSON.stringify(session.privateConversationData.received)}`);
        console.log(`processing: ${JSON.stringify(session.privateConversationData.processing)}`);
        session.endDialog();
    }
]