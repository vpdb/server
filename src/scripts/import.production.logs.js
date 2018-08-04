const { createGunzip } = require('zlib');
const { createReadStream } = require('fs');
const { Transform } = require('stream');
const LineStream = require('byline').LineStream;

const input = createReadStream('./production-logs/production-out__2016-10-07_00-00-00.log.gz');
const gunzip = createGunzip();

const byLine = new LineStream();
const stripAnsi = RegExp(['[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)','(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))'].join('|'), 'g');

class Forwarder extends Transform {
	_transform(line, encoding, callback) {
		const match = String(line).replace(stripAnsi, '').match(/^([^\s]+)\s+-\s+([^:]+):\s+(.+)/);
		if (match) {
			const date = new Date(match[1]);
			const level = match[2];
			const msg = match[3];
			this.push(level + ' - ' + msg + '\n');
		}
		callback();
	}
}

const filter = new Forwarder();
input
	.pipe(gunzip)
	.pipe(byLine)
	.pipe(filter)
	.pipe(process.stdout);

