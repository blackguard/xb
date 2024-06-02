import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';


export type ObjectWithStopMethod = {
    stop: () => any,
}

export class Activity {
    #target:         undefined|ObjectWithStopMethod;
    #multiple_stops: boolean;
    #stop_count:     number;

    get target         (){ return this.#target; }
    get multiple_stops (){ return this.#multiple_stops; }
    get stop_count     (){ return this.#stop_count; }
    get stopped        (){ return (this.#stop_count > 0); }


    /** create a new object representing an Activity,
     *  i.e., a something that is running and can be stopped
     *  @param {ObjectWithStopMethod} target the underlying object that may be stopped
     *  @param {Boolean} multiple_stops whether or not target's stop method may be called multiple times
     */
    constructor( target?:        ObjectWithStopMethod,
                 multiple_stops: boolean = false ) {
        this.#target         = target;
        this.#multiple_stops = multiple_stops;
        this.#stop_count     = 0;
    }

    /** this method is for use only by ActivityManager.  ActivityManager is also
     * an Activity, but the ActivityManager constructor cannot call super(this)
     * -- 'super' must be called before accessing 'this' -- so the ActivityManager
     * constructor calls this method after the super() call to set its own target
     * (in its role as an Activty) after calling super().
     */
    protected _set_target(target: ObjectWithStopMethod) {
        if (this.target) {
            throw new Error('Activity.__set_target called but this.target is already set');
        } else {
            this.#target = target;
        }
    }

    stop(): void {
        if (!this.stopped || this.multiple_stops) {
            try {
                this.target?.stop();
            } catch (error) {
                console.error('error while stopping', this.target, error);
            }
            this.#stop_count++;
        }
    }
}


export type StopState = {
    activity_manager: ActivityManager,
    stopped_targets:  ObjectWithStopMethod[],
}

/** ActivityManager can be used hierarchically, i.e., an ActivityManager can be
 * added to different ActivityManager as an Activity,
 */
export class ActivityManager extends Activity {
    #stop_states = new SerialDataSource<StopState>();
    get stop_states (){ return this.#stop_states; }

    #activity_objects: Array<Activity>;  // managed Activity objects
    #stopped:          boolean;          // true iff !this.multiple_stops and this.stop() has been called, false otherwise

    constructor(multiple_stops: boolean = false) {
        super(undefined, multiple_stops);
        super._set_target(this);  // cannot call super(this), so do it this way
        this.#activity_objects = [];
        this.#stopped          = false;
    }

    /** Overrides Activity.stopped().
     *  If this.multiple_stops, then this.stopped will never become true
     */
    get stopped (){ return this.#stopped; }

    /** add an Activity to this.#activity_objects
     *  @param {Activity} activity
     */
    add_activity(activity: Activity): void {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        this.#activity_objects.push(activity);
    }

    /** remove an Activity object from this.#activity_objects
     *  @param {Activity} activity
     *  @return {Boolean} found and removed?
     */
    remove_activity(activity: Activity): void {
        const index = this.#activity_objects.indexOf(activity);
        if (index !== -1) {
            this.#activity_objects.splice(index, 1);
        }
    }

    /** Stop and remove all activity objects from this.#activity_objects.
     * If there is anything to actually stop, then an event is dispatched
     * through this.stop_states (after everything was stopped).
     * If this.multiple_stops, then this method can be called multiple times,
     * otherwise only one time.
     */
    stop(): void {
        if (!this.stopped || this.multiple_stops) {
            this.#stopped = !this.multiple_stops;
            if (this.#activity_objects.length > 0) {
                const stopped_targets = this.#activity_objects.filter(ao => !!ao).map(ao => ao.target) as ObjectWithStopMethod[];
                while (this.#activity_objects.length > 0) {
                    const activity: undefined|Activity = this.#activity_objects.pop();
                    activity?.stop();  // note: typescript cannot tell that activity is not undefined
                }
                this.stop_states.dispatch({
                    activity_manager: this,
                    stopped_targets,
                });
            }
        }
    }
}
