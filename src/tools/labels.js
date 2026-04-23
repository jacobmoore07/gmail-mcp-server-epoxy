import { getGmailClient } from '../client.js';

export const tools = [
  {
    name: 'list_labels',
    description: 'List all Gmail labels for an account',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
      },
    },
  },
  {
    name: 'create_label',
    description: 'Create a new Gmail label',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        name: { type: 'string', description: 'Label name' },
        labelListVisibility: {
          type: 'string',
          enum: ['labelShow', 'labelShowIfUnread', 'labelHide'],
          description: 'Visibility in label list (default: labelShow)',
        },
        messageListVisibility: {
          type: 'string',
          enum: ['show', 'hide'],
          description: 'Visibility in message list (default: show)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'apply_label',
    description: 'Apply a label to a Gmail message',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        messageId: { type: 'string', description: 'Message ID' },
        labelId: { type: 'string', description: 'Label ID to apply' },
      },
      required: ['messageId', 'labelId'],
    },
  },
  {
    name: 'remove_label',
    description: 'Remove a label from a Gmail message',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        messageId: { type: 'string', description: 'Message ID' },
        labelId: { type: 'string', description: 'Label ID to remove' },
      },
      required: ['messageId', 'labelId'],
    },
  },
];

export const handlers = {
  async list_labels({ account } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.labels.list({ userId: 'me' });
    return { labels: res.data.labels || [] };
  },

  async create_label({ account, name, labelListVisibility = 'labelShow', messageListVisibility = 'show' } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility, messageListVisibility },
    });
    return res.data;
  },

  async apply_label({ account, messageId, labelId } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: [labelId] },
    });
    return { id: res.data.id, labelIds: res.data.labelIds };
  },

  async remove_label({ account, messageId, labelId } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: [labelId] },
    });
    return { id: res.data.id, labelIds: res.data.labelIds };
  },
};
