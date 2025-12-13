import type { Vacancy } from "./types";

export type TelegramBotConfig = {
  botToken: string;
  chatId: string;
};

export class TelegramBot {
  private botToken: string;
  private baseUrl: string;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(chatId: string, text: string, parseMode?: string) {
    const url = `${this.baseUrl}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Telegram message: ${error}`);
    }

    return response.json();
  }

  formatVacancyNotification(
    searchName: string,
    vacancies: Vacancy[],
    appUrl: string,
  ): string {
    const topN = vacancies.slice(0, 10);
    const lines = [
      `🔔 *${searchName}*`,
      `Found ${vacancies.length} new ${vacancies.length === 1 ? "vacancy" : "vacancies"}:\n`,
    ];

    for (const v of topN) {
      const badges = v.badges.length > 0 ? ` (${v.badges.join(", ")})` : "";
      lines.push(`• *${v.title}* at ${v.company}${badges}`);
      lines.push(`  ${v.location}`);
      lines.push(
        `  [View details](${appUrl}?vacancy=${encodeURIComponent(v.id)})\n`,
      );
    }

    if (vacancies.length > topN.length) {
      lines.push(
        `\n_...and ${vacancies.length - topN.length} more. Check the app for full list._`,
      );
    }

    return lines.join("\n");
  }
}

export function getTelegramBot(): TelegramBot | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return null;
  }
  return new TelegramBot(botToken);
}

export function getAdminChatId(): string | null {
  return process.env.TELEGRAM_ADMIN_CHAT_ID || null;
}
