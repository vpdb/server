var numCPUs = require('os').cpus().length;
var cluster = require('cluster');

cluster.setupMaster({ exec: 'app.js' });
for (var i = 0; i < numCPUs; i++) {
	cluster.fork();
}
