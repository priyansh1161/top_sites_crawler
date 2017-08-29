const org = require('./source.json');
const fs = require('fs');
const N = 10;
const parts = [];
const cap = org.length/N;
let index = 0;
org.forEach((curr, i) => {
	if(!parts[index]) {
		parts[index] = [];
	}
	parts[index].push(curr);
	if(parts[index].length > cap && index < N) {
		index++;
	}
});

parts.forEach((curr, i) => {
	fs.writeFileSync(`./source_part_${i}.json`, JSON.stringify(curr, null, 2));
});