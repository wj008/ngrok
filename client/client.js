/**
 * Created by Administrator on 2016/8/2.
 */
var net = require('net');
var svnet_1 = require("./svnet");
var Config = require('./client_config.js');
var client = new net.Socket();
var tsock = new svnet_1.TSocket(client);
client.setTimeout(3600000);
var tunnelId = 0;
var serverMaps = {};
var authTice = 0;
//心跳
tsock.on('heart', function (data) {
    console.log('heart:', data, tsock.isAuth, new Date());
});
tsock.on('notice', function (type, data) {
    console.log(type, data);
    if (type == 0) {
        if (data) {
            console.error(data);
        }
    }
    if (type == 1) {
        if (data) {
            console.error(data);
        }
        authTice++;
        tsock.destroy();
    }
    //重置
    if (type == 2) {
        authTice = 0;
        tsock.destroy();
    }
});
//授权回来
tsock.on('auth', function (data) {
    if (data.error) {
        authTice++;
        console.error(data.error);
        return;
    }
    tsock.isAuth = true;
    tsock.startHeart(60000);
    var createTunnelServer = function (option) {
        var server = tsock.createTunnelTcpServer(function (sock) {
            var socket = new net.Socket();
            sock.bind(socket);
            socket.connect(option.localport, option.localhost, function () {
                sock.reday();
            });
        });
        server.on('error', function (err) {
            console.error(option.mode, option, err);
        });
        server.listen(option.id);
    };
    if (data.success && data.setting) {
        console.log(data.success);
        for (var i = 0; i < data.setting.length; i++) {
            var option = data.setting[i];
            createTunnelServer(option);
        }
    }
});
client.on('timeout', function () {
    client.end();
    console.error('client connect timeout! ', new Date());
});
client.on('error', function (e) {
    console.error('Can not connect remote server! ' + e.errno, new Date());
    client.destroy();
});
client.on('end', function () {
    console.error('client end! ', new Date());
});
client.on('close', function () {
    console.error('client close! ', new Date());
    setTimeout(function () {
    }, 10000);
});
client.on('connect', function () {
    console.log('connect....', new Date());
    tsock.init();
    //发起授权
    tsock.auth({ user: Config.user, pass: Config.pass });
});
client.connect(Config.serverPort, Config.serverIP);
//# sourceMappingURL=client.js.map