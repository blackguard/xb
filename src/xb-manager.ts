const current_script_url = import.meta.url;  // save for later

import {
    show_initialization_failed,
    save_serializer,
} from 'src/init';

import {
    fs_interface,
} from 'lib/sys/fs-interface';

import {
    SerialDataSource,
    Subscription,
} from 'lib/sys/serial-data-source';

import {
    ActivityManager,
    StopState,
} from 'lib/sys/activity-manager';

import {
    KeyEventManager,
    KeyMap,
    CommandContext,
} from 'lib/ui/key/_';

import {
    AlertDialog,
    ConfirmDialog,//!!!
} from 'lib/ui/dialog/_';

import {
    create_element,
    clear_element,
} from 'lib/ui/dom-tools';

import {
    TextBasedRenderer,
    TextBasedRendererOptionsType,
} from 'src/renderer/_';

import {
    OutputContext,
} from 'src/output-context/_';

import {
    MenuBar,
} from 'lib/ui/menu/_';

import {
    XbCellElement,
} from 'src/xb-cell-element/_';

import {
    EventListenerManager,
} from 'lib/sys/event-listener-manager';

import {
    NotificationManager,
} from 'lib/ui/notification-manager/_';

import {
    settings_updated_events,
    get_settings,
} from 'src/settings/_';

import {
    get_global_command_bindings,
    get_global_initial_key_map_bindings,
    get_menubar_spec,
} from 'src/global-bindings';

import {
    beep,
} from 'lib/ui/beep';


// import {
//     assets_server_url,
// } from 'lib/sys/assets-server-url';
// import {
//     create_stylesheet_link,
// } from 'lib/ui/dom-tools';
// {
//     const server_url = assets_server_url(current_script_url);  // current_script_url is from initial import.meta.url
//     create_stylesheet_link(document.head, new URL('./style.css',       server_url));
//     create_stylesheet_link(document.head, new URL('./style-hacks.css', server_url));
// }
import 'src/style.css';        // webpack implementation
import 'src/style-hacks.css';  // webpack implementation


const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;


export class XbManager {
    get CLASS (){ return this.constructor as typeof XbManager; }

    static #singleton: XbManager;

    static get ready (){ return !!this.#singleton; }

    static get singleton (){
        if (!this.#singleton) {
            this._initialize_singleton();
        }
        return this.#singleton;
    }

    // called and awaited in ./init.js as part of initialization process
    static _initialize_singleton(): XbManager {
        if (!this.#singleton) {
            this.#singleton = new this();
            this.#singleton.#initialize();
        }
        return this.#singleton;
    }

    #initialize_called = false;
    #activity_manager: ActivityManager = new ActivityManager(true);  // true --> multiple_stops
    #eval_states = new SerialDataSource<{ cell: XbCellElement, eval_state: boolean }>();
    #eval_states_subscription: Subscription;
    #command_bindings: { [command: string]: ((...args: any[]) => any) };
    #key_event_manager: KeyEventManager<XbManager>;
    #menubar: undefined|MenuBar<XbManager> = undefined;
    #menubar_commands_subscription: undefined|Subscription = undefined;
    #menubar_selects_subscription:  undefined|Subscription = undefined;
    #file_handle: any = null;
    #editable: boolean = true;
    #active_cell: null|XbCellElement = null;
    #global_state: object = {};  // persistent state for renderers
    // the following map is maintained by this.invoke_renderer()
    #cell_ocx_map = new WeakMap<XbCellElement, Set<OutputContext>>();

    #notification_manager = new NotificationManager();
    get notification_manager (){ return this.#notification_manager; }

    #reset_before_render: boolean = false;  // from settings, kept up-to-date via settings_updated_events
    get reset_before_render (){ return this.#reset_before_render; }

    constructor() {
        // must set xb on all incoming cells
        for (const cell of this.get_cells()) {
            cell._set_xb(this);
        }

        this.reset_global_state();

        this.#eval_states_subscription = this.#eval_states.subscribe(this.#eval_states_observer.bind(this));  //!!! this.#eval_states_subscription is never unsubscribed

        // listen for settings changed events and trigger update in cells
        settings_updated_events.subscribe(this.update_from_settings.bind(this));  //!!! never unsubscribed
        this.update_from_settings();  // establish initial settings right away

        this.#command_bindings = get_global_command_bindings();

        this.#key_event_manager = new KeyEventManager<XbManager>(this, window, this.#command_observer.bind(this));
        const key_map = new KeyMap(get_global_initial_key_map_bindings());
        this.push_key_map(key_map);
        this.#key_event_manager.attach();

        this.set_editable(true);
    }

    get header_element (){
        const el = document.querySelector('header');
        if (!el) {
            throw new Error('unexpected: header element not present');
        }
        return el;
    }
    get main_element (){
        const el = document.querySelector('main');
        if (!el) {
            throw new Error('unexpected: main element not present');
        }
        return el;
    }

    get cell_view_mode (){ return document.documentElement.getAttribute('data-cell-view'); }

    get cell_parent (){ return this.main_element; }

    get activity_manager (){ return this.#activity_manager; }

    get editable (){ return this.#editable; }
    set_editable(editable: boolean = true) {
        editable = !!editable;  // ensure Boolean
        this.#editable = editable;
        for (const cell of this.get_cells()) {
            cell.set_editable(editable);
        }
    }

    get active_cell (){ return this.#active_cell; }
    set_active_cell(cell: XbCellElement): void {
        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
        }
        this.#active_cell = cell;
        for (const cell of this.get_cells()) {
            cell.set_active(cell === this.active_cell);
        }
    }

    get global_state (){ return this.#global_state; }
    reset_global_state() {
        this.#global_state = {};
    }
    /** reset the document, meaning that all cells will be reset,
     *  and this.#global_state will be reset.  Also, the saved file
     *  handle this.#file_handle set to undefined.
     *  @return {XbManager} this
     */
    reset() {
        try {
            this.stop();
        } catch (error: unknown) {
            console.error('error calling this.stop()', error, this);
        }
        TextBasedRenderer.reset_renderer_factories();
        this.reset_global_state();
        this.#file_handle = undefined;
        for (const cell of this.get_cells()) {
            try {
                cell.reset();
            } catch (error: unknown) {
                console.error('error calling cell.reset()', error, cell);
            }
        }
        return this;
    }

    /** clear the current document
     */
    clear() {
        this.reset();
        if (this.main_element) {
            clear_element(this.main_element);
        }
        const first_cell = this.create_cell();
        first_cell.focus();
    }

    stop(): void {
        try {
            this.activity_manager.stop();
        } catch (error) {
            console.error('error while stopping this.activity_manager', error, this.activity_manager);
        }
    }

    stop_cell(cell: XbCellElement): void {
        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
        }
        this.#cell_ocx_map.get(cell)?.forEach(ocx => {
            try {
                ocx.stop();
            } catch (error: unknown) {
                console.error('error while stopping ocx', error, ocx);
            }
        })
    }

    can_stop_cell(cell: XbCellElement): boolean {
        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
            return false;
        } else {
            const ocxs = this.#cell_ocx_map.get(cell);
            if (!ocxs) {
                return false;
            } else {
                return [ ...ocxs.values() ].some(ocx => !ocx.stopped);
            }
        }
    }

    #initialize() {
        if (this.#initialize_called) {
            throw new Error('initialize() called more than once');
        }
        this.#initialize_called = true;

        try {

            this.#setup_csp();
            this.#setup_header();
            this.#set_initial_active_cell();

            // add "changes may not be saved" prompt for when document is being closed while modified
            window.addEventListener('beforeunload', (event: Event): any => {
                if (this.cell_view_mode !== 'kiosk') {
                   const warn = true;  //!!! always warn for now
                   event.preventDefault();
                   event.returnValue = !warn;  // indicate: if false, default action prevented
                   return warn;                // indicate: if true, default action prevented
                }
            });  //!!! event handler never removed

        } catch (error) {
            show_initialization_failed(error);
        }
    }


    // === KEY MAP STACK ===

    reset_key_map_stack(): void {
        this.#key_event_manager.reset_key_map_stack();
    }
    push_key_map(key_map: KeyMap): void {
        this.#key_event_manager.push_key_map(key_map);
    }
    pop_key_map(): undefined|KeyMap {
        return this.#key_event_manager.pop_key_map();
    }
    remove_key_map(key_map: KeyMap, remove_subsequent_too: boolean = false): boolean {
        return this.#key_event_manager.remove_key_map(key_map, remove_subsequent_too);
    }


    // === DOCUMENT STRUCTURE ===

    #setup_csp(enabled: boolean = false): void {
        if (enabled) {

            // === CONTENT SECURITY POLICY ===

            // set a Content-Security-Policy that will permit us
            // to dynamically load associated content

            const csp_header_content = [
                //!!! audit this !!!
                "default-src 'self' 'unsafe-eval'",
                "style-src   'self' 'unsafe-inline' *",
                "script-src  'self' 'unsafe-inline' 'unsafe-eval' *",
                "img-src     'self' data: blob: *",
                "media-src   'self' data: blob: *",
                "connect-src data:",
            ].join('; ');

            create_element({
                parent: document.head,
                tag:    'meta',
                attrs: {
                    "http-equiv": "Content-Security-Policy",
                    "content":    csp_header_content,
                },
            });
        }
    }

    #setup_header(): void {
        if (!this.header_element) {
            throw new Error(`bad format for document: header element does not exist`);
        }
        const get_recents = null;//!!! implement this
        this.#menubar = MenuBar.create<XbManager>(this, this.header_element, get_menubar_spec(), get_global_initial_key_map_bindings /*, get_recents */);
        //!!! this.#menubar_commands_subscription is never unsubscribed
        this.#menubar_commands_subscription = this.#menubar.commands.subscribe(this.#command_observer.bind(this));
        //!!! this.#menubar_selects_subscription is never unsubscribed
        this.#menubar_selects_subscription = this.#menubar.selects.subscribe(this.#update_menu_state.bind(this));
    }

    #set_initial_active_cell() {
        const active_cell = (
            document.querySelector(`${XbCellElement.custom_element_name}[data-active]`) ??  // cell currently set as active
            document.querySelector(`${XbCellElement.custom_element_name}`)              ??  // first cell
            this.create_cell()                                                              // new cell
        ) as XbCellElement;
        if (active_cell.xb !== this) {
            console.error('unexpected: active_cell has a different xb');
        }
        active_cell.focus();
        // this.set_active_cell() will establish the active cell correctly,
        // and reset "active" on all other cells.
        this.set_active_cell(active_cell);
    }


    // === SAVE HANDLING ====

    async perform_save(perform_save_as: boolean = false): Promise<boolean> {
        const save_result = await fs_interface.save(save_serializer, {
            file_handle: perform_save_as ? undefined : this.#file_handle,
            prompt_options: {
                suggestedName: this.#get_suggested_filename(),//!!!
            },
        });
        const {
            canceled,
            file_handle,
            stats,
        } = (save_result as any);
        if (canceled) {
            this.notification_manager.add('save canceled');
        } else {
            //!!!
            this.#file_handle = file_handle ?? undefined;
            this.notification_manager.add('document saved');
        }
        return !canceled;
    }

    #get_suggested_filename(): string {
        return window.location.pathname.split('/').slice(-1)[0];
    }


    // === RENDER INTERFACE ===

    invoke_renderer_for_type( type:            string = 'plain',
                              options?:        null|TextBasedRendererOptionsType,
                              cell?:           null|XbCellElement,
                              output_element?: Element ): Promise<{ element: Element, remove_event_handlers: () => void }> {
        if (cell && cell.xb !== this) {
            throw new Error('unexpected: cell has a different xb');
        }
        type ??= 'plain';
        const renderer = TextBasedRenderer.renderer_for_type(type);
        if (!renderer) {
            throw new Error('no renderer found for type "${type}"');
        }
        return this.invoke_renderer(renderer, options, cell, output_element);
    }

    invoke_renderer( renderer:        TextBasedRenderer,
                     options?:        null|TextBasedRendererOptionsType,
                     cell?:           null|XbCellElement,
                     output_element?: Element ): Promise<{ element: Element, remove_event_handlers: () => void }> {
        cell ??= this.active_cell;
        if (!cell) {
            throw new Error('cell not specified and no active_cell');
        }
        if (cell.xb !== this) {
            throw new Error('unexpected: cell has a different xb');
        }

        cell.ensure_id();
        const cell_id = cell.id;

        options ??= {};
        if (!options.global_state) {
            options = {
                ...options,
                global_state: this.global_state,
            };
        }

        // reset_before_render is performed only if no output_element was passed in
        if (!output_element && this.#reset_before_render) {
            cell.reset();
        }

        output_element ??= OutputContext.create_cell_output(cell, renderer.media_type);

        // The following event listeners are not normally explicitly removed.
        // Instead, if the element is removed, we rely on the event listener
        // resources to be cleaned up, too.  However, the returned function
        // remove_event_handlers() can be called to explicitly remove the
        // handlers.  This is useful if the output_element is passed in
        // from the outside and that sort of control is desired.
        const event_listener_manager = new EventListenerManager();
        const event_listener = (event: Event) => {
            // use querySelector() to re-find the cell in case it is no longer present
            const refound_cell = document.querySelector(`#${cell_id}`);
            if (refound_cell instanceof XbCellElement) {
                if (refound_cell !== this.active_cell && refound_cell.xb === this) {
                    this.set_active_cell(refound_cell);
                }
            }
        };
        event_listener_manager.add(output_element, 'focus', event_listener, { capture: true });
        event_listener_manager.add(output_element, 'click', event_listener, { capture: true });
        event_listener_manager.attach();
        const remove_event_handlers = () => {
            if (event_listener_manager.attached) {
                event_listener_manager.detach();
            }
        };
(globalThis as any).remove_event_handlers = remove_event_handlers;//!!!

        const ocx = new OutputContext(this, output_element);
        this.activity_manager.add_activity(ocx);
        this.#associate_cell_ocx(cell, ocx);
        const ocx_stop_subscription = ocx.stop_states.subscribe((state: StopState) => {
            ocx_stop_subscription.unsubscribe();  // one-shot
            if (state.activity_manager.multiple_stops) {
                console.warn('warning: treating multiple_stops activity_manager as a one-shot...', { state, renderer, ocx });
            }
            if (state.activity_manager === ocx) {
                this.#dissociate_cell_ocx(cell, ocx);
                this.activity_manager.remove_activity(ocx);
            }
        });

        return ocx._invoke_renderer(renderer, cell.get_text(), options)
            .then((element) => ({ element, remove_event_handlers }))
            .catch((error) => { ocx.render_error(error); throw error; })//!!! improve
            .finally(() => {
                if (!ocx.keepalive) {
                    ocx.stop();  // stop anything that may have been started
                }
            });
    }

    #associate_cell_ocx(cell: XbCellElement, ocx: OutputContext) {
        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
        }
        if (ocx.xb !== this) {
            console.error('unexpected: ocx has a different xb');
        }
        const ocx_set = this.#cell_ocx_map.get(cell);
        if (ocx_set) {
            ocx_set.add(ocx);
        } else {
            const new_ocx_set = new Set<OutputContext>();
            new_ocx_set.add(ocx);
            this.#cell_ocx_map.set(cell, new_ocx_set);
        }
    }

    #dissociate_cell_ocx(cell: XbCellElement, ocx: OutputContext) {
        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
        }
        if (ocx.xb !== this) {
            console.error('unexpected: ocx has a different xb');
        }
        const ocx_set = this.#cell_ocx_map.get(cell);
        if (ocx_set) {
            ocx_set.delete(ocx);
            if (ocx_set.size <= 0) {
                this.#cell_ocx_map.delete(cell);
            }
        }
    }

    // === COMMAND HANDLER INTERFACE ===

    inject_key_event(key_event: KeyboardEvent): void {
        const active_cell = this.active_cell;
        const target      = key_event.target;
        if (active_cell && target instanceof Node && !active_cell.contains(target as Node)) {
            // try to set target to the currently active cell
            if (active_cell) {
                // this is a clumsy clone of key_event, but it will only be used internally from this point
                // the goal is to clone the event but change target and currentTarget
                key_event = {
                    ...key_event,  // captures almost nothing, e.g., just the "isTrusted" property

                    key:           key_event.key,       // non-enumerable getter
                    metaKey:       key_event.metaKey,   // non-enumerable getter
                    ctrlKey:       key_event.ctrlKey,   // non-enumerable getter
                    shiftKey:      key_event.shiftKey,  // non-enumerable getter
                    altKey:        key_event.altKey,    // non-enumerable getter

                    preventDefault:  key_event.preventDefault.bind(key_event),
                    stopPropagation: key_event.stopPropagation.bind(key_event),

                    target:        active_cell,
                    currentTarget: active_cell,
                };
            }
        }
        this.#key_event_manager.inject_key_event(key_event);
    }

    inject_command(command: string) {
        return this.#perform_command({ dm: this, command, target: this.active_cell });
    }

    #perform_command(command_context: CommandContext<XbManager>): void {
        let success: boolean = false;  // for now...
        if (command_context) {
            const target = command_context.target;
            if (target) {
                const updated_command_context = {
                    ...command_context,
                    target: this.active_cell,
                };
                const bindings_fn = this.#command_bindings[updated_command_context.command];
                if (bindings_fn) {
                    if (bindings_fn instanceof AsyncFunction) {
                        bindings_fn(updated_command_context)
                            .then((success: boolean) => {
                                if (!success) {
                                    beep();
                                }
                            })
                            .catch((error: unknown) => {
                                console.error('error performing command', error, command_context);
                            });
                        success = true;  // so far..., a failure may yet happen asynchronously
                    } else {
                        success = bindings_fn(updated_command_context);
                    }
                }
            }
        }
        if (!success) {
            beep();
        }
    }

    #command_observer(command_context: CommandContext<XbManager>): void {
        let success = false;
        try {
            this.#perform_command(command_context);
        } catch (error) {
            console.error('error processing command', command_context, error);
        }
    }

    #update_menu_state() {
        //!!! review this !!!
        const menubar = this.#menubar;
        if (menubar) {
            const cells           = this.get_cells();
            const active_cell     = this.active_cell;
            const active_index    = active_cell ? cells.indexOf(active_cell) : -1;
            const editable        = this.editable;
            const cell_mode       = active_cell?.type;
            const cell_view_mode  = this.cell_view_mode;
            const has_save_handle = !!this.#file_handle;

            menubar.set_menu_state('reset',               { enabled: editable });
            menubar.set_menu_state('reset-all',           { enabled: editable });
            menubar.set_menu_state('clear-all',           { enabled: editable });

            const neutral = false;  //!!! until we figure out how to detect a changed document
            menubar.set_menu_state('save', { enabled: !neutral && has_save_handle });
            // no update to command 'save-as'

            menubar.set_menu_state('eval',                { enabled: !!(editable && active_cell) });
            menubar.set_menu_state('eval-and-refocus',    { enabled: !!(editable && active_cell) });
            menubar.set_menu_state('eval-before',         { enabled: !!(editable && active_cell) });
            menubar.set_menu_state('eval-all',            { enabled: !!(editable && active_cell) });

            menubar.set_menu_state('stop',                { enabled: active_cell?.can_stop });
            menubar.set_menu_state('stop-all',            { enabled: cells.some(cell => cell.can_stop) });

            menubar.set_menu_state('focus-up',            { enabled: !!(active_cell && active_index > 0) });
            menubar.set_menu_state('focus-down',          { enabled: !!(active_cell && active_index < cells.length-1) });

            menubar.set_menu_state('move-up',             { enabled: !!(active_cell && active_index > 0) });
            menubar.set_menu_state('move-down',           { enabled: !!(active_cell && active_index < cells.length-1) });
            menubar.set_menu_state('add-before',          { enabled: !!(editable && active_cell) });
            menubar.set_menu_state('add-after',           { enabled: !!(editable && active_cell) });
            menubar.set_menu_state('delete',              { enabled: !!(editable && active_cell) });

            menubar.set_menu_state('set-mode-plain',      { checked: (cell_mode === 'plain')      });
            menubar.set_menu_state('set-mode-markdown',   { checked: (cell_mode === 'markdown')   });
            menubar.set_menu_state('set-mode-tex',        { checked: (cell_mode === 'tex')        });
            menubar.set_menu_state('set-mode-javascript', { checked: (cell_mode === 'javascript') });

            menubar.set_menu_state('set-view-normal',     { checked: (cell_view_mode === 'normal') });
            menubar.set_menu_state('set-view-hide',       { checked: (cell_view_mode === 'hide')   });
            menubar.set_menu_state('set-view-full',       { checked: (cell_view_mode === 'full')   });
            menubar.set_menu_state('set-view-none',       { checked: (cell_view_mode === 'none')   });
            menubar.set_menu_state('set-view-kiosk',      { checked: (cell_view_mode === 'kiosk')   });

            // no update to command 'settings'
            // no update to command 'help'

            /*
              recents
            */
        }
    }

    update_from_settings() {
        const {
            editor_options,
            render_options,
        } = (get_settings() ?? {}) as any;
        for (const cell of this.get_cells()) {
            cell.update_from_settings();
        }
        // update --cell-max-height-scrolling
        const root_element = document.querySelector(':root') as HTMLElement
        if (root_element) {
            (root_element as HTMLElement).style.setProperty('--cell-max-height-scrolling', `${editor_options?.limited_size ?? 50}vh`);
        }
        // update reset_before_render
        this.#reset_before_render = !!render_options?.reset_before_render;
    }

    // === EVAL STATES ===

    emit_eval_state(cell: XbCellElement, eval_state: boolean) {
        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
        }
        this.#eval_states.dispatch({ cell, eval_state });
    }

    #eval_states_observer(data: { cell: XbCellElement, eval_state: boolean }) {
        const {
            cell,
            eval_state,
        } = data;

        if (cell.xb !== this) {
            console.error('unexpected: cell has a different xb');
        }

        //!!! do something...  is this observer necessary?
    }


    // === CELL MANAGEMENT ===

    /** return an ordered list of the XbCellElement (xb-cell) cells in the document
     */
    get_cells(): XbCellElement[] {
        return [ ...document.getElementsByTagName(XbCellElement.custom_element_name) ] as XbCellElement[];
    }

    /** return the cell that is adjacent to the given cell, either forward (or
     *  alternately backward) from the reference.
     * @param {undefined|XbCellElement} reference (default: this.active_cell)
     * @param {Boolean} forward
     * @return {undefined|XbCellElement} the adjacent cell, or undefined if
     *     reference does not exist in the document or if there is
     *     no such adjacent cell.
     */
    adjacent_cell(reference?: XbCellElement, forward: boolean = false): undefined|XbCellElement {
        if (reference && reference.xb !== this) {
            throw new Error('unexpected: reference cell has a different xb');
        } else {
            const cells = this.get_cells();
            const pos = reference ? cells.indexOf(reference) : -1;
            if (pos === -1) {
                return undefined;
            } else {
                if (forward) {
                    if (pos === cells.length-1) {
                        return undefined;
                    } else {
                        return cells[pos+1];
                    }
                } else {
                    if (pos === 0) {
                        return undefined;
                    } else {
                        return cells[pos-1];
                    }
                }
            }
        }
    }

    /** create a new cell in the document
     *  @param (Object|null|undefined} options
     *  @return {XbCellElement} new cell
     * options is passed to create_element() but with "parent" and "before"
     * set if not already set.
     */
    create_cell(options?: object): XbCellElement {
        const extended_options = (options && ('parent' in (options as any) || 'before' in (options as any)))
            ? options
            : {
                parent: this.main_element,
                ...options,
            };
        const cell = create_element({
            tag: XbCellElement.custom_element_name,
            set_id: true,
            ...extended_options,
        }) as XbCellElement;
        cell._set_xb(this);
        cell.set_editable(true);
        return cell;
    }


    // === SHOW UNHANDLED EVENT ===

    _show_unhandled_event(event: Event, is_unhandled_rejection: boolean): void {
        ConfirmDialog.run('now is the time for all good men to come to the aid of their party').then(console.log);//!!!
        const message = `Unhandled ${is_unhandled_rejection ? 'rejection' : 'error'}: ${(event as any)?.reason?.message}`;
        AlertDialog.run(message);
    }
}
(globalThis as any).XbManager = XbManager;//!!!
