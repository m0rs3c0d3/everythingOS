// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Clock Agent
// System time, scheduling, and cron-like task execution
// Foundation agent that all other agents can depend on for timing
// ═══════════════════════════════════════════════════════════════════════════════

import { Agent, AgentConfig } from '../../runtime/Agent';
import { eventBus } from '../../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: CronSchedule | IntervalSchedule;
  event: string;
  payload?: unknown;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  maxRuns?: number;
}

export interface CronSchedule {
  type: 'cron';
  expression: string;  // Simplified: "* * * * *" (min hour dom mon dow)
}

export interface IntervalSchedule {
  type: 'interval';
  ms: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clock Agent
// ─────────────────────────────────────────────────────────────────────────────

export class ClockAgent extends Agent {
  private tasks: Map<string, ScheduledTask> = new Map();
  private taskTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private worldTick = 0;
  private startTime = 0;
  private taskCounter = 0;

  constructor(config?: Partial<AgentConfig>) {
    super({
      id: 'clock',
      name: 'Clock Agent',
      type: 'foundation',
      description: 'System time, scheduling, and cron-like task execution',
      tickRate: 1000, // 1 second tick for world time
      ...config,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  protected async onStart(): Promise<void> {
    this.startTime = Date.now();
    this.worldTick = 0;

    // Listen for task management events
    this.subscribe('clock:schedule', (event) => {
      const task = event.payload as Omit<ScheduledTask, 'id' | 'runCount'>;
      this.scheduleTask(task);
    });

    this.subscribe('clock:unschedule', (event) => {
      const { taskId } = event.payload as { taskId: string };
      this.unscheduleTask(taskId);
    });

    this.subscribe('clock:enable', (event) => {
      const { taskId } = event.payload as { taskId: string };
      this.enableTask(taskId);
    });

    this.subscribe('clock:disable', (event) => {
      const { taskId } = event.payload as { taskId: string };
      this.disableTask(taskId);
    });

    this.log('info', 'Clock agent started');
    this.emit('clock:started', { startTime: this.startTime });
  }

  protected async onStop(): Promise<void> {
    // Clear all task timers
    for (const timer of this.taskTimers.values()) {
      clearTimeout(timer);
    }
    this.taskTimers.clear();

    this.log('info', 'Clock agent stopped');
    this.emit('clock:stopped', { uptime: this.getUptime() });
  }

  protected async onTick(): Promise<void> {
    this.worldTick++;

    // Emit world tick event
    this.emit('world:tick', {
      tick: this.worldTick,
      timestamp: Date.now(),
      uptime: this.getUptime(),
    });

    // Check cron tasks (simplified check every tick)
    this.checkCronTasks();

    // Emit time markers
    if (this.worldTick % 60 === 0) {
      this.emit('clock:minute', { minute: Math.floor(this.worldTick / 60) });
    }
    if (this.worldTick % 3600 === 0) {
      this.emit('clock:hour', { hour: Math.floor(this.worldTick / 3600) });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task Scheduling
  // ─────────────────────────────────────────────────────────────────────────

  scheduleTask(task: Omit<ScheduledTask, 'id' | 'runCount'>): string {
    const id = `task_${++this.taskCounter}_${Date.now()}`;
    
    const fullTask: ScheduledTask = {
      ...task,
      id,
      runCount: 0,
      nextRun: this.calculateNextRun(task.schedule),
    };

    this.tasks.set(id, fullTask);

    if (fullTask.enabled && fullTask.schedule.type === 'interval') {
      this.startIntervalTask(fullTask);
    }

    this.log('info', `Task scheduled: ${task.name} (${id})`);
    this.emit('clock:task:scheduled', { task: fullTask });

    return id;
  }

  unscheduleTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Clear timer
    const timer = this.taskTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(taskId);
    }

    this.tasks.delete(taskId);
    this.log('info', `Task unscheduled: ${task.name}`);
    this.emit('clock:task:unscheduled', { taskId });

    return true;
  }

  enableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.enabled = true;
    task.nextRun = this.calculateNextRun(task.schedule);

    if (task.schedule.type === 'interval') {
      this.startIntervalTask(task);
    }

    this.emit('clock:task:enabled', { taskId });
    return true;
  }

  disableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.enabled = false;

    const timer = this.taskTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(taskId);
    }

    this.emit('clock:task:disabled', { taskId });
    return true;
  }

  private startIntervalTask(task: ScheduledTask): void {
    if (task.schedule.type !== 'interval') return;

    const runTask = () => {
      if (!task.enabled) return;
      if (task.maxRuns && task.runCount >= task.maxRuns) {
        this.disableTask(task.id);
        return;
      }

      this.executeTask(task);

      // Schedule next run
      const timer = setTimeout(runTask, task.schedule.ms);
      this.taskTimers.set(task.id, timer);
    };

    const timer = setTimeout(runTask, task.schedule.ms);
    this.taskTimers.set(task.id, timer);
  }

  private checkCronTasks(): void {
    const now = Date.now();

    for (const task of this.tasks.values()) {
      if (!task.enabled) continue;
      if (task.schedule.type !== 'cron') continue;
      if (task.nextRun && now < task.nextRun) continue;
      if (task.maxRuns && task.runCount >= task.maxRuns) continue;

      this.executeTask(task);
      task.nextRun = this.calculateNextRun(task.schedule);
    }
  }

  private executeTask(task: ScheduledTask): void {
    task.lastRun = Date.now();
    task.runCount++;

    this.emit(task.event, {
      ...task.payload,
      _taskId: task.id,
      _taskName: task.name,
      _runCount: task.runCount,
    });

    this.emit('clock:task:executed', {
      taskId: task.id,
      taskName: task.name,
      runCount: task.runCount,
    });
  }

  private calculateNextRun(schedule: CronSchedule | IntervalSchedule): number {
    if (schedule.type === 'interval') {
      return Date.now() + schedule.ms;
    }

    // Simplified cron: just return next minute for now
    // Full implementation would parse cron expression
    const now = new Date();
    now.setSeconds(0);
    now.setMilliseconds(0);
    now.setMinutes(now.getMinutes() + 1);
    return now.getTime();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Time Utilities
  // ─────────────────────────────────────────────────────────────────────────

  getTime(): number {
    return Date.now();
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  getWorldTick(): number {
    return this.worldTick;
  }

  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Schedule an event to fire once after a delay
   */
  setTimeout(event: string, delayMs: number, payload?: unknown): string {
    return this.scheduleTask({
      name: `timeout_${event}`,
      schedule: { type: 'interval', ms: delayMs },
      event,
      payload,
      enabled: true,
      maxRuns: 1,
    });
  }

  /**
   * Schedule an event to fire repeatedly at an interval
   */
  setInterval(event: string, intervalMs: number, payload?: unknown): string {
    return this.scheduleTask({
      name: `interval_${event}`,
      schedule: { type: 'interval', ms: intervalMs },
      event,
      payload,
      enabled: true,
    });
  }

  /**
   * Clear a timeout or interval
   */
  clearTimeout(taskId: string): boolean {
    return this.unscheduleTask(taskId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────

  getStatus(): {
    uptime: number;
    worldTick: number;
    taskCount: number;
    activeTasks: number;
  } {
    return {
      uptime: this.getUptime(),
      worldTick: this.worldTick,
      taskCount: this.tasks.size,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
    };
  }
}
