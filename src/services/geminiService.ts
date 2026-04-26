/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resource, Task, AllocationReport } from "../types";

export async function generateAllocation(resources: Resource[], tasks: Task[]): Promise<AllocationReport> {
  try {
    const response = await fetch("/api/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources, tasks }),
    });

    if (!response.ok) {
      throw new Error("Allocation failed on server");
    }

    return await response.json();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    throw error;
  }
}
