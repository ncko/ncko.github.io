import { watch } from 'node:fs';
import { website } from './index.js';

// only works on mac: https://nodejs.org/dist/latest-v18.x/docs/api/fs.html#caveats

const PATH = './src';

console.clear();
console.log(`Watching files in ${PATH}. Press Ctrl+C to stop watching.`);
website.build();
watch(PATH, { recursive: true }, function(eventType, filename) {
  console.log(`${filename} ${eventType}. Rebuilding...`);
  website.build();
})

