/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Priority = 'low' | 'medium' | 'high';

export interface Resource {
  id: string;
  name: string;
  skills: string[];
  availability: number; // 0 to 100
  role: string;
}

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  requiredSkills: string[];
  estimatedHours: number;
  deadline?: string;
}

export interface AllocationProposal {
  taskId: string;
  resourceId: string;
  reasoning: string;
  confidence: number; // 0 to 1
}

export interface AllocationReport {
  allocations: AllocationProposal[];
  summary: string;
  efficiencyScore: number;
  aiSuggestions: string[];
}
