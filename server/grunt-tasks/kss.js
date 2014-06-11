var _ = require('underscore');
var fs = require('fs');
var kss = require('kss');
var jade = require('jade');
var path = require('path');
var async = require('async');
var marked = require('marked');
var html2jade = require('html2jade');
var highlight = require('highlight.js');

var debug = require('debug')('grunt-kss');

module.exports = function(grunt) {

	grunt.registerTask('kss', function() {
		var done = this.async();
		kss.traverse('client/styles', { multiline: true, markdown: true, markup: true, mask: '*.styl' }, function(err, styleguide) {
			if (err) {
				throw err;
			}
			var rootRefs = [];

			// print out files to be generated
			grunt.log.writeln('Parsed stylesheets:');
			grunt.log.writeln(styleguide.data.files.map(function(file) {
				return '  - ' + file
			}).join('\n'));

			// accumulate all of the sections' first indexes in case they don't have a root element.
			_.each(styleguide.section('*.'), function(rootSection) {
				var currentRoot = rootSection.reference().match(/[0-9]*\.?/)[0].replace('.', '');
				if (!~rootRefs.indexOf(currentRoot)) {
					rootRefs.push(currentRoot);
				}
			});
			rootRefs.sort();
			var sectionTemplate = jade.compile(fs.readFileSync('client/views/partials/styleguide-section.jade'), { pretty: true });

			var renderSection = function(rootSection, reference, sections, next) {
				grunt.log.writeln('Generating %s %s"', reference, rootSection ? rootSection.header() : 'Unnamed');
				serializesSections(sections, function(err, sections) {
					if (err) {
						grunt.log.error(err);
						return next(err);
					}
					var filename = path.normalize('styleguide/sections/' + reference + '.html');
					grunt.log.write('Writing "%s"... ', filename);
					fs.writeFileSync(filename, sectionTemplate({
						styleguide: styleguide,
						sections: sections
					}));
					grunt.log.ok();
					next();
				});
			}


			// now, group all of the sections by their root reference, and make a page for each.
			async.each(rootRefs, function(rootRef, next) {

				var rootSection = styleguide.section(rootRef);
				async.each(styleguide.section(new RegExp('^' + rootRef + '\\.\\d+$')), function(section, next) {
					renderSection(rootSection, section.reference(), [ section ].concat(styleguide.section(section.reference() + '.x.x')), next);
				}, next);

			}, function(err) {
				if (err) {
					return done(false);
				}


				// render index
				var indexHtml = jade.renderFile('client/views/styleguide.jade', {
					sections: _.map(rootRefs, function(rootRef) {
						return {
							id: rootRef,
							title: styleguide.section(rootRef) ? styleguide.section(rootRef).header() : 'Unnamed',
							childSections: styleguide.section(new RegExp('^' + rootRef + '\\.\\d+$'))
						}
					}).sort(function(a, b) {
						return parseInt(a.id) > parseInt(b.id);
					}),
					pretty: true
				});

				var filename = path.normalize('styleguide/index.html');
				grunt.log.write('Writing "%s"... ', filename);
				fs.writeFileSync(filename, indexHtml);
				grunt.log.ok();

				// render overview
				filename = path.normalize('styleguide/overview.html');
				grunt.log.write('Writing "%s"... ', filename);
				fs.writeFileSync(filename, marked(fs.readFileSync('doc/styleguide.md').toString()));
				grunt.log.ok();
				done();
			});
		});
	});
};

/**
 * Converts an array of `KssSection` instances to a JS object.
 * @param sections
 * @param done
 * @returns {*}
 */
function serializesSections(sections, done) {
	debug('serializing %d sections..', sections.length);
	async.mapSeries(sections, function(section, next) {
		debug('serializing section %s', section.reference());
		serializeModifiers(section.modifiers(), function(err, modifiers) {
			if (err) {
				console.error(err);
				return next(err);
			}
			toJade(section.markup(), function(err, jade) {
				if (err) {
					console.error(err);
					return next(err);
				}
				debug('converted to jade (%d bytes), returning.', jade.length);
				next(null, {
					header: section.header(),
					description: section.description(),
					reference: section.reference(),
					depth: section.data.refDepth,
					deprecated: section.deprecated(),
					experimental: section.experimental(),
					modifiers: modifiers,
					markup: section.markup(),
					jade: jade
				});
			});
		});
	}, function(err, result) {
		debug('serializesSections finished.');
		done(err, result);
	});
}

/**
 * Converts an array of `KssModifier` instances to a JS object.
 * @param modifiers
 * @param done
 * @returns {*}
 */
function serializeModifiers(modifiers, done) {
	debug('serializing %d modifiers..', modifiers.length);
	async.mapSeries(modifiers, function(modifier, next) {
		toJade(modifier.markup(), function(err, jade) {
			if (err) {
				console.error(err);
				return next(err);
			}
			jade = jade.replace(/html[\s\S]+body[\n\r]+/gi, '');
			jade = ("\n" + jade).replace(/[\n\r]\s{4}/g, '\n');

			var html = modifier.markup();
			next(null, {
				name: modifier.name(),
				description: modifier.description(),
				className: modifier.className(),
				markup: html,
				markupHighlighted: highlight.highlight('html', html).value,
				jade: jade
			});
		});
	}, function(err, result) {
		debug('serializeModifiers finished.');
		done(err, result);
	});
}

function toJade(html, done) {
	if (!html) {
		return done(null, html);
	}
	var result = html2jade.convertHtml(html, {}, done);
	if (result) {
		done(result);
	}
}

function sectionSort(a, b) {
	var arrA = a.reference().split('.');
	var arrB = b.reference().split('.');
	var i = 0;
	while (parseInt(arrA[i]) === parseInt(arrB[i])) {
		if (++i > arrA.length)
			return 0;
	}
	return parseInt(arrA[i]) < parseInt(arrB[i]);
}