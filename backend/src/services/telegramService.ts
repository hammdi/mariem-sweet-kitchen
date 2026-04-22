import { logger } from '../utils/logger';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export class TelegramService {
  private static enabled(): boolean {
    return !!(BOT_TOKEN && CHAT_ID);
  }

  /**
   * Envoie un message Telegram (non-bloquant, ne lance jamais d'erreur)
   */
  static async send(text: string): Promise<void> {
    if (!this.enabled()) {
      logger.warn('Telegram non configure (TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant)');
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        logger.error(`Telegram API error: ${res.status} — ${body}`);
      }
    } catch (err) {
      logger.error('Telegram send failed:', err);
    }
  }

  /**
   * Notification de nouvelle commande
   */
  static async notifyNewOrder(order: {
    _id: string;
    clientName: string;
    clientPhone: string;
    totalPrice: number;
    requestedDate?: Date | null;
    notes?: string;
    items: {
      recipeName: string;
      sizeName: string;
      quantity: number;
      unitPrice: number;
    }[];
  }): Promise<void> {
    const itemsText = order.items
      .map(
        (i) =>
          `  • ${i.quantity}x ${i.recipeName} (${i.sizeName}) — ${(i.unitPrice * i.quantity).toFixed(2)} DT`
      )
      .join('\n');

    let dateText = '';
    if (order.requestedDate) {
      const d = new Date(order.requestedDate);
      dateText = `\n📅 <b>RDV souhaite :</b> ${d.toLocaleDateString('fr-TN', { weekday: 'long', day: 'numeric', month: 'long' })} a ${d.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    const notesText = order.notes ? `\n📝 <b>Notes :</b> ${order.notes}` : '';

    const text = [
      `🧁 <b>Nouvelle commande !</b>`,
      ``,
      `👤 <b>${order.clientName}</b>`,
      `📞 ${order.clientPhone}`,
      ``,
      itemsText,
      ``,
      `💰 <b>Total : ${order.totalPrice.toFixed(2)} DT</b>`,
      dateText,
      notesText,
    ]
      .filter(Boolean)
      .join('\n');

    await this.send(text);
  }

  /**
   * Notification de changement de statut
   */
  static async notifyStatusChange(
    orderName: string,
    clientPhone: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    const statusEmoji: Record<string, string> = {
      confirmed: '✅',
      preparing: '👩‍🍳',
      ready: '🎉',
      paid: '💵',
      cancelled: '❌',
    };

    const emoji = statusEmoji[newStatus] || '📋';
    const text = `${emoji} Commande de <b>${orderName}</b> (${clientPhone}) : ${oldStatus} → <b>${newStatus}</b>`;

    await this.send(text);
  }
}
