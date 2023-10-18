[![node.js](https://img.shields.io/badge/node--js-%E2%89%A77.0-green)](https://nodejs.org/)
[![License](https://img.shields.io/github/license/a2569875/Discord-Telegram-Bot)](https://github.com/a2569875/sd-webui-prompt-highlight/blob/main/LICENSE)
# Discord-Telegram-Bot

The functionality of this bot is to relay messages between multiple groups, including but not limited to Discord, Telegram, and other messaging software. Inspired by the [Chinese Wikipedia Interconnection Group](https://zh.wikipedia.org/wiki/Wikipedia:%E4%B8%AD%E6%96%87%E7%B6%AD%E5%9F%BA%E7%99%BE%E7%A7%91%E5%BF%97%E9%A1%98%E8%80%85%E4%BA%92%E8%81%AF%E4%BA%A4%E6%B5%81%E7%BE%A4) and [zhmrtbot](User:Renamed_user_9811840658/zhmrtbot).

This project is a modification of [LilyWhiteBot](https://github.com/mrhso/LilyWhiteBot/tree/master), originally named "[qq-tg-irc](https://github.com/esons/qq-tg-irc)."

[Original Readme](README-old.md)

The development of this project is based on a fork and, according to the definition of the upstream project, it supports message synchronization between various communication software, including Discord, Telegram, WeChat (WeChat), IRC, QQ, and more. However, this project is developed and maintained exclusively for message synchronization between Discord and Telegram.

### Language
* [繁體中文](README.zh-hant.md)
* [English](README.md)

## How to Install

### Mandatory Steps
* Prepare a bot account as needed. (Specific methods are provided later.)
* Install Node.js, version requirement: >=7.x.
* Download the bot's core.
* Execute:
```
npm install
node main.js
```
* If you're concerned about crashes, you can run it in a loop, for example: `while true; do node main.js; done`, or:
```batch
:a
node main.js
goto a
```
* Modify `config.example.js` according to your actual needs and rename it to `config.js`.
* Format for QQ groups: `qq/QQ group number`; Format for Telegram groups: `telegram/a string of numbers` (this number can be obtained using `/thisgroupid`, as explained later, and please note that this number is **negative**); Format for IRC channels: `irc/#channel name`, don't forget the `#`; Format for Discord channels: `discord/channel ID`.

### Setting up the Telegram Bot

To set up a Telegram bot, follow these steps:

1. Find the user [@BotFather](https://t.me/BotFather) on Telegram and interact with it. Follow the on-screen prompts to create a bot account.

2. After setting up the bot, BotFather will provide you with a Token. You need to fill this Token into the `config.js` file.

3. Remember to execute the `/setprivacy` command to set the bot's Privacy to DISABLED. This allows the bot to see messages within groups.

4. Initially, you can keep the "groupid-tg" within the `config.js` under the "plugins" section. Then, run the program and enter `/thisgroupid` in the group. This action will allow the bot to automatically provide the group ID for interconnection. If you don't understand the previous sentence, you can also add [@combot](https://t.me/combot) to the group and enter `/stat` to see the number provided by the bot. Note that the number is negative.

### Setting up the Discord Bot

To set up a Discord bot, follow these steps:

1. Go to the [Discord Developer Portal](https://discordapp.com/developers/applications/) and create an Application.

2. In the Bot section, click "Add Bot." Fill the Token into the `config.js` file. You can refer to the first half of [this tutorial](https://hackmd.io/@smallshawn95/python_discord_bot_base) for guidance.

3. You can find the Channel ID in the URL of the web version; it's the string of numbers at the end.

4. You can also obtain the Channel ID on the desktop version by right-clicking the channel and selecting "Copy Channel ID." On mobile, you can get it by long-pressing the channel and selecting the corresponding option.

   | Desktop   | Mobile   |
   | ----      | ----     |
   | ![](readme/fig1.png) | ![](readme/fig2.png) |

You can configure Discord to forward messages via WebHook, where messages forwarded from Telegram will directly display the avatar and name. The setup process is as follows:

1. First, prepare a WebHook for the channel you want to connect. Click on the \[`channel`\], select \[`Edit Channel`\], and choose \[`Integrations`\] tab. On that page, find WebHooks. If you don't have a WebHook, you will see a \[`Create Webhook`\] button. Click it. If you already have a WebHook or it has been automatically created by the system, it will display \[`View Webhooks ❯`\]. Click it, and you will see a list of WebHooks. Click on the first WebHook (this program only uses the first WebHook of the channel) to enter the WebHook editing page. In the WebHook editing page, you can give your WebHook, serving as the bot, a name. Save the settings. If you entered through \[`Server Settings`\], then in the tabs, find the \[`APPS`\] group and choose the \[`Integrations`\] tab. Follow the same steps as mentioned above. In the end, you'll be given the option to choose the channel.

2. In `config.js`, within the `"Discord":` settings under `"bot":`, set `"Webhook":` to `true`.

3. Please note that every channel with interconnected/synchronized messages requires the addition of a new WebHook if you want each channel to display avatars from other groups.

### Setting up Bots for Other chat software

Please refer to the [old ReadMe](README-old.md) for instructions on setting up bots for other platforms, including:

- [Setting up a QQ bot](README-old.md#設定-qq-機器人)
- [Setting up an IRC bot](README-old.md#設定-irc-機器人)
- Setting up a WeChat bot: Add `"WeChat": { ... }` to the `config.js` and follow the [QQ setup](README-old.md#設定-qq-機器人).

## Tips

1. If you set `paeeye` in `config.js` to `//`, you can prevent messages from being seen by other groups by adding `//` before your message (e.g., "//hidden").

2. If you allow IRC to accept commands (with "irccommand" in the "plugins" section), you can use `/command command` in Telegram and QQ. This command is not for IRC but for interaction with the bot in IRC channels.

3. If you enable IRC queries (with "ircquery" in the "plugins" section), you can use commands like `/names` (get a list of online users), `/whois nickname` (whois), and `/topic` (get the topic).

### Other Features

To configure the following features, make changes in `config.js`:

- [filter](https://github.com/vjudge1/LilyWhiteBot/blob/master/plugins/filter.js): Filters messages that match specified rules.
- [qqxiaoice](https://github.com/vjudge1/LilyWhiteBot/blob/master/plugins/qqxiaoice.js): Summons QQ group's XiaoBing. (Requires QQ group owner to enable XiaoBing/BabyQ functionality)
- [wikilinky](https://github.com/vjudge1/LilyWhiteBot/blob/master/plugins/wikilinky.js)

## Acknowledgments

* [Original author of zhmrtbot, mrhso](https://github.com/mrhso), [Original author of qq-tg-irc, esons](https://github.com/esons), [LilyWhiteBot](https://github.com/mrhso/LilyWhiteBot/tree/master), [qq-tg-irc](https://github.com/esons/qq-tg-irc)
*  [JackEllie's Stable-Siffusion community team](https://discord.gg/TM5d89YNwA) 、 [Youtube channel](https://www.youtube.com/@JackEllie)
*  [Chinese Wikipedia community team](https://discord.gg/77n7vnu)

<p align="center"><img src="https://count.getloli.com/get/@a2569875-Discord-Telegram-Bot.github" alt="a2569875/Discord-Telegram-Bot"></p>
