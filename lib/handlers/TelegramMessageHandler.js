/*
 * @name 使用通用介面處理 Telegram 訊息
 */

const MessageHandler = require('./MessageHandler.js');
const Context = require('./Context.js');

const getFriendlySize = (size) => {
    if (size <= 1126) {
        return `${size.toLocaleString()} B`;
    } else if (size <= 1153433) {
        return `${(size / 1024).toLocaleString()} KiB`;
    } else if (size <= 1181116006) {
        return `${(size / 1048576).toLocaleString()} MiB`;
    } else {
        return `${(size / 1073741824).toLocaleString()} GiB`;
    }
};

const getFriendlyLocation = (latitude, longitude) => {
    let y = latitude;
    let x = longitude;

    y = y<0 ? `${-y}°S` : `${y}°N`;
    x = x<0 ? `${-x}°W` : `${x}°E`;

    return `${y}, ${x}`;
};

const copyObject = (obj) => {
    let r = {};
    for (let a in obj) {
        r[a] = obj[a];
    }
    return r;
};

class TelegramMessageHandler extends MessageHandler {
    constructor (client, options = {}) {
        super();

        if (!client && !client.addListener) {
            throw ReferenceError('No Telegram client object');
        }

        this._type = 'Telegram';
        this._id = 'T';

        this._client = client;
        this._username = options.botName || '';
        this._nickStyle = options.nickStyle || 'username';
        this._startTime = new Date().getTime()/1000;
        this._keepSilence = options.keepSilence || [];

        client.on('message', (ctx, next) => {
            if (this._enabled && ctx.message && ctx.chat) {
                if (ctx.message.date < this._startTime) {
                    return;
                }

                const context = new Context({
                    from: ctx.message.from.id,
                    to: ctx.chat.id,
                    nick: this._getNick(ctx.message.from),
                    text: '',
                    isPrivate: (ctx.chat.id > 0),
                    extra: {
                        username: ctx.message.from.username,
                    },
                    handler: this,
                    _rawdata: ctx,
                });
                context.extra._avatarurl = "_avatarurl";
				this._client.telegram.getUserProfilePhotos(ctx.message.from.id).then(res=>{
					let file_id = res.photos[0][0].file_id;
					let file = this._client.telegram.getFile(file_id);
					file.then((_self => function (result) {
						let file_path = result.file_path;
						let bot_token = _self._client.login_data.token;
						if ((""+file_path).trim() !== "" && (""+bot_token).trim() !== ""){
							let photo_url = `https://api.telegram.org/file/bot${bot_token}/${file_path}`
							context.extra._avatarurl = photo_url;
						}
                        context.extra._avatarurl = (context.extra._avatarurl === "_avatarurl")?null:context.extra._avatarurl;
					})(this),
                                error=>context.extra._avatarurl = (context.extra._avatarurl === "_avatarurl")?null:context.extra._avatarurl)
                    .catch(     error=>context.extra._avatarurl = (context.extra._avatarurl === "_avatarurl")?null:context.extra._avatarurl)
                    .finally(   state=>context.extra._avatarurl = (context.extra._avatarurl === "_avatarurl")?null:context.extra._avatarurl);
				});
                let looping_data = { state: true, _self: this };
                looping_data.thread = setInterval(function(){
                    if (!looping_data.state) {
                        looping_data.state = false;
                        clearInterval(looping_data.thread);
                        console.log("_avatarurl thread stopped");
                    }
                    if (context?.extra?._avatarurl !== "_avatarurl") {
                        looping_data.state = false;
                        clearInterval(looping_data.thread);
                        console.log("_avatarurl thread stopped");

                        let _this = looping_data._self;
                        if (ctx.message.reply_to_message) {
                            let reply = ctx.message.reply_to_message;
                            let replyTo = _this._getNick(reply.from);
                            let replyMessage = _this._convertToText(reply);
        
                            context.extra.reply = {
                                nick: replyTo,
                                username: reply.from.username,
                                message: replyMessage,
                                isText: reply.text && true,
                            };
                        } else if (ctx.message.forward_from) {
                            let fwd = ctx.message.forward_from;
                            let fwdFrom = _this._getNick(fwd);
        
                            context.extra.forward = {
                                nick: fwdFrom,
                                username: fwd.username,
                            };
                        }
        
                        if (ctx.message.text) {
                            if (!context.text) {
                                context.text = ctx.message.text;
                            }
        
                            // 解析命令
                            let [, cmd, , param] = ctx.message.text.match(/^\/([A-Za-z0-9_@]+)(\s+(.*)|\s*)$/u) || [];
                            if (cmd) {
                                // 如果包含 Bot 名，判断是否为自己
                                let [, c, , n] = cmd.match(/^([A-Za-z0-9_]+)(|@([A-Za-z0-9_]+))$/u) || [];
                                if ((n && (n.toLowerCase() === _this._username.toLowerCase())) || !n) {
                                    param = param || '';
        
                                    context.command = c;
                                    context.param = param;
        
                                    if (typeof _this._commands.get(c) === 'function') {
                                        _this._commands.get(c)(context, c, param || '');
                                    }
        
                                    _this.emit('command', context, c, param || '');
                                    _this.emit(`command#${c}`, context, param || '');
                                }
                            }
        
                            _this.emit('text', context);
                        } else {
                            let message = ctx.message;
                            const setFile = (msg, type) => {
                                context.extra.files = [{
                                    client: 'Telegram',
                                    type: type,
                                    id: msg.file_id,
                                    size: msg.file_size,
                                    mime_type: msg.mime_type,
                                }];
                            };
        
                            if (message.photo) {
                                let sz = 0;
                                for (let p of message.photo) {
                                    if (p.file_size > sz) {
                                        setFile(p, 'photo');
                                        context.text = `<photo: ${p.width}x${p.height}, ${getFriendlySize(p.file_size)}>`;
                                        sz = p.file_size;
                                    }
                                }
        
                                if (message.caption) {
                                    context.text += ' ' + message.caption;
                                }
                                context.extra.isImage = true;
                                context.extra.imageCaption = message.caption;
                            } else if (message.sticker) {
                                context.text = `${message.sticker.emoji}<Sticker>`;
                                setFile(message.sticker, 'sticker');
                                context.extra.isImage = true;
                            } else if (message.audio) {
                                context.text = `<Audio: ${message.audio.duration}", ${getFriendlySize(message.audio.file_size)}>`;
                                setFile(message.audio, 'audio');
                            } else if (message.voice) {
                                context.text = `<Voice: ${message.voice.duration}", ${getFriendlySize(message.voice.file_size)}>`;
                                setFile(message.voice, 'voice');
                            } else if (message.video) {
                                context.text = `<Video: ${message.video.width}x${message.video.height}, ${message.video.duration}", ${getFriendlySize(message.video.file_size)}>`;
                                setFile(message.video, 'video');
                            } else if (message.document) {
                                context.text = `<File: ${message.document.file_name}, ${getFriendlySize(message.document.file_size)}>`;
                                setFile(message.document, 'document');
                            } else if (message.contact) {
                                context.text = `<Contact: ${message.contact.first_name}, ${message.contact.phone_number}>`;
                            } else if (message.location) {
                                context.text = `<Location: ${getFriendlyLocation(message.location.latitude, message.location.longitude)}>`;
                            } else if (message.venue) {
                                context.text = `<Venue: ${message.venue.title}, ${message.venue.address}, ${getFriendlyLocation(
                                    message.venue.location.latitude, message.venue.location.longitude)}>`;
                            } else if (message.pinned_message) {
                                if (message.from.id === message.pinned_message.from.id) {
                                    _this.emit('pin', {
                                        from: {
                                            id: message.from.id,
                                            nick: _this._getNick(message.from),
                                            username: message.from.username,
                                        },
                                        to: ctx.chat.id,
                                        text: _this._convertToText(message.pinned_message),
                                    }, ctx);
                                } else {
                                    context.text = `<Pinned Message: ${_this._convertToText(message.pinned_message)}>`;
                                }
                            } else if (message.left_chat_member) {
                                _this.emit('leave', ctx.chat.id, {
                                        id: message.from.id,
                                        nick: _this._getNick(message.from),
                                        username: message.from.username,
                                    }, {
                                        id: message.left_chat_member.id,
                                        nick: _this._getNick(message.left_chat_member),
                                        username: message.left_chat_member.username,
                                    }, ctx);
                            } else if (message.new_chat_member) {
                                _this.emit('join', ctx.chat.id, {
                                        id: message.from.id,
                                        nick: _this._getNick(message.from),
                                        username: message.from.username,
                                    }, {
                                        id: message.new_chat_member.id,
                                        nick: _this._getNick(message.new_chat_member),
                                        username: message.new_chat_member.username,
                                    }, ctx);
                            }
        
                            if (context.text) {
                                _this.emit('richmessage', context);
                            }
                        }
                    }
                }, 10);
            }
            return next();
        });
    }

    _getNick(user) {
        if (user) {
            let username = (user.username || '').trim();
            let firstname = (user.first_name || '').trim() || (user.last_name || '').trim();
            let fullname = `${user.first_name || ''} ${user.last_name || ''}`.trim();

            if (this._nickStyle === 'fullname') {
                return fullname || username;
            } else if (this._nickStyle === 'firstname') {
                return firstname || username;
            } else {
                return username || fullname;
            }
        } else {
            return '';
        }
    }

    _convertToText(message) {
        if (message.audio) {
            return '<Audio>';
        } else if (message.photo) {
            return '<Photo>';
        } else if (message.document) {
            return '<Document>';
        } else if (message.game) {
            return '<Game>';
        } else if (message.sticker) {
            return `${message.sticker.emoji}<Sticker>`;
        } else if (message.video) {
            return '<Video>';
        } else if (message.voice) {
            return '<Voice>';
        } else if (message.contact) {
            return '<Contact>';
        } else if (message.location) {
            return '<Location>';
        } else if (message.venue) {
            return '<Venue>';
        } else if (message.pinned_message) {
            return '<Pinned Message>';
        } else if (message.new_chat_member) {
            return '<New member>';
        } else if (message.left_chat_member) {
            return '<Removed member>';
        } else if (message.text) {
            return message.text;
        } else {
            return '<Message>';
        }
    }

    get username() { return this._username; }
    set username(v) { this._username = v; }
    get nickStyle() { return this._nickStyle; }
    set nickStyle(v) { this.nickStyle = v; }

    addCommand(command, func) {
        // 自動過濾掉 command 中的非法字元
        let cmd = command.replace(/[^A-Za-z0-9_]/gu, '');
        return super.addCommand(cmd, func);
    }

    deleteCommand(command) {
        let cmd = command.replace(/[^A-Za-z0-9_]/gu, '');
        return super.deleteCommand(cmd);
    }

    _say(method, target, message, options = {}) {
        if (!this._enabled) {
            return Promise.reject();
        } else if (this._keepSilence.indexOf(parseInt(target)) !== -1) {
            return Promise.resolve();
        } else {
            return this._client.telegram[method](target, message, options);
        }
    }

    say(target, message, options = {}) {
        return this._say('sendMessage', target, message, options);
    }

    sayWithHTML(target, message, options = {}) {
        let options2 = copyObject(options);
        options2.parse_mode = 'html';
        return this.say(target, message, options2);
    }

    sendPhoto(target, photo, options = {}) {
        return this._say('sendPhoto', target, photo, options);
    }

    sendAudio(target, audio, options = {}) {
        return this._say('sendAudio', target, audio, options);
    }

    sendDocument(target, doc, options = {}) {
        return this._say('sendDocument', target, doc, options);
    }

    _reply(method, context, message, options = {}) {
        if ((context._rawdata && context._rawdata.message)) {
            if (context.isPrivate) {
                return this._say(method, context.to, message, options);
            } else {
                let options2 = copyObject(options);
                options2.reply_to_message_id = context._rawdata.message.message_id;
                return this._say(method, context.to, message, options2);
            }
        } else {
            return Promise.reject();
        }
    }

    reply(context, message, options = {}) {
        return this._reply('sendMessage', context, message, options);
    }

    replyWithPhoto(context, photo, options = {}) {
        return this._reply('sendPhoto', context, photo, options);
    }

    getChatAdministrators(group) { return this._client.telegram.getChatAdministrators(group); }
    getFile(fileid) { return this._client.telegram.getFile(fileid); }
    getFileLink(fileid) { return this._client.telegram.getFileLink(fileid); }
    leaveChat(chatid) { return this._client.telegram.leaveChat(chatid); }
}

module.exports = TelegramMessageHandler;
