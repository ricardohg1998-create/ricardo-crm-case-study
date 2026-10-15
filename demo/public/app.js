const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const stageNames = { identified:'Identified', contacted:'Contacted', conversation:'Conversation', proposal:'Proposal', won:'Won', lost:'Lost', paused:'Paused' };
const actionNames = {wait_reply:'Wait for a reply',first_follow_up:'First follow-up (5–7 days)',second_follow_up:'Second follow-up (~10 days)',pause_3_months:'Pause for 3+ months',reactivate:'Reactivate',draft_reply:'Prepare a reply',await_their_reply:'Wait for their reply',partner_proposal:'Partnership proposal',meeting_proposal:'Meeting or commercial proposal'};
let state, selected;
function notify(message, error = false) { $('#notice').textContent = message; $('#notice').className = error ? 'error' : ''; }
async function request(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Could not complete the request.');
  return result;
}
async function operate(operation, input) {
  return request('/api/operate', { operation, input, requestId:crypto.randomUUID() });
}
async function refresh() {
  state = await request('/api/state');
  selected ??= state.contacts.find(c => c.email === 'elena@olive.example')?.id ?? state.contacts[0]?.id;
  render();
}
const date = value => value ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : 'No date set';
function renderContacts() {
  const query = $('#search').value.toLowerCase();
  const contacts = state.contacts.filter(contact => `${contact.name} ${contact.company}`.toLowerCase().includes(query));
  $('#contacts').innerHTML = contacts.map(contact => `<button class="contact ${selected === contact.id ? 'selected' : ''}" data-contact="${escape(contact.id)}" aria-pressed="${selected === contact.id}"><span class="avatar">${escape(contact.name.split(' ').map(n => n[0]).slice(0,2).join(''))}</span><span><strong>${escape(contact.name)}</strong><small>${escape(contact.company || 'Fictional contact')}</small></span></button>`).join('') || '<p class="empty">No matching contacts.</p>';
}
function render() {
  $('#contact-count').textContent = state.contacts.length;
  $('#opportunity-count').textContent = state.opportunities.filter(o => !['won','lost'].includes(o.stage)).length;
  $('#task-count').textContent = state.tasks.filter(t => !t.completed).length;
  $('#mcp-count').textContent = state.audit.records.filter(item => item.actor === 'MCP assistant').length;
  renderContacts();
  const contact = state.contacts.find(c => c.id === selected);
  if (!contact) { $('#detail').innerHTML = '<p class="empty">Select a contact to explore the workflow.</p>'; return; }
  const opportunity = state.opportunities.find(o => o.contactId === contact.id);
  const tasks = state.tasks.filter(t => t.contactId === contact.id);
  const activities = state.activities.filter(a => a.contactId === contact.id);
  $('#detail').innerHTML = `
    <div class="contact-header"><div><h2>${escape(contact.name)}</h2><p>${escape(contact.company)}</p><p>${escape(contact.email)}${contact.location ? ` · ${escape(contact.location)}` : ''}</p></div><span class="pill ${contact.doNotContact ? 'blocked' : ''}">${contact.doNotContact ? 'Do not contact' : 'Active relationship'}</span></div>
    <div class="detail-grid"><div class="card"><h3>Opportunity</h3>${opportunity ? `
      <strong>${escape(opportunity.title)}</strong><p class="money">${opportunity.valueCents === null ? 'Value to explore' : new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(opportunity.valueCents / 100)}</p>
      <label for="stage">Conversation stage</label><div class="row"><select id="stage">${Object.entries(stageNames).map(([value,label]) => `<option value="${value}" ${opportunity.stage === value ? 'selected' : ''}>${label}</option>`).join('')}</select><button id="save-stage" class="small">Save stage</button></div>
      <p class="subtle">Estimated opportunity value · version ${opportunity.version}</p>` : '<p>No opportunity yet.</p><button id="create-opportunity" class="small">Create opportunity</button>'}
    </div><div class="card"><h3>Next steps</h3>${tasks.map(task => `<div class="task ${task.completed ? 'done' : ''}"><div><strong>${escape(actionNames[task.actionType] ?? task.title)}</strong><p>${date(task.dueOn)}</p></div>${task.completed ? '<span class="pill">Done</span>' : `<button class="small" data-complete="${escape(task.id)}">Complete</button>`}</div>`).join('') || '<p>No follow-up scheduled.</p>'}
      <label for="next-action">Next action</label><select id="next-action">${state.nextActions.filter(a => actionNames[a.id]).map(a => `<option value="${a.id}">${escape(actionNames[a.id])}</option>`).join('')}</select><label for="due-on">Follow-up date</label><input id="due-on" type="date" value="${new Date(Date.now()+86400000).toISOString().slice(0,10)}"><div class="row"><button id="add-task" class="small">Add next step</button></div>
    </div></div>
    <div class="card notes-card"><h3>Relationship history</h3>${activities.map(activity => `<div class="activity"><p>${escape(activity.body)}</p><small>${escape(activity.actor)} · ${date(activity.occurredAt)}</small></div>`).join('') || '<p>No notes recorded yet.</p>'}<form id="note-form" class="note-form"><label class="search-label" for="note">Add a fictional note</label><textarea id="note" placeholder="Add a fictional conversation note…" required maxlength="10000"></textarea><button type="submit" class="small">Save note</button></form></div>
    <div class="row"><button id="opt-out" class="small" ${contact.doNotContact ? 'disabled' : ''}>${contact.doNotContact ? 'Contact excluded' : 'Mark as do not contact'}</button><p class="subtle">Shared across projects</p></div>`;
  $('#audit').innerHTML = state.audit.records.slice(0,8).map(item => `<div class="audit-entry"><strong>${escape(item.action)}</strong><span class="actor">${escape(item.actor)}</span><time>${date(item.recordedAt)} · ${new Date(item.recordedAt).toLocaleTimeString('en-GB')}</time></div>`).join('');
}
async function action(button, work) {
  button.disabled = true;
  try { await work(); await refresh(); }
  catch (error) { notify(error.message, true); }
  finally { if (button.isConnected) button.disabled = false; }
}
$('#contacts').addEventListener('click', event => {
  const button = event.target.closest('[data-contact]');
  if (button) { selected = button.dataset.contact; render(); }
});
$('#search').addEventListener('input', renderContacts);
$('#refresh').addEventListener('click', event => action(event.currentTarget, async () => { notify('Workspace refreshed.'); }));
$('#handoff').addEventListener('click', event => action(event.currentTarget, async () => {
  const result = await request('/api/handoff', {});
  selected = result.contactId;
  notify(result.message);
}));
$('#new-contact').addEventListener('click', () => { $('#contact-form').reset(); $('#form-error').textContent = ''; $('#contact-dialog').showModal(); });
$('#close-dialog').addEventListener('click', () => $('#contact-dialog').close());
$('#contact-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const result = await operate('contacts.create', { name:form.get('name'), company:form.get('company'), email:form.get('email'), source:'Fictional browser fixture', projectIds:[state.projects[0].id] });
    selected = result.id; $('#contact-dialog').close(); notify('Fictional contact added.'); await refresh();
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#detail').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.closest('#note-form')) return;
  const contact = state.contacts.find(c => c.id === selected), opportunity = state.opportunities.find(o => o.contactId === selected);
  action(button, async () => {
    if (button.id === 'save-stage') { await operate('opportunities.update',{id:opportunity.id, expectedVersion:opportunity.version, stage:$('#stage').value}); notify('Conversation stage updated.'); }
    else if (button.id === 'create-opportunity') { await operate('opportunities.create',{contactId:contact.id,projectId:state.projects[0].id,title:'Explore a fictional workflow'}); notify('Opportunity created.'); }
    else if (button.id === 'add-task') { await operate('tasks.create',{contactId:contact.id, opportunityId:opportunity?.id ?? null, projectId:state.projects[0].id, actionType:$('#next-action').value, dueOn:$('#due-on').value}); notify('Next step added.'); }
    else if (button.dataset.complete) { const task = state.tasks.find(t => t.id === button.dataset.complete); await operate('tasks.update',{id:task.id,expectedVersion:task.version,completed:true}); notify('Next step completed.'); }
    else if (button.id === 'opt-out') { await operate('contacts.update',{id:contact.id,expectedVersion:contact.version,doNotContact:true,doNotContactReason:'Fictional opt-out demonstration'}); notify('Contact marked as do not contact across projects.'); }
  });
});
$('#detail').addEventListener('submit', event => {
  if (event.target.id !== 'note-form') return;
  event.preventDefault();
  const contact = state.contacts.find(c => c.id === selected), opportunity = state.opportunities.find(o => o.contactId === selected);
  const body = $('#note').value;
  action(event.submitter, async () => { await operate('activities.create',{contactId:contact.id,opportunityId:opportunity?.id ?? null,projectId:state.projects[0].id,kind:'note',body}); notify('Note added to the shared history.'); });
});
refresh().catch(error => notify(error.message, true));
