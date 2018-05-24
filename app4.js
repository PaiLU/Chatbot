"use strict";
require('dotenv-extended').load();
var fs = require('fs');
var https = require('https');
var previousLUIS = JSON.parse(fs.readFileSync('./sitLeaveBot.json'));

var reqLUIS = https.request(
    {
        host:luisAPIHostName,
        path:'/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey + '&spellCheck=true&bing-spell-check-subscription-key=' + bingSpellCheckKey + '&verbose=true&timezoneOffset=0&q='+ocrStr,
        method:'GET'
    }, (res)=>{
        res.setEncoding('utf8');
        var LUISResString = '';
        if(res.statusCode ===200){
            res.on('data',function(data){
                LUISResString += data;
            });
            res.on('end',(err)=>{
                var LUISResObj = JSON.parse(LUISResString);
                console.log(LUISResObj);
            })
        }
    }
)
// var options1 = {
//     host: 'westus.api.cognitive.microsoft.com',
//     path:'/luis/api/v2.0/apps/'+process.env.luisAppId_WestUS+'/versions/'+previousLUIS.versionId+'/phraselists?skip=0&take=100',
//     method: 'GET',
//     headers:{
//         'host': 'westus.api.cognitive.microsoft.com', 
//         'Ocp-Apim-Subscription-Key': process.env.luisAPIKey_WestUS
//     }
// };
// var req = https.request(options1, function(res) {
//     res.setEncoding('utf8');
//     if (res.statusCode === 200){
//         res.on('data', function (data) {
//             var received = JSON.parse(data);
//             var file = {"model_features":[]};
//             for (var a in received){
//                 file.model_features.push({
//                     "name": received[a].name,
//                     "mode": received[a].isExchangeable,
//                     "words": received[a].phrases,
//                     "activated": received[a].isActive
//                 })
//             };	
//             fs.writeFile('modelFeatures.json',JSON.stringify(file),function(err){
//                 if(err){ 
//                     return console.log(err);
//                 }
//             })
//         });
//         res.on('end')
//     }
// });

// var buf = Buffer.from(b64string, 'base64');
// req.write(Buffer);
// req.end();
// var options2 = {
//     host: 'westus.api.cognitive.microsoft.com',
//     // port: 443,
//     path:'/luis/api/v2.0/apps/'+process.env.luisAppId_WestUS+'/versions/1.1/export',
//     method: 'GET',
//     headers:{
//         'host': 'westus.api.cognitive.microsoft.com', 
//         'Ocp-Apim-Subscription-Key': process.env.luisAPIKey_WestUS
//     }
// };
// var str = '';
// https.request(options2, function(res) {
//     res.setEncoding('utf8');
//     if (res.statusCode === 200){
//         res.on('data', function (data) {
//             str += data;
//         });
//         res.on('end',(err)=>{
//             fs.writeFile('sitLeaveBot_v1.0.json',str,function(err){
//                 if(err){ 
//                     return console.log(err);
//                 }
//             });
//         })
//     };

// })
// .end();