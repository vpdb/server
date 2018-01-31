
class Serializer {

	constructor() {
		this.REDUCED = 'reduced';
		this.SIMPLE = 'simple';
		this.DETAILED = 'detailed';
	}

	serialize(detailLevel, object, req, opts) {

		object = object.toObj ? object.toObj() : object;

		opts = opts || {};
		opts.flavor = opts.flavor || {};
		opts.fields = opts.fields || [];

		switch (detailLevel) {
			case this.REDUCED:
				return this.reduced(object, req, opts);

			case this.SIMPLE:
				return this.simple(object, req, opts);

			case this.DETAILED:
				return this.detailed(object, req, opts);
		}
	}

	reduced(object, req, opts) {
		return this.simple(object, req, opts);
	}

	simple(object, req, opts) {
		return {};
	}

	detailed(object, req, opts) {
		return this.simple(object, req, opts);
	}
}

module.exports = Serializer;