/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Released to the public domain.
 **/

// Exports a package-specific (sdk/self).data

'use strict';
// Do not forget to update this constant for each new package!
const name = 'browser-action';


const { prefixURI } = require('@loader/options');
const { readURISync } = require('sdk/net/url');

const packageDataURI = prefixURI + name + '/data/';

function uri(path) {
    return packageDataURI + (path || '');
}

exports.url = uri;
exports.load = function(path) {
    return readURISync(uri(path));
};
