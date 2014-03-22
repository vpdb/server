'use strict';

/* Directives */

angular.module('vpdb.directives', []).
  directive('appVersion', function (version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
  });
