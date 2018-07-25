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

import { createWriteStream, stat } from 'fs';
import { Readable } from 'stream';
import { promisify } from 'util';

import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { RequestState } from '../../common/typings/context';
import { XmlParser } from '../../common/xml.parser';
import { FileDocument } from '../file.document';
import { BackglassVariation, FileVariation } from '../file.variations';
import { OptimizationProcessor } from './processor';

const PngQuant = require('pngquant');
const base64 = require('base64-stream');
const statAsync = promisify(stat);

export class Directb2sOptimizationProcessor implements OptimizationProcessor<BackglassVariation> {

	public name: string = 'directb2s.optimization';

	public canProcess(file: FileDocument, variation?: FileVariation): boolean {
		return file.getMimeType(variation) === 'application/x-directb2s';
	}

	public getOrder(variation?: FileVariation): number {
		return 600 + (variation && variation.priority ? variation.priority : 0);
	}

	public async process(requestState: RequestState, file: FileDocument, src: string, dest: string, variation?: BackglassVariation): Promise<string> {

		logger.debug(requestState, '[Directb2sOptimizationProcessor] Starting processing %s at %s.', file.toShortString(variation), dest);

		const now = new Date().getTime();
		const originalSize = (await statAsync(src)).size;
		const out = createWriteStream(dest);
		const parser = new XmlParser(src);
		let closePrevious = '';
		let emptyElement: boolean;
		let level = 0;
		let currentTag: string;

		return new Promise<string>((resolve, reject) => {

			const write = (text: string) => out.write(text);

			parser.on('opentagstart', tag => {
				const name = tag.name;
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
					const source = new Readable();
					let started = false;
					const quanter = new PngQuant([192, '--ordered']);

					/* istanbul ignore next */
					const handleError = (err: Error) => {
						logger.error(requestState, '[Directb2sOptimizationProcessor] %s', err.message);
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
						const crushedSize = s.size;
						logger.debug(requestState, '[Directb2sOptimizationProcessor] Optimized "%s" in %sms (crushed down to %s%%).', dest, new Date().getTime() - now, Math.round(crushedSize / originalSize * 100));
						resolve();
					});
				}
			});

			/* istanbul ignore next */
			parser.on('opencdata', () => {
				emptyElement = false;
				write(closePrevious);
				write('<![CDATA[');
				closePrevious = '';
			});

			/* istanbul ignore next */
			parser.on('cdata', text => {
				write(text);
			});

			/* istanbul ignore next */
			parser.on('closecdata', () => {
				write(']]>');
				emptyElement = false;
			});

			/* istanbul ignore next */
			parser.on('comment', comment => {
				emptyElement = false;
				write(closePrevious);
				write('<!--' + comment + '-->');
				closePrevious = '';
			});

			/* istanbul ignore next */
			parser.on('processinginstruction', instr => {
				emptyElement = false;
				write(closePrevious);
				write('<?' + instr.name + ' ' + instr.body + '?>');
				closePrevious = '';
			});

			/* istanbul ignore next */
			parser.on('error', err => {
				reject(new ApiError('Error parsing direct2b file at %s', file.toShortString(variation)).log(err));
			});

			parser.stream(true);
		});
	}

	private escape(str: string) {
		/* istanbul ignore if */
		if (str === null || str === undefined) {
			return;
		}
		const map: { [key: string]: string } = {
			'>': '&gt;',
			'<': '&lt;',
			'\'': '&apos;',
			'"': '&quot;',
			'&': '&amp;',
			'\r': '&#xD;',
			'\n': '&#xA;',
		};
		const pattern = '([&"<>\'\n\r])';
		return str.replace(new RegExp(pattern, 'g'), (s, item) => map[item]);
	}
}
