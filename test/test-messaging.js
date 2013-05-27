'use strict';
const { createMessageChannel, messageContentScriptFile } = require('messaging');

const windowUtils = require('sdk/window/utils');
const tabs = require('sdk/tabs');
const { PageMod } = require("sdk/page-mod");
const { clearTimeout, setTimeout } = require('sdk/timers');
const selfData = require('self-data');

function $(selector) windowUtils.getMostRecentBrowserWindow().document.querySelector(selector)
function $$(selector) windowUtils.getMostRecentBrowserWindow().document.querySelectorAll(selector)

exports['test onMessage / sendMessage with workers'] = function(assert, done) {
    assert.notEqual(messageContentScriptFile, undefined, 'Content script file path must be exported!');

    let code = '(' + function pageMain() {
        /*jshint browser:true*/
        /*globals extension*/
        extension.onMessage.addListener(function(message, sender, sendResponse) {
            if (message === 'call me') sendResponse([{a:1}]);
            else if (message === 'call me twice') extension.sendMessage(0);
            else if (message === 'empty response') sendResponse();
        });
        extension.onMessage.addListener(function(message, sender, sendResponse) {
            if (message === 'test, no response please') {
                document.title = 'Expect no response';
            }
        });
        extension.onMessage.addListener(function(message, sender, sendResponse) {
            if (message === 'init from page') {
                extension.sendMessage('from page');
            }
        });
    } + ')();';
    let html = '<!DOCTYPE><html><head><title></title></head><body><script>' + code + '</script></body></html>';
    let data_url = 'data:text/html,' + encodeURIComponent(html);
    let setDelayedException = function(i) setTimeout(function() {
        throw new Error('onMessage not triggered (' + i +')!');
    }, 2000);
    let pageMod = PageMod({
        include: 'data:text/html*',
        contentScriptWhen: 'start',
        contentScriptFile: [messageContentScriptFile],
        contentScriptOptions: {channelName: 'test-messaging'},
        onAttach: function(worker) {
            let extension = createMessageChannel(pageMod.contentScriptOptions, worker.port);
            let testPhase = 1;
            let timer1, timer2, timer3, timer4, timer5;
            extension.onMessage.addListener(function(message, sender, sendResponse) {
                clearTimeout(timer2);
                clearTimeout(timer4);
                clearTimeout(timer5);
                if (testPhase === 2) {
                    // Check second test
                    assert.strictEqual(message, 0, 'Message received from page is correct');

                    // Init third test
                    timer3 = setDelayedException(testPhase = 3);
                    let hasRun = false;
                    extension.sendMessage('empty response', function(message) {
                        if (hasRun) throw new Error('Error: sendResponse called twice !'); hasRun = true;
                        // Check third test
                        clearTimeout(timer3);
                        assert.equal(message, null, 'Response should be empty');

                        // Init fourth test
                        extension.sendMessage('test, no response please');
                        timer4 = setTimeout(function() {
                            // Check fourth test
                            assert.equal(tabs.activeTab.title, 'Expect no response', 'Expected no response');

                            // Init fifth test
                            timer5 = setDelayedException(testPhase = 'init from page');
                            extension.sendMessage('init from page');
                        }, 1000);
                    });
                } else if (testPhase === 'init from page') {
                    // Check fifth test
                    assert.pass('Message successfully initiated from page');
                    // FINISH
                    done();
                } else {
                    throw new Error('Unexpected message during test phase ' + testPhase + ': ' + message);
                }
            });

            // Init first test
            timer1 = setDelayedException(testPhase = 1);
            let hasRun = false;
            extension.sendMessage('call me', function(response) {
                // Check first test
                if (hasRun) throw new Error('Error: sendResponse called twice!'); hasRun = true;
                clearTimeout(timer1);
                assert.equal(JSON.stringify(response), '[{"a":1}]', 'Response from page is OK');

                // Init second test
                timer2 = setDelayedException(testPhase = 2);
                extension.sendMessage('call me twice');
            });
        }
    });
    tabs.activeTab.url = data_url;
};

require('sdk/test').run(exports);
