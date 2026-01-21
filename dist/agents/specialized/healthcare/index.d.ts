import { BaseAgent } from '../../BaseAgent';
import { Patient, VitalSigns, StaffMember } from '../../../core/types';
export declare class PatientQueueAgent extends BaseAgent {
    private queue;
    private departments;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private generatePatient;
    addPatient(patient: Patient): void;
    processNextPatient(): Patient | undefined;
    getQueue(): Patient[];
    getCountByPriority(): Record<string, number>;
    getCountByDepartment(): Record<string, number>;
    private calculateAvgWaitTime;
}
export declare class StaffSchedulingAgent extends BaseAgent {
    private staff;
    private shifts;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private initializeStaff;
    getStaffByDepartment(): Record<string, number>;
    getStaffByShift(): Record<string, number>;
    assignStaff(staffId: string, department: string): boolean;
    getAvailableStaff(department?: string): StaffMember[];
}
export declare class VitalsMonitoringAgent extends BaseAgent {
    private patientVitals;
    private alerts;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private generateVitals;
    private updateVitals;
    private checkVitals;
    private createAlert;
    getVitals(patientId: string): VitalSigns | undefined;
    getRecentAlerts(): typeof this.alerts;
}
export declare class ResourceAllocationAgent extends BaseAgent {
    private resources;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private initializeResources;
    getLowStockResources(): string[];
    allocate(resourceName: string, quantity: number): boolean;
    release(resourceName: string, quantity: number): void;
    getResourceStatus(): Record<string, {
        total: number;
        available: number;
        utilization: number;
    }>;
}
export declare class MedicationInventoryAgent extends BaseAgent {
    private inventory;
    constructor();
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onTick(): Promise<void>;
    private initializeInventory;
    getLowStockMedications(): string[];
    dispense(medication: string, quantity: number): boolean;
    restock(medication: string, quantity: number): void;
}
//# sourceMappingURL=index.d.ts.map