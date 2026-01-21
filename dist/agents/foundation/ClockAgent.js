"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Clock Agent
// System time management and scheduling
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClockAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const WorldStateManager_1 = require("../../core/WorldStateManager");
class ClockAgent extends BaseAgent_1.BaseAgent {
    tasks = new Map();
    timeZone = 'UTC';
    constructor() {
        super({
            id: 'clock',
            name: 'Clock Agent',
            tier: 'foundation',
            description: 'System time management and scheduling',
            version: '1.0.0',
        });
        this.tickRate = 100; // Check every 100ms for precision
    }
    async onStart() {
        this.setGlobal('system_start_time', Date.now());
        this.emit('clock:started', { timestamp: Date.now() });
    }
    async onStop() {
        this.tasks.clear();
        this.emit('clock:stopped', { timestamp: Date.now() });
    }
    async onTick() {
        const now = Date.now();
        // Update system time globals
        this.setGlobal('current_time', now);
        this.setGlobal('uptime', now - (this.getGlobal('system_start_time') || now));
        // Emit time events
        this.emitTimeEvents(now);
        // Process scheduled tasks
        for (const [id, task] of this.tasks) {
            if (task.enabled && now >= task.nextRun) {
                this.executeTask(task);
                // Schedule next run
                if (task.interval) {
                    task.nextRun = now + task.interval;
                }
                else if (task.cron) {
                    task.nextRun = this.getNextCronRun(task.cron);
                }
                else {
                    // One-time task, disable it
                    task.enabled = false;
                }
                task.lastRun = now;
            }
        }
        // Emit tick pulse
        this.emit('clock:pulse', { timestamp: now, tick: WorldStateManager_1.worldState.getTick() });
    }
    emitTimeEvents(now) {
        const date = new Date(now);
        const seconds = date.getSeconds();
        const minutes = date.getMinutes();
        const hours = date.getHours();
        // Every second
        this.emit('clock:second', { timestamp: now, second: seconds });
        // Every minute
        if (seconds === 0) {
            this.emit('clock:minute', { timestamp: now, minute: minutes });
        }
        // Every hour
        if (minutes === 0 && seconds === 0) {
            this.emit('clock:hour', { timestamp: now, hour: hours });
        }
        // Midnight
        if (hours === 0 && minutes === 0 && seconds === 0) {
            this.emit('clock:midnight', { timestamp: now, date: date.toISOString().split('T')[0] });
        }
    }
    executeTask(task) {
        this.emit(task.callback, {
            taskId: task.id,
            taskName: task.name,
            scheduledTime: task.nextRun,
            actualTime: Date.now(),
            payload: task.payload,
        });
    }
    getNextCronRun(cron) {
        // Simplified cron parser - supports: */n for intervals
        const parts = cron.split(' ');
        const now = new Date();
        // Very basic: just handle */n minute patterns for now
        if (parts[0]?.startsWith('*/')) {
            const interval = parseInt(parts[0].slice(2), 10);
            const currentMinute = now.getMinutes();
            const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
            const next = new Date(now);
            next.setMinutes(nextMinute % 60);
            next.setSeconds(0);
            next.setMilliseconds(0);
            if (nextMinute >= 60) {
                next.setHours(next.getHours() + 1);
            }
            return next.getTime();
        }
        // Default: next minute
        return now.getTime() + 60000;
    }
    // Public API
    schedule(task) {
        const id = task.id || `task_${Date.now()}`;
        const scheduledTask = {
            ...task,
            id,
            nextRun: task.interval
                ? Date.now() + task.interval
                : task.cron
                    ? this.getNextCronRun(task.cron)
                    : Date.now(),
            enabled: true,
        };
        this.tasks.set(id, scheduledTask);
        this.emit('clock:task_scheduled', { taskId: id, taskName: task.name });
        return id;
    }
    cancelTask(taskId) {
        const deleted = this.tasks.delete(taskId);
        if (deleted) {
            this.emit('clock:task_cancelled', { taskId });
        }
        return deleted;
    }
    enableTask(taskId) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.enabled = true;
        }
    }
    disableTask(taskId) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.enabled = false;
        }
    }
    getTasks() {
        return Array.from(this.tasks.values());
    }
    getTime() {
        const now = Date.now();
        return {
            timestamp: now,
            iso: new Date(now).toISOString(),
            unix: Math.floor(now / 1000),
        };
    }
    setTimeZone(tz) {
        this.timeZone = tz;
        this.emit('clock:timezone_changed', { timezone: tz });
    }
}
exports.ClockAgent = ClockAgent;
//# sourceMappingURL=ClockAgent.js.map