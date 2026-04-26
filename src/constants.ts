/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resource, Task } from "./types";

export const INITIAL_RESOURCES: Resource[] = [
  {
    id: "r1",
    name: "Alex Chen",
    role: "Senior Developer",
    skills: ["React", "Node.js", "System Architecture"],
    availability: 100,
  },
  {
    id: "r2",
    name: "Sarah Miller",
    role: "UI/UX Designer",
    skills: ["Figma", "Accessibility", "Prototyping"],
    availability: 80,
  },
  {
    id: "r3",
    name: "Jordan Smith",
    role: "Fullstack Engineer",
    skills: ["React", "Python", "SQL"],
    availability: 100,
  },
  {
    id: "r4",
    name: "Dr. Elena Vance",
    role: "Machine Learning Researcher",
    skills: ["Python", "PyTorch", "Data Science"],
    availability: 60,
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "Core API Infrastructure",
    priority: "high",
    requiredSkills: ["Node.js", "System Architecture"],
    estimatedHours: 40,
  },
  {
    id: "t2",
    title: "Main Dashboard Design",
    priority: "medium",
    requiredSkills: ["Figma", "Prototyping"],
    estimatedHours: 20,
  },
  {
    id: "t3",
    title: "User Profile Implementation",
    priority: "low",
    requiredSkills: ["React", "SQL"],
    estimatedHours: 15,
  },
  {
    id: "t4",
    title: "AI Recommendation Engine",
    priority: "high",
    requiredSkills: ["Python", "PyTorch"],
    estimatedHours: 60,
  },
];
