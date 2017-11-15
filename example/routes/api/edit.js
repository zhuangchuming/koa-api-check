var router = require('koa-router')();
let User = require('../../model/User');

router.post('/edit',async (ctx,next)=>{
    let body = ctx.request.body;
    let person = ctx.session.user;
    let p = await User.findOne({uID:person.uID}).exec();
    if(!p){
        throw Error(4002);
    }
    if(body.pwd || body.pwd1){
        if(!body.pwd || !body.pwd1){
            throw Error(4004)
        }
        if(body.pwd != body.pwd1){
            throw Error(4001);
        }
        if(body.pwd == p.pwd){
            throw Error(4003)
        }
    }
    if(body.head){
        let path = body.head.path;
        let url = '/uploads'+path.substring(path.lastIndexOf('/'),path.length);
        body.head = url;
        //修改头像，可以自己删除老文件
    }
    let up = await update(User,{uID:p.uID},{$set:body});
    if(up.no != 200){
        ctx.body = {no:500,msg:"更新用户信息失败!"};
    }else{
        ctx.body = Object.assign({no:200},body);
    }
})


function update(model,query,update,options){
    if(!options){
        options = {};
    }
    return new Promise((resolve,reject)=>{
        model.update(query,update,options,(err, data)=>{
            if(err){
                resolve({no:480});
                console.log('update err',err);
            }else if(data && data.n >= 1){
                resolve({no:200,n:data.n});
            }else if(data && data.ok == 1 && data.n == 0){
                resolve({no:481})
                console.log('update err 481',data);
            }else{
                resolve({no:480})
                console.log('update err 480',data);
            }
        });
    })
}

module.exports = router