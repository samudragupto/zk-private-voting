/**
 * @file compileCircuit.js
 * @notice Compiles Circom circuit to R1CS, WASM, and SYM representations.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const FRONTEND_CIRCUITS_DIR = path.join(ROOT_DIR, "frontend", "public", "circuits");

async function main() {
  console.log("==================================================");
  console.log("Circom Circuit Compilation");
  console.log("==================================================");

  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  const circuitPath = path.join(CIRCUITS_DIR, "voting.circom");
  if (!fs.existsSync(circuitPath)) {
    throw new Error(`Circuit file not found at: ${circuitPath}`);
  }

  // 1. Detect Circom Compiler
  console.log("\nDetecting Circom Compiler...");
  let circomCmd = "circom";
  try {
    const version = execSync("circom --version", { encoding: "utf8" });
    console.log(`Circom detected in PATH: ${version.trim()}`);
  } catch (err) {
    const localCircom = path.join(ROOT_DIR, "circom.exe");
    if (fs.existsSync(localCircom)) {
      circomCmd = `"${localCircom}"`;
      console.log(`Local Circom binary found: ${localCircom}`);
    } else {
      throw new Error("Circom binary not found in PATH or root directory.");
    }
  }

  // Remove existing wasm files and directory to prevent Windows file locking
  const targetWasm = path.join(BUILD_DIR, "voting.wasm");
  if (fs.existsSync(targetWasm)) {
    try { fs.unlinkSync(targetWasm); } catch (e) {}
  }

  const votingJsDir = path.join(BUILD_DIR, "voting_js");
  if (fs.existsSync(votingJsDir)) {
    try {
      fs.rmSync(votingJsDir, { recursive: true, force: true });
    } catch (e) {}
  }

  // 2. Compile voting.circom
  console.log("\nCompiling voting.circom...");
  const compileCmd = `${circomCmd} "${circuitPath}" --r1cs --wasm --sym -o "${BUILD_DIR}" --prime bn128`;
  console.log(`Running: ${compileCmd}`);
  execSync(compileCmd, { stdio: "inherit" });
  console.log("Circuit compiled to R1CS, WASM, and SYM successfully.");

  // Copy WASM to build root and frontend
  const nestedWasm = path.join(BUILD_DIR, "voting_js", "voting.wasm");
  if (fs.existsSync(nestedWasm)) {
    fs.copyFileSync(nestedWasm, targetWasm);
  }

  if (fs.existsSync(FRONTEND_CIRCUITS_DIR) && fs.existsSync(targetWasm)) {
    fs.copyFileSync(targetWasm, path.join(FRONTEND_CIRCUITS_DIR, "voting.wasm"));
    console.log("Synchronized voting.wasm to frontend/public/circuits/");
  }

  console.log("\nCircuit compilation completed successfully.");
}

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Compilation error:", err);
      process.exit(1);
    });
}

module.exports = { main };
