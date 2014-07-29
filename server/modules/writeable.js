"use strict";

var fs = require('fs');
var path = require('path');

function Writeable() {
	this.cacheRoot = process.env.APP_CACHEDIR ? process.env.APP_CACHEDIR : path.resolve(__dirname, "../../cache");

	this.jsRoot = path.resolve(this.cacheRoot, 'js');
	this.cssRoot = path.resolve(this.cacheRoot, 'css');
	this.imgRoot = path.resolve(this.cacheRoot, 'img');
	this.htmlRoot = path.resolve(this.cacheRoot, 'html');

	if (!fs.existsSync(this.jsRoot)) {
		fs.mkdirSync(this.jsRoot);
	}
	if (!fs.existsSync(this.cssRoot)) {
		fs.mkdirSync(this.cssRoot);
	}
	if (!fs.existsSync(this.imgRoot)) {
		fs.mkdirSync(this.imgRoot);
	}
	if (!fs.existsSync(this.htmlRoot)) {
		fs.mkdirSync(this.htmlRoot);
	}
}

var writeable = new Writeable();
exports.cacheRoot = writeable.cacheRoot;