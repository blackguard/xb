import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';


export type StopState = {
    activity: Activity,
}

export type ObjectWithStopMethod = {
    stop: () => any,
}

export class Activity {
    #stop_states = new SerialDataSource<StopState>();
    get stop_states () { return this.#stop_states; }

    #target:         undefined|ObjectWithStopMethod;
    #multiple_stops: boolean;
    #stop_count:     number;

    get target         (){ return this.#target; }
    get multiple_stops (){ return this.#multiple_stops; }
    get stop_count     (){ return this.#stop_count; }
    get stopped        (){ return (!this.#multiple_stops && this.#stop_count > 0); }


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
     * (in its role as an Activity) after calling super().
     */
    protected _set_target(target: ObjectWithStopMethod) {
        if (this.target) {
            throw new Error('Activity._set_target called but this.target is already set');
        } else {
            this.#target = target;
        }
    }

    /** stop this activity.
     * No action is performed if the activity has already been stopped.
     * (Note that an activity with multiple_stops = true will never become
     * stopped.)  Otherwise, if not stopped, then this.target is (attempted
     * to be) stopped, this.stop_count is incremented, and an event is
     * dispatched through this.stopped_states.
     */
    stop(): void {
        if (!this.stopped) {
            this.#stop_count++;
            try {
                if (this.target && this.target !== this) {  // prevent endless recursion in the case where this ActivityManager is its own target
                    this.target.stop();
                }
            } catch (error) {
                console.error('error while stopping', this, error);
            } finally {
                this.stop_states.dispatch({
                    activity: this,
                });
            }
        }
    }
}


/** ActivityManager can be used hierarchically, i.e., an ActivityManager can be
 * added to a different ActivityManager as an Activity,
 */
export class ActivityManager extends Activity {
    #children: Array<Activity>;  // managed Activity objects
    #stopped:  boolean;          // true iff !this.multiple_stops and this.stop() has been called, false otherwise

    constructor(multiple_stops: boolean = false) {
        super(undefined, multiple_stops);
        super._set_target(this);  // cannot call super(this), so do it this way
        this.#children = [];
        this.#stopped  = false;
    }

    /** add an Activity to this.#children
     *  @param {Activity} activity
     * If activity is already present, then do nothing.
     */
    add_activity(activity: Activity): void {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        if (activity === this) {
            throw new Error('cannot this.add_activity() to itself');
        }
        if (!this.#children.includes(activity)) {
            this.#children.push(activity);
        }
    }

    /** remove an Activity object from this.#children
     *  @param {Activity} activity
     *  @return {Boolean} found and removed?
     */
    remove_activity(activity: Activity): boolean {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        const index = this.#children.indexOf(activity);
        if (index === -1) {
            return false;
        } else {
            this.#children.splice(index, 1);
            return true;
        }
    }

    /** manage the given Activity object.
     *  @param {Activity} activity
     *  @param {Function|undefined} stop_action to be called when activity stopped
     * First, perform this.add_activity(activity).  Later, if a stop_states
     * event for the activity occurs, call stop_action (if given) and finally
     * call this.remove_activity(activity).  Note that stop_action will be
     * called (if given) even if the activity was already removed
     * (which can occur if this manager object was stopped or if
     * this.remove_activity(activity) was already called).
     */
    manage_activity(activity: Activity, stop_action?: () => void): void {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        if (!['undefined', 'function'].includes(typeof stop_action)) {
            throw new Error('stop_action must be undefined or a function');
        }
        this.add_activity(activity);
        const subscription = activity.stop_states.subscribe((state: StopState) => {
            subscription.unsubscribe();  // one-shot
            stop_action?.();
            this.remove_activity(activity);
        });
    }

    /** Stop and remove any activity objects from this.#children,
     * then stop this manager object by calling super.stop().
     */
    stop(): void {
        while (this.#children.length > 0) {
            const activity: undefined|Activity = this.#children.pop();
            activity?.stop();  // note: typescript cannot tell here that activity is not undefined
        }
        super.stop();
    }


    // === DIAGNOSTICS ===

    /** @return {ActivityTree} tree rooted at this ActivityManager
     * For each recursive level, if children is undefined, then that
     * level is an Activity but not an ActivityManager.  Otherwise,
     * if children is not undefined, then that level is an ActivityManager
     * with children as its children.
     */
    tree(): ActivityTree {
        function walk(activity: Activity): ActivityTree {
            return {
                activity,
                children: (activity instanceof ActivityManager)
                    ? activity.#children.map(walk)
                    : undefined,
            };
        }
        return walk(this);
    }

    /** @return {Array} tree rooted at this ActivityManager represented
     * as nested arrays.  Each leaf is a non-ActivityManager Activity,
     * and each array, which represents an ActivityManager, has an additional
     * property "m" that is the associated ActivityManager.
     */
    simple_tree(): any {
        function walk(activity: Activity): any {
            if (!(activity instanceof ActivityManager)) {
                return activity;
            } else {
                const c = activity.#children.map(walk);
                (c as any).m = activity;
                return c;
            }
        }
        return walk(this);
    }
}

export type ActivityTree = {
    activity:  Activity,
    children?: ActivityTree[],  // if not undefined, then activity is an ActivityManager
};
