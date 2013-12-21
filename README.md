# chrome.browserAction API for Firefox Add-ons
This Jetpack module provides an API which is almost identical to Google Chrome's [`chrome.browserAction`](https://developer.chrome.com/extensions/browserAction.html) API for creating badges on the toolbar.  
Identical in terms of API, identical in terms of appearance!


## Usage
If you're familiar with the [`chrome.browserAction`](https://developer.chrome.com/extensions/browserAction.html) API, using this module is a breeze.  
To add a browser action button to your Firefox add-on, copy-paste the `browser_action` section from your
Chrome extension's manifest file to your add-ons background page. After running the following code, a
browser action button will appear at the right of the location bar.

```javascript
var badge = require('browserAction').BrowserAction({
    default_icon: 'images/icon19.png', // optional
    default_title: 'Badge title',      // optional; shown in tooltip
    default_popup: 'popup.html'        // optional
});
```

- All methods from the [`chrome.browserAction.` methods](https://developer.chrome.com/extensions/browserAction.html#methods) have been implemented.

### Extra features over the `chrome.browserAction` API.
- The `destroy` method makes it possible to remove the browser action at any time.
- `sendMessage` and `onMessage` have been added to ease the communication with the popup.
  This API allows for messages with callbacks, and are modelled after the [Chrome messaging API](https://developer.chrome.com/extensions/messaging.html#simple).

### Missing features
- Tab-specific states are not implemented yet.
- The `setIcon` method does not take an `imageData` object (there's no DOM, thus no `<canvas>` in the background page).

## Installation
You can add the module globally (in the `packages` directory under the SDK root), to make it available to all of your Jetpack projects,
or add it to a single project (in the `packages` directory under your add-on's root).

The official documentation contains a [tutorial on installing third-party modules](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/adding-menus.html),
which suggests to download and extract an archive.  
I strongly recommend to use git for this purpose, because it makes package management *a lot easier*. For example:

```sh
# Go to the packages directory of the SDK's root.
cd /opt/addon-sdk/packages
# Clone the repository (creates a directory "browser-action-jplib")
git clone git://github.com/Rob--W/browser-action-jplib.git
# Done! You may want to update and view the documentation...
addon-sdk && cfx sdocs
# Later, when you want to update the package to the latest version...
cd /opt/addon-sdk/packages/browser-action-jplib
git pull
```

After installing the module, declare the dependency in [package.json](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/package-spec.html):

```js
    ...
    "dependencies": ["browser-action"],
    ...
```

## Dependencies
The only external dependency is the [`toolbarwidget` Jetpack module](https://github.com/Rob--W/toolbarwidget-jplib).


## Change log
### 0.2.4
- Remove `faviconUrl` property because Firefox has deprecated synchronous access to this information ([#7](https://github.com/Rob--W/browser-action-jplib/issues/7)).
- Show icon in customization mode ([#4](https://github.com/Rob--W/browser-action-jplib/issues/4)).

### 0.2.2
- New: Automatically shrink button size when the user has set the icon size preference to "small icons".
  To get this feature, update the [`toolbarwidget`](https://github.com/Rob--W/toolbarwidget-jplib) dependency to v1.3 or higher.

### 0.2.0
- New: The `browserAction.onClicked` event receives an argument that closely follows the
  format of Chrome's `tab.Tab`.
- New: Automatically resize the popup panel when its content changes dynamically.
- New: Unload the popup document when the panel is closed (consistent with Chrome).
  Previously, the popup was never unloaded after being shown once. If you relied on
  this incorrect behavior, either update your code, or stick to the previous version.

### 0.1.4
- Fix: Serialize all resources and included it in the main script (fixes issue [#1](https://github.com/Rob--W/browser-action-jplib/issues/1)).


## Credits
Created by Rob Wu <gwnRob@gmail.com>.

Released under a MIT license.
