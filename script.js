var restify = require('restify');

var leaveApi = require('./restify');

var server = restify.createServer();

server.use(function(req, res, next){
    console.log(req.method + ' ' + req.url);
    return next();
});

server.use(restify.plugins.bodyParser());

server.get('api/products',leaveApi.get);
server.get('api/products/:id',leaveApi.getById);
server.post('api/products',leaveApi.post);
server.put('api/products/:id', leaveApi.put);
server.del('api/products/:id', leaveApi.del);

var that = this;
var i = 1;
that.pushthis = [{
    id : i,
    ok : 'no problem'
}];

// server.post('api/leavedetail', function(req, res, next){
//     that.pushthis.push({
//         id : i,
//         ok : 'no problem'
//     });
//     res.send(201);
//     return next();
// });
server.get('api/leavedetail',function(req, res, next){
    res.send(200, that.pushthis);
    return next();
});

function respond(req, res, next){
    res.send('hello ' + req.params.name);
    next();
};
server.get('api/products/2/:name/hi', respond);
server.post('api/procucts/2/:name/hi',respond);

server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});


/*
request.get(url, (error, res, body)=> {
if (!error && res.statusCode === 200) {
var fbResponse = JSON.parse(body)
console.log("Got a response: ", fbResponse.picture)
} else {
console.log("Got an error: ", error, ", status code: ", res.statusCode)
}
})*/