import { getGmailClient } from '../client.js';

export const tools = [
  {
    name: 'list_drafts',
    description: 'List Gmail drafts for an account',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        maxResults: { type: 'number', description: 'Max drafts to return (default 20)' },
        pageToken: { type: 'string', description: 'Page token for pagination' },
      },
    },
  },
  {
    name: 'create_draft',
    description: 'Create a Gmail draft',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        to: { type: 'string', description: 'Recipient email address(es)' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        cc: { type: 'string', description: 'CC recipients' },
        bcc: { type: 'string', description: 'BCC recipients' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'send_draft',
    description: 'Send an existing Gmail draft',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        draftId: { type: 'string', description: 'Draft ID to send' },
      },
      required: ['draftId'],
    },
  },
  {
    name: 'delete_draft',
    description: 'Delete a Gmail draft',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        draftId: { type: 'string', description: 'Draft ID to delete' },
      },
      required: ['draftId'],
    },
  },
];

function buildRawEmail({ to, subject, body, cc, bcc }) {
  const lines = [];
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=UTF-8');
  lines.push('');
  lines.push(body);
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

export const handlers = {
  async list_drafts({ account, maxResults = 20, pageToken } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.drafts.list({ userId: 'me', maxResults, pageToken });
    return { drafts: res.data.drafts || [], nextPageToken: res.data.nextPageToken };
  },

  async create_draft({ account, to, subject, body, cc, bcc } = {}) {
    const gmail = getGmailClient(account);
    const raw = buildRawEmail({ to, subject, body, cc, bcc });
    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } },
    });
    return { draftId: res.data.id, messageId: res.data.message?.id };
  },

  async send_draft({ account, draftId } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: { id: draftId },
    });
    return { id: res.data.id, threadId: res.data.threadId };
  },

  async delete_draft({ account, draftId } = {}) {
    const gmail = getGmailClient(account);
    await gmail.users.drafts.delete({ userId: 'me', id: draftId });
    return { deleted: draftId };
  },
};
