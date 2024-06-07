const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';

import {
    create_element,
} from 'lib/ui/dom-tools';

import {
    Dialog,
    AlertDialog,
    create_control_element,
    create_select_element,
} from 'lib/ui/dialog/_';

import {
    get_obj_path,
    set_obj_path,
} from 'lib/sys/obj-path';

import {
    get_settings,
    update_settings,
    analyze_editor_options_indent,
    analyze_editor_options_tab_size,
    analyze_editor_options_indent_with_tabs,
    analyze_editor_options_tab_key_indents,
    valid_editor_options_mode_values,
    analyze_editor_options_mode,
    analyze_editor_options_line_numbers,
    valid_formatting_options_align_values,
    analyze_formatting_options_align,
    analyze_formatting_options_indent,
    get_valid_theme_values,
    analyze_theme,
} from '../settings';

import {
    beep,
} from 'lib/ui/beep';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./settings-dialog.css', assets_server_url(current_script_url)));
}

// dialog definitiion

const sections = [
    {
        name: 'Appearance',
        settings: [{
            id: 'theme',
            label: 'Theme',
            type: 'select',
            options: get_valid_theme_values().map(value =>({ value, label: value })),
            settings_path: [ 'theme' ],
            analyze: analyze_theme,  // (value, label) => complaint
        }],
    }, {
        name: 'Editor',
        settings: [{
            id: 'editor_options_indent',
            label: 'Indent',
            type: 'text',
            settings_path: [ 'editor_options', 'indent' ],
            analyze: analyze_editor_options_indent,  // (value, label) => complaint
            convert_to_number: true,
        }, {
            id: 'editor_options_tab_size',
            label: 'Tab size',
            type: 'text',
            settings_path: [ 'editor_options', 'tab_size' ],
            analyze: analyze_editor_options_tab_size,  // (value, label) => complaint
            convert_to_number: true,
        }, {
            id: 'editor_options_indent_with_tabs',
            label: 'Indent with tabs',
            type: 'checkbox',
            settings_path: [ 'editor_options', 'indent_with_tabs' ],
            analyze: analyze_editor_options_indent_with_tabs,  // (value, label) => complaint
        }, {
            id: 'editor_options_tab_key_indents',
            label: 'TAB key indents',
            type: 'checkbox',
            settings_path: [ 'editor_options', 'tab_key_indents' ],
            analyze: analyze_editor_options_tab_key_indents,  // (value, label) => complaint
        }, {
            id: 'editor_options_mode',
            label: 'Mode',
            type: 'select',
            options: valid_editor_options_mode_values.map(value => ({ value, label: value })),
            settings_path: [ 'editor_options', 'mode' ],
            analyze: analyze_editor_options_mode,  // (value, label) => complaint
        }, {
            id: 'editor_options_line_numbers',
            label: 'Line numbers',
            type: 'checkbox',
            settings_path: [ 'editor_options', 'line_numbers' ],
            analyze: analyze_editor_options_line_numbers,  // (value, label) => complaint
        }],
    }, {
        name: 'TeX Formatting',
        settings: [{
            id: 'formatting_options_align',
            label: 'Horizontal alignment',
            type: 'select',
            options: valid_formatting_options_align_values.map(value => ({ value, label: value })),
            settings_path: [ 'formatting_options', 'align' ],
            analyze: analyze_formatting_options_align,  // (value, label) => complaint
        }, {
            id: 'formatting_options_indent',
            label: 'Indentation',
            type: 'text',
            settings_path: [ 'formatting_options', 'indent' ],
            analyze: analyze_formatting_options_indent,  // (value, label) => complaint
        }],
    },
];


export class SettingsDialog extends Dialog {
    get CLASS (){ return this.constructor as typeof SettingsDialog; }

    static settings_dialog_css_class = 'settings-dialog';

    static run(message?: string, options?: object): Promise<boolean> {
        return new this().run(message, options);
    }

    _populate_dialog_element(): void {
        const current_settings = get_settings();

        // make this dialog identifiable so that the static method run()
        // can find it if it already exists.
        this._dialog_element?.classList.add(this.CLASS.settings_dialog_css_class);

        if (this._dialog_text_container) {
            this._dialog_text_container.innerText = 'Settings';
        }

        for (const section of sections) {
            const { name, settings } = section;
            const section_div = this._dialog_form_content;

            const named_section_div = create_element({ parent: section_div, attrs: { 'data-section': name } });
            const error_div = create_element({
                parent: section_div,
                attrs: {
                    class: [ 'error-message' ],
                },
            }) as HTMLElement;

            for (const setting of settings) {
                const { id, label, type, settings_path, options, analyze, convert_to_number } = setting;
                const setting_div = named_section_div;
                let control;
                if (type === 'select') {
                    control = create_select_element(setting_div, id, {
                        label,
                        options,
                    });
                } else {
                    control = create_control_element(setting_div, id, {
                        label,
                        type,
                    });
                }

                if (type === 'checkbox') {
                    (control as any).checked = get_obj_path(current_settings, settings_path);
                } else {
                    (control as any).value = get_obj_path(current_settings, settings_path);
                }

                const update_handler = async (event: Event): Promise<void> => {
                    const current_settings = get_settings();

                    const handle_error = async (error_message: string): Promise<void> => {
                        error_div.classList.add('active');
                        error_div.innerText = error_message;
                        const existing_control = document.getElementById(control.id);
                        if (!this.completed && existing_control) {
                            existing_control.focus();
                            if (existing_control instanceof HTMLInputElement && existing_control.type === 'text') {
                                existing_control.select();
                            }
                            await beep();
                        } else {
                            await AlertDialog.run(`settings update failed: ${error_message}`);
                        }
                    };

                    const value = (type === 'checkbox') ? (control as any).checked : (control as any).value;
                    if (analyze) {
                        const complaint = analyze(value, label);
                        if (complaint) {
                            await handle_error(complaint);
                            return;
                        }
                    }
                    set_obj_path(current_settings, settings_path, (convert_to_number ? +value : value));

                    try {
                        await update_settings(current_settings);
                        error_div.classList.remove('active');
                    } catch (error: unknown) {
                        const error_message = (error instanceof Error)
                            ? error.message
                            : 'Error';
                        await handle_error(error_message);
                    }
                };

                control.addEventListener('change', update_handler);
                control.addEventListener('blur',   update_handler);
            }
        }

        // Done button should not cause Enter to automatically submit the form
        // unless directly clicked.
        const accept_button = this._create_terminal_button('Done', true);
        accept_button.onclick = (event: Event) => this._dialog_element?.close();

        if (this._dialog_element) {
            this._dialog_element.onclose = (event: Event) => this._complete();
        }
    }
}
