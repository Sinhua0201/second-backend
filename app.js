// app.js
require('dotenv').config(); // 加载 .env 环境变量

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth'); // 新增 auth 路由
const itemsRouter = require('./routes/items');

const app = express();

app.use(logger('dev'));
app.use(cors()); // 允许跨域访问，前端才能连到后端 API
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 路由配置
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter); // 加入 auth 路由
app.use('/api/items', itemsRouter);

module.exports = app;
