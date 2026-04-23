import { getGmailClient } from '../client.js';

export const tools = [
  {
    name: 'list_messages',
    description: 'List Gmail messages with optional search query',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        query: { type: 'string', description: 'Gmail search query (e.g. "is:unread from:someone@example.com")' },
        maxResults: { type: 'number', description: 'Max messages to return (default 20, max 500)' },
        pageToken: { type: 'string', description: 'Page token for pagination' },
        labelIds: { type: 'array', items: { type: 'string' }, description: 'Filter by label IDs' },
      },
    },
  },
  {
    name: 'get_message',
    description: 'Get a single Gmail message with full body',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        messageId: { type: 'string', description: 'Gmail message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email from the specified Gmail account',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        to: { type: 'string', description: 'Recipient email address(es), comma-separated' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        cc: { type: 'string', description: 'CC email address(es), comma-separated' },
        bcc: { type: 'string', description: 'BCC email address(es), comma-separated' },
        replyToMessageId: { type: 'string', description: 'Message ID to reply to (sets In-Reply-To and References headers)' },
        replyToThreadId: { type: 'string', description: 'Thread ID to reply into' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'mark_as_read',
    description: 'Mark one or more Gmail messages as read',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        messageIds: { type: 'array', items: { type: 'string' }, description: 'Message IDs to mark as read' },
      },
      required: ['messageIds'],
    },
  },
  {
    name: 'move_to_trash',
    description: 'Move a Gmail message to trash',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        messageId: { type: 'string', description: 'Message ID to trash' },
      },
      required: ['messageId'],
    },
  },
];

function decodeBody(part) {
  if (!part) return '';
  if (part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === 'text/plain');
    const html = part.parts.find((p) => p.mimeType === 'text/html');
    const target = plain || html;
    return target ? decodeBody(target) : '';
  }
  return '';
}

function formatMessage(msg) {
  const headers = Object.fromEntries(
    (msg.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]),
  );
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    subject: headers.subject,
    date: headers.date,
    snippet: msg.snippet,
    body: decodeBody(msg.payload),
    labelIds: msg.labelIds,
  };
}

function buildRawEmail({ to, subject, body, cc, bcc, from, replyToMessageId, references }) {
  const lines = [];
  if (from) lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=UTF-8');
  if (replyToMessageId) lines.push(`In-Reply-To: <${replyToMessageId}>`);
  if (references) lines.push(`References: ${references}`);
  lines.push('');
  lines.push(body);
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

export const handlers = {
  async list_messages({ account, query = '', maxResults = 20, pageToken, labelIds } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 500),
      pageToken,
      labelIds,
    });

    const messages = res.data.messages || [];
    const detailed = await Promise.all(
      messages.map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: 'me', id: m.id, format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date'],
        });
        const headers = Object.fromEntries(
          (msg.data.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]),
        );
        return {
          id: m.id,
          threadId: m.threadId,
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          date: headers.date,
          snippet: msg.data.snippet,
          labelIds: msg.data.labelIds,
        };
      }),
    );

    return {
      messages: detailed,
      nextPageToken: res.data.nextPageToken,
      resultSizeEstimate: res.data.resultSizeEstimate,
    };
  },

  async get_message({ account, messageId } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    return formatMessage(res.data);
  },

  async send_email({ account, to, subject, body, cc, bcc, replyToMessageId, replyToThreadId } = {}) {
    const gmail = getGmailClient(account);

    let references;
    if (replyToMessageId) {
      references = `<${replyToMessageId}>`;
    }

    const raw = buildRawEmail({ to, subject, body, cc, bcc, replyToMessageId, references });
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: replyToThreadId },
    });

    return { id: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds };
  },

  async mark_as_read({ account, messageIds } = {}) {
    const gmail = getGmailClient(account);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: { ids: messageIds, removeLabelIds: ['UNREAD'] },
    });
    return { marked: messageIds.length };
  },

  async move_to_trash({ account, messageId } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.messages.trash({ userId: 'me', id: messageId });
    return { id: res.data.id, labelIds: res.data.labelIds };
  },
};
