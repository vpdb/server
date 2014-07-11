//var request = require('superagent');
//var expect = require('expect.js');
//
//describe('The VPDB `ping` API', function() {
//
//	var auth = {};
//
//
//
//
//	before(function(done) {
//		request
//			.post('http://localhost:3000/api/authenticate')
//			.send({ username: 'test', password: 'testtest' })
//			.end(function(err, res) {
//				if (err) {
//					return done(err);
//				}
//				auth.root = 'Bearer ' + res.body.token;
//				done();
//			});
//	});
//
//	it('should ping the API', function(done) {
//		request
//			.get('http://localhost:3000/api/ping')
//			.end(function(err, res) {
//				expect(err).to.eql(null);
//				expect(typeof res.body).to.eql('object');
//				expect(res.body).to.eql({ result: 'pong' });
//				done();
//			});
//	});
//
//	it('should respond with token refresh header', function(done) {
//		request
//			.get('http://localhost:3000/api/ping')
//			.set('Authorization', auth.root)
//			.end(function(err, res) {
//				expect(err).to.eql(null);
//				expect(res.headers['x-token-refresh']).to.be.ok();
//				done();
//			});
//	})
//});