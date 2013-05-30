/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Released to the public domain.
 **/

// Exports a package-specific (sdk/self).data

'use strict';
const { readURISync } = require('sdk/net/url');

// https://bugzilla.mozilla.org/show_bug.cgi?id=875776#c1
const packageDataURI = module.uri.replace('lib/self-data.js', 'data/');

function uri(path) {
    return packageDataURI + (path || '');
}

exports.url = uri;
exports.load = function(path) {
    return readURISync(uri(path));
};
