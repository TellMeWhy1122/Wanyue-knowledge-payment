
//引入http模块
var socketio = require('socket.io'),
    fs 	= require('fs'),
    https     = require('https'),
    domain   = require('domain'),
    redis    = require('redis'),
    redisio  = require('socket.io-redis'),
    request  = require('request'),
    md5  = require('md5-node'),
    config   = require('./config.js');

var d = domain.create();
d.on("error", function(err) {

});
var options = {
    key: fs.readFileSync('./privkey.pem'),
    cert: fs.readFileSync('./fullchain.pem')
};

//var numscount=0;// 在线人数统计
var sockets = {};
var chat_history={};
var chat_interval={};

// redis 链接
var clientRedis  = redis.createClient(config['REDISPORT'],config['REDISHOST']);
clientRedis.auth(config['REDISPASS']);
var server = https.createServer(options,function(req, res) {
// var server = https.createServer(function(req, res) {
    res.writeHead(200, {
        'Content-type': 'text/html;charset=utf-8'
    });

    //res.write("人数: " + numscount );
    res.end();
}).listen(config['socket_port'], function() {
    ////console.log('服务开启19965');
});

var io = socketio.listen(server,{
    pingTimeout: 60000,
    pingInterval: 25000
});
/* 多端口监听 内容统一 */
/* var pub = redis.createClient(config['REDISPORT'], config['REDISHOST'], { auth_pass: config['REDISPASS'] });
 var sub = redis.createClient(config['REDISPORT'], config['REDISHOST'], { auth_pass: config['REDISPASS'] });
 io.adapter(redisio({ pubClient: pub, subClient: sub })); */

/* 资源释放 */
//setInterval(function(){
//global.gc();
////console.log('GC done')
//}, 1000*30);

io.on('connection', function(socket) {
    // console.log(FormatNowDate());
    // console.log('连接成功');
    //numscount++;

    var interval;

    //进入房间
    socket.on('conn', function(data) {
        // console.log('data');
        // console.log(data);
        if(!data || !data.token){
            return !1;
        }

        userid=data.uid;
        old_socket = sockets[userid];
        if (old_socket && old_socket != socket) {

            if(data.uid != data.roomnum && data.uid==old_socket.roomnum){
                /* 进房间 但旧链接是 主播 */
                var data_str='{"retmsg":"ok","retcode":"000000","msg":[{"msgtype":"1","_method_":"StartEndLive","action":"19","ct":"直播关闭"}]}';
                old_socket.emit('broadcastingListen',[data_str]);
            }else if(data.uid== data.roomnum && data.stream==old_socket.stream){
                /* 主播重连 */
                old_socket.reusing = 1;
                //console.log("重用");
            }else if(data.uid== data.roomnum && data.stream!=old_socket.stream){
                /* 主播多端开播 */
                var data_str='{"retmsg":"ok","retcode":"000000","msg":[{"msgtype":"1","_method_":"StartEndLive","action":"19","ct":"直播关闭"}]}';
                old_socket.emit('broadcastingListen',[data_str]);
            }
            old_socket.disconnect()
        }

        clientRedis.get(data.token,function(error,res){
            if(error){
                return;
            }else if(res==null){
                console.log("[获取token失败]"+data.uid);
            }else{
                if(res != null){

                    var userInfo = evalJson(res);
                    if(userInfo['id'] == data.uid ){
                        //console.log("[初始化验证成功]--"+data.uid+"---"+data.roomnum+'---'+data.stream);
                        //获取验证token
                        socket.token   = data.token;
                        socket.roomnum = data.roomnum;
                        socket.stream = data.stream;
                        socket.nickname = userInfo['user_nickname'];
                        socket.avatar = userInfo['avatar'];
                        socket.sign = Number(userInfo['sign']);
                        socket.usertype   = parseInt(userInfo['usertype']);
                        socket.uid     = data.uid;
                        socket.reusing = 0;

                        socket.join(data.stream);
                        sockets[userid] = socket;
                        socket.emit('conn',['ok']);

                        if(socket.roomnum==socket.uid){
                            setLiveStatus(socket.uid,socket.stream,1);
                        }

                        if( socket.usertype ==0 ){
                            var data_obj={
                                "msg":[
                                    {
                                        "_method_":"SendMsg",
                                        "action":"0",
                                        "ct":{
                                            "uid":''+userInfo['id'],
                                            "user_nickname":''+userInfo['user_nickname'],
                                            "avatar":userInfo['avatar'],
                                            "usertype":''+userInfo['usertype']
                                        },
                                        "msgtype":"0"
                                    }
                                ],
                                "retcode":"000000",
                                "retmsg":"OK"
                            };
                            process_msg(io,socket.stream,JSON.stringify(data_obj));
                            if(socket.stream){
                                clientRedis.zadd('user_'+socket.stream,socket.sign,userInfo['id']);
                            }
                        }

                        // sendSystemMsg(socket,"直播内容包含任何低俗、暴露和涉黄内容，账号会被封禁；安全部门会24小时巡查哦～");
                        return;
                    }else{
                        socket.disconnect();
                    }
                }
            }

            socket.emit('conn',['no']);
        });


    });

    socket.on('broadcast',function(data){
        ////console.log(data);
        if(socket.token != undefined){
            var dataObj  = typeof data == 'object'?data:evalJson(data);
            var msg      = dataObj['msg'][0];
            var token    = dataObj['token'];
            var method   = msg['_method_'];
            var action   = msg['action'];
            var data_str =  typeof data == 'object'?JSON.stringify(data):data;
            switch(method){
                case 'SendMsg':{     //聊天
                    process_msg(io,socket.stream,data_str);
                    break;
                }


                case 'setPPT' :{//PPT图片通知 action  0添加 1删除  2切换
                    if(socket.usertype == 1 ){
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }

                case 'StartEndLive':{
                    if(socket.usertype == 1 ){
                        socket.broadcast.to(socket.stream).emit('broadcastingListen',[data_str]);
                    }
                    break;

                }
                case 'SystemNot':{//系统通知
                    process_msg(io,socket.stream,data_str);
                    break;
                }

                case 'ShareScreen':{     //共享屏幕
                    process_msg(io,socket.stream,data_str);
                    break;
                }

                case 'changeMode' :{//切换模式 action 0 摄像头  1PPt
                    if(socket.usertype == 1){
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }

                case 'Kick' :{//踢人 action 1踢人
                    if(socket.usertype > 0){
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }
                case 'Shutup' :{//禁言  action 0取消禁言 1禁言
                    if(socket.usertype > 0){
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }

                case 'roomShutup' :{//房间禁言  action 0取消禁言 1禁言
                    if(socket.usertype > 0){
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }
                case 'roomChat' :{//开放交流区  action 0取消禁言 1禁言
                    if(socket.usertype > 0){
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }
                case 'setLiveModel' :{//老师操作学生视频状态  action  1关闭麦克风 2开启没课风 3关闭摄像头 4 开启摄像头
                    if(socket.usertype == 1){
                        var stream=socket.stream;
                        var touid=msg['touid'];
                        if(action==1){
                            clientRedis.hset('livemodel_m_'+stream,touid,1);
                        }
                        if(action==2){
                            clientRedis.hdel('livemodel_m_'+stream,touid);
                        }
                        if(action==3){
                            clientRedis.hset('livemodel_s_'+stream,touid,1);
                        }
                        if(action==4){
                            clientRedis.hdel('livemodel_s_'+stream,touid);
                        }
                        process_msg(io,socket.stream,data_str);
                    }
                    break;
                }
                case 'ask' :{//提问 action  1提问题  2同问
                    process_msg(io,socket.stream,data_str);
                    break;
                }

            }
        }

    });

    socket.on('superadminaction',function(data){
        if(data['token'] == config['TOKEN']){
            io.sockets.in(data['roomnum']).emit("broadcastingListen", ['stopplay']);
        }
    });
    /* 系统信息 */
    socket.on('systemadmin',function(data){
        if(data['token'] == config['TOKEN']){
            var data_obj={
                "msg":[
                    {
                        "_method_":"SystemNot",
                        "action":"1",
                        "ct":''+ data.content,
                        "msgtype":"4"
                    }
                ],
                "retcode":"000000",
                "retmsg":"OK"
            };
            io.emit('broadcastingListen',[JSON.stringify(data_obj)]);
        }
    });

    //资源释放
    socket.on('disconnect', function() {
        // console.log(FormatNowDate());
        // console.log('disconnect');

        if(socket.roomnum ==null || socket.token==null || socket.uid <=0){
            return !1;
        }

        d.run(function() {

            if(socket.roomnum==socket.uid){
                /* 主播 */
                setLiveStatus(socket.uid,socket.stream);

                var data_obj={
                    "msg":[
                        {
                            "_method_":"changeMode",
                            "action":"0",
                            "ct":"",
                            "uid":""+socket.uid,
                            "source":"node"
                        }
                    ],
                    "retcode":"000000",
                    "retmsg":"OK"
                };
                process_msg(io,socket.stream,JSON.stringify(data_obj));

                var sign_data={uid:socket.uid,stream:socket.stream};
                var sign=setSign(sign_data);
                request(config['WEBADDRESS']+"?service=Live.upLive&uid="+socket.uid + "&stream=" + socket.stream+ "&sign=" +sign,function(error, response, body){
                    // console.log('changeLive');
                    // console.log(body);
                });

            }else{
                /* 观众 */
                cancelLinkmic(socket.uid,socket.stream);
                quitLinkmic(socket.uid,socket.stream,0);


                clientRedis.zrem('user_'+socket.stream,socket.uid,function(error,res){
                    if(error) return;
                    if(res){
                        var data_obj={
                            "msg":[
                                {
                                    "_method_":"disconnect",
                                    "action":"1",
                                    "ct":{
                                        "uid":''+socket.uid,
                                        "user_nickname":''+socket.nickname,
                                        "avatar":socket.avatar,
                                        "usertype":socket.usertype
                                    },
                                    "msgtype":"0"
                                }
                            ],
                            "retcode":"000000",
                            "retmsg":"OK"
                        };
                        process_msg(io,socket.stream,JSON.stringify(data_obj));
                    }

                });

            }
            ////console.log(socket.roomnum+"==="+socket.token+"===="+socket.uid+"======"+socket.stream);

            socket.leave(socket.stream);
            delete io.sockets.sockets[socket.id];
            sockets[socket.uid] = null;
            delete sockets[socket.uid];

        });
    });

});
function sendSystemMsg(socket,msg){
    var data_obj={
        "msg":[
            {
                "_method_":"SystemNot",
                "action":"1",
                "ct":""+ msg,
                "msgtype":"4"
            }
        ],
        "retcode":"000000",
        "retmsg":"OK"
    };
    socket.emit('broadcastingListen',[JSON.stringify(data_obj)]);

}
function evalJson(data){
    return eval("("+data+")");
}

function process_msg(io,roomnum,data){
    if(!chat_history[roomnum]){
        chat_history[roomnum]=[];
    }
    chat_history[roomnum].push(data);
    chat_interval[roomnum] || (chat_interval[roomnum]=setInterval(function(){
        if(chat_history[roomnum].length>0){
            send_msg(io,roomnum);
        }else{
            clearInterval(chat_interval[roomnum]);
            chat_interval[roomnum]=null;
        }
    },200));
}

function send_msg(io,roomnum){
    var data=chat_history[roomnum].splice(0,chat_history[roomnum].length);
    io.sockets.in(roomnum).emit("broadcastingListen", data);
}

//时间格式化
function FormatNowDate(){
    var mDate = new Date();
    var Y = mDate.getFullYear();
    var M = mDate.getMonth()+1;
    var D = mDate.getDate();
    var H = mDate.getHours();
    var i = mDate.getMinutes();
    var s = mDate.getSeconds();
    return Y +'-' + M + '-' + D + ' ' + H + ':' + i + ':' + s;
}

//毫秒时间戳
function getMillisecond(){
    var timestamp3 =new Date().getTime();
    return timestamp3;
}

/* sign加密 */
function setSign(obj) {//排序的函数
    var str='';
    var newkey = Object.keys(obj).sort();
//先用Object内置类的keys方法获取要排序对象的属性名，再利用Array原型上的sort方法对获取的属性名进行排序，newkey是一个数组
    var newObj = {};//创建一个新的对象，用于存放排好序的键值对
    for (var i = 0; i < newkey.length; i++) {//遍历newkey数组
        //newObj[newkey[i]] = obj[newkey[i]];//向新创建的对象中按照排好的顺序依次增加键值对
        str+=newkey[i]+'='+obj[newkey[i]]+'&';
    }
    str+=config['sign_key'];

    var sign=md5(str);
    return sign;
}

/* 取消申请 */
function cancelLinkmic(uid,stream){
    clientRedis.zrem('linkmic_apply_'+stream,uid);
}

/* 退出连麦 */
function quitLinkmic(uid,stream,type=1){
    if(type==1){
        clientRedis.zadd('user_'+stream,0,uid);
    }
    clientRedis.hdel('write_'+stream,uid);
    clientRedis.hdel('livemodel_m_'+stream,uid);
    clientRedis.hdel('livemodel_s_'+stream,uid);
    setWrite(uid,stream);
}


/* 讲师是否在直播 */
function setLiveStatus(uid,stream,type=0){
    if(type==1){
        clientRedis.hset('liveing',uid,stream);
    }else{
        clientRedis.hdel('liveing',uid);
    }
}