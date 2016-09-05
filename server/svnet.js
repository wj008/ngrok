var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var EventEmitter = require('events');
var net = require('net');
//数据读取器
var Reader = (function () {
    function Reader(socket) {
        this.tempData = null;
        this.socket = socket;
    }
    Reader.prototype.read = function (len) {
        var data;
        if (this.tempData !== null && this.tempData.length > 0) {
            data = this.tempData.shift();
        }
        else {
            this.tempData = null;
            data = this.socket.read(len);
            if (data === null) {
                return null;
            }
        }
        return data;
    };
    Reader.prototype.saveData = function (data) {
        if (this.tempData === null) {
            this.tempData = [];
        }
        this.tempData.push(data);
    };
    ;
    return Reader;
})();
var TunnelClient = (function (_super) {
    __extends(TunnelClient, _super);
    function TunnelClient(tSocket, tunnelId, id) {
        if (id === void 0) { id = null; }
        this.id = 0;
        this.otype = 0; //tcp=1
        this.stream = null;
        this.addTraffic = null;
        this.callback = null;
        _super.prototype.constructor.call(this);
        if (id == null) {
            TunnelClient.sockIndex++;
            if (TunnelClient.sockIndex > 100000000) {
                TunnelClient.sockIndex = 1;
            }
            while (tSocket.sockMap[TunnelClient.sockIndex]) {
                TunnelClient.sockIndex++;
            }
            this.id = TunnelClient.sockIndex;
        }
        else {
            this.id = id;
        }
        console.log('create', this.id);
        var self = this;
        if (tSocket.user && typeof (tSocket.user.addTraffic) == 'function') {
            this.addTraffic = function (type, byte) {
                return tSocket.user.addTraffic(type, byte);
            };
        }
        this.tSocket = tSocket;
        this.socket = tSocket.socket;
        this.tunnelId = tunnelId;
        tSocket.sockMap[this.id] = self;
        this.on('end', function () {
            this.destroy();
        });
    }
    //发起连接
    TunnelClient.prototype.connect = function (callback) {
        this.callback = callback;
        var head = new Buffer(16);
        head.writeUInt16BE(7, 0);
        head.writeUInt16BE(this.tunnelId, 4);
        head.writeUInt32BE(this.id, 8);
        if (!this.socket.writable) {
            return false;
        }
        this.socket.write(head);
        if (this.addTraffic !== null) {
            var ntype = this.addTraffic(this.otype, 16);
            //流量不足
            if (ntype != 0) {
                if (ntype == 1) {
                    this.tSocket.notice(1, { error: 'HTTP流量不足.' });
                }
                else if (ntype == 2) {
                    this.tSocket.notice(1, { error: 'TCP流量不足.' });
                }
                else {
                    this.tSocket.notice(1, { error: '流量不足.' });
                }
                this.tSocket.destroy();
            }
        }
    };
    TunnelClient.prototype.reday = function () {
        var head = new Buffer(16);
        head.writeUInt16BE(8, 0);
        head.writeUInt16BE(this.tunnelId, 4);
        head.writeUInt32BE(this.id, 8);
        if (!this.socket.writable) {
            return false;
        }
        this.socket.write(head);
    };
    TunnelClient.prototype.reconnect = function () {
        if (typeof (this.callback) == 'function') {
            this.callback();
        }
    };
    TunnelClient.prototype.end = function () {
        console.log('end', this.id);
        if (this.socket.writable) {
            var head = new Buffer(16);
            head.writeUInt16BE(9, 0);
            head.writeUInt16BE(0, 4);
            head.writeUInt32BE(this.id, 8);
            this.socket.write(head);
        }
        this.destroy();
    };
    TunnelClient.prototype.destroy = function () {
        var stream = this.stream;
        if (stream) {
            if (stream.writable) {
                stream.end();
            }
            if (stream._writableState.finished) {
                stream.destroy();
            }
            else {
                stream.once('finish', this.stream.destroy);
            }
        }
        this.tSocket.sockMap[this.id] = null;
        delete this.tSocket.sockMap[this.id];
        this.emit('destroy');
    };
    TunnelClient.prototype.write = function (data) {
        var head = new Buffer(16);
        var buf;
        if (typeof (data) === 'string') {
            buf = new Buffer(data);
        }
        else if (Buffer.isBuffer(data)) {
            buf = data;
        }
        else {
            return false;
        }
        head.writeUInt16BE(2, 0);
        head.writeUInt16BE(buf.length, 4);
        head.writeUInt32BE(this.id, 8);
        if (!this.socket.writable) {
            return false;
        }
        this.socket.write(head);
        if (buf.length > 0) {
            this.socket.write(buf);
        }
        if (this.addTraffic !== null) {
            var ntype = this.addTraffic(this.otype, 16 + buf.length);
            if (ntype != 0) {
                if (ntype == 1) {
                    this.tSocket.notice(1, { error: 'HTTP流量不足.' });
                }
                else if (ntype == 2) {
                    this.tSocket.notice(1, { error: 'TCP流量不足.' });
                }
                else {
                    this.tSocket.notice(1, { error: '流量不足.' });
                }
                this.tSocket.destroy();
            }
        }
        return true;
    };
    TunnelClient.prototype.bind = function (stream) {
        if (stream === null || stream._binded) {
            return false;
        }
        this.stream = stream;
        stream._binded = true;
        var self = this;
        var onStream = stream._onStream = function () {
            if (!stream._binded) {
                return;
            }
            if (!stream.readable) {
                return;
            }
            if (stream.__pause) {
                return;
            }
            var chunk = stream.read(4096) || stream.read();
            if (chunk === null) {
                return;
            }
            self.write(chunk);
            onStream();
        };
        var onEnd = stream._onEnd = function () {
            self.unbind();
            self.end();
        };
        stream.on('error', function () {
            self.unbind();
            self.end();
        });
        stream.on('end', stream._onEnd);
        stream.on('readable', stream._onStream);
        if (stream.readable) {
            stream.emit('readable');
        }
        if (!stream._writeOffBind) {
            function onData(data) {
                if (!stream._binded) {
                    return false;
                }
                if (!stream.writable) {
                    return false;
                }
                stream.write(data);
            }
            self.removeListener('data', onData);
            self.on('data', onData);
        }
    };
    TunnelClient.prototype.unbind = function () {
        if (this.stream) {
            if (typeof (this.stream._onStream) == 'function') {
                this.stream.removeListener('readable', this.stream._onStream);
                this.stream._onStream = null;
            }
            if (typeof (this.stream._onEnd) == 'function') {
                this.stream.removeListener('end', this.stream._onEnd);
                this.stream._onEnd = null;
            }
            this.stream._binded = false;
        }
        this.stream = null;
    };
    TunnelClient.sockIndex = 0;
    return TunnelClient;
})(EventEmitter);
var TunnelTcpServer = (function (_super) {
    __extends(TunnelTcpServer, _super);
    function TunnelTcpServer(tSocket, callback) {
        this.tunnelId = null;
        this.conneted = false;
        _super.prototype.constructor.call(this);
        this.tSocket = tSocket;
        this.socket = tSocket.socket;
        var self = this;
        this.on('connect', function (sock) {
            callback(sock);
        });
        this.on('error', function (err) {
            self.close();
        });
    }
    //监听数据
    TunnelTcpServer.prototype.listen = function (tunnelId) {
        if (this.conneted) {
            this.close();
        }
        this.conneted = true;
        this.tunnelId = tunnelId;
        this.tSocket.serverMap[tunnelId] = this;
        return true;
    };
    TunnelTcpServer.prototype.success = function (data) {
        this.emit('success', data);
    };
    TunnelTcpServer.prototype.close = function () {
        if (this.tunnelId !== null) {
            this.tSocket.serverMap[this.tunnelId] = null;
        }
        this.tunnelId = null;
        this.conneted = false;
        this.emit('close');
    };
    return TunnelTcpServer;
})(EventEmitter);
var TSocket = (function (_super) {
    __extends(TSocket, _super);
    function TSocket(socket) {
        this.socket = null;
        this.isAuth = false;
        this.sockMap = {};
        this.serverMap = {};
        this.timer = null;
        this.user = null;
        this.destroyed = false;
        this._pause = false;
        _super.prototype.constructor.call(this);
        this.socket = socket;
        this.initReader();
    }
    TSocket.prototype.pause = function () {
        this._pause = true;
    };
    TSocket.prototype.resume = function () {
        this._pause = false;
        this.socket.emit('readable');
    };
    TSocket.prototype.init = function () {
        this.destroyed = false;
        this.isAuth = false;
        this.stopHeart();
    };
    TSocket.prototype.startHeart = function (time) {
        var self = this;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.timer = setInterval(function () {
            self.heart();
        }, time);
    };
    TSocket.prototype.stopHeart = function () {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    };
    //关闭连接
    TSocket.prototype.destroy = function () {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        console.log('.....destroy');
        this.isAuth = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        for (var i in this.sockMap) {
            var sock = this.sockMap[i];
            if (sock) {
                sock.destroy();
            }
        }
        this.sockMap = {};
        for (var i in this.serverMap) {
            var server = this.serverMap[i];
            if (server) {
                server.close();
            }
        }
        this.serverMap = {};
        var socket = this.socket;
        if (socket.writable) {
            socket.end();
        }
        if (!socket.destroyed && socket._writableState.finished) {
            socket.destroy();
        }
        else {
            socket.once('finish', socket.destroy);
        }
        this.emit('destroy');
    };
    TSocket.prototype.initReader = function () {
        var socket = this.socket;
        var reader = new Reader(socket);
        var self = this;
        var onAuth = function () {
            //console.log(self.isAuth, 'auth-----------');
            //如果已经验证就继续
            var head = reader.read(8);
            if (head === null) {
                return false;
            }
            var k1 = head.readUInt16BE(0);
            var len = head.readUInt16BE(4);
            if (k1 !== 1203) {
                return false;
            }
            var chunk = reader.read(len);
            if (chunk === null) {
                reader.saveData(head);
                return false;
            }
            var strdata = chunk.toString();
            if (!/^\{.*\}$/.test(strdata)) {
                self.destroy();
                return false;
            }
            try {
                var data = JSON.parse(strdata);
                self.emit('auth', data);
                if (!self.isAuth) {
                    self.destroy();
                    return false;
                }
                return true;
            }
            catch (e) {
                self.destroy();
                return false;
            }
        };
        var onReadData = function () {
            if (self._pause) {
                return;
            }
            if (!socket.readable || !socket.writable) {
                return false;
            }
            if (!(self.isAuth || onAuth())) {
                return;
            }
            var head = reader.read(16);
            if (head === null) {
                return;
            }
            var p1 = head.readUInt16BE(0);
            var p2 = head.readUInt16BE(4);
            // console.log('read', p1, p2);
            switch (p1) {
                //心跳包
                case 1:
                    {
                        var p3 = head.readUInt32BE(8);
                        var time = p3 * 1000 + p2;
                        self.emit('heart', time);
                        onReadData();
                        return;
                    }
                //数据转发包
                case 2:
                    {
                        var id = head.readUInt32BE(8);
                        var len = p2;
                        if (len === 0) {
                            onReadData();
                            return;
                        }
                        if (len > 4100) {
                            self.destroy();
                            return;
                        }
                        if (len == 0) {
                            onReadData();
                            return;
                        }
                        var chunk = reader.read(len);
                        if (chunk === null) {
                            reader.saveData(head);
                            return;
                        }
                        self.emit('data', chunk, id);
                        var sock = self.sockMap[id] || null;
                        if (sock) {
                            sock.emit('data', chunk);
                        }
                        onReadData();
                        return;
                    }
                //客户端收到服务端的通知
                case 4:
                    {
                        var tunnelId = p2;
                        var len = head.readUInt32BE(8);
                        if (len === 0 || len > 4100) {
                            self.destroy();
                            return;
                        }
                        var chunk = reader.read(len);
                        if (chunk === null) {
                            reader.saveData(head);
                            return;
                        }
                        var strdata = chunk.toString();
                        if (!/^\{.*\}$/.test(strdata)) {
                            self.destroy();
                            return;
                        }
                        try {
                            var server = self.serverMap[tunnelId] || null;
                            if (server) {
                                var data = JSON.parse(strdata);
                                if (data.error) {
                                    server.emit('error', data.error);
                                }
                                else {
                                    server.success(data.success);
                                }
                            }
                            onReadData();
                            return;
                        }
                        catch (e) {
                            self.destroy();
                            return;
                        }
                    }
                //有新连接连入
                case 7:
                    {
                        var tunnelId = p2;
                        var id = head.readUInt32BE(8);
                        var server = self.serverMap[tunnelId] || null;
                        if (server) {
                            var sock = self.createTunnelClient(tunnelId, id);
                            server.emit('connect', sock);
                        }
                        onReadData();
                        return;
                    }
                case 8:
                    {
                        var tunnelId = p2;
                        var id = head.readUInt32BE(8);
                        var sock = self.sockMap[id] || null;
                        if (sock) {
                            sock.reconnect();
                        }
                        onReadData();
                        return;
                    }
                //通讯断开包
                case 9:
                    {
                        var tunnelId = p2;
                        var id = head.readUInt32BE(8);
                        var sock = self.sockMap[id] || null;
                        if (sock) {
                            sock.end();
                        }
                        onReadData();
                        return;
                    }
                case 5:
                    {
                        var type = p2;
                        var len = head.readUInt32BE(8);
                        if (len === 0) {
                            self.emit('notice', type, null);
                            onReadData();
                            return;
                        }
                        if (len > 4100) {
                            self.destroy();
                            return;
                        }
                        var chunk = reader.read(len);
                        if (chunk === null) {
                            reader.saveData(head);
                            return;
                        }
                        var strdata = chunk.toString();
                        if (!/^\{.*\}$/.test(strdata)) {
                            self.destroy();
                            return;
                        }
                        try {
                            var data = JSON.parse(strdata);
                            self.emit('notice', type, data);
                            onReadData();
                            return;
                        }
                        catch (e) {
                            self.destroy();
                            return;
                        }
                    }
                default:
                    self.destroy();
                    return;
            }
        };
        socket.on('error', function (err) {
            socket.destroy();
        });
        socket.on('end', function () {
            self.destroy();
        });
        socket.on('close', function () {
            self.destroy();
        });
        socket.on('readable', onReadData);
    };
    //心跳包
    TSocket.prototype.heart = function (intime) {
        if (!this.socket.writable) {
            return false;
        }
        var head = new Buffer(16);
        var time = intime || new Date().getTime();
        var ts = parseInt(time / 1000);
        var ms = time % 1000;
        head.writeUInt16BE(1, 0);
        head.writeUInt16BE(ms, 4);
        head.writeUInt32BE(ts, 8);
        this.socket.write(head);
        if (this.user && typeof (this.user.addTraffic) == 'function') {
            this.user.addTraffic(2, 16);
        }
    };
    //认证
    TSocket.prototype.auth = function (data) {
        if (!this.socket.writable) {
            return false;
        }
        var head = new Buffer(8);
        var str = JSON.stringify(data);
        var buf = new Buffer(str);
        head.writeUInt16BE(1203, 0);
        head.writeUInt16BE(buf.length, 4);
        this.socket.write(head);
        if (buf.length > 0) {
            this.socket.write(buf);
        }
        return true;
    };
    //发起连接
    TSocket.prototype.createTunnelClient = function (tunnelId, id) {
        if (id === void 0) { id = null; }
        return new TunnelClient(this, tunnelId, id);
    };
    //创建一个通道服务
    TSocket.prototype.createTunnelTcpServer = function (callback) {
        return new TunnelTcpServer(this, callback);
    };
    //获取通道
    TSocket.prototype.getTunnelTcpServer = function (tunnelId) {
        return this.serverMap[tunnelId] || null;
    };
    //总的回复
    TSocket.prototype.notice = function (type, data) {
        if (!this.socket.writable) {
            return false;
        }
        var str = JSON.stringify(data);
        var buf = new Buffer(str);
        var head = new Buffer(16);
        head.writeUInt16BE(5, 0);
        head.writeUInt16BE(type, 4);
        head.writeUInt32BE(buf.length, 8);
        this.socket.write(head);
        if (buf.length > 0) {
            this.socket.write(buf);
        }
        return true;
    };
    //回复通道
    TSocket.prototype.noticeTunnel = function (tunnelId, data) {
        if (!this.socket.writable) {
            return false;
        }
        var str = JSON.stringify(data);
        var buf = new Buffer(str);
        var head = new Buffer(16);
        head.writeUInt16BE(4, 0);
        head.writeUInt16BE(tunnelId, 4);
        head.writeUInt32BE(buf.length, 8);
        this.socket.write(head);
        if (buf.length > 0) {
            this.socket.write(buf);
        }
        return true;
    };
    return TSocket;
})(EventEmitter);
exports.TSocket = TSocket;
var TServer = (function (_super) {
    __extends(TServer, _super);
    function TServer(func) {
        _super.prototype.constructor.call(this);
        var self = this;
        //创建服务
        this.server = net.createServer(function (socket) {
            var sock = new TSocket(socket);
            socket.setTimeout(10000, function () {
                //等待数据超时
                if (!sock.isAuth && !socket.destroyed) {
                    if (socket.writable) {
                        socket.end();
                    }
                    if (socket._writableState.finished) {
                        socket.destroy();
                    }
                    else {
                        socket.once('finish', socket.destroy);
                    }
                }
            });
            func(sock);
        });
        //监听服务错误
        this.server.on('error', function (err) {
            self.emit('error', err);
        });
    }
    TServer.prototype.close = function () {
        this.server.close();
    };
    TServer.prototype.listen = function (port, host, callbace) {
        this.server.listen(port, host, callbace);
    };
    return TServer;
})(EventEmitter);
exports.TServer = TServer;
//# sourceMappingURL=svnet.js.map