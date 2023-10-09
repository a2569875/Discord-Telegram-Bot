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
			if (!this._enabled || this._webhook.login_data.id === rawdata?.author.id || rawdata?.author.id === client.user.id || client.user.id == this._webhook.login_data.id) {
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

    say(target, message, options = {}) {
        if (!this._enabled) {
            return Promise.reject();
        } else if (this._keepSilence.indexOf(target) !== -1) {
            return Promise.resolve();
        } else {
			if (this._webhook) {
				let parse_username = /^\s*\[(.+)\]((.|\s)*)$/.exec(message);
				if ((parse_username||[]).length > 2) {
					let avatar_mag = {
						content: parse_username[2],
						username: parse_username[1],
					};
					if (options?._avatarurl) {
						avatar_mag.avatarURL = options._avatarurl;
					}
                    (async _self => await _self._webhook.send(avatar_mag))(this);
					//await this._webhook.send(avatar_mag);
					return Promise.resolve();
				}
			}
			//let target_channel = await this._client.channels.fetch(target);
            let target_channel = (async _self => await _self._client.channels.fetch(target))(this);
            (async _self => await target_channel.send(message))(this);
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
