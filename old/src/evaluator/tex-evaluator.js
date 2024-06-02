import {
    Activity,
} from 'lib/sys/activity-manager';

import {
    Evaluator,
} from './evaluator';


export class TeXEvaluator extends Evaluator {
    static handled_media_types = [
        'tex',
    ];

    async _perform_eval() {
        const options = {
            style:  undefined,//!!!
            inline: undefined,//!!!
            global_state: this.global_state,
        };
        const renderer = this.ocx.renderer_for_type('tex');
        this.add_activity(new Activity(renderer));
        return this.ocx.invoke_renderer(renderer, this.input_element.get_text(), options);
    }
}
