/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

/* tslint:disable:no-console */
import chalk from 'chalk';
const treeify = require('treeify');

const line = '=========================';
class Profiler {

	private logs: Map<string, ProfileLog> = new Map();
	private history: ProfileLog[] = [];
	private current: ProfileLog = null;

	/**
	 * Starts measuring.
 	 * @param name Name of the profile, if not set the calling class/method name will be taken.
	 */
	public start(name?: string) {
		if (!name) {
			name = this.getName(3);
		}
		const log: ProfileLog = { name, timestamp: Date.now(), parent: this.current };
		this.logs.set(name, log);
		if (this.current) {
			if (!this.current.children) {
				this.current.children = [];
			}
			this.current.children.push(log);
		}

		this.current = log;
		this.history.push(log);
		console.log(chalk.white.bgRed(line) + chalk.red(' >>> ') + chalk.white(this.getTrace(log).map(p => p.name).join(':')));
	}

	/**
	 * Stops measuring.
	 * @param name Name of the profile, if not set the calling class/method name will be taken.
	 */
	public end(name?: string) {
		let log;
		if (name) {
			log = this.logs.get(name);
			if (!log) {
				throw new Error('Cannot stop unknown profile "' + name + '".');
			}
		} else {
			log = this.logs.get(this.getName(3));
			if (!log) {
				throw new Error('Cannot stop unknown profile "' + this.getName(3) + '" from stack.');
			}
		}
		if (log.name !== this.current.name) {
			throw new Error('Can only stop current profiler "' + this.current.name + '" (not "' + log.name + '").');
		}
		this.logs.delete(name);
		log.duration = Date.now() - log.timestamp;
		console.log(chalk.white.bgMagenta(line) + chalk.magenta(' <<< ') + chalk.white(this.getTrace(log).map(p => p.name).join(':')) + ' ' + chalk.bgGreen.white(' ' + log.duration + 'ms '));
		this.current = log.parent;
	}

	/**
	 * Prints a tree of all the measured profiles.
	 */
	public print() {
		const rootLogs = this.history.filter(l => !l.parent);
		const tree = {};
		rootLogs.forEach(log => {
			this.createTree(tree, log);
		});
		console.log('\nProfiler');
		console.log(treeify.asTree(tree));
	}

	/**
	 * Returns the name of the caller
	 * @param pos Number of stacks to go back
	 */
	private getName(pos: number) {
		const stackLines = (new Error()).stack.split('\n');
		if (stackLines.length < pos + 1) {
			throw new Error('Cannot determine caller with a stack of ' + stackLines.length + '.');
		}
		const m = stackLines[pos].match(/\s+at\s+([^\s(]+)/i);
		if (!m) {
			throw new Error('Cannot parse stack line "' + stackLines[pos] + '".');
		}
		return m[1];
	}

	/**
	 * Recursively creates a tree object to use with treeify.
	 * @param node Current node
	 * @param log Current profile
	 */
	private createTree(node: { [key: string]: any }, log: ProfileLog): {[key: string]: any } {
		const key = this.printLog(log);
		if (log.children && log.children.length > 0) {
			node[key] = {};
			for (const child of log.children) {
				this.createTree(node[key], child);
			}
		} else {
			node[key] = null;
			return null;
		}
	}

	/**
	 * Gets the property name for the log entry (which will show up as node name in the tree).
	 * @param log Profile
	 */
	private printLog(log: ProfileLog) {
		return chalk.white(log.name) + ': ' + chalk.white(String(log.duration)) + chalk.gray('ms');
	}

	/**
	 * Recursively returns a list of all parents.
	 * @param log Profile
	 * @param parents current parents
	 * @private
	 */
	private getTrace(log: ProfileLog, parents?: ProfileLog[]): ProfileLog[] {
		parents = parents ? parents : [ log ];
		if (!log.parent) {
			return parents;
		} else {
			return this.getTrace(log.parent, [ log.parent, ...parents]);
		}
	}
}

interface ProfileLog {
	name: string;
	timestamp: number;
	duration?: number;
	parent?: ProfileLog | null;
	children?: ProfileLog[] | null;
}

export const profiler = new Profiler();
