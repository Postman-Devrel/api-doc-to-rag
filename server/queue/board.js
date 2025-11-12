import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { curlQueue, embeddingsQueue } from './config.js';

// Create Bull Board server adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Create Bull Board with your queues
createBullBoard({
    queues: [new BullMQAdapter(curlQueue), new BullMQAdapter(embeddingsQueue)],
    serverAdapter: serverAdapter,
});

export { serverAdapter };
