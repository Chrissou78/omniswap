import { logger } from '../utils/logger';

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: 'price_alert' | 'order_filled' | 'dca_executed' | 'system';
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  async sendNotification(payload: NotificationPayload): Promise<void> {
    logger.info('Sending notification', { payload });
    // TODO: Implement actual notification sending (email, push, etc.)
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    logger.info('Sending email', { to, subject });
    // TODO: Implement email sending
  }

  async sendPushNotification(userId: string, title: string, body: string): Promise<void> {
    logger.info('Sending push notification', { userId, title });
    // TODO: Implement push notification
  }
}

export const notificationService = new NotificationService();
export default notificationService;
