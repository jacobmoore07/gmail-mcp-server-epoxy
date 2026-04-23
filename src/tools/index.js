import * as threads from './threads.js';
import * as messages from './messages.js';
import * as labels from './labels.js';
import * as drafts from './drafts.js';
import * as accounts from './accounts.js';

const modules = [threads, messages, labels, drafts, accounts];

export const tools = modules.flatMap((m) => m.tools);

const handlerMap = Object.assign({}, ...modules.map((m) => m.handlers));

export async function handleTool(name, args) {
  const fn = handlerMap[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(args ?? {});
}
