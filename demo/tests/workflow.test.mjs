import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startDemo } from '../server.mjs';
import { createWorkspace, actors } from '../workspace.mjs';
import { runHandoff } from '../client.mjs';

const payload = (operation, input, requestId = crypto.randomUUID()) => ({ operation, input, requestId });
async function post(url, body, headers = {}) {
  return fetch(url, { method:'POST', headers:{'content-type':'application/json',...headers}, body:JSON.stringify(body) });
}
async function mcp(baseUrl) {
  const client = new Client({ name:'integration-test', version:'1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp',baseUrl)));
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments:args });
    return { ...result, value:JSON.parse(result.content.find(i => i.type === 'text').text) };
  };
  return { client, call };
}

test('real MCP handoff creates one contact despite retry and shares the browser state', async t => {
  const demo = await startDemo(0); t.after(() => demo.close());
  const result = await runHandoff(demo.baseUrl);
  assert.equal(result.contactId,result.retriedContactId);
  const state = await (await fetch(`${demo.baseUrl}/api/state`)).json();
  assert.equal(state.contacts.length,4);
  assert.equal(state.contacts.filter(c => c.id === result.contactId).length,1);
  assert.equal(state.opportunities.filter(o => o.contactId === result.contactId).length,1);
  assert.equal(state.tasks.filter(task => task.contactId === result.contactId).length,1);
  assert.equal(state.activities.filter(a => a.contactId === result.contactId).length,1);
  assert.equal(state.audit.records.filter(a => a.actor === 'MCP assistant').length,4);
  assert.ok(state.contacts.every(c => c.email.endsWith('.example')));
});

test('browser creation, MCP update and stale browser edit use one versioned domain', async t => {
  const demo = await startDemo(0); t.after(() => demo.close());
  const channel = await mcp(demo.baseUrl); t.after(() => channel.client.close());
  const initial = await demo.workspace.state();
  const createdResponse = await post(`${demo.baseUrl}/api/operate`, payload('contacts.create',{name:'Fictional reviewer',email:'reviewer@demo.example',projectIds:[initial.projects[0].id]}));
  assert.equal(createdResponse.status,200);
  const contact = await createdResponse.json();
  const updated = await channel.call('crm_contacts_update',{input:{id:contact.id,expectedVersion:1,company:'Example team'},requestId:'test-mcp-update-001'});
  assert.equal(updated.isError,undefined);
  assert.equal(updated.value.version,2);
  const stale = await post(`${demo.baseUrl}/api/operate`,payload('contacts.update',{id:contact.id,expectedVersion:1,company:'Stale edit'}));
  assert.equal(stale.status,409);
  const state = await demo.workspace.state();
  assert.equal(state.contacts.find(c => c.id === contact.id).company,'Example team');
  assert.deepEqual(new Set(state.audit.records.filter(a => a.entityId === contact.id).map(a => a.actor)),new Set(['Web workspace','MCP assistant']));
});

test('reusing a request identifier with changed content rejects without another write', async t => {
  const workspace = await createWorkspace(); t.after(() => workspace.close());
  const input={name:'Retry fixture',email:'retry@fixture.example'};
  const one = await workspace.perform(actors.mcp,'contacts.create',input,'stable-request-001');
  const two = await workspace.perform(actors.mcp,'contacts.create',input,'stable-request-001');
  assert.deepEqual(one,two);
  await assert.rejects(workspace.perform(actors.mcp,'contacts.create',{...input,name:'Changed'},'stable-request-001'),error => error.status === 409);
  assert.equal((await workspace.state()).contacts.length,4);
});

test('read-only actors cannot mutate and unavailable operations stay unavailable', async t => {
  const workspace = await createWorkspace(); t.after(() => workspace.close());
  await assert.rejects(workspace.perform(actors.reader,'contacts.create',{name:'Read fixture'},'read-request-001'),error => error.status === 403);
  await assert.rejects(workspace.perform(actors.mcp,'projects.create',{name:'Escalation'},'project-request-001'),error => error.status === 400);
  const demo = await startDemo(0); t.after(() => demo.close());
  const { client } = await mcp(demo.baseUrl); t.after(() => client.close());
  const tools = await client.listTools();
  assert.equal(tools.tools.length,8);
  assert.ok(tools.tools.every(tool => !/send|mail|key|export/.test(tool.name)));
});

test('concurrent edits using the same version permit only one winner', async t => {
  const workspace = await createWorkspace(); t.after(() => workspace.close());
  const contact = (await workspace.state()).contacts[0];
  const result = await Promise.allSettled(['A','B'].map(company => workspace.perform(actors.mcp,'contacts.update',{id:contact.id,expectedVersion:contact.version,company},`concurrent-request-${company}`)));
  assert.equal(result.filter(r => r.status === 'fulfilled').length,1);
  assert.equal(result.find(r => r.status === 'rejected').reason.status,409);
  assert.equal((await workspace.state()).contacts.find(c => c.id === contact.id).version,2);
});

test('duplicate email is case-insensitive and real-domain contact details are rejected', async t => {
  const workspace = await createWorkspace(); t.after(() => workspace.close());
  const contact = (await workspace.state()).contacts[0];
  await assert.rejects(workspace.perform(actors.web,'contacts.create',{name:'Duplicate',email:contact.email.toUpperCase()},'duplicate-request-001'),error => error.status === 409);
  for (const fields of [{email:'fixture@example.org'},{phone:'12345'},{website:'https://example.com'}]) {
    await assert.rejects(workspace.perform(actors.web,'contacts.create',{name:'Rejected fixture',...fields},crypto.randomUUID()),error => error.status === 400);
  }
  assert.equal((await workspace.state()).contacts.length,3);
});

test('shared opt-out is persisted and removes the contact from the active pipeline', async t => {
  const workspace = await createWorkspace(); t.after(() => workspace.close());
  const state = await workspace.state();
  const contact = state.contacts[0];
  await workspace.perform(actors.web,'contacts.update',{id:contact.id,expectedVersion:contact.version,doNotContact:true},'opt-out-request-001');
  const next = await workspace.state();
  assert.equal(next.contacts.find(c => c.id === contact.id).doNotContact,1);
  assert.ok(next.pipeline.every(row => row.contactId !== contact.id));
  const current = next.contacts.find(c => c.id === contact.id);
  await assert.rejects(workspace.perform(actors.mcp,'contacts.update',{id:contact.id,expectedVersion:current.version,doNotContact:false},'opt-in-request-001'),error => error.status === 403);
});

test('local HTTP boundary rejects cross-origin, malformed and oversized requests', async t => {
  const demo = await startDemo(0); t.after(() => demo.close());
  assert.equal((await post(`${demo.baseUrl}/api/operate`,{}, {origin:'https://other.example'})).status,403);
  assert.equal((await fetch(`${demo.baseUrl}/api/operate`,{method:'POST',headers:{'content-type':'application/json'},body:'{broken'})).status,400);
  assert.equal((await post(`${demo.baseUrl}/api/operate`,{padding:'x'.repeat(70000)})).status,413);
  assert.equal((await fetch(`${demo.baseUrl}/.dev.vars`)).status,404);
  const home = await fetch(demo.baseUrl);
  assert.equal(home.status,200);
  assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
