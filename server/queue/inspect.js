#!/usr/bin/env node
/**
 * CLI tool to inspect BullMQ queue status
 * Usage: node server/queue/inspect.js
 */
import '../env.mjs'; // Load environment variables
import { curlQueue, embeddingsQueue } from './config.js';

const inspectQueue = async (queue, name) => {
    console.log(`\n📊 ${name} Queue`);
    console.log('─'.repeat(50));

    const counts = await queue.getJobCounts();
    console.log(`  Waiting:    ${counts.waiting}`);
    console.log(`  Active:     ${counts.active}`);
    console.log(`  Completed:  ${counts.completed}`);
    console.log(`  Failed:     ${counts.failed}`);
    console.log(`  Delayed:    ${counts.delayed}`);

    // Get active jobs
    if (counts.active > 0) {
        const activeJobs = await queue.getActive();
        console.log(`\n  📌 Active Jobs:`);
        activeJobs.forEach(job => {
            console.log(`    - ${job.id} (progress: ${job.progress}%)`);
        });
    }

    // Get waiting jobs
    if (counts.waiting > 0) {
        const waitingJobs = await queue.getWaiting(0, 5);
        console.log(`\n  ⏳ Next ${Math.min(5, counts.waiting)} Waiting Jobs:`);
        waitingJobs.forEach(job => {
            console.log(`    - ${job.id}`);
        });
    }

    // Get recent failed jobs
    if (counts.failed > 0) {
        const failedJobs = await queue.getFailed(0, 3);
        console.log(`\n  ❌ Recent Failed Jobs:`);
        failedJobs.forEach(job => {
            console.log(`    - ${job.id}: ${job.failedReason}`);
        });
    }
};

const main = async () => {
    console.log('\n🔍 BullMQ Queue Inspector\n');

    try {
        await inspectQueue(curlQueue, 'Curl Generation');
        await inspectQueue(embeddingsQueue, 'Embeddings Generation');

        console.log('\n✅ Inspection complete!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error inspecting queues:', error.message);
        console.log('\n💡 Make sure Redis is running: redis-cli ping\n');
        process.exit(1);
    }
};

main();
