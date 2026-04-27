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
    skills: ["React", "Node.js", "System Architecture", "Cloud Services"],
    availability: 100,
  },
  {
    id: "r2",
    name: "Sarah Miller",
    role: "Lead Designer",
    skills: ["Figma", "Accessibility", "UI/UX", "Branding"],
    availability: 80,
  },
  {
    id: "r3",
    name: "Jordan Smith",
    role: "Fullstack Engineer",
    skills: ["React", "Python", "SQL", "Docker"],
    availability: 100,
  },
  {
    id: "r4",
    name: "Dr. Elena Vance",
    role: "AI Scientist",
    skills: ["Python", "PyTorch", "Data Science", "LLMs"],
    availability: 60,
  },
  {
    id: "r5",
    name: "Marcus Aurelius",
    role: "Security Analyst",
    skills: ["Networking", "Cybersecurity", "Compliance", "Python"],
    availability: 100,
  },
  {
    id: "r6",
    name: "Maya Patel",
    role: "Quality Engineer",
    skills: ["Automation", "Testing", "React", "CI/CD"],
    availability: 90,
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "Zero-Trust Architecture",
    priority: "high",
    requiredSkills: ["System Architecture", "Cybersecurity"],
    estimatedHours: 40,
  },
  {
    id: "t2",
    title: "Brand System Refresh",
    priority: "medium",
    requiredSkills: ["Figma", "Branding"],
    estimatedHours: 20,
  },
  {
    id: "t3",
    title: "Data Migration v3",
    priority: "medium",
    requiredSkills: ["SQL", "Python", "Cloud Services"],
    estimatedHours: 45,
  },
  {
    id: "t4",
    title: "Generative AI Chatbot",
    priority: "high",
    requiredSkills: ["Python", "LLMs", "React"],
    estimatedHours: 70,
  },
  {
    id: "t5",
    title: "Compliance Audit Prep",
    priority: "low",
    requiredSkills: ["Compliance", "Networking"],
    estimatedHours: 15,
  },
  {
    id: "t6",
    title: "Performance Optimization",
    priority: "medium",
    requiredSkills: ["Node.js", "React", "Docker"],
    estimatedHours: 30,
  },
];
