import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { pathToFileURL } from 'node:url';

export async function runHandoff(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Use the local demo URL.');
  const client = new Client({ name: 'demo-handoff', version: '1.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', url)));
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    const parsed = JSON.parse(result.content.find(item => item.type === 'text').text);
    if (result.isError) throw new Error(parsed.error);
    return parsed;
  };
  try {
    const overview = await call('crm_overview', {});
    const projectId = overview.projects[0].id;
    const run = crypto.randomUUID().slice(0, 8);
    const input = { name: 'Clara Montes', company: 'Harbour Clinic · fictional', email: `clara-${run}@harbour.example`, projectIds: [projectId], source: 'Fictional MCP handoff' };
    const contact = await call('crm_contacts_create', { input, requestId: `handoff-${run}-contact` });
    const retry = await call('crm_contacts_create', { input, requestId: `handoff-${run}-contact` });
    if (retry.id !== contact.id) throw new Error('Idempotent retry returned a different contact.');
    const opportunity = await call('crm_opportunities_create', { input: { contactId: contact.id, projectId, title: 'Appointment enquiry workflow', stage: 'conversation', valueCents: 240000, nextStep: 'meeting_proposal' }, requestId: `handoff-${run}-opportunity` });
    const dueOn = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await call('crm_tasks_create', { input: { contactId: contact.id, opportunityId: opportunity.id, projectId, actionType: 'meeting_proposal', dueOn }, requestId: `handoff-${run}-task` });
    await call('crm_activities_create', { input: { contactId: contact.id, opportunityId: opportunity.id, projectId, kind: 'note', body: 'Fictional MCP handoff: enquiry reviewed, opportunity recorded and follow-up scheduled. No message was sent.' }, requestId: `handoff-${run}-activity` });
    return { contactId: contact.id, opportunityId: opportunity.id, retriedContactId: retry.id, message: 'MCP created Clara, an opportunity and a follow-up. Retrying the contact created no duplicate.' };
  } finally { await client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runHandoff(process.argv[2] ?? 'http://127.0.0.1:4318'), null, 2));
}
