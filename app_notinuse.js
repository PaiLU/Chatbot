"use strict";
var a = new Object;
var c = new Object;
a.daterange = {
    "entity": "from 4 aug to 6 aug",
    "type": "builtin.datetimeV2.daterange",
    "startIndex": 6,
    "endIndex": 24,
    "resolution": {
      "values": [
        {
          "timex": "(XXXX-08-04,XXXX-08-06,P2D)",
          "type": "daterange",
          "start": "2017-08-04",
          "end": "2017-08-06"
        },
        {
          "timex": "(XXXX-08-04,XXXX-08-06,P2D)",
          "type": "daterange",
          "start": "2018-08-04",
          "end": "2018-08-06"
        }
      ]
    }
};
a.date = {
    "entity": "4 aug",
    "type": "builtin.datetimeV2.date",
    "startIndex": 11,
    "endIndex": 15,
    "resolution": {
      "values": [
        {
          "timex": "XXXX-08-04",
          "type": "date",
          "value": "2017-08-04"
        },
        {
          "timex": "XXXX-08-04",
          "type": "date",
          "value": "2018-08-04"
        }
      ]
    }
  };
a.duration = {
    "entity": "4 days",
    "type": "builtin.datetimeV2.duration",
    "startIndex": 21,
    "endIndex": 26,
    "resolution": {
      "values": [
        {
          "timex": "P4D",
          "type": "duration",
          "value": "345600"
        }
      ]
    }
  };
  c = {
    // "daterange":null,
    "date":{
      "entity":"3 aug",
      "type":"builtin.datetimeV2.date",
      "startIndex":11,
      "endIndex":15,
      "resolution":{
        "values":[
          {"timex":"XXXX-08-03","type":"date","value":"2017-08-03"},
          {"timex":"XXXX-08-03","type":"date","value":"2018-08-03"}
        ]
      }
    },
    // "duration":null,
    // "datetime":null,
    // "datetimerange":null
  }
var b = recConv(a);
var d = recConv(c);
function recConv(received){
    var p;
    var o= new Object;
    for (p in received){
        var i;
        // var n = received[p] && received[p].resolution.values[1] != null;
        if (received[p] && received[p].resolution.values[1] != null)
            i = 1
        else i=0;
        switch (p){
            case "daterange":{
                o.start = Date.parse(received[p].resolution.values[i]['start']);
                console.log('%s',typeof(o.start));
                o.end = Date.parse(received[p].resolution.values[i]['end']);
                console.log('%s',typeof(o.end));
                break;
            };
            case "date":{
                o.date = new Date(received[p].resolution.values[i].value);
                console.log('%s',typeof(o.date));
                break;
            };
            case "duration":{
                o.duration = Number(received[p].resolution.values[i].value)*1000
                console.log('%s',typeof(o.duration));
                break;
            };
            case "datetime":{
                break;
            };
            case "datetimerange":{
                break;
            }
        }
    }
    console.log('%s',JSON.stringify(o));
    return o;
};

// console.log('%s',JSON.stringify(d));