"use strict";
const csvjson = require('csvtojson');
const fs = require('fs');
const file = './SITLeaveType.csv'
var list = []
var a = csvjson({
	noheader: false
})
.fromFile(file)
.on('json', (jsonObj, rowIndex) => {
	list.push(jsonObj)
	// console.log(rowIndex+1 + JSON.stringify(jsonObj))
})
.on('done', (err) => {
	fs.writeFile('sitLeaveTypeData.json',JSON.stringify(list),function(err){
		if(err){ 
			return console.log(err);
		}
	})
	console.log("end")
});
