var fs = require('fs');
const url=require('url');
var path = require('path');

var JSON5 = require('json5');
var typeis = require('type-is');
var coForm = require('koa-formpart');

let itCountpath = null;//itCount.json 指定输出接口访问统计文件
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
 * @param {req}  name
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
        if(isExist(path.join(`${interFaceRoot}${route}.json`))){
            data = fs.readFileSync(path.join(`${interFaceRoot}${route}.json`), 'utf-8');
            try {
                data = eval('('+data+')');
            }catch (err){
                return {TPL:"接口文档定义错误!"}
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
        if(!data && isExist(path.join(`${interFaceRoot}${`${route}_${method}`}.json`))){
            data = fs.readFileSync(path.join(`${interFaceRoot}${`${route}_${method}`}.json`), 'utf-8');
            try {
                data = eval('('+data+')');
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
        if(data){
            //处理数据中,含有的特殊字符
            let map={"{}":"$B","{S}":"$S","{U}":"$U","{X}":"$X"};
            if(data.pretreat)
            {
                if(String==data.pretreat.constructor) data.pretreat=[data.pretreat];
                data.pretreat=data.pretreat.join(";").replace(/{[SUX]?}/g,function($0)
                {
                    return map[$0];
                });
            }
            if(data.grant)
                data.grant=_formatCnd(data.grant,map);
            if(data.check)
                data.check=_formatCnd(data.check,map);
        }
    }
    if(data){
        if(data.params){
            for(let key in data.params){
                if('file'==data.params[key].type) data.hasFile=1;
            }
        }
    }
    return {TPL:data,routeName:routeName}
}

/**
 * 将API定义中的检查条件定义格式化为eval值为int的表达式字串(0:正确,>0:错误编号)
 * @param {string|{R:string,M:string,no:int}|[]} cnd
 * @param {{}} map 替换映射，格式为"{}":"提交数据对象","{S}":"会话对象","{U}":"用户信息","{X}":"扩展对象"
 * @return {{bodyCnt:int,exp:string,err:[{M,no},...]}} {bodyCnt:条件中POST或GET提交数据对象的出现次数,exp:可以eval的表达式字串,err:对应错误信息清单}
 * @private
 */
function _formatCnd(cnd,map)
{
    let ret={bodyCnt:0,exp:'',err:[]};
    if(String==cnd.constructor)
        cnd=[{R:cnd}];
    else if(Array!=cnd.constructor)
        cnd=[cnd];
    for(let i=0;i<cnd.length;i++)
    {
        let R=cnd[i],M=null,no=null;
        if(String!=R.constructor)
        {
            M=R.M;no=R.no;R=R.R;
        }
        ret.exp+=' || (('+R+')?0:'+(i+1)+')';
        R={M:M,no:no};
        if(!M) delete R.M;
        if(!no) delete R.no;
        ret.err.push(R);
    }
    ret.exp=ret.exp.substr(4).replace(/{[SUX]?}/g,function($0)
    {
        if('{}'==$0) ret.bodyCnt++;
        return map[$0];
    });
    return ret;
}
/**
 * 计算检查条件
 * @param {{bodyCnt:int,exp:string,err:[{M,no},...]}} cnd 检查条件
 * @param {int} no 默认错误no号
 * @param {string} cndName 检查条件名
 * @param {*} $B 提交数据
 * @param {*} $S 会话对象
 * @param {*} $U 用户信息
 * @return {null|{no:int,msg:string}}
 * @private
 */
function _CheckCnd(cnd,no,cndName,$B,$S,$U)
{
    let err;
    try{err=eval(cnd.exp);}
    catch(e){
        return {no:500,msg:'接口['+cndName+']错:'+e.toString()};
    }
    if(!err) return null;
    err--;
    return {no:cnd.err[err].no || no,msg:cnd.err[err].M};
}

//接口参数类型认证
//source:接口文档数据
//qs:请求的参数
function CheckParams(data, query)
{
    for (let key in data) {
        let par = data[key];
        if(par.constructor!=Object)continue;//非
        let errkey = par.lbl?par.lbl:(par.rem?par.rem:key);//发生错误时的key的称呼方式
        if(par.constructor != Object){return `${errkey}接口文档定义错误。`}
        if (null==par.rem && null==par.lbl) {//这里则认为是两层及以上对象嵌套,递归
            if(par.need && null==query[key]){query[key]={};delete par.need;delete par.rem;delete par.lbl;}//如果需要的传外层的话,且为空时,默认给空对象
            let msg =CheckParams(data[key],query[key]);
            if(msg){return msg;}
        }else {
            //参数是否缺少
            if(!query){return 0;}
            let val = query[key];
            //检验必要的请求参数,非必要参数则不验证
            if (par.need&&null==val) {return`缺少${par.lbl?par.lbl:(par.rem?par.rem:key)}参数。`;}
            //若未传,且有默认值,则设置默认值,然后继续向下检验默认值
            if(null!=par.default&&null==val){query[key]=par.default;val = par.default;RES.usedefault = true;}
            if(null==val){continue;}//未传的非必须参数不需要校验
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
                        case 'string':if(val.constructor.name != 'String')throw Error('类型错误');break;
                        case 'object':if(val.constructor.name != 'Object')throw Error('类型错误');break;
                        case 'array':if(val.constructor.name != 'Array')throw Error('类型错误');break;
                        case 'file':if(val.path && !isExist(val.path)) throw Error('类型错误');break;
                        default :
                            if(val.constructor.name != 'String')throw Error('类型错误');
                    }
                }catch(err){return `${errkey}参数类型错误。`;}
            }
            let msg;
            //参数长度控制
            if(par.len){
                //接口文档在定义的时候定义为一个对象
                var ol = 0;
                let name = "长度";
                switch (par.type.toLowerCase()){
                    case 'array':
                        ol =  val.length;
                        name = "数组长度";
                        break;
                    case 'object'://数组或者对象
                        ol =  Object.keys(val).length;
                        name = "对象长度";
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
                        ol = val.length;
                        name = "字符串长度";
                        break;
                }
                if((msg=getRange(ol,par.len))){
                    return `${errkey}${name}${msg}${'file'==par.type?'字节':''}`;
                }
            }
            //范围控制
            if(par.range && (msg=getRange(val,par.range))){return `${errkey}${'string'==par.type?"字符内容":""}${msg}`;}
            //枚举型判断参数是否在设置范围内
            if (par.enum && par.enum.indexOf(val)<0) {return `${errkey}参数只能是${par.enum}。`;}
            //正则验证参数是否合法
            if(par.reg && !eval(par.reg).test((par.type == 'file' ? val.name:val))){return `${errkey}格式错误`;}
            // RES.usedefault = null;
        }
    }
    return 0;
}

/**
 * @param {string|object} range like '[1,3)','["a","b"]' ,[1,3],['a','b']...
 * @param {*} val
 */
function getRange(val,range){
    if (range.constructor.name == 'Array')
    {//双闭区间有时候会解析成数组结构
        let s = '不能'
        if(range.length!= 2){return '接口文档描述错误'}
        if(null!=range[0]&&val<range[0]){return `${s}小于${range[0]}`}
        if(null!=range[1]&&val>range[1]){return `${s}大于${range[1]}`}
    }else if(range.constructor.name == 'String')
    {
        //接口文档定义为字符串
        range = range.trim();
        //null表示无穷大
        var cl = range.substr(0,1);//k[0].substring(1);
        var cr = range.substr(-1,1);
        let rng; try{rng = JSON.parse("["+range.substr(1,range.length-2)+"]");}catch(err){return `${range}格式错误`;}
        let s = '不能';
        if(rng[0]==rng[1] && (val < rng[0] || val > rng[0]))
            return "是"+rng[0];
        if(null!=rng[0] && (cl=="["?(val<rng[0]):(val<=rng[0]))) return s+(cl=='['?`小于`:'小于等于')+rng[0];
        if(null!=rng[1] && (cr=="]"?(val>rng[1]):(val>=rng[1]))) return s+(cr==']'?`大于`:'大于等于')+rng[1];
        return 0;
    }else{
        return `接口文档,range描述错误。`;
    }
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
    // isDebug && console.log('JustifyReq',TPL,routeName);
    if(TPL&&typeof TPL != 'object'){_formatErr({no: 500, msg: TPL});return;}
    try {
        if (TPL && routeName) {
            //接口访问计数
            itCount[routeName] = (itCount[routeName]?itCount[routeName]:0)+1;

            //判断url的一致性
            if(TPL.url != url.parse(ctx.url).pathname){
                _formatErr({no: 400, msg: "请求的url与接口不一致"});
                return;
            }
            //有文件需要解析,并且删除多余文件
            if(typeis(ctx, 'multipart/form-data')){// TPL.hasFile 不一定要接口文件才去解析
                isDebug && console.log('-----有form格式传递过来的请求')
                let data = await coForm(ctx,(upfileRoot?{uploadDir:upfileRoot}:null));
                isDebug && console.log('file',data);
                removeOtherFile(TPL,ctx);//删除多余文件
            }

            //获取请求的参数
            let $B=('GET'==ctx.method)?ctx.request.query:ctx.request.body;
            let $S=ctx.session || {};
            let $U=$S.user;
            let err;
            //认证接口授权状况
            if(TPL.grant && (err=_CheckCnd(TPL.grant,403,'grant',$B,$S,$U))) {
                if(!itGrantFunc || ! (await itGrantFunc(ctx))) {//itGrantFunc 这个是个异步方法
                    if(!$U){
                        return _formatErr({no: 401, msg: "您尚未登录"});
                    }else {
                        return _formatErr({no: 403, msg: "您无权访问该接口"});
                    }
                }
            }

            //请求参数认证
            if (TPL.params) {
                let msg ;
                try{
                    if((msg=CheckParams(TPL.params,$B))){
                        _formatErr({no:400,msg:`${CTX.usedefault?'默认值错误:':''}${msg}`});
                        if(TPL.hasFile){//有文件就需要移除文件
                            removeFormpart(TPL,ctx);//删除文件
                        }
                        return ;
                    }
                }catch(err){
                    return ;
                }
            }

            if(TPL.pretreat) try{
                eval(TPL.pretreat);
            }
            catch(e){
                return _formatErr({no:500,msg:'接口[pretreat]错:'+e.toString()});
            }

            if(TPL.check && (err=_CheckCnd(TPL.check,400,'check',$B,$S,$U)))
                return _formatErr(err);
            await next();
        } else if ('GET'==ctx.method) {//渲染模板时，不需要接口文档{
            await next();
        } else{
            _formatErr({no:404,msg:`访问的模板不存在`});
        }

    } catch (err) {
        //这里统一处理 接口文档的error参数返回
        console.log('error',err)
        if (err.message && TPL && TPL.error && TPL.error[err.message]) {
            // console.log('tttt',data.error[err.message])
            _formatErr({no: err.message, msg: TPL.error[err.message]})
        } else {
            _formatErr({no: 500, msg: err.message+'/n'+err.stack});
        }
        if(TPL && TPL.hasFile){
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
    if(itCountpath)fs.writeFileSync(itCountpath,JSON.stringify(itCount));
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