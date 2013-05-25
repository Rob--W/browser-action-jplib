'use strict';
const { BrowserAction } = require('browserAction');

const { defer, resolve } = require('sdk/core/promise');

const { setTimeout } = require('sdk/timers');
const { data } = require('sdk/self');
const selfData = require('self-data');

const TYPE_CALLBACK = 5318008; // Arbitrary constant ;)
function CALL(browserAction, method, args) {
    const REJECT_TIMEOUT = 1000;

    if (!args) args = [];
    let deferred = defer({
        logAnyErrors: function() {
            return this.then(function(v) v, function(error) {
                console.log(error);
                console.trace();
            });
        }
    });

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
    let badge = BrowserAction({});
    badge.destroy();
    assert.ok(true, 'Badge created and destroyed'); // TODO: Test if it's really gone
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
    .then(function() CALL(badge, 'setTitle', [{title: 'bar'}]))
    .then(function() CALL(badge, 'getTitle', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], 'bar', 'Title updated after using setTitle');
    })
    .logAnyErrors()
    .then(badge.destroy)
    .then(done);
};

exports['test setIcon'] = function(assert) {
    let badge = BrowserAction({
        default_icon: selfData.url('default_icon.png')
    });
    badge.setIcon({path: 'default_icon.png'});
    badge.destroy();
    assert.ok(true, 'Called setIcon and destroyed badge'); // TODO: Check if icon is really set
};

exports['test setPopup / getPopup'] = function(assert, done) {
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
    CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK])
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.strictEqual(args[0], '', 'Badge text empty string by default');
    })
    .then(function() CALL(badge, 'setBadgeText', [{text: 'foo'}]))
    .then(function() CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], 'foo', 'Badge text updated');
    })
    .then(function() CALL(badge, 'setBadgeText', [{text: ''}]))
    .then(function() CALL(badge, 'getBadgeText', [{}, TYPE_CALLBACK]))
    .then(function(args) {
        assert.equal(args.length, 1, 'Callback called with one argument');
        assert.equal(args[0], '', 'Badge text updated to empty string');
    })
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

exports['test enable / disable'] = function(assert) {
    let badge = BrowserAction({});
    badge.disable();
    badge.enable();
    badge.disable();
    badge.destroy();
    assert.ok(true, 'Called enable / disable'); // TODO: Check if element is susceptible to clicks
};


require('sdk/test').run(exports);
