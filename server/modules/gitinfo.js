var fs = require('fs');
var path = require('path');

function Gitinfo() {
	this.info = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../gitinfo.json')));
}

var gitinfo = new Gitinfo();
exports.info = gitinfo.info;