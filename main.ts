import { PuppetPadlocal } from "wechaty-puppet-padlocal";
import { Contact, log, Message, ScanStatus, Wechaty, UrlLink } from "wechaty";
import { WechatyWeixinOpenAI, AIBotRequestResponse, SentimentData } from 'wechaty-weixin-openai'
import { EventLogger, QRCodeTerminal } from 'wechaty-plugin-contrib'

import { padlocalToken, weixinAIToken, weixinAIAESKey, bossId, huanIntroUrl } from './const'

const puppet = new PuppetPadlocal({
    token: padlocalToken
})

/**
 * Preprocess message, if the message if sent from boss,
 * in room and mentioned the bot, will check for a list
 * of keyword, if anything matched, sent out prepared
 * materials
 * @param message received message
 */
const processCommonMaterial = async (message: Message) => {
  const room = message.room()
  const from = message.from()
  const mentionSelf = await message.mentionSelf()
  const text = message.text()

  if (room !== null && from !== null && from.id === bossId && mentionSelf) {
    if (/Sam/.test(text)) {
      await room.say(new UrlLink(huanIntroUrl))
      return true
    }
  }

  return false
}

/**
 * Function to get boss contact
 */
const getBoss = async () => {
  const contact = bot.Contact.load(bossId)
  await contact.sync()
  return contact
}

 /**
  * This hook function will be called when OpenAI does not match
  * any pre-set conversation
  * @param message received message
  */
  const noAnswerHook = async (message: Message) => {
    console.log(`No Answer Message: ${message}`)

    const room = message.room()
    const from = message.from()
    if (!room) {
      return;
    }
    const members = await room.memberAll()
    const bossInRoom = members.find(m => m.id === bossId)
    if (bossInRoom) {
      await room.say`${bossInRoom}，${from}问的问题我不知道，你帮我回答一下吧。`
    } else {
      const boss = await getBoss()
      await room.say`${from}，你的问题我不会回答，你可以联系我的老板`
      await room.say(boss)
    }
  }

  /**
   * This function will be called before the action executed. With answer will be sent
   * back and the sentiment data. So we can do customize logic here for some specific
   * case. If we want to take over the job of replying this message, we need to return
   * false in the function to prevent future actions.
   * @param message received message
   * @param answer this is the answer from the OpenAI, we didn't use it here, so use _ to replace it
   * @param sentiment this is the sentiment data returned from OpenAI
   */
  const preAnswerHook = async (message: Message, answer: AIBotRequestResponse, sentiment?: SentimentData) => {
    console.log(`PreAnswerHook() with message: ${message}, answer: ${answer} and sentiment: ${sentiment}`)

    const isCommonMaterial = await processCommonMaterial(message)
    if (isCommonMaterial) {
      return false
    }

    const hate = sentiment.hate
    const angry = sentiment.angry
    const score = (hate || 0) + (angry || 0)
    if (score > 0.9) {
      const boss = await getBoss()
      const from = message.from()
      const room = await bot.Room.create([boss, from])
      await new Promise(r => setTimeout(r, 3000))
      await room.say`${boss}，你帮帮我吧，${from}和我聊天已经聊得不耐烦了`
      return false
    }
  }

const bot = new Wechaty({
    name: "Sam",
    puppet,
})

/**
 * Enable basic plugins here
 *   EventLogger: print log for all events
 *   QRCodeTerminal: print a qrcode in the console for convenient scan
 */
 bot.use(EventLogger())
 bot.use(QRCodeTerminal({ small: true }))

bot.use(WechatyWeixinOpenAI({
  token: weixinAIToken,
  encodingAESKey: weixinAIAESKey,
  includeSentiment: true,
  noAnswerHook,
  preAnswerHook,
}))

bot.start().then(() => {
    log.info("TestBot", "started.");
});

