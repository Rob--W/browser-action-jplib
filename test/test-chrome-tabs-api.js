'use strict';
const tabs = require('sdk/tabs');
const chromeTabs = require('chrome-tabs-api');

exports['test '] = function(assert, done) {
    var url = 'data:text/html,' + encodeURIComponent('<title>Test</title>');
    tabs.open({
        url: url,
        onReady: function(tab) {
            assert.ok(tab, 'SDK Tab exists'); // Pre-requisite
            testSdkTab(tab);
            testSdkTab = function() {}; // Run once
        }
    });
    function testSdkTab(tab) {
        var chromeTab = chromeTabs.toChromeTab(tab);
        assert.equal(tab.url, chromeTab.url, 'Tab\'s "url" property must be equal');
        assert.equal(false, chromeTab.pinned, 'Tab\'s "pinned" property must be false');
        var ffTab = chromeTabs.toFirefoxTab(chromeTab);
        assert.equal(tab, ffTab, 'toFirefoxTab(toChromeTab(tab)) === tab');
        done();
    }
};

require('sdk/test').run(exports);
