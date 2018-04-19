const userModel = require('./user.model');
const userRouter = require('./user.api.routes');

class UserModule {

	constructor() {
		this.model = userModel;
		this.router = userRouter;
	}
}

module.exports = new UserModule();