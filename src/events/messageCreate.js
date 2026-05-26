




import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: 'messageCreate',
  async execute(message) {
    const { Client, GatewayIntentBits } = require('discord.js');
const { QuickDB } = require('quick.db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const db = new QuickDB();

client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  // ADD XP
  let xp = await db.get(`xp_${message.guild.id}_${message.author.id}`);
  if (!xp) xp = 0;

  xp += 10;

  await db.set(`xp_${message.guild.id}_${message.author.id}`, xp);

  // LEVEL SYSTEM
  let level = await db.get(`level_${message.guild.id}_${message.author.id}`);
  if (!level) level = 1;

  let neededXP = level * 100;

  // LEVEL UP
  if (xp >= neededXP) {

    level++;

    await db.set(`level_${message.guild.id}_${message.author.id}`, level);
    await db.set(`xp_${message.guild.id}_${message.author.id}`, 0);

    message.channel.send(
      `${message.author} leveled up to level ${level}! 🎉`
    );
  }

  // !RANK COMMAND
  if (message.content === '!rank') {

    // ALLOWED CHANNEL ID
    const allowedChannel = '1395849203948503040';

    // ONLY WORKS IN THIS CHANNEL
    if (message.channel.id !== allowedChannel) return;

    let xp = await db.get(`xp_${message.guild.id}_${message.author.id}`);
    let level = await db.get(`level_${message.guild.id}_${message.author.id}`);

    if (!xp) xp = 0;
    if (!level) level = 1;

    message.reply(
      `🏆 Level: ${level}\n⭐ XP: ${xp}/${level * 100}`
    );
  }

});

client.login('YOUR_BOT_TOKEN');
async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
    const canProcess = await checkRateLimit(rateLimitKey, MESSAGE_XP_RATE_LIMIT_ATTEMPTS, MESSAGE_XP_RATE_LIMIT_WINDOW_MS);
    if (!canProcess) {
      return;
    }

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    
    if (!levelingConfig?.enabled) {
      return;
    }

    
    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) {
      return;
    }

    
    if (levelingConfig.ignoredRoles?.length > 0) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => {
        return null;
      });
      if (member && member.roles.cache.some(role => levelingConfig.ignoredRoles.includes(role.id))) {
        return;
      }
    }

    
    if (levelingConfig.blacklistedUsers?.includes(message.author.id)) {
      return;
    }

    
    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    const userData = await getUserLevelData(client, message.guild.id, message.author.id);
    
    
    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    const timeSinceLastMessage = now - (userData.lastMessage || 0);
    
    
    if (timeSinceLastMessage < cooldownTime * 1000) {
      return;
    }

    
    const minXP = levelingConfig.xpRange?.min || levelingConfig.xpPerMessage?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || levelingConfig.xpPerMessage?.max || 25;

    
    const safeMinXP = Math.max(1, minXP);
    const safeMaxXP = Math.max(safeMinXP, maxXP);

    
    const xpToGive = Math.floor(Math.random() * (safeMaxXP - safeMinXP + 1)) + safeMinXP;

    
    let finalXP = xpToGive;
    if (levelingConfig.xpMultiplier && levelingConfig.xpMultiplier > 1) {
      finalXP = Math.floor(finalXP * levelingConfig.xpMultiplier);
    }

    
    const result = await addXp(client, message.guild, message.member, finalXP);
    
    if (result.success && result.leveledUp) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`
      );
    }
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}


