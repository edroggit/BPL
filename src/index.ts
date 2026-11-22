const MAX_COORDINATE = 50;
const INSTRUCTION_LENGTH_LIMIT = 100;

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export interface Coordinate {
  readonly x: number;
  readonly y: number;
}

// Clockwise order: turning right steps forward, turning left steps back.
const ORIENTATIONS = ["N", "E", "S", "W"] as const;

type Orientation = (typeof ORIENTATIONS)[number];

interface MovementVector {
  readonly dx: number;
  readonly dy: number;
}

const MOVEMENT_BY_ORIENTATION: Readonly<Record<Orientation, MovementVector>> = {
  N: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: -1 },
  W: { dx: -1, dy: 0 },
};

export class Grid {
  private readonly maxX: number;
  private readonly maxY: number;

  private readonly scents: Set<string> = new Set();

  constructor(maxX: number, maxY: number) {
    this.maxX = maxX;
    this.maxY = maxY;
  }

  isOutOfBounds(coordinate: Coordinate): boolean {
    return (
      coordinate.x < 0 ||
      coordinate.x > this.maxX ||
      coordinate.y < 0 ||
      coordinate.y > this.maxY
    );
  }

  hasScent(coordinate: Coordinate): boolean {
    return this.scents.has(this.toKey(coordinate));
  }

  leaveScent(coordinate: Coordinate): void {
    this.scents.add(this.toKey(coordinate));
  }

  private toKey(coordinate: Coordinate): string {
    return `${coordinate.x},${coordinate.y}`;
  }
}

export class Robot {
  private currentCoordinate: Coordinate;
  private currentOrientation: Orientation;
  private lost = false;

  constructor(coordinate: Coordinate, orientation: Orientation) {
    this.currentCoordinate = coordinate;
    this.currentOrientation = orientation;
  }

  get coordinate(): Coordinate {
    return this.currentCoordinate;
  }

  get orientation(): Orientation {
    return this.currentOrientation;
  }

  get isLost(): boolean {
    return this.lost;
  }

  turnLeft(): void {
    this.rotate(-1);
  }

  turnRight(): void {
    this.rotate(1);
  }

  /** Where the robot would move to next. Doesn't move it. */
  nextCoordinate(): Coordinate {
    const { dx, dy } = MOVEMENT_BY_ORIENTATION[this.currentOrientation];
    return {
      x: this.currentCoordinate.x + dx,
      y: this.currentCoordinate.y + dy,
    };
  }

  stepForward(): void {
    this.currentCoordinate = this.nextCoordinate();
  }

  markLost(): void {
    this.lost = true;
  }

  private rotate(steps: 1 | -1): void {
    const count = ORIENTATIONS.length;
    const index = ORIENTATIONS.indexOf(this.currentOrientation);
    this.currentOrientation = ORIENTATIONS[(index + steps + count) % count];
  }
}

type Command = (robot: Robot, grid: Grid) => void;

/**
 * Moves the robot one step forward. If that step would leave the grid, the move is
 * ignored when a scent is already here; otherwise the robot leaves a scent and is lost.
 */
export function moveForward(robot: Robot, grid: Grid): void {
  if (!grid.isOutOfBounds(robot.nextCoordinate())) {
    robot.stepForward();
    return;
  }

  // ignore move if there is a scent from a previous robot
  if (grid.hasScent(robot.coordinate)) {
    return;
  }

  grid.leaveScent(robot.coordinate);
  robot.markLost();
}

/**
 * Maps each instruction letter to its command. To add a command, write a function
 * that matches `Command` and give it a letter here. Parsing and running pick it up automatically.
 */
const COMMANDS: Readonly<Record<string, Command>> = {
  L: (robot) => robot.turnLeft(),
  R: (robot) => robot.turnRight(),
  F: moveForward,
};

// Only called after parseInstructions has checked every letter, so each one is in COMMANDS.
function executeInstructions(
  robot: Robot,
  instructions: string,
  grid: Grid,
): void {
  for (const letter of instructions) {
    if (robot.isLost) {
      break;
    }
    COMMANDS[letter](robot, grid);
  }
}

// The exact shape of each line: whole numbers only, and nothing extra.
const GRID_LINE = /^(\d+)\s+(\d+)$/;
const ROBOT_LINE = /^(\d+)\s+(\d+)\s+([NESW])$/;

function parseCoordinateValue(digits: string, line: string): number {
  const value = Number(digits);
  if (value > MAX_COORDINATE) {
    throw new InvalidInputError(
      `Coordinate ${value} is over ${MAX_COORDINATE} in: ${line}`,
    );
  }
  return value;
}

function parseGrid(line: string): Grid {
  const match = GRID_LINE.exec(line);
  if (!match) {
    throw new InvalidInputError(`Invalid grid line (expected "x y"): ${line}`);
  }
  const [, x, y] = match;
  return new Grid(parseCoordinateValue(x, line), parseCoordinateValue(y, line));
}

function parseRobot(line: string, grid: Grid): Robot {
  const match = ROBOT_LINE.exec(line);
  if (!match) {
    throw new InvalidInputError(
      `Invalid robot line (expected "x y N|E|S|W"): ${line}`,
    );
  }
  const [, x, y, orientation] = match;
  const coordinate = {
    x: parseCoordinateValue(x, line),
    y: parseCoordinateValue(y, line),
  };

  if (grid.isOutOfBounds(coordinate)) {
    throw new InvalidInputError(`Robot position out of bounds: ${line}`);
  }
  // ROBOT_LINE only matches N, E, S or W so this cast is safe.
  return new Robot(coordinate, orientation as Orientation);
}

function parseInstructions(line: string): string {
  if (line.length >= INSTRUCTION_LENGTH_LIMIT) {
    throw new InvalidInputError(
      `Instructions must be under ${INSTRUCTION_LENGTH_LIMIT} characters: ${line}`,
    );
  }
  const unknownLetter = [...line].find(
    (letter) => !Object.hasOwn(COMMANDS, letter),
  );
  if (unknownLetter !== undefined) {
    throw new InvalidInputError(
      `Unknown instruction "${unknownLetter}" in: ${line}`,
    );
  }
  return line;
}

interface RobotPlan {
  robot: Robot;
  instructions: string;
}

interface Mission {
  grid: Grid;
  robotPlans: RobotPlan[];
}

/**
 * Parses and checks the whole input before anything runs.
 * @throws {InvalidInputError} if any line is invalid.
 */
export function parseMissionInput(input: string): Mission {
  // Blank lines (e.g. between robots) are ignored; \r handles Windows line endings.
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const [gridLine, ...robotLines] = lines;
  if (gridLine === undefined) {
    throw new InvalidInputError("Input is empty");
  }

  const grid = parseGrid(gridLine);
  const robotPlans: RobotPlan[] = [];
  for (let i = 0; i < robotLines.length; i += 2) {
    const robotLine = robotLines[i];
    const instructionLine = robotLines[i + 1];
    if (instructionLine === undefined) {
      throw new InvalidInputError(
        `Missing instructions for robot: ${robotLine}`,
      );
    }
    robotPlans.push({
      robot: parseRobot(robotLine, grid),
      instructions: parseInstructions(instructionLine),
    });
  }
  return { grid, robotPlans };
}

function formatRobotStatus(robot: Robot): string {
  const status = `${robot.coordinate.x} ${robot.coordinate.y} ${robot.orientation}`;
  return robot.isLost ? `${status} LOST` : status;
}

/**
 * Runs each robot in turn on the same grid, so scents carry over, and returns one result line per robot.
 * @throws {InvalidInputError} if the input is invalid.
 */
export function runMission(input: string): string {
  const { grid, robotPlans } = parseMissionInput(input);

  const results: string[] = [];
  for (const { robot, instructions } of robotPlans) {
    executeInstructions(robot, instructions, grid);
    results.push(formatRobotStatus(robot));
  }
  return results.join("\n");
}
