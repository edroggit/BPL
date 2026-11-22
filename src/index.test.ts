import { describe, expect, it } from "vitest";
import {
  type Command,
  COMMANDS,
  CommandProcessor,
  Grid,
  InvalidInputError,
  MoveForward,
  parseMissionInput,
  Robot,
  runMission,
  TurnLeft,
  TurnRight,
  turnLeft,
  turnRight,
} from "./index";

describe("turnLeft", () => {
  it.each([
    ["N", "W"],
    ["W", "S"],
    ["S", "E"],
    ["E", "N"],
  ] as const)("turns left from %s to %s", (start, expected) => {
    expect(turnLeft(start)).toBe(expected);
  });
});

describe("turnRight", () => {
  it.each([
    ["N", "E"],
    ["E", "S"],
    ["S", "W"],
    ["W", "N"],
  ] as const)("turns right from %s to %s", (start, expected) => {
    expect(turnRight(start)).toBe(expected);
  });
});

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

    robot.moveForward();

    expect(robot.coordinate).toEqual({ x: 2, y: 3 });
    expect(robot.orientation).toBe("N");
  });

  it("turns without moving", () => {
    const robot = new Robot({ x: 2, y: 2 }, "N");

    robot.turnRight();
    expect(robot.orientation).toBe("E");

    robot.turnLeft();
    robot.turnLeft();
    expect(robot.orientation).toBe("W");

    expect(robot.coordinate).toEqual({ x: 2, y: 2 });
  });

  it("starts not lost and stays where it is when marked lost", () => {
    const robot = new Robot({ x: 2, y: 2 }, "N");
    expect(robot.isLost).toBe(false);

    robot.markLost();

    expect(robot.isLost).toBe(true);
    expect(robot.coordinate).toEqual({ x: 2, y: 2 });
  });
});

describe("TurnLeft and TurnRight", () => {
  it("turn the robot without moving it", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 2, y: 2 }, "N");

    TurnRight.execute(robot, grid);
    expect(robot.orientation).toBe("E");

    TurnLeft.execute(robot, grid);
    TurnLeft.execute(robot, grid);
    expect(robot.orientation).toBe("W");

    expect(robot.coordinate).toEqual({ x: 2, y: 2 });
  });
});

describe("MoveForward", () => {
  it("moves the robot when the next point is on the grid", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 2, y: 2 }, "N");

    MoveForward.execute(robot, grid);

    expect(robot.coordinate).toEqual({ x: 2, y: 3 });
    expect(robot.isLost).toBe(false);
  });

  it("loses the robot off the edge and leaves a scent at its last position", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 5, y: 3 }, "N");

    MoveForward.execute(robot, grid);

    expect(robot.isLost).toBe(true);
    expect(robot.coordinate).toEqual({ x: 5, y: 3 });
    expect(grid.hasScent({ x: 5, y: 3 })).toBe(true);
  });

  it("ignores a move off the edge from a scented point", () => {
    const grid = new Grid(5, 3);
    grid.leaveScent({ x: 5, y: 3 });
    const robot = new Robot({ x: 5, y: 3 }, "N");

    MoveForward.execute(robot, grid);

    expect(robot.isLost).toBe(false);
    expect(robot.coordinate).toEqual({ x: 5, y: 3 });
  });

  it("still allows an on-grid move from a scented point", () => {
    const grid = new Grid(5, 3);
    grid.leaveScent({ x: 5, y: 3 });
    const robot = new Robot({ x: 5, y: 3 }, "S");

    MoveForward.execute(robot, grid);

    expect(robot.coordinate).toEqual({ x: 5, y: 2 });
    expect(robot.isLost).toBe(false);
  });
});

describe("CommandProcessor", () => {
  it("runs every instruction in order", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 1, y: 1 }, "E");

    new CommandProcessor().execute(robot, "RFRFRFRF", grid);

    expect(robot.coordinate).toEqual({ x: 1, y: 1 });
    expect(robot.orientation).toBe("E");
    expect(robot.isLost).toBe(false);
  });

  it("ignores the remaining instructions once the robot is lost", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 5, y: 3 }, "N");

    new CommandProcessor().execute(robot, "FRF", grid);

    expect(robot.isLost).toBe(true);
    expect(robot.coordinate).toEqual({ x: 5, y: 3 });
    expect(robot.orientation).toBe("N");
  });

  it("rejects an unknown instruction before moving the robot", () => {
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 2, y: 2 }, "N");

    expect(() => new CommandProcessor().execute(robot, "FFXF", grid)).toThrow(
      InvalidInputError,
    );
    expect(robot.coordinate).toEqual({ x: 2, y: 2 });
  });

  it("uses commands from a custom registry", () => {
    const TurnAround: Command = {
      execute(robot) {
        robot.turnRight();
        robot.turnRight();
      },
    };
    const commands = new Map([...COMMANDS, ["U", TurnAround]]);
    const grid = new Grid(5, 3);
    const robot = new Robot({ x: 2, y: 2 }, "N");

    new CommandProcessor(commands).execute(robot, "UF", grid);

    expect(robot.orientation).toBe("S");
    expect(robot.coordinate).toEqual({ x: 2, y: 1 });
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
    ["a grid coordinate over 50", "51 3\n1 1 E\nF"],
    ["a non-numeric robot coordinate", "5 3\na b E\nF"],
    ["a robot that starts off the grid", "5 3\n6 1 E\nF"],
    ["an unknown orientation", "5 3\n1 1 Q\nF"],
    ["instructions of 100 characters", `5 3\n1 1 E\n${"F".repeat(100)}`],
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

  it("rejects an unknown instruction", () => {
    expect(() => runMission("5 3\n1 1 E\nFX")).toThrow(InvalidInputError);
  });
});
