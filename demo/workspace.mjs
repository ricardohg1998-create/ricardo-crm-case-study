import { database } from './database.mjs';
import { mutate, snapshot, history, operations, CRMError } from './core/crm.ts';
import { nextActions } from './core/next-actions.ts';

export const actors = Object.freeze({
  web: Object.freeze({ id: 'demo:web', label: 'Web workspace', permission: 'owner' }),
  mcp: Object.freeze({ id: 'demo:mcp', label: 'MCP assistant', permission: 'write' }),
  reader: Object.freeze({ id: 'demo:reader', label: 'Read-only assistant', permission: 'read' }),
});
export const supportedOperations = Object.freeze([
  'contacts.create', 'contacts.update', 'opportunities.create',
  'opportunities.update', 'tasks.create', 'tasks.update', 'activities.create',
]);
export { operations, CRMError };

export async function createWorkspace() {
  const db = database();
  // Mutations are serialised in this single-process demo. Production uses D1.
  let pending = Promise.resolve();
  const perform = (actor, operation, input, requestId) => {
    if (!supportedOperations.includes(operation)) return Promise.reject(new CRMError(400, 'Operation unavailable in this demo.'));
    if (input?.email && !/^[^@]+@[^@]+\.example$/i.test(input.email)) return Promise.reject(new CRMError(400, 'Use a fictional email ending in .example.'));
    if (input?.phone) return Promise.reject(new CRMError(400, 'Phone numbers are not used in this fictional demo.'));
    if (input?.website) {
      try { if (!new URL(input.website).hostname.endsWith('.example')) throw new Error(); }
      catch { return Promise.reject(new CRMError(400, 'Use a fictional website ending in .example.')); }
    }
    const work = pending.then(() => mutate(db, actor, operation, input, requestId));
    pending = work.catch(() => {});
    return work;
  };
  const project = await mutate(db, actors.web, 'projects.create', { name: 'Studio North · demo', domain: 'studio.example', color: '#176c58' }, 'seed-project-001');
  const samples = [
    { name: 'Elena Martín', company: 'Olive Pharmacy · fictional', email: 'elena@olive.example', location: 'Sevilla', businessDescription: 'Independent pharmacy', detectedNeed: 'Discuss a stock enquiry workflow', stage: 'conversation', title: 'Stock enquiry workflow', nextStep: 'first_follow_up', valueCents: 180000 },
    { name: 'Daniel Vega', company: 'River Homes · fictional', email: 'daniel@river.example', location: 'Málaga', businessDescription: 'Local estate agency', detectedNeed: 'Discuss centralising valuation enquiries', stage: 'proposal', title: 'Valuation enquiry intake', nextStep: 'meeting_proposal', valueCents: 320000 },
    { name: 'Sofía Ruiz', company: 'Cedar Studio · fictional', email: 'sofia@cedar.example', location: 'Cádiz', businessDescription: 'Design studio', detectedNeed: '', stage: 'identified', title: 'Explore a referral partnership', nextStep: 'partner_proposal', valueCents: null },
  ];
  let index = 0;
  for (const sample of samples) {
    index++;
    const { stage, title, nextStep, valueCents, ...fields } = sample;
    const contact = await perform(actors.web, 'contacts.create', { ...fields, source: 'Fictional demo fixture', projectIds: [project.id] }, `seed-contact-00${index}`);
    const opportunity = await perform(actors.web, 'opportunities.create', { contactId: contact.id, projectId: project.id, stage, title, nextStep, valueCents }, `seed-opportunity-00${index}`);
    if (index === 1) {
      const dueOn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await perform(actors.web, 'tasks.create', { contactId: contact.id, opportunityId: opportunity.id, projectId: project.id, actionType: nextStep, dueOn }, 'seed-task-001');
      await perform(actors.web, 'activities.create', { contactId: contact.id, opportunityId: opportunity.id, projectId: project.id, kind: 'note', body: 'Fictional conversation: Elena asked for a short workflow proposal.' }, 'seed-activity-001');
    }
  }
  return {
    perform,
    projectId: project.id,
    async state() {
      await pending;
      return { ...await snapshot(db), audit: await history(db, {}), nextActions };
    },
    close: () => db.close(),
  };
}
