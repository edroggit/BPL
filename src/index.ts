const MAX_COORDINATE = 50;
const MAX_INSTRUCTION_LENGTH = 100;

export interface Coordinate {
  readonly x: number;
  readonly y: number;
}

// Orientations are in clockwise order
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

function getOrientationIndex(orientation: Orientation): number {
  return ORIENTATIONS.indexOf(orientation);
}

export function turnLeft(orientation: Orientation): Orientation {
  const index = getOrientationIndex(orientation);
  return ORIENTATIONS[(index - 1 + ORIENTATIONS.length) % ORIENTATIONS.length];
}

export function turnRight(orientation: Orientation): Orientation {
  const index = getOrientationIndex(orientation);
  return ORIENTATIONS[(index + 1) % ORIENTATIONS.length];
}

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
    this.currentOrientation = turnLeft(this.currentOrientation);
  }

  turnRight(): void {
    this.currentOrientation = turnRight(this.currentOrientation);
  }

  nextCoordinate(): Coordinate {
    const movement = MOVEMENT_BY_ORIENTATION[this.orientation];
    return {
      x: this.currentCoordinate.x + movement.dx,
      y: this.currentCoordinate.y + movement.dy,
    };
  }

  moveForward(): void {
    this.currentCoordinate = this.nextCoordinate();
  }

  markLost(): void {
    this.lost = true;
  }
}

export interface Command {
  execute(robot: Robot, grid: Grid): void;
}

export const TurnLeft: Command = {
  execute(robot) {
    robot.turnLeft();
  },
};

export const TurnRight: Command = {
  execute(robot) {
    robot.turnRight();
  },
};

export const MoveForward: Command = {
  execute(robot, grid) {
    if (!grid.isOutOfBounds(robot.nextCoordinate())) {
      robot.moveForward();
      return;
    }
    // dont move off grid if scented
    if (grid.hasScent(robot.coordinate)) {
      return;
    }

    grid.leaveScent(robot.coordinate);
    robot.markLost();
  },
};

export const COMMANDS: ReadonlyMap<string, Command> = new Map([
  ["L", TurnLeft],
  ["R", TurnRight],
  ["F", MoveForward],
]);

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export class CommandProcessor {
  constructor(
    private readonly commands: ReadonlyMap<string, Command> = COMMANDS,
  ) {}

  execute(robot: Robot, instructions: string, grid: Grid): void {
    const commands = this.toCommands(instructions);

    for (const command of commands) {
      if (robot.isLost) {
        break;
      }
      command.execute(robot, grid);
    }
  }

  private toCommands(instructions: string): Command[] {
    return [...instructions].map((letter) => {
      const command = this.commands.get(letter);
      if (!command) {
        throw new InvalidInputError(`Unknown instruction "${letter}"`);
      }
      return command;
    });
  }
}

function parseCoordinateValue(text: string | undefined, line: string): number {
  const value = Number(text);
  if (
    text === undefined ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_COORDINATE
  ) {
    throw new InvalidInputError(`Invalid coordinate "${text}" in: ${line}`);
  }
  return value;
}

function parseGrid(line: string): Grid {
  const [x, y] = line.split(/\s+/);
  const maxX = parseCoordinateValue(x, line);
  const maxY = parseCoordinateValue(y, line);
  return new Grid(maxX, maxY);
}

function parseRobot(line: string, grid: Grid): Robot {
  const [x, y, orientation] = line.split(/\s+/);
  const xValue = parseCoordinateValue(x, line);
  const yValue = parseCoordinateValue(y, line);
  if (grid.isOutOfBounds({ x: xValue, y: yValue })) {
    throw new InvalidInputError(`Robot position out of bounds: ${line}`);
  }
  if (!ORIENTATIONS.includes(orientation as Orientation)) {
    throw new InvalidInputError(`Invalid robot orientation: ${line}`);
  }
  return new Robot({ x: xValue, y: yValue }, orientation as Orientation);
}

function parseInstructions(line: string): string {
  if (line.length >= MAX_INSTRUCTION_LENGTH) {
    throw new InvalidInputError(`Invalid instruction length: ${line}`);
  }
  return line;
}

type RobotPlan = { robot: Robot; instructions: string };
type Mission = { grid: Grid; robotPlans: RobotPlan[] };

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
    if (!robotLine || !instructionLine) {
      throw new InvalidInputError(`Invalid robot input: ${input}`);
    }
    const robot = parseRobot(robotLine, grid);
    const instructions = parseInstructions(instructionLine);
    robotPlans.push({ robot, instructions });
  }
  return { grid, robotPlans };
}

function formatRobotStatus(robot: Robot): string {
  return `${robot.coordinate.x} ${robot.coordinate.y} ${robot.orientation}${robot.isLost ? " LOST" : ""}`;
}

export function formatMissionOutput(mission: Mission): string {
  return mission.robotPlans
    .map(({ robot }) => formatRobotStatus(robot))
    .join("\n");
}

export function executeMission(mission: Mission): void {
  const processor = new CommandProcessor();
  for (const { robot, instructions } of mission.robotPlans) {
    processor.execute(robot, instructions, mission.grid);
  }
}

export function runMission(input: string): string {
  const mission = parseMissionInput(input);
  executeMission(mission);
  return formatMissionOutput(mission);
}
