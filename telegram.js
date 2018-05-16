const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.js');

// replace the value below with the Telegram token you receive from @BotFather
const token = 'TOKEN-TELEGRAM';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

const chats = []

let addToChats = function(id){
  if (chats.includes(id)) return
  chats.push(id)
  console.log('chatAdded', id)  
} 

let removeFromChats = function(id){
  var index = chats.indexOf(id);
  if (index > -1) {
    chats.splice(index, 1);
  }
}

// Matches config.startpass
bot.onText(config.startpass, (msg, match) => {
  addToChats(msg.chat.id)
  const chatId = msg.chat.id;
  // console.log(match[0], match[1])
  bot.sendMessage(chatId, 'notifications started');
});

// Matches config.startpass
bot.onText(config.stoppass, (msg, match) => {
  removeFromChats(msg.chat.id)
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'notifications stopped');
});

// Listen for any kind of message. There are different kinds of messages.
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Enter start phrase to start. Enter stop phrase to stop notifications.');
});

exports.sendMessage = async function(message){
  for(chatId of chats){
    bot.sendMessage(chatId, message);
  }
}