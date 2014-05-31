var _ = require('underscore');
var fs = require('fs');
var kss = require('kss');
var jade = require('jade');
var marked = require('marked');

module.exports = function(grunt) {

	grunt.registerTask('kss', function() {
		var done = this.async();
		kss.traverse('client/styles', { multiline: true, markdown: true, markup: true, mask: '*.styl' }, function(err, styleguide) {
			if (err) {
				throw err;
			}
			var rootSections = [];

			// print out files to be generated
			grunt.log.writeln(styleguide.data.files.map(function(file) {
				return ' - ' + file
			}).join('\n'));

			// accumulate all of the sections' first indexes in case they don't have a root element.
			_.each(styleguide.section('*.'), function(section) {
				var currentRoot = section.reference().match(/[0-9]*\.?/)[0].replace('.', '');
				if (!~rootSections.indexOf(currentRoot)) {
					rootSections.push(currentRoot);
				}
			});
			rootSections.sort();

			// now, group all of the sections by their root reference, and make a page for each.
			var sectionTemplate = jade.compile(fs.readFileSync('client/views/partials/styleguide-section.jade'), { pretty: true });

			_.each(rootSections, function(rootSection) {
				var childSections = styleguide.section(rootSection + '.*');

				grunt.log.writeln('...generating section ' + rootSection + ' [',
					styleguide.section(rootSection) ? styleguide.section(rootSection).header() : 'Unnamed',
					']'
				);
				fs.writeFileSync('styleguide/sections/' + rootSection + '.html', sectionTemplate({
					styleguide: styleguide,
					sections: serializesSections(childSections),
					rootNumber: rootSection,
					rootSections: rootSections
				}));
			});

			// render index
			var indexHtml = jade.renderFile('client/views/styleguide.jade', {
				sections: _.map(rootSections, function(rootSection) {
					return {
						id: rootSection,
						title: styleguide.section(rootSection) ? styleguide.section(rootSection).header() : 'Unnamed'
					}
				}),
				pretty: true
			});
			fs.writeFileSync('styleguide/index.html', indexHtml);

			// render overview
			fs.writeFileSync('styleguide/overview.html', marked(fs.readFileSync('doc/styleguide.md').toString()));
			done();
		});

	});
};

/**
 * Converts an array of `KssSection` instances to a JS object.
 * @param sections
 * @returns {*}
 */
function serializesSections(sections) {
	return sections.map(function(section) {
		return {
			header: section.header(),
			description: section.description(),
			reference: section.reference(),
			depth: section.data.refDepth,
			deprecated: section.deprecated(),
			experimental: section.experimental(),
			modifiers: serializeModifiers(section.modifiers()),
			markup: section.markup()
		};
	});
}

/**
 * Converts an array of `KssModifier` instances to a JS object.
 * @param modifiers
 * @returns {*}
 */
function serializeModifiers(modifiers) {
	return modifiers.map(function(modifier) {
		return {
			name: modifier.name(),
			description: modifier.description(),
			className: modifier.className(),
			markup: modifier.markup()
		};
	});
}
