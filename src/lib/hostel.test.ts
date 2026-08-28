import { describe, it, expect } from "vitest";

export function computeHostelOccupancy(
  rooms: Array<{ capacity: number; occupiedCount?: number }>
): {
  totalRooms: number;
  totalCapacity: number;
  totalOccupied: number;
  totalVacant: number;
  occupancyRate: number;
} {
  const totalRooms = rooms.length;
  const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const totalOccupied = rooms.reduce((acc, r) => acc + (r.occupiedCount || 0), 0);
  const totalVacant = Math.max(0, totalCapacity - totalOccupied);
  const occupancyRate =
    totalCapacity > 0 ? Number(((totalOccupied / totalCapacity) * 100).toFixed(1)) : 0;

  return {
    totalRooms,
    totalCapacity,
    totalOccupied,
    totalVacant,
    occupancyRate,
  };
}

export function validateRoomCapacity(
  roomCapacity: number,
  currentAllocations: number
): { canAllocate: boolean; remainingBeds: number } {
  const remainingBeds = Math.max(0, roomCapacity - currentAllocations);
  return {
    canAllocate: remainingBeds > 0,
    remainingBeds,
  };
}

describe("Hostel Accommodation & Bed Allocation Engine", () => {
  it("calculates total hostel building capacity and vacancy rates correctly", () => {
    const rooms = [
      { capacity: 4, occupiedCount: 4 }, // Full
      { capacity: 4, occupiedCount: 2 }, // 2 vacant
      { capacity: 2, occupiedCount: 0 }, // 2 vacant
    ];

    const result = computeHostelOccupancy(rooms);
    expect(result.totalRooms).toBe(3);
    expect(result.totalCapacity).toBe(10);
    expect(result.totalOccupied).toBe(6);
    expect(result.totalVacant).toBe(4);
    expect(result.occupancyRate).toBe(60.0);
  });

  it("handles empty or new hostel with zero occupants", () => {
    const rooms = [
      { capacity: 4, occupiedCount: 0 },
      { capacity: 4, occupiedCount: 0 },
    ];

    const result = computeHostelOccupancy(rooms);
    expect(result.totalCapacity).toBe(8);
    expect(result.totalOccupied).toBe(0);
    expect(result.totalVacant).toBe(8);
    expect(result.occupancyRate).toBe(0);
  });

  it("prevents over-allocation when room capacity is exhausted", () => {
    const fullRoom = validateRoomCapacity(4, 4);
    expect(fullRoom.canAllocate).toBe(false);
    expect(fullRoom.remainingBeds).toBe(0);

    const availableRoom = validateRoomCapacity(4, 3);
    expect(availableRoom.canAllocate).toBe(true);
    expect(availableRoom.remainingBeds).toBe(1);
  });
});
