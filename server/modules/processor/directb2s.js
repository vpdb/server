"use strict";

const fs = require('fs');
const expat = require('node-expat');
const parser = new expat.Parser('UTF-8');
const base64 = require('base64-stream');
const Readable = require('stream').Readable


const PngQuant = require('pngquant');

const quanter = new PngQuant([192, '--ordered']);
//const xmlPath = 'test.xml';
//const xmlPath = 'C:/Games/Visual Pinball/Tables/Attack from Mars (Bally 1995)-simplified.directb2s';
const xmlPath = 'C:/Games/Visual Pinball/Tables/Attack from Mars (Bally 1995).directb2s';

let db2s = fs.createReadStream(xmlPath);
let out = fs.createWriteStream('updated.xml');
let closePrevious = '';
let emptyElement;
let level = 0;
let isStopped = false; // https://github.com/astro/node-expat/issues/148

var write = function(text) {
	out.write(text);
	//process.stdout.write(text);
};

parser.on('xmlDecl', (version, encoding, standalone) => {
	write('<?xml');
	if (version) {
		write(' version="' + version + '"');
	}
	write(' standalone="' + (standalone ? 'yes' : 'no') + '"');
	if (encoding) {
		write(' encoding="' + encoding + '"');
	}
	write(' ?>\n');
});

parser.on('startElement', function(name, attrs) {
	level++;
	emptyElement = true;
	write(closePrevious);
	write('<' + name);
	closePrevious = '>';
	for (var key in attrs) {
		if (attrs.hasOwnProperty(key)) {
			let value = attrs[key];
			if (name === 'Bulb' && key === 'Image') {
				parser.stop();
				isStopped = true;
				let started = false;
				let attrName = key;
				let source = new Readable;
				let startedAt = new Date().getTime();
				source.pipe(base64.decode())
					.pipe(quanter)
					.pipe(base64.encode())
					.on('data', data => {
						if (!started) {
							write(' ' + attrName + '="');
						}
						write(data);
						started =true;
					})
					.on('end', () => {
						console.log('Crushed in %sms.', (new Date().getTime() - startedAt));

						write('"');
						isStopped = false;
						parser.emit('endElement');
						parser.resume();
					});
				source.push(value);
				source.push(null);

			} else {
				write(' ' + key + '="');
				write(escape(value));
				write('"');
			}
		}
	}
});

parser.on('text', function(text) {
	if (text) {
		emptyElement = false;
		write(closePrevious);
		write(text);
		closePrevious = '';
	} else {
		emptyElement = true;
	}
});

parser.on('endElement', function(name) {
	if (isStopped) {
		return;
	}
	level--;
	if (emptyElement) {
		write('/>');
	} else {
		write('</' + name + '>');
	}
	closePrevious = '';

	if (level === 0) {

		console.log('\n----------');
		console.log('Done.');
		out.end();
	}
});

parser.on('startCdata', function() {
	emptyElement = false;
	write(closePrevious);
	write('<![CDATA[');
	closePrevious = '';
});

parser.on('endCdata', function() {
	write(']]>');
	emptyElement = false;
});

parser.on('comment', function(comment) {
	emptyElement = false;
	write(closePrevious);
	write('<!--' + comment + '-->');
	closePrevious = '';
});

parser.on('processingInstruction', function(target, data) {
	emptyElement = false;
	write(closePrevious);
	write('<?' + target + ' ' + data + '?>');
	closePrevious = '';
});

parser.on('error', function(error) {
	console.error('ERROR: %s', error);
});

db2s.pipe(parser);


function escape(string) {
	let pattern;

	if (string === null || string === undefined) return;
	const map = {
		'>': '&gt;',
		'<': '&lt;',
		"'": '&apos;',
		'"': '&quot;',
		'&': '&amp;',
		'\r': '&#xD;',
		'\n': '&#xA;'
	};
	pattern = '([&"<>\'\n\r])';
	return string.replace(new RegExp(pattern, 'g'), function(str, item) {
		return map[item];
	});
}