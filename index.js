const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const async = require('async');
const csv = require('csvtojson');
const converter = require('json2csv');
const source = require(`./source_part_${process.env.PART || 0}.json`);

const CONCURRENCY = 50;

class writeToStream  {
	constructor(location) {
		// this.writer = csvWriter({ headers: ["id", "url", "text", "description", "meta", "imgAlt"]});
		this.writer = fs.createWriteStream(location);
		this.writer.write('"id","url","text","description","meta","imgAlt"\n');
		// this.writer.pipe(fs.createWriteStream(location));
	}
	write({ index, url = '', text = '', description = '', meta = '', imgAlt = '' }) {
		url = url.replace(/[,"]/g, "");
		text = text.replace(/[,"]/g, "");
		description = description.replace(/[,"]/g, "");
		meta = meta.replace(/[,"]/g, "");
		imgAlt = imgAlt.replace(/[,"]/g, "");
		return new Promise(resolve => {
			this.writer.write(`${index},${url},${text},${description},${meta},${imgAlt}\n`, () => resolve());
		});
	}
	close() {
		this.writer.close();
	}
}

const results =  new writeToStream('./out.csv');
const errors =  new writeToStream('./errors.csv');

function compute(task, index) {
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
					index,
					url: task,
					text: `ERROR: ${err.message}`,
				});
			} else if(response.statusCode > 399) {
				await errors.write({
					index,
					url: task,
					text: `ERROR: ERROR STATUS CODE ${response.statusCode}`,
				});
			} else {
				const $ = cheerio.load(body);
				const $meta = $('meta[name="description"]'); // only get 1st description meta tag
				let meta = '';
				$('meta').each(function(i, curr) {
					meta += $(this).attr('content') + ' ';
				});
				let imgAlt = '';
				$('img').each(function () {
						imgAlt += $(this).attr('alt') + ' ';
				});
				const description = $meta.attr('content');
				await results.write({
					index,
					url: task,
					text: $('body').text().replace(/(?:\s|\n|\r|<[^>]*>)+/g, ' '),
					description,
					meta,
					imgAlt,
				});
			}
			console.log('DONE ---->', task);
			resolve();
		});
	})
}



const q = async.queue(async (task, cb) => {
	await compute(task.url, task.index);
	cb(null);
}, CONCURRENCY);

source.forEach((curr, index) => {
	q.push({ url: curr.field2, index }, () => { });
});
