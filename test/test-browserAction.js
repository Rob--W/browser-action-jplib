'use strict';
const { BrowserAction } = require('browserAction');

let { defer, resolve } = require('sdk/core/promise');
defer = defer.bind(null, {
    delay: function(ms, value) this.then(function() {
        let { promise, resolve } = defer();
        setTimeout(resolve, ms === undefined ? 200 : ms, value);
        return promise;
    }),
    logAnyErrors: function() {
        return this.then(function(v) v, function(error) {
            console.log(error);
            console.trace();
        });
    }
});

const windowUtils = require('sdk/window/utils');
const { setTimeout } = require('sdk/timers');
const { data, name } = require('sdk/self');
const selfData = require('self-data');

function $(selector) windowUtils.getMostRecentBrowserWindow().document.querySelector(selector)
function $$(selector) windowUtils.getMostRecentBrowserWindow().document.querySelectorAll(selector)
function container() $('#nav-bar')
function widgetCount() container() ? container().getElementsByTagName('toolbaritem').length : 0

// Assume that we're looking for the first occurrence of the badge
function getBadgeElem() $('toolbaritem[id*="browserAction"][label="' + name + '"]')
function getBadgeDocument() getBadgeElem().querySelector('iframe').contentDocument
function promiseBadgeReady() promiseDOMReady(getBadgeElem().querySelector('iframe'))

function promiseDOMReady(iframe) {
    let deferred = defer();
    const MAX_TIMEOUT = 2000;
    const POLL_TIMEOUT = 250;
    let attemptsLeft = MAX_TIMEOUT / POLL_TIMEOUT;
    let resolve = function() setTimeout(deferred.resolve, 222); // Wait till the widget API has finished
    function addReady() {
        let doc = iframe.contentDocument;
        if (doc.readyState == 'uninitialized') {
            if (attemptsLeft-- > 0) {
                setTimeout(addReady, POLL_TIMEOUT);
            } else {
                deferred.reject('promiseDOMReady error: Document always uninitialized');
            }
        } if (doc.readyState == 'complete') {
            resolve();
        } else {
            doc.addEventListener('DOMContentLoaded', resolve, false);
            setTimeout(deferred.reject, MAX_TIMEOUT, 'promiseDOMReady error: DOM ready not triggered!');
        }
    }
    addReady();
    return deferred.promise;
}

const TYPE_CALLBACK = 5318008; // Arbitrary constant ;)
function CALL(browserAction, method, args) {
    const REJECT_TIMEOUT = 1000;

    if (!args) args = [];
    let deferred = defer();

    let cbIndex = args.indexOf(TYPE_CALLBACK);
    let hasCallback = !!~cbIndex;
    let resolve = function() deferred.resolve(arguments);

    setTimeout(deferred.reject, REJECT_TIMEOUT);

    if (hasCallback) args[cbIndex] = resolve;
    let res = browserAction[method].apply(browserAction, args);
    if (!hasCallback) resolve(res);

    return deferred.promise;
}

exports['test create & destroy badge'] = function(assert) {
    let count = widgetCount();
    let badge = BrowserAction({});
    assert.equal(widgetCount(), count + 1, 'A new widget must be added to the toolbar');
    assert.ok(!!getBadgeElem(), 'getBadgeElem() returns the expected node');
    badge.destroy();
    assert.equal(widgetCount(), count, 'Widget created and destroyed');
    badge.destroy();
    assert.ok(true, 'Calling destroy() twice does not throw an error');
    assert.equal(widgetCount(), count, 'Widget count not changed');
};

exports['test setTitle / getTitle'] = function(assert, done) {
    let badge = BrowserAction({
        default_title: 'foo'
    });
    CALL(badge, 'getTitle', [{}, TYPE_CALLBACK])
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], 'foo', 'Title equals default_title');
    })
    .then(function() assert.equal(getBadgeElem().tooltipText, 'foo', 'Tooltip equals default title'))
    .then(function() CALL(badge, 'setTitle', [{title: 'bar'}]))
    .then(function() CALL(badge, 'getTitle', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], 'bar', 'Title updated after using setTitle');
    })
    .then(function() assert.equal(getBadgeElem().tooltipText, 'bar', 'Tooltip equals title'))
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};

exports['test setIcon'] = function(assert, done) {
    let default_icon = selfData.url('default_icon.png?test');
    let changed_icon = 'default_icon.png?changed';
    let badge = BrowserAction({
        default_icon: default_icon
    });
    function getBadgeIcon() getBadgeDocument().querySelector('img').src
    promiseBadgeReady()
    .then(function() assert.equal(getBadgeIcon(), default_icon, 'default_icon is set'))
    .then(function() CALL(badge, 'setIcon', [{path: changed_icon}]))
    .delay()
    .then(function() assert.ok(getBadgeIcon().contains(changed_icon), 'setIcon changed icon'))
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};

exports['test setPopup / getPopup'] = function(assert, done) {
    // TODO: Test whether the document has really changed.
    let default_popup = selfData.url('popup.html');
    let new_popup = data.url('popup.html?test');
    let badge = BrowserAction({
        default_popup: default_popup
    });
    CALL(badge, 'getPopup', [{}, TYPE_CALLBACK])
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], default_popup, 'popup equals default_popup');
    })
    .then(function() CALL(badge, 'setPopup', [{popup: new_popup}]))
    .then(function() CALL(badge, 'getPopup', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.notEqual(args[0], default_popup, 'popup updated after using setPopup');
        assert.equal(args[0], new_popup, 'popup changed to new popup');
    })
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};

exports['test setBadgeText / getBadgeText'] = function(assert, done) {
    let badge = BrowserAction({});
    function getBadgeText() getBadgeDocument().querySelector('#badgeText').textContent
    CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK])
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.strictEqual(args[0], '', 'Badge text empty string by default');
    })
    .then(promiseBadgeReady)
    .then(function() assert.equal(getBadgeText(), '', 'Badge text empty string by default'))
    .then(function() CALL(badge, 'setBadgeText', [{text: 'foo'}]))
    .then(function() CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], 'foo', 'getBadgeText updated');
    })
    .delay()
    .then(function() assert.equal(getBadgeText(), 'foo', 'Badge text updated'))
    .then(function() CALL(badge, 'setBadgeText', [{text: ''}]))
    .then(function() CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], '', 'getBadgeText updated to empty string');
    })
    .delay()
    .then(function() assert.equal(getBadgeText(), '', 'Badge text updated to empty string'))
    .then(function() CALL(badge, 'setBadgeText', [{text: '&amp;'}]))
    .then(function() CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], '&amp;', 'getBadgeText should be "&amp;"');
    })
    .delay()
    .then(function() assert.equal(getBadgeText(), '&amp;', 'Badge text should be "&amp;"'))
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};

exports['test setBadgeBackgroundColor / getBadgeBackgroundColor'] = function(assert, done) {
    let badge = BrowserAction({});
    let isColorArray = function(o) Array.isArray(o) && o.length == 4 &&
                                   o.every(function(v) v >= 0 && v <= 255 && (0|v) === v);
    let isColorArrayEqual = function(a, b) isColorArray(a) && isColorArray(b) &&
                                           a.every(function(value, index) value == b[index]);
    function getBadgeColor() {
        let doc = getBadgeDocument();
        let badgeText = doc.querySelector('#badgeText');
        if (!badgeText) throw new Error('doc.querySelector("#badgeText") is null');
        let backgroundColor = doc.defaultView.getComputedStyle(badgeText, null).backgroundColor;
        // Normalize fractions to 2 digits (.091 -> .09 / .101 -> .1 / 0.001 -> 0)
        return backgroundColor && backgroundColor.replace(/(\.\d[1-9]|\.[1-9](?=0)|\.(?=0))\d+/g, '$1');
    }
    function rgba(r,g,b,a) 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.floor(a*100)/100 + ')'

    CALL(badge, 'getBadgeBackgroundColor', [{}, TYPE_CALLBACK])
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.ok(isColorArray(args[0]), 'Result is a color array');
    })
    .then(function() CALL(badge, 'setBadgeBackgroundColor', [{color: [200, 100, 0, 50]}]))
    .then(function() CALL(badge, 'getBadgeBackgroundColor', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.ok(isColorArray(args[0]), 'Result is a color array');
        assert.equal(args[0]+'', [200, 100, 0, 50]+'', 'Color changed to [200, 100, 0, 50]');
    })
    .then(promiseBadgeReady)
    .then(function() assert.equal(getBadgeColor(), rgba(200, 100, 0, 50/255), 'Color changed to rgba(200, 100, 0, 50/255)'))
    .then(function() CALL(badge, 'setBadgeBackgroundColor', [{color: '#123'}]))
    .then(function() CALL(badge, 'getBadgeBackgroundColor', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.ok(isColorArray(args[0]), 'Result is a color array');
        assert.equal(args[0]+'', [0x11, 0x22, 0x33, 0xFF]+'', 'Color changed to #123');
    })
    .then(function() CALL(badge, 'setBadgeBackgroundColor', [{color: '#445566'}]))
    .then(function() CALL(badge, 'getBadgeBackgroundColor', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.ok(isColorArray(args[0]), 'Result is a color array');
        assert.equal(args[0]+'', [0x44, 0x55, 0x66, 0xFF]+'', 'Color changed to #445566');
    })
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};
exports['test onClicked / enable / disable'] = function(assert, done) {
    let badge = BrowserAction({});
    const WAIT_TIMEOUT = 150;
    let onClicked;
    badge.onClicked.addListener(function() onClicked());
    let simulateClick = function() {
        let doc = getBadgeDocument();
        let MouseEvent =  doc.defaultView.MouseEvent;
        doc.body.dispatchEvent(new MouseEvent('click', {button: 0}));
    };
    let expectNoClick = function(i) function() {
        let deferred = defer();
        setTimeout(deferred.resolve, WAIT_TIMEOUT);
        onClicked = function() deferred.reject('onClicked should not be triggered (' + i + ')');
        simulateClick();
        return deferred.promise.then(function() assert.pass('onClicked was not triggered (' + i + ')'));
    };
    let expectClick = function(i) function() {
        let deferred = defer();
        setTimeout(deferred.reject, WAIT_TIMEOUT, 'onClicked should have been triggered (' + i + ')');
        onClicked = deferred.resolve;
        simulateClick();
        return deferred.promise.then(function() assert.pass('onClicked was triggered (' + i + ')'));
    };

    promiseBadgeReady()
    .then(expectClick('init'))
    .then(expectClick('init repeat'))
    .then(function() CALL(badge, 'disable', []))
    .then(expectNoClick('disabled'))
    .then(expectNoClick('still disabled'))
    .then(function() CALL(badge, 'enable', []))
    .then(expectClick('enabled'))
    .then(expectClick('still enabled'))
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};


require('sdk/test').run(exports);
