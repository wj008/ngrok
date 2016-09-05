/**
 * Created by Administrator on 2016/8/10.
 */
var mysql = require('mysql');

module.exports = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'eke123',
    database: 'ngrok'
});