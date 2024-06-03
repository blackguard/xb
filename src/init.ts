const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    XbManager,
} from 'src/xb-manager';

import {
    reset_to_initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    CellElement,
} from 'src/cell-element/_';


// this script is itself the bootstrap script, so we can go ahead and grab its markup now...
const bootstrap_script_markup = document.querySelector('head script')?.outerHTML;
if (!bootstrap_script_markup) {
    show_initialization_failed('unexpected: failed to find bootstrap script');
} else {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        await initialize_document();
    } else {
        window.addEventListener('load', async (load_event: Event) => {
            await initialize_document();
        }, {
            once: true,
        });
    }
}

async function initialize_document(): Promise<void> {
    window.addEventListener('error', (event) => {
        console.error('UNHANDLED ERROR', event);  // put on separate line to facilitate setting breakpoint
    });  // event listener never removed

    window.addEventListener('unhandledrejection', (event) => {
        console.error('UNHANDLED REJECTION', event);  // put on separate line to facilitate setting breakpoint
    });  // event listener never removed

    try {

        // establish head element if not already present
        if (!document.head) {
            const head_element = document.createElement('head');
            document.documentElement.insertBefore(head_element, document.documentElement.firstChild);
            // document.head is now set
        }

        // establish favicon if not already present
        if (!document.querySelector('link[rel="icon"]')) {
            const link_element = document.createElement('link');
            link_element.rel  = 'icon';
            link_element.href = new URL('../dist/favicon.ico', assets_server_url(current_script_url)).toString();
            document.head.appendChild(link_element);
        }

        // establish body element if not already present
        if (!document.body) {
            document.documentElement.appendChild(document.createElement('body'));
            // document.body is now set
        }

        // create header element
        const header_element = document.createElement('header');

        // create the main element and move the current children of the body element into it
        const main_element = document.createElement('main');
        for (let child; !!(child = document.body.firstChild); ) {
            main_element.appendChild(child);  // child is moved to main_element
        }

        // add header and main elements to the (now empty) body
        document.body.appendChild(header_element);
        document.body.appendChild(main_element);

        // document restructuring complete

        // The document is now in the expected format.
        // Initialize XbManager to enable interaction.
        await XbManager._initialize_singleton();
        (globalThis as any).xb_manager = XbManager.singleton;//!!!

        // initialize renderer factories after all the TextOrientedRenderer factories have been registered...
        reset_to_initial_text_renderer_factories();

        // focus first cell
        XbManager.singleton.get_cells()[0]?.focus();

    } catch (error: unknown) {
        show_initialization_failed(error);
    }
}

export function show_initialization_failed(reason: unknown) {
    const error = (reason instanceof Error)
        ? reason
        : new Error((reason as any)?.toString?.() ?? 'INITIALIZATION ERROR');
    console.error('initialization failed', error.stack);
    document.body.innerText = '';  // clear all children
    const error_h1 = document.createElement('h1');
    error_h1.innerText = error.message ?? 'Initialization Failed';
    const error_pre = document.createElement('pre');
    error_pre.classList.add('error-message');
    error_pre.innerText = error.stack ?? 'INITIALIZATION ERROR';
    document.body.appendChild(error_h1);
    document.body.appendChild(error_pre);
}

/** for use by save and save-as operations
 */
export function save_serializer() {
    const main_element = document.querySelector('main');
    if (!main_element) {
        throw new Error('bad format for document: <main> element not found');
    }
    const contents_segments = [];
    for (const node of main_element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            contents_segments.push(node.nodeValue);  // the text of the TEXT node
        } else if (node instanceof Element) {
            contents_segments.push(node.outerHTML);
        } else {
            console.warn('save_serializer(): ignoring not-text, non-Element node', node);
        }
    }
    const contents = contents_segments.join('');
    return `\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    ${bootstrap_script_markup}
</head>
<body>
${contents}
</body>
</html>
`;
}
