const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_element,
} from '../dom-tools';

import {
    uuidv4,
} from 'lib/sys/uuid';

import {
    OpenPromise,
} from 'lib/sys/open-promise';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./dialog.css', assets_server_url(current_script_url)));
}


// === DIALOG BASE CLASS ===

const _dialog_element_to_instance_map = new WeakMap<HTMLDialogElement, Dialog>();

export class Dialog {
    get CLASS (){ return this.constructor as typeof Dialog; }

    /** run a new instance of this dialog class
     *  @param {undefined|string} message to be passed to instance run() method
     *  @param {Object|undefined|null} options to be passed to instance run() method
     *  @return {Promise}
     */
    static run(message?: string, options?: object) { return new this().run(message, options); }

    /** Return the dialog instance associated with an element, if any.
     *  @param {Element} element an HTML element in the DOM
     *  @return {null|Dialog} null if element is not a dialog or a child
     *          of a dialog, otherwise the associated Dialog instance.
     */
    static instance_from_element(element: Element): null|Dialog {
        const dialog_element  = element.closest('dialog') as HTMLDialogElement;
        if (!dialog_element) {
            return null;
        } else {
            const dialog_instance = _dialog_element_to_instance_map.get(dialog_element);
            return dialog_instance ?? null;
        }
    }

    static _modal_dialog_css_class = 'modal_dialog';

    #promise = new OpenPromise<boolean>();
    #dialog_element_id: string = `dialog-${uuidv4()}`;
    _dialog_element: undefined|HTMLDialogElement = undefined;
    _dialog_text_container: undefined|HTMLElement = undefined;
    _dialog_form: undefined|HTMLFormElement = undefined;

    #completed: boolean = false;
    get completed (){ return this.#completed; }

    constructor() {
        this.#promise.finally(() => {
            try {
                this._destroy_dialog_element();
            } catch (error) {
                console.warn('ignoring error when finalizing dialog promise', error);
            }
        });
        try {
            this._create_dialog_element();
            if (!this._dialog_element) {
                throw new Error('unexpected: this._dialog_element is not set after calling this._create_dialog_element()');
            }
            _dialog_element_to_instance_map.set(this._dialog_element, this);
        } catch (error) {
            this._cancel(error);
        }
    }

    get promise (){ return this.#promise.promise; }

    run(message?: string, options?: object): Promise<boolean> {
        this._populate_dialog_element(message, options);
        this._dialog_element?.showModal();
        return this.promise;
    }


    // === INTERNAL METHODS ===

    // To be overridden to provide the content of the dialog.
    // this.dialog_element will have already been set and will be part of the DOM.
    _populate_dialog_element(message?: string, options?: object) {
        throw new Error('unimplemented');
    }

    // to be called when dialog is complete
    _complete(result: boolean = false) {
        this.#completed = true;
        this.#promise.resolve(result);
    }

    // to be called when dialog is canceled
    _cancel(error: unknown) {
        this.#promise.reject(error ?? new Error('canceled'));
    }

    // expects this.#dialog_element_id is already set, sets this._dialog_element
    _create_dialog_element() {
        if (typeof this.#dialog_element_id !== 'string') {
            throw new Error('this.#dialog_element_id must already be set to a string before calling this method');
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
        if (document.getElementById(this.#dialog_element_id)) {
            throw new Error(`unexpected: dialog with id ${this.#dialog_element_id} already exists`);
        }
        const dialog_element = create_element({
            parent: ui_element,
            tag:    'dialog',
            attrs: {
                id: this.#dialog_element_id,
                class: this.CLASS._modal_dialog_css_class,
            },
        }) as HTMLDialogElement;
        this._dialog_text_container = create_element({
            parent: dialog_element,
            tag: 'h2',
            attrs: {
                class: 'dialog-text',
            },
        }) as HTMLElement;
        this._dialog_form = create_element({
            parent: dialog_element,
            tag:    'form',
            attrs: {
                method: 'dialog',
            },
        }) as HTMLFormElement;
        this._dialog_element = dialog_element;
    }

    _destroy_dialog_element() {
        if (this._dialog_element) {
            _dialog_element_to_instance_map.delete(this._dialog_element);
            this._dialog_element.remove();
            this._dialog_element.oncancel = null;
            this._dialog_element.onclose = null;
            this._dialog_element = undefined;
        }
    }
}


export class AlertDialog extends Dialog {
    _populate_dialog_element(message: string, options?: object) {
        const {
            accept_button_label = 'Ok',
        } = (options ?? {}) as any;
        if (this._dialog_text_container) {  // test for the sake of typescript...
            this._dialog_text_container.innerText = message;
        }
        const accept_button = create_element({
            parent: this._dialog_form,
            tag:    'input',
            attrs: {
                type: 'submit',
                value: accept_button_label,
            },
        }) as HTMLInputElement;
        if (this._dialog_element) {  // test for the sake of typescript...
            this._dialog_element.onclose = (event) => this._complete();
        }
    }
}


export class ConfirmDialog extends Dialog {
    _populate_dialog_element(message: string, options?: object) {
        const {
            decline_button_label = 'No',
            accept_button_label  = 'Yes',
        } = (options ?? {}) as any;
        if (this._dialog_text_container) {  // test for the sake of typescript...
            this._dialog_text_container.innerText = message;
        }
        const decline_button = create_element({
            parent: this._dialog_form,
            tag:    'input',
            attrs: {
                type: 'button',
                value: decline_button_label,
            },
        }) as HTMLInputElement;
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
        if (this._dialog_element) {  // test for the sake of typescript...
            this._dialog_element.oncancel = (event) => this._complete(false);
            this._dialog_element.onclose = (event) => this._complete(this._dialog_element?.returnValue === accept_button_label);
        }
    }
}


// === UTILITY FUNCTIONS ===

/** create a new HTML control as a child of the given parent with an optional label element
 *  @param {Node} parent
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
export function create_control_element(parent: Node, id: string, options?: object) {
    if (typeof id !== 'string' || id === '') {
        throw new Error('id must be a non-empty string');
    }
    const {
        tag  = 'input',
        type = 'text',
        label,
        label_after,
        attrs = {},
    } = (options ?? {}) as any;

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
    let control_label: undefined|HTMLLabelElement;
    if (label) {
        control_label = create_element({
            tag: 'label',
            attrs: {
                for: id,
            },
        }) as HTMLLabelElement;
        control_label.innerText = label;
    }

    if (label_after) {
        parent.appendChild(control);
        if (control_label) {
            parent.appendChild(control_label);
        }
    } else {
        if (control_label) {
            parent.appendChild(control_label);
        }
        parent.appendChild(control);
    }

    return control;
}

/** create a new HTML <select> and associated <option> elements
 *  as a child of the given parent with an optional label element
 *  @param {Node} parent
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
export function create_select_element(parent: Node, id: string, opts?: object) {
    opts = opts ?? {};
    if ('tag' in (opts as any) || 'type' in (opts as any)) {
        throw new Error('opts must not contain "tag" or "type"');
    }
    const option_elements: HTMLOptionElement[] = [];
    const options = (opts as any).options;
    if (typeof options === 'object') {
        for (const { value, label } of options) {
            const option_attrs = { value: (value ?? label) };
            const option_element = create_element({
                tag: 'option',
                attrs: option_attrs,
            }) as HTMLOptionElement;
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
