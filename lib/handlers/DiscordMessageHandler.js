/*
 * @name 使用通用介面處理 Discord 訊息
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

class DiscordMessageHandler extends MessageHandler {
    constructor (client, options = {}) {
        super();

        if (!client || !client.addListener) {
            throw ReferenceError('No Discord client object');
        }

        this._type = 'Discord';
        this._id = 'D';

        this._client = client;
        this._nickStyle = options.nickStyle || 'username';
        this._keepSilence = options.keepSilence || [];
        this._useProxyURL = options.useProxyURL;
		this._webhook = null;

        const processMessage = (rawdata) => {
			if (!this._enabled || rawdata?.author.id === client.user.id || !!rawdata?.webhookID) {
                return;
            }
            let text = rawdata.content;
            let extra = {};
            if (rawdata.attachments && rawdata.attachments.size) {
                for (let [, p] of rawdata.attachments) {
                    extra.files = [{
                        client: 'Discord',
                        type: 'photo',
                        id: p.id,
                        size: p.size,//filesize
                        url: this._useProxyURL ? p.proxyURL : p.url,
                    }];
                    text += ` <photo: ${p.width}x${p.height}, ${getFriendlySize(p.size)}>`;
                }
            }

            let context = new Context({
                from: rawdata.author.id,
                to: rawdata.channel.id,
                nick: this.getNick(rawdata.author),
                text: text,
                isPrivate: rawdata.channel.type === 'dm',
                extra: extra,
                handler: this,
                _rawdata: rawdata,
            });
			
			try {
				if (rawdata?.author?.avatarURL) {
					context.extra._avatarurl = rawdata.author.avatarURL();
				}
			} catch (ignore_ex) {}

            context.extra.referenceMessage = "referenceMessage";
			if (rawdata?.reference?.messageID) {
                rawdata.channel.messages.fetch(rawdata.reference.messageID)
                .then(_message => {
                    context.extra.referenceMessage = _message;
                }, 
                    error=>context.extra.referenceMessage = (context.extra.referenceMessage === "referenceMessage")?null:context.extra.referenceMessage)
                .catch(error=>context.extra.referenceMessage = (context.extra.referenceMessage === "referenceMessage")?null:context.extra.referenceMessage)
                .finally(state=>context.extra.referenceMessage = (context.extra.referenceMessage === "referenceMessage")?null:context.extra.referenceMessage);
			} else context.extra.referenceMessage = (context.extra.referenceMessage === "referenceMessage")?null:context.extra.referenceMessage;

            let looping_data = { state: true, _self: this };
            looping_data.thread = setInterval(function(){
                if (!looping_data.state) {
                    looping_data.state = false;
                    clearInterval(looping_data.thread);
                    console.log("referenceMessage thread stopped");
                }
                if (context?.extra?.referenceMessage !== "referenceMessage") {
                    looping_data.state = false;
                    clearInterval(looping_data.thread);
                    console.log("referenceMessage thread stopped");
                    let _this = looping_data._self;
                    
                    let referenceMessage = context?.extra?.referenceMessage;
                    if (referenceMessage) {
                        let replay_message = referenceMessage.content;
                        let parse_username = /^(\[.+\])?\s*Re\s([^「]+)\s「(.*)」:((.|\s)*)$/.exec(replay_message);
                        if ((parse_username||[]).length > 4) {
                            replay_message = parse_username[4];
                        }
                        context.extra.reply = {
                            nick: _this.getNick(referenceMessage.author),
                            username: referenceMessage.author.username,
                            message: replay_message,
                            isText: referenceMessage.content.trim()!="",
                        };
                    }

                    // 檢查是不是命令
                    for (let [cmd, callback] of _this._commands) {
                        if (rawdata.content.startsWith(cmd)) {
                            let param = rawdata.content.trim().substring(cmd.length);
                            if (param === '' || param.startsWith(' ')) {
                                param = param.trim();

                                context.command = cmd;
                                context.param = param;

                                if (typeof callback === 'function') {
                                    callback(context, cmd, param);
                                }

                                _this.emit('command', context, cmd, param);
                                _this.emit(`command#${cmd}`, context, param);
                            }
                        }
                    }

                    _this.emit('text', context);
                }
            }, 10);
        };

        client.on('message', processMessage);

        client.on('ready', (message) => {
            this.emit('ready', message);
        });
    }
	
	setWebhook(_Webhook) {
		this._webhook = _Webhook || this._webhook;
	}
	
	check_id(_id_input, _id_to_check) {
		if (typeof(_id_to_check.keys) == typeof([].keys)) {
			return _id_to_check.includes(_id_input);
		}
		return _id_input == _id_to_check;
	}

    say(target, message, options = {}) {
        if (!this._enabled) {
            return Promise.reject();
        } else if (this._keepSilence.indexOf(target) !== -1) {
            return Promise.resolve();
        } else {
			/*if (this._webhook) {
				let parse_username = /^\s*\[(.+)\]((.|\s)*)$/.exec(message);
				if ((parse_username||[]).length > 2) {
					let message_obj = {
						content: parse_username[2],
						username: parse_username[1],
					};
					if (options?._avatarurl) {
						message_obj.avatarURL = options._avatarurl;
					}
                    (async _self => await _self._webhook.send(message_obj))(this);
					//await this._webhook.send(message_obj);
					return Promise.resolve();
				}
			}*/
			//let target_channel = await this._client.channels.fetch(target);
            //const target_channel = (async _self => await _self._client.channels.fetch(target))(this);
            (async _self => {
                const target_channel = await _self._client.channels.fetch(target);
                let webhook_sented = false;
                try {
                    const webhooks = await target_channel.fetchWebhooks();
                    const webhook = webhooks.find(wh => !!wh.token);
                    if (!!webhook) {
                        const parse_username = /^\s*\[(.+)\]((.|\s)*)$/.exec(message);
                        if ((parse_username||[]).length > 2) {
							//取得傳送訊息的必要資訊
							let sent_user = parse_username[1]; //發送者
							let sent_message = parse_username[2]; //發送內容
							let sent_avatarurl = options?._avatarurl||null; //發送者頭像連結
							//檢查是否匿名發言
							const check_anonymous = /^\s*\(\$anonymous\)((.|\s)*)$/i.exec(sent_message)||[];
							let is_anonymous = false;
							if (check_anonymous.length > 1) {
								sent_message = check_anonymous[1];
								sent_user = "᲼᲼"; //使用非列印字元作為名稱
								if (sent_message.trim() == "") sent_message = "​"; //零寬空白
								sent_avatarurl = "https://upload.wikimedia.org/wikipedia/commons/a/a5/%E6%AD%A30%E9%82%8A%E5%BD%A2.png"; //空白png
								is_anonymous = true;
							}
							if (!is_anonymous) {
								const check_user = /^([DT]) - ((.|\s)*)$/.exec(sent_user)||[];
								if (check_user.length > 2) {
									const msg_from = check_user[1];
									const msg_username = check_user[2];
									sent_user = msg_username;
								}
							}
							//建構傳遞含使用者名稱訊息之物件
                            let message_obj = {
                                content: sent_message,
                                username: sent_user,
                            };
                            if (sent_avatarurl) {
                                message_obj.avatarURL = sent_avatarurl;
                            }
							//匿名發文時，可能遇到空白字元發不出去的問題
							if (is_anonymous) {
								try{
									//嘗試發送，失敗代表可能遇到空白字元發不出去
									await webhook.send(message_obj);
								} catch (inside_ex) {
									//設定成非空白，但在Discord上不可見的符號，再次重發
									message_obj.content = "᲼᲼";
									await webhook.send(message_obj);
								}
							} else {
								//其餘情況就單純發文。
								await webhook.send(message_obj);
							}
                            webhook_sented = true;
                        } else {
                            webhook_sented = false;
                        }
                    }
                } catch (error) {
					console.log(error);
                    webhook_sented = false;
                }
                if (!webhook_sented){
                    await target_channel.send(message);
                }
            })(this);
			//await target_channel.send(message);
			//this._client.channels.get(target).send(message);
            return Promise.resolve();
        }
    }

    reply(context, message, options = {}) {
        if (context.isPrivate) {
            return this.say(context.from, message, options);
        } else {
            if (options.noPrefix) {
                return this.say(context.to, `${message}`, options);
            } else {
                return this.say(context.to, `${context.nick}: ${message}`, options);
            }
        }
    }

    getNick(user) {
        if (user) {
            let { username, id } = user;

            if (this._nickStyle === 'username') {
                return username || id;
            } else {
                return id;
            }
        } else {
            return '';
        }
    }

    fetchUser(user) {
        return this._client.fetchUser(user);
    }
}

module.exports = DiscordMessageHandler;
