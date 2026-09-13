import assert from "node:assert/strict";

const snapping = await import("../src/lib/editor/snapping.ts");
const roomEngine = await import("../src/lib/editor/room-engine.ts");
const wallEngine = await import("../src/lib/editor/wall-engine.ts");

const exterior = { thickness: 30, height: 270, wallType: "exterior" };
const wall = (id, a, b, extra = {}) => ({ id, a, b, ...exterior, ...extra });

function close(actual, expected, tolerance = 0.001, message = "values differ") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} !== ${expected}`);
}

{
  const result = snapping.resolveWallDrawSnap({
    raw: { x: 301, y: 7 },
    previous: { x: 0, y: 0 },
    plan: { walls: [], openings: [], furniture: [], labels: [], sections: [] },
    grid: 20,
    scale: 1,
    snapEnabled: true,
  });
  assert.equal(result.kind, "axis-x");
  assert.deepEqual(result.point, { x: 300, y: 0 });
}

{
  const result = snapping.resolveWallDrawSnap({
    raw: { x: 8, y: 247 },
    previous: { x: 0, y: 0 },
    plan: { walls: [], openings: [], furniture: [], labels: [], sections: [] },
    grid: 20,
    scale: 1,
    snapEnabled: true,
  });
  assert.equal(result.kind, "axis-y");
  assert.deepEqual(result.point, { x: 0, y: 240 });
}

{
  const plan = {
    walls: [wall("w1", { x: 0, y: 0 }, { x: 400, y: 0 })],
    openings: [],
    furniture: [],
    labels: [],
    sections: [],
  };
  const result = snapping.resolveWallDrawSnap({
    raw: { x: 396, y: 9 },
    previous: { x: 100, y: 0 },
    plan,
    grid: 20,
    scale: 1,
    snapEnabled: true,
  });
  assert.equal(result.kind, "endpoint");
  assert.deepEqual(result.point, { x: 400, y: 0 });
}

{
  const result = snapping.resolveWallDrawSnap({
    raw: { x: 9, y: 7 },
    previous: { x: 0, y: 300 },
    drawingStart: { x: 0, y: 0 },
    plan: { walls: [], openings: [], furniture: [], labels: [], sections: [] },
    grid: 20,
    scale: 1,
    snapEnabled: true,
  });
  assert.equal(result.kind, "close-room");
  assert.deepEqual(result.point, { x: 0, y: 0 });
  assert.equal(result.wouldCloseRoom, true);
}

{
  const plan = wallEngine.createRectangularRoom({
    a: { x: 0, y: 0 },
    b: { x: 401, y: 298 },
    wallSettings: exterior,
    grid: 20,
  });
  assert.equal(plan.walls.length, 4);
  assert.deepEqual(
    plan.walls.map((w) => [w.a, w.b]),
    [
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
      ],
      [
        { x: 400, y: 0 },
        { x: 400, y: 300 },
      ],
      [
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ],
      [
        { x: 0, y: 300 },
        { x: 0, y: 0 },
      ],
    ],
  );
  const rooms = roomEngine.detectInteriorRooms(plan);
  assert.equal(rooms.length, 1);
  close(rooms[0].areaM2, 12, 0.001, "rectangle room area");
  assert.equal(roomEngine.formatAreaM2(rooms[0].areaM2), "12,00 m²");
}

{
  const plan = wallEngine.normalizePlanTopology({
    walls: [
      wall("a", { x: 0, y: 0 }, { x: 400, y: 0 }),
      wall("b", { x: 403, y: 2 }, { x: 403, y: 300 }),
    ],
    openings: [],
    furniture: [],
    labels: [],
    sections: [],
  });
  assert.deepEqual(plan.walls[1].a, { x: 400, y: 0 });
}

{
  const plan = {
    walls: [wall("w1", { x: 0, y: 3 }, { x: 400, y: 11 })],
    openings: [],
    furniture: [],
    labels: [],
    sections: [],
  };
  const next = wallEngine.moveWallBodyOrthogonal({
    plan,
    wallId: "w1",
    dx: 0,
    dy: 37,
    grid: 20,
  });
  assert.deepEqual(next.walls[0].a, { x: 0, y: 40 });
  assert.deepEqual(next.walls[0].b, { x: 400, y: 40 });
}

console.log("wall engine contract test passed");
