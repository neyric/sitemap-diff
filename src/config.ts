/**
 * 配置管理模块
 * 对应原 Python 项目的 core/config.py
 */

interface TelegramConfig {
  token: string;
  targetChat: string;
}

interface DiscordConfig {
  token: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const telegramConfig: TelegramConfig = {
  token: '', // 从环境变量获取
  targetChat: '', // 从环境变量获取
};

export const discordConfig: DiscordConfig = {
  token: '', // 从环境变量获取
};

/**
 * 初始化配置
 * @param env - Cloudflare Workers 环境变量
 */
export function initConfig(env: any): void {
  telegramConfig.token = env.TELEGRAM_BOT_TOKEN || "";
  telegramConfig.targetChat = env.TELEGRAM_TARGET_CHAT || "";
  discordConfig.token = env.DISCORD_TOKEN || "";

  console.log("配置初始化完成");
  console.log("Telegram Token:", telegramConfig.token ? "已设置" : "未设置");
  console.log("Telegram Target Chat:", telegramConfig.targetChat || "未设置");
  console.log("Discord Token:", discordConfig.token ? "已设置" : "未设置");
}

/**
 * 验证配置是否完整
 * @returns 验证结果
 */
export function validateConfig(): ValidationResult {
  const errors = [];

  if (!telegramConfig.token) {
    errors.push("TELEGRAM_BOT_TOKEN 未设置");
  }

  if (!telegramConfig.targetChat) {
    errors.push("TELEGRAM_TARGET_CHAT 未设置");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
} 