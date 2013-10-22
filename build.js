#!/usr/bin/env node
/* jshint node:true */
'use strict';

var fs = require('fs');
var path = require('path');
// npm install mime
var mime = require('mime');

var baseDir = __dirname;
var dataDir = path.join(baseDir, 'data');
var outputFile = path.join(baseDir, 'lib/browser-action-jplib-data.js');

var encodedFiles = {};

// Assume that there are no subdirectories in the data dir
fs.readdirSync(dataDir)
.forEach(function(filename) {
    if (filename.charAt(0) === '.') {
        // Skip hidden / temporary files
        return;
    }
    var pathToFile = path.join(dataDir, filename);
    var stat = fs.statSync(pathToFile);
    var mimeType = mime.lookup(filename);
    var data = fs.readFileSync(pathToFile);
    var base64encoded = new Buffer(data).toString('base64');
    
    var dataURI = 'data:' + mimeType + ';base64,' + base64encoded;

    encodedFiles[filename] = dataURI;
});

var moduleContent =
    [
    '/**',
    ' * (c) 2013 Rob Wu <gwnRob@gmail.com>',
    ' * Released under the MIT license.',
    ' *',
    ' * Auto-generated from "data" dir by build.js',
    ' * Because the Add-on SDK does not support loading assets',
    ' * from the data dir for third-party modules.',
    ' **/',
    '',
    '\'use strict\';',
    '',
    'const base64 = require(\'sdk/base64\');',
    '',
    'function uri(path) {',
    '    path = (\'\'+path).split(/[#?]/, 1)[0];',
    '    if (!dataFiles[path]) throw new Error(\'Resource not found: \' + path);',
    '    return dataFiles[path];',
    '}',
    'exports.url = uri;',
    'exports.load = function(path) {',
    '    var fileAsBase64 = uri(path).split(\',\')[1];',
    '    return base64.decode(fileAsBase64);',
    '};',
    '',
    'const dataFiles = ' + JSON.stringify(encodedFiles, null, 4) + ';'
    ].join('\n');

fs.writeFileSync(outputFile, moduleContent);
