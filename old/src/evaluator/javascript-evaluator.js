import {
    Activity,
} from 'lib/sys/activity-manager';

import {
    Evaluator,
} from './evaluator';


export class JavaScriptEvaluator extends Evaluator {
    static handled_media_types = [
        'javascript',
    ];

    async _perform_eval() {
        const options = {
            style:  undefined,//!!!
            inline: undefined,//!!!
            global_state: this.global_state,
        };
        const renderer = this.ocx.renderer_for_type('javascript');
        this.add_activity(new Activity(renderer));
        const code = this.input_element.get_text();
        return this.ocx.invoke_renderer(renderer, code, options);
    }
}
