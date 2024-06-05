const current_script_url = import.meta.url;  // save for later

import {
    XbManager,
} from 'src/xb-manager';

import {
    clear_element,
    make_string_literal,
} from 'lib/ui/dom-tools';

import {
    EventListenerManager,
} from 'lib/sys/event-listener-manager';

import {
    CodemirrorInterface,
    create_codemirror_view,
} from './codemirror';

import {
    generate_object_id,
} from 'lib/sys/uuid';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}

/** CellElement represents a text-oriented input/source
 *  It represents media types text/???
 */
export class CellElement extends HTMLElement {
    get CLASS (){ return this.constructor as typeof CellElement; }

    static custom_element_name = 'cell-';

    static attribute__active = 'data-active';
    static #attribute__type  = 'data-type';

    static default_type = 'markdown';

    #codemirror: undefined|CodemirrorInterface = undefined;
    #event_listener_manager = new EventListenerManager();

    constructor() {
        super();
        this.#connect_focus_listeners();
    }

    // === UPDATE FROM SETTINGS ===

    update_from_settings(): void {
        if (this.#has_text_container()) {
            this.#codemirror?.update_from_settings();
        }
    }


    // === TEXT CONTENT ===

    get_text(): string {
        const text = this.#has_text_container()
            ? this.#codemirror?.get_text()
            : this.textContent;
        return text ?? '';
    }

    // this works even if the cell is not editable
    set_text(text: string): void {
        if (this.#has_text_container()) {
            this.#codemirror?.set_text(text);
        } else {
            this.textContent = text;
        }
    }

    #has_text_container(): boolean { return !!this.#codemirror; }

    #establish_editable_text_container(): void {
        if (!this.#has_text_container()) {
            this.#codemirror = create_codemirror_view(this);
        }
    }

    #remove_text_container(): void {
        if (this.#has_text_container()) {
            const text = this.get_text();
            this.#codemirror = undefined;
            clear_element(this);  // remove text_container element, etc
            this.set_text(text);  // will be added directly to this because no text_container
        }
    }

    /** override focus() so that we can direct focus to the contained textarea
     *  if necessary.  Setting a tabindex="0" attribute on this cell solves the
     *  problem but then causes another: SHIFT-Tab out of a textarea with a
     *  tabindex="0" parent fails.  So we just have to do it the hard way.
     */
    focus(options?: object): void {
        this.set_active(true);  // set "active" right away
        if (this.#has_text_container()) {
            this.#codemirror?.focus();
        } else {
            super.focus(options);  // will most likely fail, but that would be appropriate
        }
    }


    // === EDITABLE ===

    get editable (): boolean {
        return this.#has_text_container();
    }

    set_editable(editable: boolean): void {
        this.removeAttribute('contenteditable');  // editability established by text container element
        if (editable) {
            this.#establish_editable_text_container();
        } else {
            this.#remove_text_container();
        }
    }


    // === ACTIVE ===

    get active () {
        return !!this.hasAttribute(this.CLASS.attribute__active);
    }

    set_active(state: boolean = false): void {
        state = !!state;
        if (this.active !== state) {  // avoid creating an unnecessary dom mutation
            if (state) {
                this.setAttribute(this.CLASS.attribute__active, true.toString());
            } else {
                this.removeAttribute(this.CLASS.attribute__active);
            }
        }
    }


    // === ID, TYPE ===

    ensure_id(): void {
        if (!this.id) {
            this.id = generate_object_id();
        }
    }

    get type (): string { return this.getAttribute(CellElement.#attribute__type) ?? this.CLASS.default_type; }

    set type (type: string){
        this.setAttribute(CellElement.#attribute__type, type);
    }


    // === DOM ===

    /** reset the cell, removing all associated output elements
     */
    reset(): void {
        //!!! should stop any running renderer, however running ocx is not stored here....
        if (this.id) {
            for (const output_element of document.querySelectorAll(`[data-source-element="${this.id}"]`)) {
                output_element.remove();
            }
        }
    }

    /** stop any running activities for this cell
     */
    stop() {
        XbManager.singleton.stop_cell(this);
    }

    scroll_into_view(): void {
        //!!! this needs improvement
        //!!! when repositioning the viewport, try to ensure that the cell and its outputs are visible, and not just the editor portion
        if (this.#has_text_container()) {
            this.#codemirror?.scroll_into_view();
        } else {
            //!!! this is too eager...
            this.scrollIntoView();
        }
    }

    /* Override this.outerHTML to provide clean output for save_serializer() in 'src/init.ts'.
     * This is done so that CodeMirror stuff does not get included, only the text.
     */
    get outerHTML (): string {
        const open_tag_segments = [
            `<${this.CLASS.custom_element_name}`,
        ];
        //!!! attributes values' contained " character are incorrectly translated to \"
        for (const name of this.getAttributeNames()) {
            const value = this.getAttribute(name);
            if (value === null) {
                open_tag_segments.push(name);
            } else {
                open_tag_segments.push(`${name}=${make_string_literal(value, true)}`);
            }
        }
        const open_tag = open_tag_segments.join(' ') + '>';
        return `${open_tag}${this.get_text()}</${this.CLASS.custom_element_name}>`;
    }


    // === FOCUS LISTENERS / ACTIVE ===

    #connect_focus_listeners(): void {
        function select_handler(event: Event) {
            const target = event.target;
            if (target instanceof Element) {
                const cell = target.closest(CellElement.custom_element_name) as CellElement;
                if (cell) {
                    // XbManager.singleton.set_active_cell() clears/sets the "active" attributes of all cells
                    XbManager.singleton.set_active_cell(cell);
                }
            }
        }
        this.#event_listener_manager.add(this, 'focus', select_handler, { capture: true });
        this.#event_listener_manager.add(this, 'click', select_handler, { capture: true });
    }


    // === WEB COMPONENT LIFECYCLE ===

    #update_for_connected(): void {
        this.#event_listener_manager.attach();
        this.removeAttribute('tabindex');  // focusable parent for textarea causes SHIFT-Tab not to work
    }

    #update_for_disconnected(): void {
        this.#event_listener_manager.detach();
    }

    // connectedCallback:
    //     Invoked each time the custom element is appended into a document-connected element.
    //     This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
    //     Note: connectedCallback may be called once your element is no longer connected, use Node.isConnected to make sure.
    connectedCallback(): void {
        this.#update_for_connected();
    }

    // disconnectedCallback:
    //     Invoked each time the custom element is disconnected from the document's DOM.
    disconnectedCallback(): void {
        this.#update_for_disconnected();
    }

    // adoptedCallback:
    //     Invoked each time the custom element is moved to a new document.
    adoptedCallback(): void {
        this.#update_for_connected();
    }

    // attributeChangedCallback:
    //     Invoked each time one of the custom element's attributes is added, removed, or changed.
    //     Which attributes to notice change for is specified in a static get observedAttributes method
    attributeChangedCallback(name: string, old_value: any, new_value: any): void {
        switch (name) {
        case 'xyzzy': {
            //!!!
            break;
        }
        }
        //!!!
    }

    static get observedAttributes(): string[] {
        return [
            'xyzzy',//!!!
        ];
    }


    // === INITIALIZATION ===

    static {  // static initialization
        globalThis.customElements.define(this.custom_element_name, this);
    }
}
