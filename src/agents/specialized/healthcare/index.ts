// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHING OS - Healthcare Agents
// Hospital operations and patient management
// ═══════════════════════════════════════════════════════════════════════════════

import { BaseAgent } from '../../BaseAgent';
import { Patient, VitalSigns, StaffMember } from '../../../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Patient Queue Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class PatientQueueAgent extends BaseAgent {
  private queue: Patient[] = [];
  private departments = ['ER', 'ICU', 'Surgery', 'Pediatrics', 'Cardiology'];

  constructor() {
    super({
      id: 'patient_queue',
      name: 'Patient Queue Agent',
      tier: 'specialized',
      description: 'Manage patient queues and prioritization',
      version: '1.0.0',
    });
    this.tickRate = 5000;
  }

  protected async onStart(): Promise<void> {
    // Initialize with some patients
    for (let i = 0; i < 15; i++) {
      this.addPatient(this.generatePatient());
    }
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    // Simulate patient flow
    if (Math.random() > 0.7) {
      this.addPatient(this.generatePatient());
    }

    if (Math.random() > 0.6 && this.queue.length > 0) {
      this.processNextPatient();
    }

    this.emit('healthcare:queue_status', {
      total: this.queue.length,
      byPriority: this.getCountByPriority(),
      byDepartment: this.getCountByDepartment(),
      avgWaitTime: this.calculateAvgWaitTime()
    });
  }

  private generatePatient(): Patient {
    const priorities: Patient['priority'][] = ['critical', 'urgent', 'standard', 'routine'];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    return {
      id: `patient_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: `Patient ${Math.floor(Math.random() * 1000)}`,
      priority,
      department: this.departments[Math.floor(Math.random() * this.departments.length)],
      admittedAt: Date.now(),
      status: 'waiting',
    };
  }

  addPatient(patient: Patient): void {
    // Insert by priority
    const priorityOrder = { critical: 0, urgent: 1, standard: 2, routine: 3 };
    const idx = this.queue.findIndex(p => priorityOrder[p.priority] > priorityOrder[patient.priority]);
    
    if (idx === -1) {
      this.queue.push(patient);
    } else {
      this.queue.splice(idx, 0, patient);
    }

    this.emit('healthcare:patient_admitted', patient);
  }

  processNextPatient(): Patient | undefined {
    const patient = this.queue.shift();
    if (patient) {
      patient.status = 'in_treatment';
      this.emit('healthcare:patient_called', patient);
    }
    return patient;
  }

  getQueue(): Patient[] { return [...this.queue]; }

  getCountByPriority(): Record<string, number> {
    return this.queue.reduce((acc, p) => {
      acc[p.priority] = (acc[p.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  getCountByDepartment(): Record<string, number> {
    return this.queue.reduce((acc, p) => {
      acc[p.department] = (acc[p.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateAvgWaitTime(): number {
    if (this.queue.length === 0) return 0;
    const now = Date.now();
    return this.queue.reduce((sum, p) => sum + (now - p.admittedAt), 0) / this.queue.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Staff Scheduling Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class StaffSchedulingAgent extends BaseAgent {
  private staff: StaffMember[] = [];
  private shifts = ['day', 'evening', 'night'];

  constructor() {
    super({
      id: 'staff_scheduling',
      name: 'Staff Scheduling Agent',
      tier: 'specialized',
      description: 'Manage staff schedules and assignments',
      version: '1.0.0',
    });
    this.tickRate = 60000;
  }

  protected async onStart(): Promise<void> {
    this.initializeStaff();
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    this.emit('healthcare:staff_status', {
      total: this.staff.length,
      available: this.staff.filter(s => s.available).length,
      byDepartment: this.getStaffByDepartment(),
      byShift: this.getStaffByShift()
    });
  }

  private initializeStaff(): void {
    const roles = ['Doctor', 'Nurse', 'Technician', 'Admin'];
    const departments = ['ER', 'ICU', 'Surgery', 'Pediatrics', 'Cardiology'];

    for (let i = 0; i < 50; i++) {
      this.staff.push({
        id: `staff_${i}`,
        name: `Staff Member ${i}`,
        role: roles[Math.floor(Math.random() * roles.length)],
        department: departments[Math.floor(Math.random() * departments.length)],
        shift: this.shifts[Math.floor(Math.random() * this.shifts.length)],
        available: Math.random() > 0.3
      });
    }
  }

  getStaffByDepartment(): Record<string, number> {
    return this.staff.filter(s => s.available).reduce((acc, s) => {
      acc[s.department] = (acc[s.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  getStaffByShift(): Record<string, number> {
    return this.staff.reduce((acc, s) => {
      acc[s.shift] = (acc[s.shift] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  assignStaff(staffId: string, department: string): boolean {
    const member = this.staff.find(s => s.id === staffId);
    if (member && member.available) {
      member.department = department;
      this.emit('healthcare:staff_assigned', { staffId, department });
      return true;
    }
    return false;
  }

  getAvailableStaff(department?: string): StaffMember[] {
    return this.staff.filter(s => s.available && (!department || s.department === department));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vitals Monitoring Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class VitalsMonitoringAgent extends BaseAgent {
  private patientVitals: Map<string, VitalSigns> = new Map();
  private alerts: Array<{ patientId: string; type: string; value: number; timestamp: number }> = [];

  constructor() {
    super({
      id: 'vitals_monitoring',
      name: 'Vitals Monitoring Agent',
      tier: 'specialized',
      description: 'Monitor patient vital signs',
      version: '1.0.0',
    });
    this.tickRate = 2000;
  }

  protected async onStart(): Promise<void> {
    // Initialize some patient vitals
    for (let i = 0; i < 10; i++) {
      this.patientVitals.set(`patient_${i}`, this.generateVitals());
    }
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    // Update vitals with some variation
    for (const [patientId, vitals] of this.patientVitals) {
      const updated = this.updateVitals(vitals);
      this.patientVitals.set(patientId, updated);
      this.checkVitals(patientId, updated);
    }

    this.emit('healthcare:vitals_summary', {
      patientCount: this.patientVitals.size,
      alertCount: this.alerts.filter(a => Date.now() - a.timestamp < 60000).length
    });
  }

  private generateVitals(): VitalSigns {
    return {
      heartRate: 70 + Math.floor(Math.random() * 30),
      bloodPressure: {
        systolic: 110 + Math.floor(Math.random() * 30),
        diastolic: 70 + Math.floor(Math.random() * 20)
      },
      temperature: 36.5 + Math.random(),
      oxygenSaturation: 95 + Math.floor(Math.random() * 5),
      respiratoryRate: 14 + Math.floor(Math.random() * 6),
      timestamp: Date.now()
    };
  }

  private updateVitals(vitals: VitalSigns): VitalSigns {
    return {
      heartRate: Math.max(40, Math.min(180, vitals.heartRate + (Math.random() - 0.5) * 10)),
      bloodPressure: {
        systolic: Math.max(80, Math.min(200, vitals.bloodPressure.systolic + (Math.random() - 0.5) * 10)),
        diastolic: Math.max(50, Math.min(120, vitals.bloodPressure.diastolic + (Math.random() - 0.5) * 5))
      },
      temperature: Math.max(35, Math.min(42, vitals.temperature + (Math.random() - 0.5) * 0.2)),
      oxygenSaturation: Math.max(85, Math.min(100, vitals.oxygenSaturation + (Math.random() - 0.5) * 2)),
      respiratoryRate: Math.max(8, Math.min(30, vitals.respiratoryRate + (Math.random() - 0.5) * 2)),
      timestamp: Date.now()
    };
  }

  private checkVitals(patientId: string, vitals: VitalSigns): void {
    const thresholds = {
      heartRate: { low: 50, high: 120 },
      systolic: { low: 90, high: 180 },
      oxygenSaturation: { low: 92, high: 100 },
      temperature: { low: 36, high: 38.5 }
    };

    if (vitals.heartRate < thresholds.heartRate.low || vitals.heartRate > thresholds.heartRate.high) {
      this.createAlert(patientId, 'heart_rate', vitals.heartRate);
    }

    if (vitals.oxygenSaturation < thresholds.oxygenSaturation.low) {
      this.createAlert(patientId, 'oxygen_saturation', vitals.oxygenSaturation);
    }

    if (vitals.temperature < thresholds.temperature.low || vitals.temperature > thresholds.temperature.high) {
      this.createAlert(patientId, 'temperature', vitals.temperature);
    }
  }

  private createAlert(patientId: string, type: string, value: number): void {
    const alert = { patientId, type, value, timestamp: Date.now() };
    this.alerts.push(alert);
    this.emit('healthcare:vital_alert', alert);
    
    if (this.alerts.length > 100) this.alerts.shift();
  }

  getVitals(patientId: string): VitalSigns | undefined {
    return this.patientVitals.get(patientId);
  }

  getRecentAlerts(): typeof this.alerts {
    return this.alerts.filter(a => Date.now() - a.timestamp < 300000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Resource Allocation Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class ResourceAllocationAgent extends BaseAgent {
  private resources: Map<string, { total: number; available: number; department: string }> = new Map();

  constructor() {
    super({
      id: 'resource_allocation',
      name: 'Resource Allocation Agent',
      tier: 'specialized',
      description: 'Manage hospital resource allocation',
      version: '1.0.0',
    });
    this.tickRate = 30000;
  }

  protected async onStart(): Promise<void> {
    this.initializeResources();
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    // Simulate resource usage fluctuation
    for (const [name, resource] of this.resources) {
      const change = Math.floor((Math.random() - 0.5) * 3);
      resource.available = Math.max(0, Math.min(resource.total, resource.available + change));
    }

    this.emit('healthcare:resource_status', {
      resources: Object.fromEntries(this.resources),
      lowStock: this.getLowStockResources()
    });
  }

  private initializeResources(): void {
    const items = [
      { name: 'beds_ER', total: 50, department: 'ER' },
      { name: 'beds_ICU', total: 20, department: 'ICU' },
      { name: 'ventilators', total: 30, department: 'ICU' },
      { name: 'operating_rooms', total: 10, department: 'Surgery' },
      { name: 'MRI_machines', total: 3, department: 'Radiology' },
      { name: 'CT_scanners', total: 5, department: 'Radiology' },
      { name: 'wheelchairs', total: 100, department: 'General' },
      { name: 'IV_pumps', total: 200, department: 'General' }
    ];

    for (const item of items) {
      this.resources.set(item.name, {
        total: item.total,
        available: Math.floor(item.total * (0.5 + Math.random() * 0.4)),
        department: item.department
      });
    }
  }

  getLowStockResources(): string[] {
    return Array.from(this.resources.entries())
      .filter(([_, r]) => r.available / r.total < 0.2)
      .map(([name]) => name);
  }

  allocate(resourceName: string, quantity: number): boolean {
    const resource = this.resources.get(resourceName);
    if (resource && resource.available >= quantity) {
      resource.available -= quantity;
      this.emit('healthcare:resource_allocated', { resourceName, quantity });
      return true;
    }
    return false;
  }

  release(resourceName: string, quantity: number): void {
    const resource = this.resources.get(resourceName);
    if (resource) {
      resource.available = Math.min(resource.total, resource.available + quantity);
      this.emit('healthcare:resource_released', { resourceName, quantity });
    }
  }

  getResourceStatus(): Record<string, { total: number; available: number; utilization: number }> {
    const status: Record<string, { total: number; available: number; utilization: number }> = {};
    for (const [name, r] of this.resources) {
      status[name] = {
        total: r.total,
        available: r.available,
        utilization: ((r.total - r.available) / r.total) * 100
      };
    }
    return status;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Medication Inventory Agent
// ═══════════════════════════════════════════════════════════════════════════════

export class MedicationInventoryAgent extends BaseAgent {
  private inventory: Map<string, { stock: number; reorderPoint: number; unit: string }> = new Map();

  constructor() {
    super({
      id: 'medication_inventory',
      name: 'Medication Inventory Agent',
      tier: 'specialized',
      description: 'Track medication inventory levels',
      version: '1.0.0',
    });
    this.tickRate = 60000;
  }

  protected async onStart(): Promise<void> {
    this.initializeInventory();
  }

  protected async onStop(): Promise<void> {}

  protected async onTick(): Promise<void> {
    // Simulate medication usage
    for (const [med, data] of this.inventory) {
      const used = Math.floor(Math.random() * 5);
      data.stock = Math.max(0, data.stock - used);
      
      if (data.stock <= data.reorderPoint) {
        this.emit('healthcare:medication_low', { medication: med, stock: data.stock });
      }
    }

    this.emit('healthcare:inventory_status', {
      medications: Object.fromEntries(this.inventory),
      lowStock: this.getLowStockMedications()
    });
  }

  private initializeInventory(): void {
    const medications = [
      { name: 'Morphine', stock: 500, reorderPoint: 100, unit: 'mg' },
      { name: 'Aspirin', stock: 2000, reorderPoint: 500, unit: 'tablets' },
      { name: 'Insulin', stock: 300, reorderPoint: 50, unit: 'units' },
      { name: 'Epinephrine', stock: 100, reorderPoint: 20, unit: 'vials' },
      { name: 'Antibiotics', stock: 1000, reorderPoint: 200, unit: 'doses' },
      { name: 'Saline', stock: 500, reorderPoint: 100, unit: 'bags' }
    ];

    for (const med of medications) {
      this.inventory.set(med.name, {
        stock: med.stock,
        reorderPoint: med.reorderPoint,
        unit: med.unit
      });
    }
  }

  getLowStockMedications(): string[] {
    return Array.from(this.inventory.entries())
      .filter(([_, m]) => m.stock <= m.reorderPoint)
      .map(([name]) => name);
  }

  dispense(medication: string, quantity: number): boolean {
    const med = this.inventory.get(medication);
    if (med && med.stock >= quantity) {
      med.stock -= quantity;
      this.emit('healthcare:medication_dispensed', { medication, quantity });
      return true;
    }
    return false;
  }

  restock(medication: string, quantity: number): void {
    const med = this.inventory.get(medication);
    if (med) {
      med.stock += quantity;
      this.emit('healthcare:medication_restocked', { medication, quantity });
    }
  }
}
