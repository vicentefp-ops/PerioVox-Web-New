import {getWorkflowMetadata,sleep} from 'workflow';
import {previewIdentity, previewStore} from '../workflow-preview/storage.mjs';

export async function publishJournal(alarm) {
  'use workflow';
  await sleep(new Date(alarm.scheduledAt));
  return publishJournalStep(alarm,getWorkflowMetadata().workflowRunId);
}

async function publishJournalStep(alarm,runId) {
  'use step';
  const store=await previewStore();
  const startedAt=Date.now();
  if(startedAt<Date.parse(alarm.scheduledAt))throw new Error('Alarm arrived early');
  const published=await store.publishDue(startedAt,alarm);
  const result={scheduledAt:alarm.scheduledAt,startedAt,checkedAt:Date.now(),
    published:published.includes(alarm.id),deployment:previewIdentity().deployment};
  await store.pool.query('INSERT INTO journal_settings VALUES($1,$2) ON CONFLICT DO NOTHING',
    ['workflow-evidence:'+runId,JSON.stringify(result)]);
  console.log('JOURNAL_WORKFLOW_ALARM',JSON.stringify(result));
  return result;
}
