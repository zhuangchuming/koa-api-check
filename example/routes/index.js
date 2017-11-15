'use strict';
var router = require('koa-router')();
const register = require('./user/register');
const login = require('./user/login');
const edit = require('./api/edit');
//从这里开始使用接口检测功能
router.use(require('../../index').JustifyReq);
router.use('/apiCheck/user',register.routes(),register.allowedMethods());
router.use('/apiCheck/user',login.routes(),login.allowedMethods());
router.use('/apiCheck/api',edit.routes(),edit.allowedMethods());

module.exports = router;
