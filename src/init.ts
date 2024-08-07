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
    make_string_literal,
} from 'lib/ui/dom-tools';


const cell_view_attribute_name   = 'data-cell-view';
const allowable_cell_view_values = ['normal', 'hide', 'full', 'none', 'kiosk'];


// this script is itself (part of or loaded by) the bootstrap script, so we can go ahead and grab its markup now...
const bootstrap_script_markup = _get_bootstrap_script_markup();
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
    window.addEventListener('error',              (event) => _show_unhandled_event(event, false));  // event listener never removed
    window.addEventListener('unhandledrejection', (event) => _show_unhandled_event(event, true));   // event listener never removed

    try {

        // validate html[data-cell-view]
        const cell_view = document.documentElement.getAttribute(cell_view_attribute_name);
        if (cell_view && !allowable_cell_view_values.includes(cell_view)) {
            throw new Error(`<html> attribute data-cell-view must be unset or one of: "${allowable_cell_view_values.join('", "')}"`);
        }

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

        // establish <meta name="viewport" content="width=device-width, initial-scale=1"> if not already present
        // this enables @media queries for responsiveness to size changes
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta_viewport_element = document.createElement('meta');
            meta_viewport_element.name  = 'viewport';
            meta_viewport_element.content = 'width=device-width, initial-scale=1';
            document.head.appendChild(meta_viewport_element);
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
        XbManager._initialize_singleton();

        // initialize renderer factories after all the TextBasedRenderer factories have been registered...
        reset_to_initial_text_renderer_factories();

        // asynchronously scroll and set focus
        setTimeout(() => XbManager.singleton.active_cell?.scroll_into_view(true));

    } catch (error: unknown) {
        show_initialization_failed(error);
    } finally {
        (globalThis as any)._uninhibit_document_display?.();
    }
}

function _show_unhandled_event(event: Event, is_unhandled_rejection: boolean): void {
    (globalThis as any)._uninhibit_document_display?.();
    const message = is_unhandled_rejection ? 'UNHANDLED REJECTION' : 'UNHANDLED ERROR';
    console.error(message, event);
    if (XbManager.ready) {
        XbManager.singleton._show_unhandled_event(event, is_unhandled_rejection);
    }
}

export function show_initialization_failed(reason: unknown) {
    (globalThis as any)._uninhibit_document_display?.();
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
    let cell_view: undefined|null|string = document.documentElement.getAttribute(cell_view_attribute_name);
    if (cell_view && !allowable_cell_view_values.includes(cell_view)) {
        cell_view = undefined;  // just skip if not valid
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
<html lang="en"${cell_view ? ` ${cell_view_attribute_name}="${cell_view}"` : ''}>
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

function _get_bootstrap_script_markup(convert_src_to_absolute: boolean = false) {
    const markup_segments: string[] = [];
    const bootstrap_script_element = document.querySelector('head script') as null|HTMLScriptElement;
    if (bootstrap_script_element) {
        markup_segments.push('<script');
        for (const name of bootstrap_script_element.getAttributeNames()) {
            let value = bootstrap_script_element.getAttribute(name);
            if (name === 'src' && convert_src_to_absolute) {
                value = bootstrap_script_element.src  // this will resolve to a full absolute URL
            }
            markup_segments.push(` ${name}=${make_string_literal((value ?? ''), true)}`);
        }
        markup_segments.push('></script>');
    }
    return markup_segments.join('');
}
