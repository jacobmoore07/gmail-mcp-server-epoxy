import { listAccounts } from '../client.js';

export const tools = [
  {
    name: 'list_accounts',
    description: 'List all configured Gmail accounts available in this server',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export const handlers = {
  list_accounts() {
    const accounts = listAccounts();
    return {
      accounts: accounts.map((email, i) => ({ index: i + 1, email })),
      total: accounts.length,
    };
  },
};
