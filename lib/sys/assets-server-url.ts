const current_script_url = import.meta.url;  // save for later

const local_server_root = new URL('../..', current_script_url);  // assumes this script is located two directory levels below server root

const assets_server_script = document.querySelector('script');
let assets_server_root: undefined|URL = undefined;

function _setup_assets_server_root() {
    // because this module is employed when loading resources, and the
    // fact that we may encounter an error here, this initialization
    // is deferred until the call to assets_server_url().  Otherwise,
    // the error is thrown out of webpack code and can't be caught....
    if (!assets_server_script || !assets_server_script.src) {
        throw new Error('no script for assets server found in document');
    }
    assets_server_root ??= new URL('..', assets_server_script.src);  // assumes script src points to is one directory level below the server root
}

/** @return {URL} url resolved against the running server url
 */
export function assets_server_url(local_url: string|URL): URL {
console.log('>>> assets_server_url()', local_url);//!!!
    _setup_assets_server_root();
    if (!assets_server_root) {  // this is for the sake of typescript
        throw new Error('unexpected: assets_server_root is not set');
    }

    if (typeof local_url === 'string') {
        local_url = new URL(local_url, local_server_root);
    }

    if ( local_url.protocol !== 'file:' ||
         local_server_root.protocol !== 'file:' ||
         assets_server_root.protocol === 'file:' ||
         !local_url.href.startsWith(local_server_root.href) ) {
        return local_url;  // nothing to do...
    } else {
        const relative = local_url.href.slice(local_server_root.href.length);
        return new URL(assets_server_root.href + relative);
    }
}
