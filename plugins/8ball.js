/*
 * 8ball
 *
 * 在群組中使用 '8ball （在Telegram群組中使用 /8ball）
 */
'use strict';

const BridgeMsg = require('./transport/BridgeMsg.js');

const eightballs = ['As I see it, yes', 'It is certain', 'It is decidedly so', 'Most likely',
    'Outlook good', 'Signs point to yes', 'One would be wise to think so', 'Naturally', 'Without a doubt',
    'Yes', 'Yes, definitely', 'You may rely on it', 'Reply hazy, try again', 'Ask again later',
    'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again',
    'You know the answer better than I', 'Maybe...', 'You\'re kidding, right?', 'Don\'t count on it',
    'In your dreams', 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful'];

module.exports = (pluginManager, options) => {
    const bridge = pluginManager.plugins.transport;
    const Broadcast = pluginManager.global.Broadcast;

    const eightball = context => {
        let result = eightballs[parseInt(Math.random() * eightballs.length)];

        context.reply(result);

        if (bridge && !context.isPrivate) {
            bridge.send(new BridgeMsg(context, {
                text: `8ball: ${result}`,
                isNotice: true,
            }));
        }
    };

    if (bridge) {
        bridge.addCommand('!8ball', eightball, options);
    } else {
        for (let [type, handler] of pluginManager.handlers) {
            handler.addCommand('!8ball', eightball);
        }
    }
};
