import { kafka } from './kafka.js';
import { HANDLERS, handleEvent } from './events.js';

let consumer;

export async function startConsumers() {
  consumer = kafka.consumer({ groupId: 'dailycart-workers' });
  await consumer.connect();
  for (const topic of Object.keys(HANDLERS)) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let evt;
      try {
        evt = JSON.parse(message.value.toString());
      } catch (err) {
        console.error(`[consumer] bad message on ${topic}:`, err.message);
        return;
      }
      await handleEvent(topic, evt, 'kafka');
    },
  });
  console.log('[kafka] consumers running');
}

export async function stopConsumers() {
  if (consumer) await consumer.disconnect();
}
