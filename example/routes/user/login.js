var router = require('koa-router')();
let User = require('../../model/User');

router.post('/login',async (ctx,nexgt)=>{
    let body = ctx.request.body;
    let query = {pwd:body.pwd};
    switch(body.type){
        case 1:
        query.account = body.account;
        break;
        case 2:
        query.mail = body.account;
        break;
        case 3:
        query.phone = body.account;
        break;
    }
    let person = await User.findOne(query,{__v:0,_id:0}).exec();
    if(!person){
        throw Error(400);
    }
    let data = Object.assign({no:200},person._doc);
    ctx.session.user = person._doc;
    ctx.body = data;
})



module.exports = router