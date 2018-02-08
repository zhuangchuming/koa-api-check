var router = require('koa-router')();
let User = require('../../model/User');

router.post('/register',async (ctx,next)=>{
	let body = ctx.request.body;
	if(await User.findOne({account:body.account}).exec()){
		throw Error(5001);
	}
	if(body.head) {
		let path = body.head.path;
		let url = '/uploads'+path.substring(path.lastIndexOf('/'),path.length);
		body.head = url;
	}
	let mP = await User.find({}).sort({uID:-1}).limit(1).exec();
	let uID = 1;
	if(mP && mP[0]){
		uID = mP[0].uID+1;
	}
	body.uID = uID;
	let user = new User(body);
	await user.save();
	ctx.body = {no:200};
})



module.exports = router