import { getGmailClient } from '../client.js';

export const tools = [
  {
    name: 'search_threads',
    description: 'Search Gmail threads using Gmail search syntax (e.g. "from:someone@example.com is:unread")',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number (1, 2, …). Defaults to account 1.' },
        query: { type: 'string', description: 'Gmail search query string' },
        maxResults: { type: 'number', description: 'Max threads to return (default 20, max 500)' },
        pageToken: { type: 'string', description: 'Page token for pagination' },
      },
    },
  },
  {
    name: 'get_thread',
    description: 'Get a full Gmail thread including all messages and bodies',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email address or account number. Defaults to account 1.' },
        threadId: { type: 'string', description: 'Gmail thread ID' },
      },
      required: ['threadId'],
    },
  },
];

function decodeBody(part) {
  if (!part) return '';
  if (part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }
  if (part.parts) {
    // Prefer text/plain, fall back to text/html
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
    subject: headers.subject,
    date: headers.date,
    snippet: msg.snippet,
    body: decodeBody(msg.payload),
    labelIds: msg.labelIds,
  };
}

export const handlers = {
  async search_threads({ account, query = '', maxResults = 20, pageToken } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.threads.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 500),
      pageToken,
    });

    const threads = res.data.threads || [];
    // Fetch snippet + subject for each thread
    const detailed = await Promise.all(
      threads.map(async (t) => {
        const thread = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'] });
        const first = thread.data.messages?.[0];
        const headers = Object.fromEntries(
          (first?.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]),
        );
        return {
          threadId: t.id,
          subject: headers.subject,
          from: headers.from,
          date: headers.date,
          snippet: first?.snippet,
          messageCount: thread.data.messages?.length,
        };
      }),
    );

    return {
      threads: detailed,
      nextPageToken: res.data.nextPageToken,
      resultSizeEstimate: res.data.resultSizeEstimate,
    };
  },

  async get_thread({ account, threadId } = {}) {
    const gmail = getGmailClient(account);
    const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    return {
      threadId: res.data.id,
      historyId: res.data.historyId,
      messages: (res.data.messages || []).map(formatMessage),
    };
  },
};
