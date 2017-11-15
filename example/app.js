const Koa = require('koa');
const app = new Koa();
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-bodyparser')();
const logger = require('koa-logger');
var path = require('path');

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost/test");

var apiInit = require('../index').Init;
let interFaceRoot = path.join(__dirname, '/itFacepath/');//接口文档根目录
let itCFace = path.join(__dirname, '/routes/itCount.json');//接口统计地址
let upFileDir = path.join(__dirname,'/public/uploads/');//上传文件根目录
apiInit(interFaceRoot, itCFace, null, process.env.NODE_ENV == 'production'? false:true,upFileDir);//初始化接口检测功能



const index = require('./routes/index');

// error handler
onerror(app);

const session = require("koa-session2");
const Store = require('./lib/Store');

app.use(session({
    key: `koa:sess`,   //default "koa:sess"
    maxAge: 12*60*60*1000,//86400000 12个小时
    httpOnly: true,
    store: new Store()
}));

// middlewares
app.use(bodyparser);
app.use(json());
app.use(logger());
app.use(require('koa-static')(__dirname + '/public'));

app.use(views(__dirname + '/views', {
  extension: 'jade'
}));

// logger
app.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// routes

app.use(index.routes(), index.allowedMethods());

module.exports = app;
