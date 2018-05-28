"use strict";
const csvjson = require('csvtojson');
const fs = require('fs');
const file1 = './SITLeaveApplicationTypes.csv'
const file2 = './sitLeaveQuotaTypes.csv'
var list1 = [];
var list2 = [];
var a = csvjson({
	noheader: false
})
	.fromFile(file1)
	.on('json', (jsonObj, rowIndex) => {
		list1.push(jsonObj)
		// console.log(rowIndex+1 + JSON.stringify(jsonObj))
	})
	.on('done', (err) => {
		fs.writeFile('sitLeaveApplicationData.json', JSON.stringify(list1), function (err) {
			if (err) {
				return console.log(err);
			}
		})
		console.log("list 1 done");
	});
var b = csvjson({
	noheader: false
})
	.fromFile(file2)
	.on('json', (jsonObj, rowIndex) => {
		list2.push(jsonObj)
		// console.log(rowIndex+1 + JSON.stringify(jsonObj))
	})
	.on('done', (err) => {
		fs.writeFile('sitLeaveQuotaData.json', JSON.stringify(list2), function (err) {
			if (err) {
				return console.log(err);
			}
		})
		console.log("list 2 done");
	});