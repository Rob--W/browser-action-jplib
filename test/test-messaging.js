'use strict';
const { createMessageChannel, messageContentScriptFile } = require('messaging');

const windowUtils = require('sdk/window/utils');
const tabs = require('sdk/tabs');
const { PageMod } = require("sdk/page-mod");
const { clearTimeout, setTimeout } = require('sdk/timers');

function $(selector) windowUtils.getMostRecentBrowserWindow().document.querySelector(selector)
function $$(selector) windowUtils.getMostRecentBrowserWindow().document.querySelectorAll(selector)

/**
 * Create test.
 * If endAtPage is true, the channel-testing code is run in the context of the page,
 *   and it's checked whether "extension" is undefined in the content script.
 * If endAtPage is false, the channel-testing code is run in the context of the content script.
 *   and it's checked whether "extension" is undefined in the page.
 **/
function testFactory(isEndAtPage, assert, done) {
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
    let throwIfExtensionIsDefined = 'if(typeof extension == "object") throw new Error("Unexpected global object \'extension\'!")';
    let pageCode = isEndAtPage ? code : throwIfExtensionIsDefined;
    let html = '<!--messagingtest--><!DOCTYPE><html><head><title></title></head><body><script>' + pageCode + '</script></body></html>';
    let data_url = 'data:text/html,' + encodeURIComponent(html);
    let setDelayedException = function(i) setTimeout(function() {
        throw new Error('onMessage not triggered (' + i +')!');
    }, 2000);
    let pageMod = PageMod({
        include: 'data:text/html,%3C!--messagingtest*',
        contentScriptWhen: 'start',
        contentScriptFile: [messageContentScriptFile],
        contentScript: isEndAtPage ? throwIfExtensionIsDefined : code,
        contentScriptOptions: {channelName: 'test-messaging', endAtPage: isEndAtPage},
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
}
exports['test onMessage / sendMessage with workers with end at page'] = testFactory.bind(exports, /*endAtPage=*/true);
exports['test onMessage / sendMessage with workers with end at content script'] = testFactory.bind(exports, /*endAtPage=*/false);

require('sdk/test').run(exports);
