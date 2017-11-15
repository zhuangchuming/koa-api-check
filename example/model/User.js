var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
	phone:String,
	mail:String,
	name : String,
	uID:{type:Number,unique:true,min:1},
	sex:{type:Number,min:0,max:1},//性别,
	type:{type:String,default:"custom"},
	account:{type:String,required:true,index:true},//账号
	height:{type:Number,default:0},//身高
	head:{type:String},
	pwd:{type:String,required:true},//密码
	tLogin: Number,//new Date().getTime(),	// 本次登录时间
},{collection:'user'});
module.exports = mongoose.model('user',UserSchema);
