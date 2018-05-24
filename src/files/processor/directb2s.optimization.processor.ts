/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { Readable } from 'stream';
import { createWriteStream, stat } from 'fs';
import { promisify } from 'util';

import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { Parser } from '../../common/sax.async';
import { Processor } from './processor';
import { ProcessorQueueName } from './processor.queue';
import { File } from '../file';
import { BackglassVariation, FileVariation } from '../file.variations';

const PngQuant = require('pngquant');
const base64 = require('base64-stream');
const statAsync = promisify(stat);

export class Directb2sOptimizationProcessor extends Processor<BackglassVariation> {

	name: string = 'directb2s.optimization';

	canProcess(file: File, variation?: FileVariation): boolean {
		return file.getMimeType(variation) === 'application/x-directb2s';
	}

	getOrder(variation?: FileVariation): number {
		return 600 + (variation && variation.priority ? variation.priority : 0);
	}

	getQueue(): ProcessorQueueName {
		return 'LOW_PRIO_SLOW';
	}

	async process(file: File, src: string, dest: string, variation?: BackglassVariation): Promise<string> {

		logger.debug('[Directb2sOptimizationProcessor] Starting processing %s at %s.', file.toString(variation), dest);

		const now = new Date().getTime();
		let originalSize = (await statAsync(src)).size;
		let out = createWriteStream(dest);
		let parser = new Parser(src);
		let closePrevious = '';
		let emptyElement: boolean;
		let level = 0;
		let currentTag: string;

		return new Promise<string>((resolve, reject) => {

			const write = (text: string) => out.write(text);

			parser.on('opentagstart', tag => {
				let name = tag.name;
				level++;
				emptyElement = true;
				write(closePrevious);
				write('<' + name);
				closePrevious = '>';
				currentTag = name;
			});

			parser.on('attribute', attr => {
				if ((currentTag === 'Bulb' && attr.name === 'Image') ||
					(currentTag === 'BackglassImage' && attr.name === 'Value') ||
					(currentTag === 'ThumbnailImage' && attr.name === 'Value')) {

					parser.pause();
					let source = new Readable();
					let started = false;
					let quanter = new PngQuant([192, '--ordered']);
					let handleError = (err: Error) => {
						logger.error('[Directb2sOptimizationProcessor] %s', err.message);
						if (!started) {
							write(' ' + attr.name + '="');
							write(this.escape(attr.value));
						}
						write('"');
						parser.resume();
					};
					source.on('error', handleError)
						.pipe(base64.decode()).on('error', handleError)
						.pipe(quanter).on('error', handleError)
						.pipe(base64.encode()).on('error', handleError)
						.on('data', (data: any) => {
							if (!started) {
								write(' ' + attr.name + '="');
							}
							write(data);
							started = true;
						})
						.on('end', () => {
							write('"');
							parser.resume();
						});

					source.push(attr.value);
					source.push(null);
				} else {
					write(' ' + attr.name + '="');
					write(escape(attr.value));
					write('"');
				}
			});

			parser.on('text', text => {
				if (text) {
					emptyElement = false;
					write(closePrevious);
					write(text);
					closePrevious = '';
				} else {
					emptyElement = true;
				}
			});

			parser.on('closetag', name => {
				level--;
				if (emptyElement) {
					write('/>');
				} else {
					write('</' + name + '>');
				}
				closePrevious = '';

				if (level === 0) {
					out.end();
					statAsync(dest).then(s => {
						let crushedSize = s.size;
						logger.debug('[Directb2sOptimizationProcessor] Optimized "%s" in %sms (crushed down to %s%%).', dest, new Date().getTime() - now, Math.round(crushedSize / originalSize * 100));
						resolve();
					});
				}
			});

			parser.on('opencdata', () => {
				emptyElement = false;
				write(closePrevious);
				write('<![CDATA[');
				closePrevious = '';
			});

			parser.on('cdata', text => {
				write(text);
			});

			parser.on('closecdata', () => {
				write(']]>');
				emptyElement = false;
			});

			parser.on('comment', comment => {
				emptyElement = false;
				write(closePrevious);
				write('<!--' + comment + '-->');
				closePrevious = '';
			});

			parser.on('processinginstruction', instr => {
				emptyElement = false;
				write(closePrevious);
				write('<?' + instr.name + ' ' + instr.body + '?>');
				closePrevious = '';
			});

			parser.on('error', err => {
				reject(new ApiError('Error parsing direct2b file at %s', file.toString(variation)).log(err));
			});

			parser.stream(true);
		});
	}

	private escape(string: string) {
		let pattern;
		if (string === null || string === undefined) return;
		const map: { [key: string]: string } = {
			'>': '&gt;',
			'<': '&lt;',
			'\'': '&apos;',
			'"': '&quot;',
			'&': '&amp;',
			'\r': '&#xD;',
			'\n': '&#xA;'
		};
		pattern = '([&"<>\'\n\r])';
		return string.replace(new RegExp(pattern, 'g'), (str, item) => map[item]);
	}
}