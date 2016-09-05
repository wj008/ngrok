var net = require('net');
var http = require('http');
var svnet_1 = require("./svnet");
var user_1 = require('./user');
var Config = require('./server_config.js');
var NgrokServer = (function () {
    function NgrokServer() {
    }
    NgrokServer.getPost = function () {
        for (var i = Config.openPortRange[0]; i <= Config.openPortRange[1]; i++) {
            if (!NgrokServer.serverMaps[i]) {
                return i;
            }
        }
        return 0;
    };
    ;
    //获得头
    NgrokServer.getHeader = function (stream, callback) {
        var header = '';
        function onRead() {
            if (!stream.readable) {
                return;
            }
            var chunk = stream.read(1024) || stream.read();
            if (chunk === null) {
                return;
            }
            header += chunk.toString();
            var m = header.match(/\r?\n\r?\n/);
            if (header.length > 2048 && !m) {
                stream.removeListener('readable', onRead);
                callback(null, header, stream);
                return;
            }
            if (!m) {
                onRead();
                return;
            }
            var idx = m.index + m[0].length;
            var haad = header.substring(0, idx);
            var last = header.substring(idx);
            header = haad;
            stream.removeListener('readable', onRead);
            if (last.length > 0) {
                var buf = new Buffer(last);
                stream.unshift(buf);
            }
            callback(null, header, stream);
        }
        ;
        stream.on('readable', onRead);
    };
    NgrokServer.createHttpServer = function () {
        var httpserv = net.createServer(function (socket) {
            console.log('http request in....');
            //设置超时
            socket.on('error', function (err) {
                console.log('http client error:', err);
                socket.destroy();
            });
            socket.on('end', function (err) {
                console.log('http client end');
                socket.destroy();
            });
            NgrokServer.getHeader(socket, function (err, header, socket) {
                var m = header.match(/Host:\s*([a-z0-9_\.-]+)(?:\:(\d+))?/i);
                if (!m) {
                    socket.end('HTTP/1.1 404 OK\n\nThe Host was not binding.');
                    return;
                }
                var host = m[1].toLowerCase();
                var key = 'http:' + host;
                // console.log(header);
                var map = NgrokServer.serverMaps[key] || null;
                if (!map) {
                    socket.end('HTTP/1.1 404 OK\n\nThe Host [' + host + '] was not binding.');
                    return;
                }
                var tsock = map.tsock;
                var tunnelId = map.tunnelId;
                if (!tsock || tunnelId == void 0) {
                    socket.end('HTTP/1.1 404 OK\n\nThe Host [' + host + '] was not binding.');
                    return;
                }
                var osock = tsock.createTunnelClient(tunnelId);
                osock.otype = 1;
                osock.connect(function () {
					osock.write(header);
                    osock.bind(socket);
                });
            });
        });
        httpserv.on('error', function (err) {
            console.log('httpserv is error!', Config.httpPort, err, new Date());
        });
        httpserv.on('close', function () {
            console.log('httpserv is close!', Config.httpPort, new Date());
        });
        httpserv.listen(Config.httpPort, '0.0.0.0', function () {
            console.log('httpserv is start!', Config.httpPort, new Date());
        });
    };
    NgrokServer.createTcpServer = function () {
        var tserver = new svnet_1.TServer(function (tsock) {
            console.log('new connet...');
            //心跳回复
            tsock.on('heart', function (time) {
                tsock.heart(time);
            });
            var createHttpTunnelServer = function (tunnelId, option) {
                console.log('创建了HTTP服务绑定', option);
                if (tsock.isAuth == false) {
                    tsock.close();
                    return;
                }
                if (!(option.domain && typeof (option.domain) == 'string')) {
                    tsock.noticeTunnel(tunnelId, { error: '没有绑定的http host' });
                }
                var key = 'http:' + option.domain;
                tsock.on('destroy', function () {
                    console.log('HTTP连接关闭.......');
                    NgrokServer.serverMaps[key] = null;
                });
                NgrokServer.serverMaps[key] = { tsock: tsock, tunnelId: tunnelId };
                tsock.noticeTunnel(tunnelId, { success: { domain: option.domain } });
            };
            var createTcpTunnelServer = function (tunnelId, option) {
                console.log('创建了TCP服务绑定', option);
                var port = option.port || 0;
                if (port <= 0) {
                    port = NgrokServer.getPost();
                }
                if (port < Config.openPortRange[0] || port > Config.openPortRange[1]) {
                    tsock.noticeTunnel(tunnelId, { error: '端口范围必须在 ' + Config.openPortRange[0] + '-' + Config.openPortRange[1] + ' 之间。' });
                    return;
                }
                var tcpserv = net.createServer(function (socket) {
                    console.log('socket in....');
                    socket.setTimeout(600000, function () {
                        socket.end();
                    });
                    var osock = tsock.createTunnelClient(tunnelId);
                    osock.otype = 2;
                    osock.connect();
                    osock.bind(socket);
                });
                tcpserv.on('error', function (err) {
                    console.log('tcpserv is error!', port, tunnelId, new Date());
                    tsock.noticeTunnel(tunnelId, { error: err.toString() });
                });
                tcpserv.on('close', function () {
                    console.log('tcpserv is close!', port, tunnelId, new Date());
                    tsock.noticeTunnel(tunnelId, { error: '远程关闭' });
                });
                tcpserv.listen(port, '0.0.0.0', function () {
                    console.log('tcpserv is start!', port, tunnelId, new Date());
                });
                var key = 'tcp:' + port;
                tsock.on('destroy', function () {
                    console.log('TCP连接关闭.......');
                    tcpserv.close();
                    NgrokServer.serverMaps[key] = null;
                });
                NgrokServer.serverMaps[key] = tcpserv;
                tsock.noticeTunnel(tunnelId, { success: { port: port } });
            };
            //验证授权
            tsock.on('auth', function (data) {
                tsock.isAuth = true;
                if (!data || typeof (data) != 'object') {
                    tsock.isAuth = false;
                    tsock.notice(0, '非法数据提交');
                    return;
                }
                if (!data.user || typeof (data.user) != 'string' || data.user == '') {
                    tsock.isAuth = false;
                    tsock.auth({ error: '用户名必须填写' });
                    return;
                }
                if (!data.pass || typeof (data.pass) != 'string' || data.pass == '') {
                    tsock.isAuth = false;
                    tsock.auth({ error: '密码必须填写' });
                    return;
                }
                var user = new user_1.UserModel();
                user.login(data.user, data.pass, function (err, state) {
                    if (err) {
                        tsock.isAuth = false;
                        tsock.auth({ error: '服务器异常，无法处理请求' });
                        return;
                    }
                    console.log(state);
                    if (state === 9) {
                        tsock.isAuth = false;
                        tsock.auth({ error: '用户名密码不正确.' });
                        return;
                    }
                    if (state === 1) {
                        tsock.isAuth = false;
                        tsock.auth({ error: 'HTTP流量不足.' });
                        return;
                    }
                    if (state === 2) {
                        tsock.isAuth = false;
                        tsock.auth({ error: 'TCP流量不足.' });
                        return;
                    }
                    if (state === 3) {
                        tsock.isAuth = false;
                        tsock.auth({ error: '流量不足.' });
                        return;
                    }
                    tsock.user = user;
                    var options = user.getSetting();
                    tsock.auth({ success: '登录服务器成功.', setting: options });
                    for (var i = 0; i < options.length; i++) {
                        var option = options[i];
                        if (option.mode == 'http') {
                            createHttpTunnelServer(option.id, option);
                        }
                        else if (option.mode == 'tcp') {
                            createTcpTunnelServer(option.id, option);
                        }
                        else {
                            tsock.noticeTunnel(option.id, { error: '不支持的mode:' });
                        }
                    }
                });
            });
            tsock.on('destroy', function () {
                if (tsock.user) {
                    try {
                        tsock.user.save();
                    }
                    catch (e) {
                    }
                }
                console.log('tsock end...');
            });
        });
        tserver.on('error', function (err) {
            console.log('server is error!', Config.serverPort, err, new Date());
        });
        tserver.listen(Config.serverPort, '0.0.0.0', function () {
            console.log('server is running at port', Config.serverPort, '...', new Date());
        });
    };
    NgrokServer.serverMaps = {};
    return NgrokServer;
})();
exports.NgrokServer = NgrokServer;
//# sourceMappingURL=ngrok_server.js.map