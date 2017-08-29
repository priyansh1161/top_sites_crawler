const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const async = require('async');
const csv = require('csvtojson');
const source = require('./source.json');

const CONCURRENCY = 20;

class writeToStream  {
	constructor(location) {
		this.writer = csvWriter({ headers: ["url", "text", "meta"]});
		// this.writer = fs.createWriteStream(location);
		// this.writer.write('url,text,meta\n');
		this.writer.pipe(fs.createWriteStream(location));
	}
	write({ url = '', text = '', meta = '' }) {
		return new Promise(resolve => {
			this.writer.write([url, text, meta], () => resolve());
		});
	}
	close() {
		this.writer.close();
	}
}

const results =  new writeToStream('./out.csv');
const errors =  new writeToStream('./errors.csv');

function compute(task) {
	return new Promise((resolve) => {
		const validURL = /^(http|https)./g;
		if(!validURL.test(task)) {
			task = 'http://' + task;
		}
		request({
			url: task,
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36',
			},
			maxRedirects: 6,
			timeout: 25000,
		}, async (err, response, body) => {
			if(err) {
				await errors.write({
					url: task,
					text: `ERROR: ${err.message}`,
				});
			} else if(response.statusCode > 399) {
				await errors.write({
					url: task,
					text: `ERROR: ERROR STATUS CODE ${response.statusCode}`,
				});
			} else {
				const $ = cheerio.load(body);
				const $meta = $('meta[name="description"]'); // only get 1st description meta tag
				console.log(typeof $meta);
				const meta = $meta.attr('content');
				await results.write({
					url: task,
					text: $('body').text().replace(/(?:\s|\n|\r|<[^>]*>)+/g, ' '),
					meta,
				});
			}
			console.log('DONE ---->', task, ' with status ');
			resolve();
		});
	})
}


// (async () => {
// 	let tasks = [];
// 	let currentlyWorking = 0;
// 	for(let i =0; i<source.length; i++) {
// 		if(currentlyWorking%CONCURRENCY === 0 && currentlyWorking !== 0) {
// 			await Promise.all(tasks);
// 			console.log('BATCH Done' );
// 			tasks = [];
// 			currentlyWorking = 0;
// 		}
// 		else {
// 			tasks.push(compute(source[i].field2));
// 			currentlyWorking++;
// 		}
// 	}
// })();

// ( async () => {
// 	// await compute('http://facebook.com');
// })();

const q = async.queue(async (task, cb) => {
	await compute(task);
	cb(null);
}, CONCURRENCY);

source.forEach((curr) => {
	q.push(curr.field2, () => { });
});
