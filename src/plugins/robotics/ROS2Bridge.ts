// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - ROS2 Bridge
// Bidirectional bridge between EverythingOS and ROS2
// Translates events <-> topics, intents <-> services/actions
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../../core/event-bus/EventBus';
import { WebSocketProtocol } from '../hardware/protocols/WebSocketProtocol';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ROS2BridgeConfig {
  // rosbridge_suite WebSocket connection
  rosbridgeUrl: string;           // e.g., 'ws://localhost:9090'
  
  // Namespace
  namespace?: string;             // Robot namespace prefix
  
  // Auto-subscribe to these topics
  subscriptions?: ROS2Subscription[];
  
  // Map EverythingOS events to ROS2 topics
  eventMappings?: EventTopicMapping[];
  
  // Reconnection
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export interface ROS2Subscription {
  topic: string;
  messageType: string;
  throttleRate?: number;          // Max rate in ms
  queueSize?: number;
  handler?: (message: ROS2Message) => void;
}

export interface EventTopicMapping {
  event: string;                  // EverythingOS event pattern
  topic: string;                  // ROS2 topic
  messageType: string;            // ROS2 message type
  direction: 'to_ros' | 'from_ros' | 'bidirectional';
  transform?: (data: unknown) => unknown;
}

export interface ROS2Message {
  topic: string;
  messageType: string;
  data: unknown;
  timestamp: number;
}

export interface ROS2ServiceRequest {
  service: string;
  serviceType: string;
  args: unknown;
}

export interface ROS2ActionGoal {
  action: string;
  actionType: string;
  goal: unknown;
  feedbackCallback?: (feedback: unknown) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROS2 Bridge Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class ROS2Bridge {
  private config: ROS2BridgeConfig;
  private ws: WebSocketProtocol;
  private connected = false;
  
  // Tracking
  private subscriptions: Map<string, ROS2Subscription> = new Map();
  private pendingServices: Map<string, { resolve: Function; reject: Function }> = new Map();
  private activeActions: Map<string, ROS2ActionGoal> = new Map();
  private messageId = 0;

  constructor(config: ROS2BridgeConfig) {
    this.config = {
      autoReconnect: true,
      reconnectInterval: 5000,
      namespace: '',
      ...config,
    };

    this.ws = new WebSocketProtocol({
      id: 'ros2-bridge',
      type: 'websocket',
      connection: {
        host: new URL(config.rosbridgeUrl).hostname,
        portNumber: parseInt(new URL(config.rosbridgeUrl).port) || 9090,
        path: '/',
        protocol: config.rosbridgeUrl.startsWith('wss') ? 'wss' : 'ws',
      },
      messageFormat: 'json',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    await this.ws.connect();
    this.connected = true;
    
    // Handle incoming messages
    this.ws.onMessage((msg) => {
      try {
        const data = JSON.parse(msg.data.toString());
        this.handleRosbridgeMessage(data);
      } catch (error) {
        this.log('error', `Failed to parse message: ${error}`);
      }
    });

    // Set up error handling
    this.ws.onError((error) => {
      this.log('error', `WebSocket error: ${error.message}`);
      this.connected = false;
    });

    // Subscribe to configured topics
    if (this.config.subscriptions) {
      for (const sub of this.config.subscriptions) {
        await this.subscribe(sub);
      }
    }

    // Set up event mappings
    this.setupEventMappings();

    this.log('info', `Connected to ROS2 bridge at ${this.config.rosbridgeUrl}`);
    eventBus.emit('ros2:connected', { url: this.config.rosbridgeUrl });
  }

  async disconnect(): Promise<void> {
    // Unsubscribe all
    for (const topic of this.subscriptions.keys()) {
      await this.unsubscribe(topic);
    }
    
    await this.ws.disconnect();
    this.connected = false;
    
    eventBus.emit('ros2:disconnected', {});
  }

  isConnected(): boolean {
    return this.connected && this.ws.isConnected();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Topics (Pub/Sub)
  // ─────────────────────────────────────────────────────────────────────────

  async subscribe(subscription: ROS2Subscription): Promise<void> {
    const topic = this.namespaceTopic(subscription.topic);
    
    const msg = {
      op: 'subscribe',
      id: `sub_${++this.messageId}`,
      topic,
      type: subscription.messageType,
      throttle_rate: subscription.throttleRate ?? 0,
      queue_length: subscription.queueSize ?? 1,
    };

    await this.send(msg);
    this.subscriptions.set(topic, subscription);
    
    this.log('debug', `Subscribed to ${topic}`);
  }

  async unsubscribe(topic: string): Promise<void> {
    topic = this.namespaceTopic(topic);
    
    await this.send({
      op: 'unsubscribe',
      topic,
    });
    
    this.subscriptions.delete(topic);
  }

  async publish(topic: string, messageType: string, data: unknown): Promise<void> {
    topic = this.namespaceTopic(topic);
    
    await this.send({
      op: 'publish',
      topic,
      type: messageType,
      msg: data,
    });
    
    this.log('debug', `Published to ${topic}`);
  }

  async advertise(topic: string, messageType: string): Promise<void> {
    topic = this.namespaceTopic(topic);
    
    await this.send({
      op: 'advertise',
      topic,
      type: messageType,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Services (Request/Response)
  // ─────────────────────────────────────────────────────────────────────────

  async callService<T = unknown>(request: ROS2ServiceRequest): Promise<T> {
    const service = this.namespaceTopic(request.service);
    const id = `srv_${++this.messageId}`;
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingServices.delete(id);
        reject(new Error(`Service call timeout: ${service}`));
      }, 30000);

      this.pendingServices.set(id, {
        resolve: (result: T) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.send({
        op: 'call_service',
        id,
        service,
        type: request.serviceType,
        args: request.args,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions (Long-running with feedback)
  // ─────────────────────────────────────────────────────────────────────────

  async sendGoal(actionGoal: ROS2ActionGoal): Promise<string> {
    const action = this.namespaceTopic(actionGoal.action);
    const goalId = `goal_${++this.messageId}`;
    
    // Subscribe to feedback and result
    await this.subscribe({
      topic: `${action}/feedback`,
      messageType: `${actionGoal.actionType}_FeedbackMessage`,
      handler: (msg) => {
        if (actionGoal.feedbackCallback) {
          actionGoal.feedbackCallback(msg.data);
        }
        eventBus.emit('ros2:action:feedback', { goalId, action, feedback: msg.data });
      },
    });

    await this.subscribe({
      topic: `${action}/result`,
      messageType: `${actionGoal.actionType}_Result`,
      handler: (msg) => {
        this.activeActions.delete(goalId);
        eventBus.emit('ros2:action:result', { goalId, action, result: msg.data });
      },
    });

    // Publish goal
    await this.publish(
      `${action}/goal`,
      `${actionGoal.actionType}_Goal`,
      { goal_id: { id: goalId }, goal: actionGoal.goal }
    );

    this.activeActions.set(goalId, actionGoal);
    return goalId;
  }

  async cancelGoal(goalId: string): Promise<void> {
    const actionGoal = this.activeActions.get(goalId);
    if (!actionGoal) return;

    await this.publish(
      `${actionGoal.action}/cancel`,
      'actionlib_msgs/GoalID',
      { id: goalId }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Message Handling
  // ─────────────────────────────────────────────────────────────────────────

  private handleRosbridgeMessage(data: Record<string, unknown>): void {
    switch (data.op) {
      case 'publish':
        this.handleTopicMessage(data);
        break;
        
      case 'service_response':
        this.handleServiceResponse(data);
        break;
        
      case 'status':
        this.log('debug', `Status: ${JSON.stringify(data)}`);
        break;
        
      default:
        this.log('debug', `Unknown op: ${data.op}`);
    }
  }

  private handleTopicMessage(data: Record<string, unknown>): void {
    const topic = data.topic as string;
    const msg = data.msg;
    
    const message: ROS2Message = {
      topic,
      messageType: this.subscriptions.get(topic)?.messageType ?? 'unknown',
      data: msg,
      timestamp: Date.now(),
    };

    // Call subscription handler
    const sub = this.subscriptions.get(topic);
    if (sub?.handler) {
      sub.handler(message);
    }

    // Emit to EverythingOS event bus
    eventBus.emit('ros2:message', message);
    eventBus.emit(`ros2:${topic.replace(/\//g, ':')}`, msg);
  }

  private handleServiceResponse(data: Record<string, unknown>): void {
    const id = data.id as string;
    const pending = this.pendingServices.get(id);
    
    if (pending) {
      this.pendingServices.delete(id);
      
      if (data.result !== undefined && (data as any).values) {
        pending.resolve((data as any).values);
      } else if (data.result === false) {
        pending.reject(new Error('Service call failed'));
      } else {
        pending.resolve(data.values ?? data.result);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Mappings
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventMappings(): void {
    if (!this.config.eventMappings) return;

    for (const mapping of this.config.eventMappings) {
      if (mapping.direction === 'to_ros' || mapping.direction === 'bidirectional') {
        // EverythingOS event -> ROS2 topic
        eventBus.on(mapping.event, (event) => {
          const data = mapping.transform 
            ? mapping.transform(event.payload) 
            : event.payload;
          this.publish(mapping.topic, mapping.messageType, data);
        });
      }

      if (mapping.direction === 'from_ros' || mapping.direction === 'bidirectional') {
        // ROS2 topic -> EverythingOS event
        this.subscribe({
          topic: mapping.topic,
          messageType: mapping.messageType,
          handler: (msg) => {
            const data = mapping.transform 
              ? mapping.transform(msg.data) 
              : msg.data;
            eventBus.emit(mapping.event, data);
          },
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Common ROS2 Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Publish velocity command (cmd_vel) */
  async publishVelocity(linear: { x: number; y: number; z: number }, angular: { x: number; y: number; z: number }): Promise<void> {
    await this.publish('/cmd_vel', 'geometry_msgs/Twist', {
      linear,
      angular,
    });
  }

  /** Get current robot pose via TF */
  async getPose(targetFrame = 'base_link', sourceFrame = 'map'): Promise<unknown> {
    return this.callService({
      service: '/tf2_frames',
      serviceType: 'tf2_msgs/FrameGraph',
      args: {},
    });
  }

  /** Call navigation goal */
  async navigateTo(x: number, y: number, theta: number): Promise<string> {
    return this.sendGoal({
      action: '/navigate_to_pose',
      actionType: 'nav2_msgs/NavigateToPose',
      goal: {
        pose: {
          header: { frame_id: 'map' },
          pose: {
            position: { x, y, z: 0 },
            orientation: this.eulerToQuaternion(0, 0, theta),
          },
        },
      },
      feedbackCallback: (feedback) => {
        eventBus.emit('robot:navigation:progress', feedback);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  private async send(msg: object): Promise<void> {
    await this.ws.sendJSON(msg);
  }

  private namespaceTopic(topic: string): string {
    if (!this.config.namespace || topic.startsWith('/')) {
      return topic;
    }
    return `/${this.config.namespace}${topic.startsWith('/') ? '' : '/'}${topic}`;
  }

  private eulerToQuaternion(roll: number, pitch: number, yaw: number): { x: number; y: number; z: number; w: number } {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    return {
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy,
      w: cr * cp * cy + sr * sp * sy,
    };
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    eventBus.emit('ros2:log', { level, message, timestamp: Date.now() });
  }
}
