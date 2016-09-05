/**
 * Created by Administrator on 2016/8/10.
 */
var pool = require('./db.js');
var Traffic = (function () {
    function Traffic() {
        this.megabytes = 0;
        this.byte = 0;
    }
    Traffic.prototype.init = function (megabytes, byte) {
        this.byte = byte;
        this.megabytes = megabytes;
    };
    Traffic.prototype.add = function (byte) {
        this.byte += byte;
        if (this.byte >= 1048576) {
            var mb = parseInt(this.byte / 1048576);
            this.byte = this.byte % 1048576;
            this.megabytes = mb;
        }
    };
    return Traffic;
})();
var UserModel = (function () {
    function UserModel() {
        this.userid = 0;
        this.username = '';
        //最大流量
        this.max_traffic = 0;
        this.max_http_traffic = 0;
        this.max_tcp_traffic = 0;
        this.enable = false;
        this.traffic = null;
        this.http_traffic = null;
        this.tcp_traffic = null;
        this.setting = null;
        this.traffic = new Traffic();
        this.http_traffic = new Traffic();
        this.tcp_traffic = new Traffic();
    }
    UserModel.prototype.addTraffic = function (type, byte) {
        if (type == 1) {
            this.http_traffic.add(byte);
            if (this.max_http_traffic > 0 && this.http_traffic.megabytes >= this.max_http_traffic) {
                return 1;
            }
        }
        else if (type == 2) {
            this.tcp_traffic.add(byte);
            if (this.max_tcp_traffic > 0 && this.tcp_traffic.megabytes >= this.max_tcp_traffic) {
                return 2;
            }
        }
        this.traffic.add(byte);
        if (this.max_traffic > 0 && this.traffic.megabytes >= this.max_traffic) {
            return 3;
        }
        return 0;
    };
    UserModel.prototype.login = function (user, pass, cb) {
        var self = this;
        var conn = null;
        if (this.setting != null) {
            cb(null, this.setting);
            return;
        }
        var onError = function (err) {
            console.error(err);
            conn && conn.release();
            conn = null;
            cb(err);
        };
        var onEnd = function () {
            conn && conn.release();
            conn = null;
        };
        var onGetSetting = function () {
            conn.query('SELECT * FROM setting WHERE userid=?', [self.userid], function (err, rows) {
                if (err) {
                    onError(err);
                    return;
                }
                self.setting = rows;
                cb(null, 0);
                onEnd();
            });
        };
        var onSelectUser = function () {
            conn.query('SELECT * FROM member WHERE username=? and password=?', [user, pass], function (err, rows) {
                if (err) {
                    onError(err);
                    return;
                }
                if (rows.length == 0) {
                    cb(null, 9);
                    onEnd();
                    return;
                }
                self.userid = rows[0].id;
                self.username = rows[0].username;
                self.traffic.init(rows[0].traffic_megabytes, rows[0].traffic_byte);
                self.http_traffic.init(rows[0].http_traffic_megabytes, rows[0].http_traffic_byte);
                self.tcp_traffic.init(rows[0].tcp_traffic_megabytes, rows[0].tcp_traffic_byte);
                self.max_traffic = rows[0].max_traffic;
                self.max_http_traffic = rows[0].max_http_traffic;
                self.max_tcp_traffic = rows[0].max_tcp_traffic;
                self.enable = !!rows[0].enable;
                if (self.max_http_traffic > 0 && self.http_traffic.megabytes >= self.max_http_traffic) {
                    cb(null, 1);
                    onEnd();
                    return;
                }
                if (self.max_tcp_traffic > 0 && self.tcp_traffic.megabytes >= self.max_tcp_traffic) {
                    cb(null, 2);
                    onEnd();
                    return;
                }
                if (self.max_traffic > 0 && self.traffic.megabytes >= self.max_traffic) {
                    cb(null, 3);
                    onEnd();
                    return;
                }
                onGetSetting();
            });
        };
        pool.getConnection(function (err, connection) {
            if (err) {
                onError(err);
                return;
            }
            conn = connection;
            onSelectUser();
        });
    };
    UserModel.prototype.save = function () {
        var self = this;
        pool.getConnection(function (err, conn) {
            if (err) {
                console.error('db....', err);
                conn && conn.release();
                conn = null;
                return;
            }
            var updata = [
                self.traffic.megabytes,
                self.traffic.byte,
                self.http_traffic.megabytes,
                self.http_traffic.byte,
                self.tcp_traffic.megabytes,
                self.tcp_traffic.byte,
                self.userid
            ];
            conn.query('UPDATE member SET traffic_megabytes=?,' +
                'traffic_byte=?,' +
                'http_traffic_megabytes=?,' +
                'http_traffic_byte=?,' +
                'tcp_traffic_megabytes=?,' +
                'tcp_traffic_byte=? WHERE id=?', updata, function (err, data) {
                if (err) {
                    console.error('db....', err);
                    conn && conn.release();
                    conn = null;
                    return;
                }
                conn && conn.release();
                conn = null;
            });
        });
    };
    UserModel.prototype.getSetting = function () {
        return this.setting || [];
    };
    return UserModel;
})();
exports.UserModel = UserModel;
//# sourceMappingURL=user.js.map