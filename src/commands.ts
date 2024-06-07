// === COMMAND HANDLERS ===

import {
    XbManager,
} from 'src/xb-manager';

import {
    CellElement,
} from 'src/cell-element/_';

import {
    CommandContext,
} from 'lib/ui/key/_';

import {
    TextOrientedRenderer,
} from 'src/renderer/_';

import {
    move_node,
} from 'lib/ui/dom-tools';

import {
    ConfirmDialog,
} from 'lib/ui/dialog/_';

import {
    SettingsDialog,
} from 'src/settings/settings-dialog/_';

import {
    open_help_window,
} from 'src/help-window/_';


// These command_handler__* functions each return a boolean, true iff the command was successfully handled


export function command_handler__reset(command_context: CommandContext): boolean {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        command_context.target.reset();
        return true;
    }
}

export function command_handler__reset_all(command_context: CommandContext): boolean {
    command_context.xb.reset();
    return true;
}

export async function command_handler__clear_all(command_context: CommandContext): Promise<boolean> {
    if (!await ConfirmDialog.run('Clear document?')) {
        command_context.xb.active_cell?.focus();
        return false;
    }
    command_context.xb.clear();
    return true;
}

export async function command_handler__save(command_context: CommandContext): Promise<boolean> {
    return command_context.xb.perform_save();
}

export async function command_handler__save_as(command_context: CommandContext): Promise<boolean> {
    return command_context.xb.perform_save(true);
}

export async function command_handler__eval(command_context: CommandContext): Promise<boolean> {
    const cell = command_context.target;
    if (!(cell instanceof CellElement)) {
        return false;
    } else {
        try {
            await command_context.xb.invoke_renderer_for_type(cell.type, undefined, cell);
        } catch (error: unknown) {
            console.error('error rendering cell', error, cell);
            return false;
        }
        return true;
    }
}

/** eval target cell and refocus to next cell (or a new one if at the end of the document)
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval_and_refocus(command_context: CommandContext): Promise<boolean> {
    const eval_result = await command_handler__eval(command_context);
    if (!eval_result) {
        return false;
    } else {
        const next_cell = command_context.xb.adjacent_cell(command_context.target as CellElement, true) ?? command_context.xb.create_cell();
        next_cell.focus();
        next_cell.scroll_into_view();
        return true;
    }
}

async function multi_eval_helper(command_context: CommandContext, eval_all: boolean = false): Promise<boolean> {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        const target_cell = command_context.target;
        const cells = command_context.xb.get_cells();
        if (!eval_all && cells.indexOf(target_cell) === -1) {
            return true;  // don't fail, but also don't do anything if !eval_all and cell is not in cells
        } else {
            command_context.xb.stop();  // stop any previously-running renderers
            command_context.xb.reset_global_state();
            for (const iter_cell of cells) {
                iter_cell.focus();
                if (!eval_all && iter_cell === target_cell) {
                    break;  // only eval cells before target_cell if !eval_all
                }
                try {
                    await command_context.xb.invoke_renderer_for_type(iter_cell.type, undefined, iter_cell);
                } catch (error: unknown) {
                    console.error('error rendering cell', error, iter_cell);
                    return false;
                }
            }
            return true;
        }
    }
}

/** reset global eval context and then eval all cells in the document
 *  from the beginning up to but not including the target cell.
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval_before(command_context: CommandContext): Promise<boolean> {
    return multi_eval_helper(command_context, false);
}

/** stop all running evaluations, reset global eval context and then eval all cells in the document
 *  from first to last, and set focus to the last.
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval_all(command_context: CommandContext): Promise<boolean> {
    return multi_eval_helper(command_context, true);
}

/** stop evaluation for the active cell.
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__stop(command_context: CommandContext): boolean {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        command_context.target.stop();
        return true;
    }
}

/** stop all running evaluations.
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__stop_all(command_context: CommandContext): boolean {
    command_context.xb.stop();
    return true;
}

export function command_handler__focus_up(command_context: CommandContext): boolean {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        const focus_cell = command_context.xb.adjacent_cell(command_context.target, false);
        if (!focus_cell) {
            return false;
        } else {
            focus_cell.focus();
            focus_cell.scroll_into_view();
            return true;
        }
    }
}

export function command_handler__focus_down(command_context: CommandContext): boolean {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        const focus_cell = command_context.xb.adjacent_cell(command_context.target, true);
        if (!focus_cell) {
            return false;
        } else {
            focus_cell.focus();
            focus_cell.scroll_into_view();
            return true;
        }
    }
}

function move_helper(command_context: CommandContext, move_down: boolean): boolean {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        const cell = command_context.target;
        let before = command_context.xb.adjacent_cell(cell, move_down);
        if (!before) {
            return false;
        } else {
            if (move_down) {
                before = command_context.xb.adjacent_cell(before, move_down);
            }
            const parent = before ? before.parentElement : command_context.xb.cell_parent;
            move_node(cell, { parent, before });
            cell.focus();
            cell.scroll_into_view();
            return true;
        }
    }
}

export function command_handler__move_up(command_context: CommandContext): boolean {
    return move_helper(command_context, false);
}

export function command_handler__move_down(command_context: CommandContext): boolean {
    return move_helper(command_context, true);
}

function add_cell_helper(command_context: CommandContext, add_before: boolean) {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        const this_cell = command_context.target;
        const before = add_before
            ? this_cell
            : command_context.xb.adjacent_cell(this_cell, true);
        const parent = before ? before.parentElement : command_context.xb.cell_parent;
        const new_cell = command_context.xb.create_cell({ before, parent });
        if (!new_cell) {
            return false;
        } else {
            new_cell.focus();
            return true;
        }
    }
}

export function command_handler__add_before(command_context: CommandContext): boolean {
    return add_cell_helper(command_context, true);
}

export function command_handler__add_after(command_context: CommandContext): boolean {
    return add_cell_helper(command_context, false);
}

export async function command_handler__delete(command_context: CommandContext): Promise<boolean> {
    if (!(command_context.target instanceof CellElement)) {
        return false;
    } else {
        const cell = command_context.target;
        if (cell.get_text().trim().length > 0) {
            if (!await ConfirmDialog.run('Cannot undo delete of non-empty cell.\nContinue?')) {
                cell.focus();
                return false;
            }
        }
        let next_cell = command_context.xb.adjacent_cell(cell, true) ?? command_context.xb.adjacent_cell(cell, false);
        cell.remove();
        if (!next_cell) {
            next_cell = command_context.xb.create_cell();
        }
        next_cell.focus();
        next_cell.scroll_into_view();
        return true;
    }
}

function set_mode_helper(command_context: CommandContext, type: string) {
    const cell = command_context.target;
    if (!(cell instanceof CellElement)) {
        return false;
    } else {
        cell.type = type;
        return true;
    }
}

/** set the active cell's type to "markdown".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_mode_markdown(command_context: CommandContext): boolean {
    return set_mode_helper(command_context, 'markdown');
}

/** set the active cell's type to "tex".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_mode_tex(command_context: CommandContext): boolean {
    return set_mode_helper(command_context, 'tex');
}

/** set the active cell's type to "javascript".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_mode_javascript(command_context: CommandContext): boolean {
    return set_mode_helper(command_context, 'javascript');
}

/** set the active cell's type to "plain".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_mode_plain(command_context: CommandContext): boolean {
    return set_mode_helper(command_context, 'plain');
}

function set_view_helper(command_context: CommandContext, view: string): boolean {
    document.documentElement.setAttribute('data-cell-view', view);
    return true;
}

/** set the document view to "normal".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_normal(command_context: CommandContext): boolean {
    return set_view_helper(command_context, 'normal');
}

/** set the document view to "hide".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_hide(command_context: CommandContext): boolean {
    return set_view_helper(command_context, 'hide');
}

/** set the document view to "full".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_full(command_context: CommandContext): boolean {
    return set_view_helper(command_context, 'full');
}

/** set the document view to "none".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_none(command_context: CommandContext): boolean {
    return set_view_helper(command_context, 'none');
}

export function command_handler__show_settings_dialog(command_context: CommandContext): boolean {
    SettingsDialog.run();
    return true;
}

export function command_handler__show_help(command_context: CommandContext): boolean {
    open_help_window();
    return true;
}
