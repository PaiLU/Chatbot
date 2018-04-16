var fs = require('fs');
var LUISmodel = JSON.parse(fs.readFileSync('./LUISmodel.json'));
var sitLeaveType = JSON.parse(fs.readFileSync('./allLeaveType.json'));
const modelFeatures = JSON.parse(fs.readFileSync('./modelFeatures.json'));
var otherUtterances = JSON.parse(fs.readFileSync('./utterances.json'));


//import applyLeave intent and entities(leaveTypes)
  LUISmodel.intents.push({"name": "applyLeave"});
  for (var i in sitLeaveType.leaveType){
  LUISmodel.entities.push({"name": sitLeaveType.leaveType[i].name});
    var beforeEntityText = ["","take ","apply "];
    var entityText = [];    
    var afterEntityText = [""," from 2 jan to 3 feb"," from 2 jan for 8 days"," for 3 days", "on tomorrow"];
    entityText.push(sitLeaveType.leaveType[i].name);
    for (var j in modelFeatures.model_features){
      if (sitLeaveType.leaveType[i].name == modelFeatures.model_features[j].name){
        LUISmodel.model_features.push(modelFeatures.model_features[j]);
        var word = modelFeatures.model_features[j].words.split(",");
        for (var k in word)
          entityText.push(word[k]);
      };
    };

    for (var l in beforeEntityText){
      for (var m in entityText){
        for (var n in afterEntityText)
          LUISmodel.utterances.push(makeUtterance("applyLeave",sitLeaveType.leaveType[i].name,beforeEntityText[l],entityText[m],afterEntityText[n]));
      }
    };
  };
// import other intents and utternces (reqStatus, help)
  for (var otherIntent in otherUtterances){
    LUISmodel.intents.push({"name" : otherIntent});
    for (var o in otherUtterances[otherIntent])
      LUISmodel.utterances.push(otherUtterances[otherIntent][o]);
  };

var jsonData = JSON.stringify(LUISmodel);
fs.writeFile('sitLeaveBot_importing.json', jsonData, function(err) {
    if(err) {
        return console.log(err);
    }
});
console.log("Done on generating "+fileName);

function makeUtterance(intent,entity,beforeEntityText,entityText,afterEntityText){
  var a ={
    "text": beforeEntityText + entityText + afterEntityText,
    "intent": intent,
    "entities": [
      {
        "entity": entity,
        "startPos": beforeEntityText.length,
        "endPos": beforeEntityText.length+entityText.length-1
      }
    ]
  };
  return a;
}
