function GetName(){
    var that = this;
    that.store = [];
    that.get = function(req, res, next){
        res.send(200, that.store[that.store.length-1].name);
        return next();
    };
    that.post = function(req, res, next){
        if(!req.body.hasOwnProperty('name') || that.store.name != null){
            res.send(500);
        }else{
            that.store.push({
                name : req.body.name
            });
            res.send(201);if(!req.body.hasOwnProperty('name')){
                res.send(500);
            }else{
                that.store.push({name : req.body.name});
                console.log('%s', JSON.stringify(that.store[that.store.length-1].name));
                res.send(201);
        }
        return next();
    };
};

module.exports = new GetName();}
