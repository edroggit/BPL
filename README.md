# Martian Robots

A TypeScript solution to the Martian Robots problem. Robots move around a rectangular grid on Mars. A robot that drives off the edge is lost, and it leaves a "scent" behind that stops later robots falling off at the same point.

## Requirements

- Node.js 22.12 or later

## Setup

```bash
npm install
```

## Running

Pipe the input in through stdin:

```bash
npm start < sample-input.txt
```

or pass a file path:

```bash
npm start -- sample-input.txt
```

For the sample input, this prints:

```
1 1 E
3 3 N LOST
2 3 S
```

If the input is invalid, the program prints an error to stderr and exits with code 1.

## Tests

```bash
npm test
```

To check types (strict mode):

```bash
npm run typecheck
```

## Design

All the logic is in `src/index.ts`. `src/cli.ts` is a thin wrapper that handles input and output, so the tests can import the logic without touching stdin.

My rule for choosing between a class and something simpler: **a class is used only when it holds state or configuration.**

| Piece | Kind | Why |
|---|---|---|
| `Orientation`, `Coordinate`, the movement table | Types and constants | They're values that never change. Turning steps through a clockwise array, so there are no switch statements. |
| `Grid` | Class | It owns the bounds and the scents, and the scents have to persist across robots. How scents are stored is private. |
| `Robot` | Class | It owns its coordinate, orientation and lost state. Other code can read these but only change them through the robot's methods. It knows nothing about the grid. |
| `Command` | Interface | **This is where new commands plug in.** `TurnLeft`, `TurnRight` and `MoveForward` are plain objects, because they have no state. |
| `COMMANDS` | A map from letter to `Command` | Adding a command means adding one object and one entry here. Nothing else changes. |
| `CommandProcessor` | Class | It's configured with the set of commands. It converts a robot's instructions into commands and runs them, stopping once the robot is lost. |
| Parsing, formatting, `runMission` | Pure functions | They turn input into output and hold no state. |

`MoveForward` is the only piece that uses both the robot and the grid. It asks the robot where it *would* go, then either moves it, ignores the move (because of a scent) or leaves a scent and marks the robot lost. That keeps `Robot` and `Grid` independent of each other.

## Assumptions

- **A scent is per coordinate, not per direction.** The brief says a move off the world "from a grid point" with a scent is ignored, so a scent blocks every move off the edge from that point.
- **A lost robot reports its last position on the grid,** and its remaining instructions are skipped.
- **The whole input is checked first.** An invalid instruction letter is rejected before the robot moves, so bad input never leaves the program partway through.
- **These count as invalid input:** a coordinate that isn't a whole number from 0 to 50, an unknown orientation, a robot that starts off the grid, instructions of 100 or more characters, an unknown instruction letter, or a robot with no instruction line.
- **Blank lines are ignored,** and Windows line endings are accepted. So a robot can't have an empty instruction line.
- **Invalid input stops the program.** It doesn't report the error and carry on with the other robots.

## Trade-offs, and what I'd do with more time

- **One file.** I kept the logic in `index.ts` because it's easy to review in one place. At this size it reads fine. If the project grew, I'd split it into `domain/`, `commands/` and `parsing/`.
- **The CLI isn't tested automatically.** It's a thin wrapper and I checked it by hand (sample input, a file path, bad input). With more time I'd add a test that runs it as a separate process.
- **Error messages don't include line numbers.** They include the offending line's text, which is enough for input this size.
- **No extra commands.** The brief only asks to make room for them, so the `Command` interface and the map are where they'd go. I didn't build any.
- **Robots can occupy the same point.** The brief doesn't mention collisions, so robots don't check for each other.
