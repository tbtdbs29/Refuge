import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { MESSAGE_STATUS, MESSAGE_TOPICS } from '../config/labels.js';
import { animalRepository } from '../repositories/animalRepository.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { NotFoundError } from '../utils/errors.js';
import { formatStamp, textToHtml } from '../utils/format.js';
import { logger } from '../utils/logger.js';

let transporter;

function getTransporter() {
  if (!config.smtp.host || !config.smtp.notify) return null;
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

async function notify(message) {
  const mailer = getTransporter();
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: config.smtp.from || config.smtp.user,
      to: config.smtp.notify,
      replyTo: message.email,
      subject: `[Site] ${MESSAGE_TOPICS[message.topic]}${message.animal_name ? ` – ${message.animal_name}` : ''} – ${message.name}`,
      text: [
        `Nom : ${message.name}`,
        `Email : ${message.email}`,
        `Téléphone : ${message.phone || '—'}`,
        message.animal_name ? `Animal : ${message.animal_name}` : '',
        message.home ? `\nCadre de vie :\n${message.home}` : '',
        `\nMessage :\n${message.body}`,
        `\nVoir dans le back office : ${config.baseUrl}/admin/messages/${message.id}`,
      ].filter(Boolean).join('\n'),
    });
    logger.info('message.notified', { id: message.id });
  } catch (error) {
    // The message is already saved; a mail failure must not fail the visitor's request.
    logger.error('message.notify_failed', { id: message.id, error: error.message });
  }
}

function decorate(message) {
  return {
    ...message,
    topicLabel: MESSAGE_TOPICS[message.topic],
    statusLabel: MESSAGE_STATUS[message.status],
    dateLabel: formatStamp(message.created_at),
    bodyHtml: textToHtml(message.body),
    homeHtml: textToHtml(message.home),
  };
}

export const messageService = {
  async submit(data) {
    const animalId = data.animal_id && (await animalRepository.findById(data.animal_id)) ? data.animal_id : null;
    const id = await messageRepository.create({ ...data, animal_id: animalId });
    logger.info('message.received', { id, topic: data.topic });
    await notify(await messageRepository.findById(id));
    return id;
  },

  async list(status) {
    return (await messageRepository.list({ status })).map(decorate);
  },

  async counts() {
    const counts = await messageRepository.countByStatus();
    return { nouveau: counts.nouveau || 0, traite: counts.traite || 0, archive: counts.archive || 0 };
  },

  async getById(id) {
    const message = await messageRepository.findById(id);
    if (!message) throw new NotFoundError('Message introuvable.');
    return decorate(message);
  },

  async setStatus(id, status) {
    await this.getById(id);
    await messageRepository.setStatus(id, status);
  },

  async delete(id) {
    await this.getById(id);
    await messageRepository.delete(id);
  },
};
