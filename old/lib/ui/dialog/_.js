const current_script_url = import.meta.url;  // save for later

import {
    create_element,
} from '../dom-tools.js';

import {
    uuidv4,
} from '../../sys/uuid.js';

import {
    OpenPromise,
} from '../../sys/open-promise.js';

import {
    assets_server_url,
} from '../../../src/assets-server-url.js';

// import {
//     create_stylesheet_link,
// } from '../dom-tools.js';
export async function load_stylesheet() {
    // create_stylesheet_link(document.head, new URL('./dialog.css', assets_server_url(current_script_url)));
    await import('./dialog.css');  // webpack implementation
}


// === DIALOG BASE CLASS ===

const _dialog_element_to_instance_map = new WeakMap();

export class Dialog {
    /** run a new instance of this dialog class
     *  @param {string} message to be passed to instance run() method
     *  @param {Object|undefined|null} options to be passed to instance run() method
     *  @return {Promise}
     */
    static run(message, options) { return new this().run(message, options); }

    static is_modal_active() {
        return [ ...document.querySelectorAll(`dialog.${this._modal_dialog_css_class}`) ].some(d => d.open);
    }

    /** Return the dialog instance associated with an element, if any.
     *  @param {Element} element an HTML element in the DOM
     *  @return {Element|null} null if element is not a dialog or a child
     *          of a dialog, otherwise the associated Dialog instance.
     */
    static instance_from_element(element) {
        return _dialog_element_to_instance_map.get(element.closest('dialog'));
    }

    static _modal_dialog_css_class = 'modal_dialog';

    constructor() {
        this._completed = false;
        this._promise = new OpenPromise();
        this._promise.promise.finally(() => {
            try {
                this._destroy_dialog_element();
            } catch (error) {
                console.warn('ignoring error when finalizing dialog promise', error);
            }
        });
        try {
            this._dialog_element_id = `dialog-${uuidv4()}`;
            this._create_dialog_element();
            _dialog_element_to_instance_map.set(this._dialog_element, this);
        } catch (error) {
            this._cancel(error);
        }
    }

    get promise (){ return this._promise.promise; }

    run(...args) {
        this._populate_dialog_element(...args);
        this._dialog_element.showModal();
        return this.promise;
    }


    // === INTERNAL METHODS ===

    // To be overridden to provide the content of the dialog.
    // this.dialog_element will have already been set and will be part of the DOM.
    _populate_dialog_element(...args) {
        throw new Error('unimplemented');
    }

    // to be called when dialog is complete
    _complete(result) {
        this._completed = true;
        this._promise.resolve(result);
    }

    // to be called when dialog is canceled
    _cancel(error) {
        this._promise.reject(error ?? new Error('canceled'));
    }

    // expects this._dialog_element_id is already set, sets this._dialog_element
    _create_dialog_element() {
        if (typeof this._dialog_element_id !== 'string') {
            throw new Error('this._dialog_element_id must already be set to a string before calling this method');
        }
        if (typeof this._dialog_element !== 'undefined') {
            throw new Error('this._dialog_element must be undefined when calling this method');
        }
        const header_element = document.querySelector('header') ??
              create_element({ parent: document.body, tag: 'header' });
        if (header_element.parentElement !== document.body) {
            throw new Error('pre-existing header element is not a direct child of document.body');
        }
        const ui_element = document.getElementById('ui') ??
              create_element({
                  before: header_element.firstChild,  // prepend
                  attrs:  { id: 'ui' },
              });
        if (ui_element.tagName !== 'DIV' || ui_element.parentElement !== header_element) {
            throw new Error('pre-existing #ui element is not a <div> that is a direct child of the header element');
        }
        if (document.getElementById(this._dialog_element_id)) {
            throw new Error(`unexpected: dialog with id ${this._dialog_element_id} already exists`);
        }
        const dialog_element = create_element({
            parent: ui_element,
            tag:    'dialog',
            attrs: {
                id: this._dialog_element_id,
                class: this.constructor._modal_dialog_css_class,
            },
        });
        this._dialog_text_container = create_element({
            parent: dialog_element,
            tag: 'h2',
            attrs: {
                class: 'dialog-text',
            },
        });
        this._dialog_form = create_element({
            parent: dialog_element,
            tag:    'form',
            attrs: {
                method: 'dialog',
            },
        });
        this._dialog_element = dialog_element;
    }

    _destroy_dialog_element() {
        if (this._dialog_element) {
            _dialog_element_to_instance_map.delete(this._dialog_element);
            this._dialog_element.remove();
        }
        this._dialog_element.oncancel = null;
        this._dialog_element.onclose = null;
        this._dialog_element = undefined;
    }
}

export class AlertDialog extends Dialog {
    _populate_dialog_element(message, options) {
        const {
            accept_button_label = 'Ok',
        } = (options ?? {});
        this._dialog_text_container.innerText = message;
        const accept_button = create_element({
            parent: this._dialog_form,
            tag:    'input',
            attrs: {
                type: 'submit',
                value: accept_button_label,
            },
        });
        this._dialog_element.onclose = (event) => this._complete();
    }
}

export class ConfirmDialog extends Dialog {
    _populate_dialog_element(message, options) {
        const {
            decline_button_label = 'No',
            accept_button_label  = 'Yes',
        } = (options ?? {});
        this._dialog_text_container.innerText = message;
        const decline_button = create_element({
            parent: this._dialog_form,
            tag:    'input',
            attrs: {
                type: 'button',
                value: decline_button_label,
            },
        });
        decline_button.innerText = decline_button_label;
        decline_button.onclick = (event) => this._complete(false);
        const accept_button = create_element({
            parent: this._dialog_form,
            tag:    'input',
            attrs: {
                type: 'submit',
                value: accept_button_label,
            },
        });
        this._dialog_element.oncancel = (event) => this._complete(false);
        this._dialog_element.onclose = (event) => this._complete(this._dialog_element.returnValue === accept_button_label);
    }
}


// === UTILITY FUNCTIONS ===

/** create a new HTML control as a child of the given parent with an optional label element
 *  @param {HTMLElement} parent
 *  @param {string} id for control element
 *  @param {Object|undefined|null} options: {
 *             tag?:         string,   // tag name for element; default: 'input'
 *             type?:        string,   // type name for element; default: 'text' (only used if tag === 'input')
 *             label?:       string,   // if !!label, then create a label element
 *             label_after?: boolean,  // if !!label_after, the add label after element, otherwise before
 *             attrs?:       object,   // attributes to set on the new control element
 *         }
 *  @return {Element} the new control element
 */
export function create_control_element(parent, id, options) {
    if (typeof id !== 'string' || id === '') {
        throw new Error('id must be a non-empty string');
    }
    const {
        tag  = 'input',
        type = 'text',
        label,
        label_after,
        attrs = {},
    } = (options ?? {});

    if ('id' in attrs || 'type' in attrs) {
        throw new Error('attrs must not contain "id" or "type"');
    }
    const control_opts = {
        id,
        ...attrs,
    };
    if (tag === 'input') {
        control_opts.type = type;
    }
    const control = create_element({
        tag,
        attrs: control_opts,
    });
    let control_label;
    if (label) {
        control_label = create_element({
            tag: 'label',
            attrs: {
                for: id,
            },
        });
        control_label.innerText = label;
    }

    if (label_after) {
        parent.appendChild(control);
        parent.appendChild(control_label);
    } else {
        parent.appendChild(control_label);
        parent.appendChild(control);
    }

    return control;
}

/** create a new HTML <select> and associated <option> elements
 *  as a child of the given parent with an optional label element
 *  @param {HTMLElement} parent
 *  @param {string} id for control element
 *  @param {Object|undefined|null} opts: {
 *             tag?:         string,    // tag name for element; default: 'input'
 *             label?:       string,    // if !!label, then create a label element
 *             label_after?: boolean,   // if !!label_after, the add label after element, otherwise before
 *             attrs?:       object,    // attributes to set on the new <select> element
 *             options?:     object[],  // array of objects, each of which contain "value" and "label" keys (value defaults to label)
 *                                      // values are the option attributes.  If no "value"
 *                                      // attribute is specified then the key is used.
 *         }
 * Note: we are assuming that opts.options is specified with an key-order-preserving object.
 *  @return {Element} the new <select> element
 */
export function create_select_element(parent, id, opts) {
    opts = opts ?? {};
    if ('tag' in opts || 'type' in opts) {
        throw new Error('opts must not contain "tag" or "type"');
    }
    const option_elements = [];
    if (opts.options) {
        for (const { value, label } of opts.options) {
            const option_attrs = { value: (value ?? label) };
            const option_element = create_element({
                tag: 'option',
                attrs: option_attrs,
            });
            option_element.innerText = label;
            option_elements.push(option_element);
        }
    }
    const select_opts = {
        ...opts,
        tag: 'select',
    };
    const select_element = create_control_element(parent, id, select_opts);
    for (const option_element of option_elements) {
        select_element.appendChild(option_element);
    }
    return select_element;
}
