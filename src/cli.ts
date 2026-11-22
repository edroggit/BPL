import { readFileSync } from "node:fs";
import { InvalidInputError, runMission } from "./index";

const STDIN_FILE_DESCRIPTOR = 0;
const USAGE = "Usage: npm start -- <input-file>  or  npm start < <input-file>";

function readInput(): string | undefined {
  const filePath = process.argv[2];
  if (filePath) {
    return readFileSync(filePath, "utf8");
  }
  // Nothing was piped in, so reading stdin would just wait for typing.
  if (process.stdin.isTTY) {
    return undefined;
  }
  return readFileSync(STDIN_FILE_DESCRIPTOR, "utf8");
}

const input = readInput();

if (input === undefined) {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  try {
    console.log(runMission(input));
  } catch (error) {
    // Bad input is a user error so show a clean message
    if (!(error instanceof InvalidInputError)) {
      throw error;
    }
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
