'use strict';

const path = require('path');
const BridgeMsg = require('../BridgeMsg.js');

const truncate = (str, maxLen = 10) => {
    str = str.replace(/\n/gu, '');
    if (str.length > maxLen) {
        str = str.substring(0, maxLen - 3) + '...';
    }
    return str;
};

const htmlEscape = (str) => {
    return str.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
};

let bridge = null;
let config = null;
let tgHandler = null;
let forwardBots = {};

let options = {};

// 如果是互聯機器人，那麼提取真實的使用者名稱和訊息內容
const parseForwardBot = (username, text) => {
    let realText, realNick;
    let symbol = forwardBots[username];
    if (symbol === 'self') {
        // TODO 更換匹配方式
        // [, , realNick, realText] = text.match(/^(|<.> )\[(.*?)\] ([^]*)$/mu) || [];
        [, realNick, realText] = text.match(/^\[(.*?)\] ([^]*)$/mu) || [];
    } else if (symbol === '[]') {
        [, realNick, realText] = text.match(/^\[(.*?)\](?::? |\n)([^]*)$/mu) || [];
    } else if (symbol === '<>') {
        [, realNick, realText] = text.match(/^<(.*?)>(?::? |\n)([^]*)$/mu) || [];
    }

    return { realNick, realText };
};

const init = (b, h, c) => {
    bridge = b;
    config = c;
    tgHandler = h;

    const options = config.options.Telegram || {};
    forwardBots = options.forwardBots || {};

    if (!options.notify) {
        options.notify = {};
    }

    // 我們自己也是傳話機器人
    forwardBots[tgHandler.username] = 'self';

    // 將訊息加工好並發送給其他群組
    tgHandler.on('text', (context) => {
        let extra = context.extra;
        if (context.text.match(/^\/([A-Za-z0-9_@]+)(\s+(.*)|\s*)$/u) && !options.forwardCommands) {
            return;
        }

        // 檢查是不是自己在回覆自己，然後檢查是不是其他互聯機器人在說話
        if (extra.reply && forwardBots[extra.reply.username]) {
            let { realNick, realText } = parseForwardBot(extra.reply.username, extra.reply.message);
            if (realNick) {
                [extra.reply.nick, extra.reply.message] = [realNick, realText];
            }
        } else if (extra.forward && forwardBots[extra.forward.username]) {
            let { realNick, realText } = parseForwardBot(extra.forward.username, context.text);
            if (realNick) {
                [extra.forward.nick, context.text] = [realNick, realText];
            }
        }

        bridge.send(context).catch(() => {});
    });

    tgHandler.on('richmessage', (context) => {
        let extra = context.extra;

        // 檢查是不是在回覆互聯機器人
        if (extra.reply && forwardBots[extra.reply.username]) {
            let { realNick, realText } = parseForwardBot(extra.reply.username, extra.reply.message);
            if (realNick) {
                [extra.reply.nick, extra.reply.message] = [realNick, realText];
            }
        }

        bridge.send(context).catch(() => {});
    });

    // Pinned message
    tgHandler.on('pin', (info, ctx) => {
        if (options.notify.pin) {
            bridge.send(new BridgeMsg({
                from: info.from.id,
                to: info.to,
                nick: info.from.nick,
                text: `${info.from.nick} pinned: ${info.text.replace(/\n/gu, ' ')}`,
                isNotice: true,
                handler: tgHandler,
                _rawdata: ctx,
            })).catch(() => {});
        }
    });


    /*
     * 加入與離開
     */
    tgHandler.on('join', (group, from, target, ctx) => {
        let text;
        if (from.id === target.id) {
            text = `${target.nick} 加入群組`;
        } else {
            text = `${from.nick} 邀請 ${target.nick} 加入群組`;
        }

        if (options.notify.join) {
            bridge.send(new BridgeMsg({
                from: target.id,
                to: group,
                nick: target.nick,
                text: text,
                isNotice: true,
                handler: tgHandler,
                _rawdata: ctx,
            })).catch(() => {});
        }
    });

    tgHandler.on('leave', (group, from, target, ctx) => {
        let text;
        if (from.id === target.id) {
            text = `${target.nick} 離開群組`;
        } else {
            text = `${target.nick} 被 ${from.nick} 移出群組`;
        }

        if (options.notify.leave) {
            bridge.send(new BridgeMsg({
                from: target.id,
                to: group,
                nick: target.nick,
                text: text,
                isNotice: true,
                handler: tgHandler,
                _rawdata: ctx,
            })).catch(() => {});
        }
    });
};

// 收到了來自其他群組的訊息
const receive = (msg) => new Promise((resolve, reject) => {
    if (msg.isNotice) {
        if (msg.extra.clients >= 3) {
            tgHandler.sayWithHTML(msg.to, `<pre>&lt; ${msg.extra.clientName.fullname}: ${htmlEscape(msg.text)} &gt;</pre>`);
        } else {
            tgHandler.sayWithHTML(msg.to, `<pre>&lt; ${htmlEscape(msg.text)} &gt;</pre>`);
        }
    } else {
        let output = '';
        let prefix = '';

        // 多群組
        if (!config.options.hidenick) {
            if (msg.extra.isAction) {
                prefix = `* <b>${htmlEscape(msg.nick)}</b> `;
            } else {
                if (msg.extra.clients >= 3) {
                    prefix = `[${htmlEscape(msg.extra.clientName.shortname)} - <b>${htmlEscape(msg.nick)}</b>] `;
                } else {
                    prefix = `[<b>${htmlEscape(msg.nick)}</b>] `;
                }
            }
        }

        try{
        let msg_text = msg.text;
        let special = "";
        if (msg.extra.reply) {
            const reply = msg.extra.reply;
            special = `Re ${reply.nick} `;

            if (reply.isText) {
                special += `「${truncate(reply.message)}」`;
            } else {
                special += reply.message;
            }

            special += ': ';
        } else if (msg.extra.forward) {
            special = `Fwd ${msg.extra.forward.nick}: `;
        }
        msg_text = special + htmlEscape(msg_text);

        output = `${prefix}${msg_text}`;
        }catch(err_msg){console.log(err_msg);throw err_msg;}
        // TODO 圖片在文字之前發出
        tgHandler.sayWithHTML(msg.to, output);

        // 如果含有相片和音訊
        if (msg.extra.uploads) {
            let files = [];

            for (let upload of msg.extra.uploads) {
                if (upload.type === 'audio') {
                    tgHandler.sendAudio(msg.to, upload.url);
                } else if (upload.type === 'photo') {
                    if (path.extname(upload.url) === '.gif') {
                        tgHandler.sendDocument(msg.to, upload.url);
                    } else {
                        tgHandler.sendPhoto(msg.to, upload.url);
                    }
                } else {
                    files.push(upload.url);
                }
            }

            if (files.length > 0) {
                output += ` ${htmlEscape(files.join(' '))}`;
            }
        }
    }
    resolve();
});

module.exports = {
    init,
    receive,
};
