var fs = require('fs');
const url=require('url');
var path = require('path');

var JSON5 = require('json5');
var typeis = require('type-is');
var coForm = require('co-formpart');

let itCountpath = 'itCount.json';//指定输出接口访问统计文件
let interFaceRoot = null;//接口文档根目录
let upfileRoot  = path.join(__dirname,'/uploads/');;//上传文件目录

//是否是调试模式,调试模式下,支持
let isDebug = false;
let itGrantFunc = null;
/**
 * 初始接口认证服务
 * @param itFaceUrl 接口文档的路径
 * @param itCPath 接口访问统计文件目录
 * @param grantFunc 接口授权访问的时候,授权未通过时可以特殊处理 eg:比如自己写一个登陆,然后来给自己设置session
 *          该参数通过判断grantFunc方法返回值, true:授权通过,可以访问接口;false:授权未通过,返回错误值。
 * @param isDebug 是否是调试模式,如果是的话,则接口文档可以实时更新,不需要每次重启服务器,上线后需要把这个参数设置为false
 * @param fileRoot 上传文件的根目录,不配置的话,采用默认
 */
function init(itFaceUrl,itCPath,grantFunc,Debug,fileRoot)
{
    if(!itFaceUrl){
        throw Error('尚未初始化接口文档路径');
    }
    interFaceRoot = itFaceUrl;
    //输出接口统计的文件地址
    if(itCPath){
        itCountpath = itCPath;
        readitCount();
    }
    //是否授权未通过后
    if(grantFunc){
        itGrantFunc = grantFunc;
    }
    //是否调试模式
    if(Debug != undefined){
        isDebug = Debug;
    }
    //上传文件目录
    if(fileRoot != undefined){
        upfileRoot = fileRoot;
    }
}


/**
 * 获取接口模板对象并初始化。
 * @param {ctx}  name
 * @return {*} json object {TPL:data,routeName:routeName}
 *                              返回接口文档数据，文档名字
 * @private
 */
function _TPL(ctx)
{
    let method = ctx.method;
    let route = url.parse(ctx.url).pathname.substr(1);
    isDebug && console.log('route',route,ctx.url)
    let data = null;
    let routeName ;//路由名字

    if(((itFace[route] && itFace[route].method == method) || 
        (itFace[`${route}_${method}`] && itFace[`${route}_${method}`].method == method)) 
        && !isDebug){
        if(itFace[route] && itFace[route].method == method){
            routeName = route;
        }
        if(itFace[`${route}_${method}`] && itFace[`${route}_${method}`].method == method){
            routeName = `${route}_${method}`;
        }
        data = itFace[`${routeName}`];
    }else{
        //读取接口文档,并缓存起来
        // console.log('aaaa',`${interFaceRoot}${`${route}_${method}`}.json`)
        if(isExist(`${interFaceRoot}${route}.json`)){
            data = fs.readFileSync(`${interFaceRoot}${route}.json`, 'utf-8');
            try {
                data = JSON5.parse(data);
            }catch (err){
                data = null;
            }
            //如果请求方法对不上,则清空现有数据
            if(!data || data.method != method){//
                data = null;
            }else {
                itFace[route] = data;
                routeName = route;
            }
        }
        //如果本文件不存在,则通过匹配文件名加上请求参数
        if(!data && isExist(`${interFaceRoot}${`${route}_${method}`}.json`)){
            data = fs.readFileSync(`${interFaceRoot}${`${route}_${method}`}.json`, 'utf-8');
            try {
                data = JSON5.parse(data);
            }catch (err){
                data = null;
            }
            if(!data || data.method != method){//
                data = null;
            }else {
                itFace[route] = data;
                routeName = route;
            }
        }
    }
    if(data && data.params){
        for(let key in data.params){
            if('file'==data.params[key].type) data.hasFile=1;
        }
    }
    return {TPL:data,routeName:routeName}
}

//接口参数类型认证
//source:接口文档数据
//qs:请求的参数
function CheckParams(data, query)
{
    for (let key in data) {
        let par = data[key];
        // if (par == undefined) {//多余的参数返回错误
        //     res.json({no: 400, msg: `错误的请求参数:${key}。`});
        //     return false;
        // }
        if (undefined == par.rem && undefined == par.type) {//这里则认为是两层对象嵌套
            if(!CheckParams(data[key],query[key])){//递归
                return false;
            }
        }else {
            //参数是否缺少
            if(!query){
                return true;
            }
            let val = query[key];
            //检验必要的请求参数,非必要参数则不验证
            if (par.need && (val == null || val == undefined)) {
                _formatErr({no: 400, msg: `缺少${key}参数。`});
                return false;
            }
            if(val != undefined || val != null) {
                //参数类型
                if(par.type) {
                    try{
                        switch(par.type.toLowerCase()){
                            case 'number':
                            case 'int':
                                if((par.type == 'number'||par.type =='int')&& parseInt(val)!=val)throw Error('类型错误');
                                query[key] = parseInt(val);
                                val = query[key];
                                break;
                            case 'float':
                                if(par.type == 'float' && parseFloat(val)!=val)throw Error('类型错误');
                                query[key] = parseFloat(val);
                                val = query[key];
                                break;
                            case 'string':
                                if(val.constructor.name != 'String')throw Error('类型错误');
                                break;
                            case 'object':
                                if(val.constructor.name != 'Object')throw Error('类型错误');
                                break;
                            case 'array':
                                if(val.constructor.name != 'Array')throw Error('类型错误');
                                break;
                            case 'file':
                                if(val.path && !isExist(val.path)) throw Error('类型错误');
                                // console.log('file',val.constructor.name);
                                break;
                            default :
                                _formatErr({no: 400, msg: `${key}接口文档type类型定义错误。`});
                                return false;

                        }
                    }catch(err){_formatErr({no: 400, msg: `${key}参数类型错误。`});return false;}
                }

                //参数长度控制
                if(par.len != undefined || par.len != null){
                    //接口文档在定义的时候定义为一个对象
                    var ol = 0;
                    let name = "长度";
                    switch (par.type.toLowerCase()){
                        case 'array':
                            ol =  val.length;
                            name = "数组长度";
                            break;
                        case 'object'://数组或者对象
                            // if(query[key].length != undefined){//数组
                            //     ol =  query[key].length;
                            // }else{//对象
                            ol =  Object.keys(val).length;
                            name = "对象长度";
                            // }
                            break;
                        case 'number':
                        case 'int':
                        case 'float':
                            ol = val;
                            name = "值";
                            break;
                        case 'string':
                            ol = val.length;
                            name = "字符串长度";
                            break;
                        case 'file':
                            ol = val.size;//文件大小
                            name = "文件大小";
                            break;
                        default:
                            _formatErr({no: 400, msg: `${key}接口文档,len描述错误。`});
                            return false;

                    }
                    if (par.len.constructor.name == 'Array')
                    {//双闭区间有时候会解析成数组结构
                        if (par.len.length == 2 && par.len[0].constructor.name == 'Number' && par.len[1].constructor.name == 'Number') {
                            if (par.len[0] != undefined && ol < par.len[0]) {
                                _formatErr({no: 400, msg: `${key}的${name}不能小于${par.len[0]}。`});
                                return false;
                            }
                            if (par.len[1] != undefined && ol > data[key].len[1]) {
                                _formatErr({no: 400, msg: `${key}的${name}不能大于${par.len[1]}。`});
                                return false;
                            }
                        } else {
                            _formatErr({no: 400, msg: `${key}接口文档,len描述错误。`});
                            return false;
                        }
                    }else if(par.len.constructor.name == 'String')
                    {
                        //接口文档定义为字符串
                        let k = par.len.trim().split(',');
                        if (k.length > 2) {
                            _formatErr({no: 400, msg: `${key}指定的长度有误。`});
                            return false;
                        }

                        //null表示无穷大
                        var left = k[0].substring(1);
                        if (left.toLowerCase() == 'null') {
                            left = 'null';
                        } else {
                            left = parseFloat(left);
                        }
                        var right = k[1].substring(0, k[1].length - 1);
                        if (k[1].substring(0, k[1].length - 2).toLowerCase() == 'null') {
                            right = 'null';
                        } else {
                            right = parseFloat(right);
                        }

                        if (left != 'null') {//判断是否是左无穷

                            if (k[0].substring(0, 1) == '[') {//左边闭区间
                                if (ol < left) {
                                    _formatErr({no: 400, msg: `${key}的${name}不能小于${left}。`});
                                    return false;
                                }
                            } else {
                                if (ol <= left) {
                                    _formatErr({no: 400, msg: `${key}的${name}不能小于等于${left}。`});
                                    return false;
                                }
                            }
                        }
                        if (right != 'null') {//判断是否是右无穷
                            if (k[1].substring(k[1].length - 1, k[1].length) == ']') {//右边闭区间
                                if (ol > right) {
                                    _formatErr({no: 400, msg: `${key}的${name}不能大于${right}。`});
                                    return false;
                                }
                            } else {
                                if (ol >= right) {
                                    _formatErr({no: 400, msg: `${key}的${name}不能大于等于${right}。`});
                                    return false;
                                }
                            }
                        }
                    }else{
                        _formatErr({no: 400, msg: `${key}接口文档,len描述错误。`});
                        return false;
                    }
                }

                //枚举型判断参数是否在设置范围内
                if (par.enum) {
                    for (var i = 0; i <= par.enum.length; i++) {
                        if (par.enum[i] == val) {
                            break;
                        }
                    }
                    if (i > par.enum.length) {//表示不能在枚举的范围内找到该值
                        _formatErr({no: 400, msg: `${key}参数取值范围只能在${par.enum}。`});
                        return false;
                    }
                }

                //正则验证参数是否合法
                if(par.reg && !eval(par.reg).test((par.type == 'file' ? val.name:val))){
                    _formatErr({no: 400, msg: `${key}:格式错误`});
                    return false;
                }
            }
        }
    }
    return true;
}

let CTX;
/**
* 接口文档检测参数
*
* */
async function JustifyReq(ctx, next)
{
    CTX = ctx;
    //解析接口文件
    let {TPL,routeName} = _TPL(ctx);
    isDebug && console.log('JustifyReq',TPL,routeName);
    try {
        //get请求要去掉请求头

        if (TPL && routeName) {
            //接口访问计数
            itCount[routeName] = (itCount[routeName]?itCount[routeName]:0)+1;

            //认证接口授权状况
            let U = ctx.session;
            if (TPL.grant && !eval(TPL.grant)) {//授权未通过
                if(!itGrantFunc || ! (await itGrantFunc(ctx))) {//itGrantFunc 这个是个异步方法
                    if(Object.keys(U) <= 0){
                        _formatErr({no: 401, msg: "您尚未登录"});
                    }else {
                        _formatErr({no: 403, msg: "您无权访问该接口"});
                    }
                    return;
                }
            }

            //有文件需要解析,并且删除多余文件
            // console.log('header',ctx.header["content-type"],ctx.request.type)
            if(typeis(ctx, 'multipart/form-data')){// TPL.hasFile 不一定要接口文件才去解析
                isDebug && console.log('-----有form格式传递过来的请求')
                let data = await coForm(ctx,(upfileRoot?{uploadDir:upfileRoot}:null));
                isDebug && console.log('file',data);
                removeOtherFile(TPL,ctx);//删除多余文件
            }

            //获取请求的参数
            let query;
            if (ctx.method == 'GET') {
                query = ctx.request.query;
            }else {
                query = ctx.request.body;
            }

            //请求参数认证
            if (TPL.params) {
                if(!CheckParams(TPL.params,query)){
                    if(TPL.hasFile){//有文件就需要移除文件
                        removeFormpart(TPL,ctx);//删除文件
                    }
                    return ;
                }
            }
            await next();

            //可以在此对返回参数进行一个校验,标准化返回值
            // let t = ctx.body;
            // ctx.body = {no:200}
        } else {
            if (ctx.method === 'GET') {//渲染模板时，不需要接口文档
                await next();
            }else{
                _formatErr({no: 404, msg: "访问的模板不存在"});
            }
        }

    } catch (err) {
        console.log('err',err)
        //这里统一处理 接口文档的error参数返回
        if (err.message && TPL && TPL.error && TPL.error[err.message]) {
            // console.log('tttt',data.error[err.message])
            _formatErr({no: err.message, msg: TPL.error[err.message]});
        } else {
            _formatErr({no: 500, msg: err.message+'/n'+err.stack});
        }
        if(TPL.hasFile){
            removeFormpart(TPL,ctx);
        }
    }
}

/**
 读取文件,返回promise
 */
function readFile(path)
{
    return new Promise((resolve, reject) => {
        let data = fs.readFileSync(path, 'utf-8');
        // console.log('data',data)
        resolve(data);
    })
}

/**
 * 发生错误的时候删除上传的文件
 * @param req 请求
 */
function removeFormpart(TPL,ctx)
{
    let files = ctx.files;
    for(let f in files) {
        fs.unlink(files[f].path, (err)=> {
            err && TPL.params[f] && console.error('删除文件失败', files[f])
        });//异步清除临时目录中的上传文件
    }
}
/**
 * 删除接口参数多余的文件
 * @param TPL 接口模板对象
 * @param req请求
 */
function removeOtherFile(TPL,ctx)
{
    let params = TPL.params;
    let files = ctx.files;
    for(let item in files){
        if(!params[item]){
            fs.unlink(files[item].path,(err)=>{
                err && console.error('删除文件失败',files[f])
            });//异步清除临时目录中的上传文件
        }
    }
}

/** 格式化错误输出
 * @param {Number|{no,msg}} err
 * @returns {{no,msg}}
 * @private
 */

function _formatErr(obj)
{
    if(CTX){
        CTX.body = obj;
    }
}

//保存接口文档参数
var itFace = {};
var itCount = {};//接口访问统计
async function readitCount()
{
    itCount = await readFile(itCountpath).catch(err=>{
        // console.log('err',err)
        return {};
    });
    if(typeof itCount != "object") {
        itCount = JSON5.parse(itCount);
    }
    isDebug && console.log('itCount',itCount)
}

/**
 * 捕获系统推出信息,并做响应的保存动作
 */
process.on('SIGINT', () => {
    // console.error('Received SIGINT.  Press Control-D to exit.');
    fs.writeFileSync(itCountpath,JSON.stringify(itCount));
    process.exit(0);
});

/**
 * 判断路径文件是否存在
 */
function isExist(path) {
    try{
        fs.statSync(path);
        return true;
    }catch (err){
        return false;
    }
}

module.exports = {
    //带有 1、session.fromApp标志;2、请求参数中带有wsId的
    Init:init,
    readFile:readFile,//读文件,返回promise
    itFace:itFace,
    //对请求,根据接口文档进行验证
    JustifyReq:JustifyReq,
}