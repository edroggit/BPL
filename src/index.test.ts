import { describe, expect, it } from "vitest";
import {
  Grid,
  InvalidInputError,
  moveForward,
  parseMissionInput,
  Robot,
  runMission,
} from "./index";

describe("Grid", () => {
  const createGrid = () => new Grid(5, 3);

  it.each([
    { x: 0, y: 0 },
    { x: 5, y: 3 },
  ])("treats corner ($x, $y) as in bounds", (coordinate) => {
    expect(createGrid().isOutOfBounds(coordinate)).toBe(false);
  });

  it.each([
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 6, y: 3 },
    { x: 5, y: 4 },
  ])("treats ($x, $y) as out of bounds", (coordinate) => {
    expect(createGrid().isOutOfBounds(coordinate)).toBe(true);
  });

  it("remembers a scent only where it was left", () => {
    const grid = createGrid();
    expect(grid.hasScent({ x: 3, y: 3 })).toBe(false);

    grid.leaveScent({ x: 3, y: 3 });

    expect(grid.hasScent({ x: 3, y: 3 })).toBe(true);
    expect(grid.hasScent({ x: 3, y: 2 })).toBe(false);
  });
});

describe("Robot", () => {
  it.each([
    { orientation: "N", expected: { x: 2, y: 3 } },
    { orientation: "E", expected: { x: 3, y: 2 } },
    { orientation: "S", expected: { x: 2, y: 1 } },
    { orientation: "W", expected: { x: 1, y: 2 } },
  ] as const)(
    "works out the next coordinate facing $orientation without moving",
    ({ orientation, expected }) => {
      const robot = new Robot({ x: 2, y: 2 }, orientation);

      expect(robot.nextCoordinate()).toEqual(expected);
      expect(robot.coordinate).toEqual({ x: 2, y: 2 });
    },
  );

  it("moves forward one step in the direction it faces", () => {
    const robot = new Robot({ x: 2, y: 2 }, "N");

    robot.stepForward();

    expect(robot.coordinate).toEqual({ x: 2, y: 3 });
    expect(robot.orientation).toBe("N");
  });

  it.each([
    { start: "N", left: "W", right: "E" },
    { start: "E", left: "N", right: "S" },
    { start: "S", left: "E", right: "W" },
    { start: "W", left: "S", right: "N" },
  ] as const)(
    "turns from $start to $left (left) or $right (right) without moving",
    ({ start, left, right }) => {
      const turningLeft = new Robot({ x: 2, y: 2 }, start);
      const turningRight = new Robot({ x: 2, y: 2 }, start);

      turningLeft.turnLeft();
      turningRight.turnRight();

      expect(turningLeft.orientation).toBe(left);
      expect(turningRight.orientation).toBe(right);
      expect(turningLeft.coordinate).toEqual({ x: 2, y: 2 });
    },
  );

  it("starts not lost and stays where it is when marked lost", () => {
    const robot = new Robot({ x: 2, y: 2 }, "N");
    expect(robot.isLost).toBe(false);

    robot.markLost();

    expect(robot.isLost).toBe(true);
    expect(robot.coordinate).toEqual({ x: 2, y: 2 });
  });
});

describe("moveForward", () => {
  it("moves the robot when the next point is on the grid", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 2, y: 2 }, "N");

    moveForward(robot, grid);

    expect(robot.coordinate).toEqual({ x: 2, y: 3 });
    expect(robot.isLost).toBe(false);
  });

  it("loses the robot off the edge and leaves a scent at its last position", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 5, y: 3 }, "N");

    moveForward(robot, grid);

    expect(robot.isLost).toBe(true);
    expect(robot.coordinate).toEqual({ x: 5, y: 3 });
    expect(grid.hasScent({ x: 5, y: 3 })).toBe(true);
  });

  it("ignores a move off the edge from a scented point", () => {
    const grid = new Grid(5, 3);
    grid.leaveScent({ x: 5, y: 3 });
    const robot = new Robot({ x: 5, y: 3 }, "N");

    moveForward(robot, grid);

    expect(robot.isLost).toBe(false);
    expect(robot.coordinate).toEqual({ x: 5, y: 3 });
  });

  it("still allows an on-grid move from a scented point", () => {
    const grid = new Grid(5, 3);
    grid.leaveScent({ x: 5, y: 3 });
    const robot = new Robot({ x: 5, y: 3 }, "S");

    moveForward(robot, grid);

    expect(robot.coordinate).toEqual({ x: 5, y: 2 });
    expect(robot.isLost).toBe(false);
  });
});

const SAMPLE_INPUT = `5 3
1 1 E
RFRFRFRF
3 2 N
FRRFLLFFRRFLL
0 3 W
LLFFFLFLFL`;

describe("parseMissionInput", () => {
  it("parses the grid and each robot with its instructions", () => {
    const { grid, robotPlans } = parseMissionInput(SAMPLE_INPUT);

    expect(grid.isOutOfBounds({ x: 5, y: 3 })).toBe(false);
    expect(grid.isOutOfBounds({ x: 6, y: 3 })).toBe(true);

    expect(robotPlans).toHaveLength(3);
    expect(robotPlans[0].robot.coordinate).toEqual({ x: 1, y: 1 });
    expect(robotPlans[0].robot.orientation).toBe("E");
    expect(robotPlans[0].instructions).toBe("RFRFRFRF");
    expect(robotPlans[2].robot.coordinate).toEqual({ x: 0, y: 3 });
    expect(robotPlans[2].robot.orientation).toBe("W");
    expect(robotPlans[2].instructions).toBe("LLFFFLFLFL");
  });

  it("accepts instructions just under the length limit", () => {
    const input = `5 3\n1 1 E\n${"F".repeat(99)}`;

    expect(parseMissionInput(input).robotPlans[0].instructions).toHaveLength(
      99,
    );
  });

  it("ignores blank lines and Windows line endings", () => {
    const input = "5 3\r\n1 1 E\r\nRF\r\n\r\n3 2 N\r\nFL\r\n";

    const { robotPlans } = parseMissionInput(input);

    expect(robotPlans).toHaveLength(2);
    expect(robotPlans[1].robot.coordinate).toEqual({ x: 3, y: 2 });
    expect(robotPlans[1].instructions).toBe("FL");
  });

  it.each([
    ["a non-numeric grid size", "a b\n1 1 E\nF"],
    ["a grid line with an extra value", "5 3 7\n1 1 E\nF"],
    ["a grid size in scientific notation", "1e1 3\n1 1 E\nF"],
    ["a grid size in hexadecimal", "0x5 3\n1 1 E\nF"],
    ["a robot line with extra text", "5 3\n1 1 E extra\nF"],
    ["a grid coordinate over 50", "51 3\n1 1 E\nF"],
    ["a non-numeric robot coordinate", "5 3\na b E\nF"],
    ["a robot that starts off the grid", "5 3\n6 1 E\nF"],
    ["an unknown orientation", "5 3\n1 1 Q\nF"],
    ["instructions of 100 characters", `5 3\n1 1 E\n${"F".repeat(100)}`],
    ["an unknown instruction letter", "5 3\n1 1 E\nFX"],
    ["a robot with no instruction line", "5 3\n1 1 E"],
    ["empty input", ""],
  ])("rejects %s", (_description, input) => {
    expect(() => parseMissionInput(input)).toThrow(InvalidInputError);
  });
});

describe("runMission", () => {
  it("produces the expected output for the sample input", () => {
    expect(runMission(SAMPLE_INPUT)).toBe("1 1 E\n3 3 N LOST\n2 3 S");
  });

  it("uses a scent left by an earlier robot to save a later one", () => {
    const input = "5 3\n0 3 N\nF\n0 3 N\nFR";

    expect(runMission(input)).toBe("0 3 N LOST\n0 3 E");
  });

  it("ignores the remaining instructions once a robot is lost", () => {
    expect(runMission("5 3\n5 3 N\nFRF")).toBe("5 3 N LOST");
  });
});
