const current_script_url = import.meta.url;  // save for later

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


await load_script(document.head, new URL('../../dist/algebrite.bundle-for-browser.js', assets_server_url(current_script_url)));

declare global {
    var Algebrite: any;
}

export const Algebrite = globalThis.Algebrite;
