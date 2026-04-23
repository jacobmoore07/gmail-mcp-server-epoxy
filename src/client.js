import 'dotenv/config';
import { google } from 'googleapis';

// Build account map from env vars: ACCOUNT_1_EMAIL + ACCOUNT_1_REFRESH_TOKEN, etc.
function buildAccounts() {
  const accounts = {};
  let i = 1;
  while (process.env[`ACCOUNT_${i}_EMAIL`]) {
    const email = process.env[`ACCOUNT_${i}_EMAIL`];
    const refreshToken = process.env[`ACCOUNT_${i}_REFRESH_TOKEN`];
    if (email && refreshToken) {
      accounts[email] = refreshToken;
      accounts[String(i)] = refreshToken; // also indexable by number
    }
    i++;
  }
  return accounts;
}

const ACCOUNTS = buildAccounts();

// Returns a Gmail API client authenticated for the given account.
// `account` can be an email address ("info@epoxyfloorpros.us") or a 1-based
// index ("1", "2"). Defaults to account 1 if omitted.
export function getGmailClient(account) {
  const keys = Object.keys(ACCOUNTS).filter((k) => /^\d+$/.test(k));
  if (keys.length === 0) {
    throw new Error(
      'No Gmail accounts configured. Set ACCOUNT_1_EMAIL and ACCOUNT_1_REFRESH_TOKEN env vars.',
    );
  }

  const key = account ? String(account) : '1';
  const refreshToken = ACCOUNTS[key];
  if (!refreshToken) {
    throw new Error(
      `Gmail account "${account}" not found. Available: ${Object.keys(ACCOUNTS).filter((k) => k.includes('@')).join(', ')}`,
    );
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

export function listAccounts() {
  return Object.keys(ACCOUNTS).filter((k) => k.includes('@'));
}
