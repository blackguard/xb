import * as commands from './commands';

/** return the initial menu specification
 *  @return {Object} menu specification
 */
export function get_menubar_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Recent documents', collection: [
                // ...
            ] },
            '---',
            { label: 'Clear document',  item: { command: 'clear-all'           } },
            '---',
            { label: 'Save',            item: { command: 'save'                } },
            { label: 'Save as...',      item: { command: 'save-as'             } },
            '---',
            { label: 'Settings...',     item: { command: 'settings'            } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',            item: { command: 'eval-and-refocus'    } },
            { label: 'Eval and stay',   item: { command: 'eval'                } },
            { label: 'Eval before',     item: { command: 'eval-before'         } },
            { label: 'Eval all',        item: { command: 'eval-all'            } },
            '---',
            { label: 'Stop cell',       item: { command: 'stop'                } },
            { label: 'Stop all',        item: { command: 'stop-all'            } },
            '---',
            { label: 'Reset cell',      item: { command: 'reset'               } },
            { label: 'Reset all',       item: { command: 'reset-all'           } },
            '---',
            { label: 'Focus up',        item: { command: 'focus-up'            } },
            { label: 'Focus down',      item: { command: 'focus-down'          } },
            '---',
            { label: 'Move up',         item: { command: 'move-up'             } },
            { label: 'Move down',       item: { command: 'move-down'           } },
            { label: 'Add before',      item: { command: 'add-before'          } },
            { label: 'Add after',       item: { command: 'add-after'           } },
            { label: 'Delete',          item: { command: 'delete'              } },
        ] },

        { label: 'Mode', collection: [
            { label: 'Plain text',      item: { command: 'set-mode-plain'      } },
            { label: 'Markdown',        item: { command: 'set-mode-markdown'   } },
            { label: 'TeX',             item: { command: 'set-mode-tex'        } },
            { label: 'JavaScript',      item: { command: 'set-mode-javascript' } },
        ] },

        { label: 'View', collection: [
            { label: 'Normal',          item: { command: 'set-view-normal'     } },
            { label: 'Hide',            item: { command: 'set-view-hide'       } },
            { label: 'Full',            item: { command: 'set-view-full'       } },
            { label: 'None',            item: { command: 'set-view-none'       } },
            { label: 'Kiosk',           item: { command: 'set-view-kiosk'      } },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',         item: { command: 'help',               } },
        ] },
    ];
}

export function get_ellipsis_menu_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Recent documents', collection: [
                // ...
            ] },
            '---',
            { label: 'Clear document',  item: { command: 'clear-all'           } },
            '---',
            { label: 'Save',            item: { command: 'save'                } },
            { label: 'Save as...',      item: { command: 'save-as'             } },
            '---',
            { label: 'Settings...',     item: { command: 'settings'            } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',            item: { command: 'eval-and-refocus'    } },
            { label: 'Eval and stay',   item: { command: 'eval'                } },
            { label: 'Eval before',     item: { command: 'eval-before'         } },
            { label: 'Eval all',        item: { command: 'eval-all'            } },
            '---',
            { label: 'Stop cell',       item: { command: 'stop'                } },
            { label: 'Stop all',        item: { command: 'stop-all'            } },
            '---',
            { label: 'Reset cell',      item: { command: 'reset'               } },
            { label: 'Reset all',       item: { command: 'reset-all'           } },
            '---',
            { label: 'Focus up',        item: { command: 'focus-up'            } },
            { label: 'Focus down',      item: { command: 'focus-down'          } },
            '---',
            { label: 'Move up',         item: { command: 'move-up'             } },
            { label: 'Move down',       item: { command: 'move-down'           } },
            { label: 'Add before',      item: { command: 'add-before'          } },
            { label: 'Add after',       item: { command: 'add-after'           } },
            { label: 'Delete',          item: { command: 'delete'              } },
        ] },

        { label: 'Mode', collection: [
            { label: 'Plain text',      item: { command: 'set-mode-plain'      } },
            { label: 'Markdown',        item: { command: 'set-mode-markdown'   } },
            { label: 'TeX',             item: { command: 'set-mode-tex'        } },
            { label: 'JavaScript',      item: { command: 'set-mode-javascript' } },
        ] },

        { label: 'View', collection: [
            { label: 'Normal',          item: { command: 'set-view-normal'     } },
            { label: 'Hide',            item: { command: 'set-view-hide'       } },
            { label: 'Full',            item: { command: 'set-view-full'       } },
            { label: 'None',            item: { command: 'set-view-none'       } },
            { label: 'Kiosk',           item: { command: 'set-view-kiosk'      } },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',         item: { command: 'help',               } },
        ] },
    ];
}


/** return the initial key map bindings
 *  @return {Object} mapping from command strings to arrays of triggering key sequences
 */
export function get_global_initial_key_map_bindings() {
    return {
        'reset':               [ 'CmdOrCtrl-Shift-#' ],
        'reset-all':           [ 'CmdOrCtrl-Alt-Shift-#' ],
        'clear-all':           [ 'CmdOrCtrl-Shift-!' ],

        'cut':                 [ 'CmdOrCtrl-X' ],
        'copy':                [ 'CmdOrCtrl-C' ],
        'paste':               [ 'CmdOrCtrl-V' ],

        'save':                [ 'CmdOrCtrl-S' ],
        'save-as':             [ 'CmdOrCtrl-Shift-S' ],

        'eval':                [ 'CmdOrCtrl-Enter' ],
        'eval-and-refocus':    [ 'Shift-Enter' ],
        'eval-before':         [ 'CmdOrCtrl-Shift-Enter' ],
        'eval-all':            [ 'CmdOrCtrl-Shift-Alt-Enter' ],

        'stop':                [ 'CmdOrCtrl-Shift-$' ],
        'stop-all':            [ 'CmdOrCtrl-Shift-Alt-$' ],

        'focus-up':            [ 'Alt-Up' ],
        'focus-down':          [ 'Alt-Down' ],

        'move-up':             [ 'CmdOrCtrl-Alt-Up' ],
        'move-down':           [ 'CmdOrCtrl-Alt-Down' ],
        'add-before':          [ 'CmdOrCtrl-Alt-Shift-Up' ],
        'add-after':           [ 'CmdOrCtrl-Alt-Shift-Down' ],
        'delete':              [ 'CmdOrCtrl-Alt-Backspace' ],

        'set-mode-plain':      [ 'Alt-M t', 'Alt-M p' ],
        'set-mode-markdown':   [ 'Alt-M m' ],
        'set-mode-tex':        [ 'Alt-M x' ],
        'set-mode-javascript': [ 'Alt-M j' ],

        'set-view-normal':     [ 'Alt-V n' ],
        'set-view-hide':       [ 'Alt-V h' ],
        'set-view-full':       [ 'Alt-V f' ],
        'set-view-none':       [ 'Alt-V x' ],
        'set-view-kiosk':      [ 'Alt-V k' ],

        'settings':            [ 'CmdOrCtrl-,' ],
        'help':                [ 'F1' ],
    };
}

/** return global command bindings
 *  @return {Object} mapping from command strings to functions implementing that command
 * The handler functions are taken from the commands argument.
 */
export function get_global_command_bindings() {
    const command_bindings = {
        'reset':               commands.command_handler__reset,
        'reset-all':           commands.command_handler__reset_all,
        'clear-all':           commands.command_handler__clear_all,

        'save':                commands.command_handler__save,
        'save-as':             commands.command_handler__save_as,

        'cut':                 commands.command_handler__cut,
        'copy':                commands.command_handler__copy,
        'paste':               commands.command_handler__paste,

        'eval':                commands.command_handler__eval,
        'eval-and-refocus':    commands.command_handler__eval_and_refocus,
        'eval-before':         commands.command_handler__eval_before,
        'eval-all':            commands.command_handler__eval_all,

        'stop':                commands.command_handler__stop,
        'stop-all':            commands.command_handler__stop_all,

        'focus-up':            commands.command_handler__focus_up,
        'focus-down':          commands.command_handler__focus_down,

        'move-up':             commands.command_handler__move_up,
        'move-down':           commands.command_handler__move_down,
        'add-before':          commands.command_handler__add_before,
        'add-after':           commands.command_handler__add_after,
        'delete':              commands.command_handler__delete,

        'set-mode-plain':      commands.command_handler__set_mode_plain,
        'set-mode-markdown':   commands.command_handler__set_mode_markdown,
        'set-mode-tex':        commands.command_handler__set_mode_tex,
        'set-mode-javascript': commands.command_handler__set_mode_javascript,

        'set-view-normal':     commands.command_handler__set_view_normal,
        'set-view-hide':       commands.command_handler__set_view_hide,
        'set-view-full':       commands.command_handler__set_view_full,
        'set-view-none':       commands.command_handler__set_view_none,
        'set-view-kiosk':      commands.command_handler__set_view_kiosk,

        'settings':            commands.command_handler__show_settings_dialog,
        'help':                commands.command_handler__show_help,
    };

    return command_bindings;
}
