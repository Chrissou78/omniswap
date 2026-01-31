import { PriceAlert } from '@prisma/client';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export class NotificationService {
  private emailTransporter: nodemailer.Transporter;
  private telegramBotToken: string;
  private fcmServerKey: string;

  constructor(config: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
    telegramBotToken: string;
    fcmServerKey: string;
  }) {
    this.emailTransporter = nodemailer.createTransport(config.smtp);
    this.telegramBotToken = config.telegramBotToken;
    this.fcmServerKey = config.fcmServerKey;
  }

  async sendEmailAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    const subject = this.buildAlertSubject(alert, currentPrice);
    const html = this.buildAlertEmailHtml(alert, currentPrice);

    // In production, fetch user's email from DB
    // For now, we'll log and skip actual send
    logger.info('Email alert would be sent', {
      alertId: alert.id,
      subject,
    });

    // Uncomment for actual email sending:
    // await this.emailTransporter.sendMail({
    //   from: '"OmniSwap Alerts" <alerts@omniswap.io>',
    //   to: userEmail,
    //   subject,
    //   html,
    // });
  }

  async sendPushAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    const title = `${alert.tokenSymbol} Price Alert`;
    const body = this.buildAlertMessage(alert, currentPrice);

    logger.info('Push notification would be sent', {
      alertId: alert.id,
      title,
      body,
    });

    // FCM implementation would go here
  }

  async sendTelegramAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    if (!alert.telegramChatId) {
      throw new Error('No Telegram chat ID configured');
    }

    const message = this.buildTelegramMessage(alert, currentPrice);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: alert.telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Telegram API error: ${error.description}`);
      }

      logger.info('Telegram alert sent', { alertId: alert.id, chatId: alert.telegramChatId });
    } catch (error) {
      logger.error('Failed to send Telegram alert', { alertId: alert.id, error });
      throw error;
    }
  }

  private buildAlertSubject(alert: PriceAlert, currentPrice: number): string {
    const direction = alert.alertType === 'ABOVE' ? '📈 rose above' : 
                      alert.alertType === 'BELOW' ? '📉 fell below' : 
                      '📊 changed by';
    const target = alert.alertType === 'PERCENT_CHANGE' 
      ? `${Number(alert.targetPercentChange)}%`
      : `$${Number(alert.targetPrice).toFixed(2)}`;

    return `🔔 ${alert.tokenSymbol} ${direction} ${target}`;
  }

  private buildAlertMessage(alert: PriceAlert, currentPrice: number): string {
    const direction = alert.alertType === 'ABOVE' ? 'rose above' : 
                      alert.alertType === 'BELOW' ? 'fell below' : 
                      'changed by';
    const target = alert.alertType === 'PERCENT_CHANGE' 
      ? `${Number(alert.targetPercentChange)}%`
      : `$${Number(alert.targetPrice).toFixed(2)}`;

    return `${alert.tokenSymbol} ${direction} ${target}! Current price: $${currentPrice.toFixed(4)}`;
  }

  private buildAlertEmailHtml(alert: PriceAlert, currentPrice: number): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🔔 Price Alert Triggered</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${alert.tokenSymbol}</h3>
          <p style="color: #666; margin: 0;">${alert.tokenName}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">Alert Type</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">
              ${alert.alertType === 'ABOVE' ? 'Price Above' : alert.alertType === 'BELOW' ? 'Price Below' : 'Percent Change'}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">Target</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">
              ${alert.alertType === 'PERCENT_CHANGE' ? `${Number(alert.targetPercentChange)}%` : `$${Number(alert.targetPrice).toFixed(4)}`}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">Current Price</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">

              $${currentPrice.toFixed(4)}
            </td>
          </tr>
        </table>
        ${alert.note ? `<p style="color: #666; font-style: italic; margin-top: 20px;">Note: ${alert.note}</p>` : ''}
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This alert was set up on OmniSwap. 
          <a href="https://app.omniswap.io/alerts">Manage your alerts</a>
        </p>
      </div>
    `;
  }

  private buildTelegramMessage(alert: PriceAlert, currentPrice: number): string {
    const emoji = alert.alertType === 'ABOVE' ? '📈' : alert.alertType === 'BELOW' ? '📉' : '📊';
    const direction = alert.alertType === 'ABOVE' ? 'rose above' : 
                      alert.alertType === 'BELOW' ? 'fell below' : 
                      'changed by';
    const target = alert.alertType === 'PERCENT_CHANGE' 
      ? `${Number(alert.targetPercentChange)}%`
      : `$${Number(alert.targetPrice).toFixed(4)}`;

    let message = `${emoji} <b>${alert.tokenSymbol} Price Alert</b>\n\n`;
    message += `${alert.tokenSymbol} ${direction} <b>${target}</b>!\n\n`;
    message += `💰 Current Price: <b>$${currentPrice.toFixed(4)}</b>\n`;
    message += `📍 Chain: ${this.getChainName(alert.chainId)}\n`;

    if (alert.note) {
      message += `\n📝 Note: ${alert.note}`;
    }

    message += `\n\n<a href="https://app.omniswap.io/alerts">Manage Alerts</a>`;

    return message;
  }

  private getChainName(chainId: number): string {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      56: 'BNB Chain',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
      43114: 'Avalanche',
      101: 'Solana',
      784: 'Sui',
    };
    return chains[chainId] || `Chain ${chainId}`;
  }
}
