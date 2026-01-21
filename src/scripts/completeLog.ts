#!/usr/bin/env npx ts-node
/**
 * completeLog.ts - Complete incomplete Tenhou Log
 *
 * Input: GeneratorInput containing incomplete RoundLog and PlayerEvent[]
 * Output: Complete TenhouLogJson
 *
 * Usage:
 *   npx ts-node src/scripts/completeLog.ts input.json [output.json]
 *   npx ts-node src/scripts/completeLog.ts --stdin < input.json
 *
 * Input JSON format (GeneratorInput):
 * {
 *   "roundLog": [...],           // RoundLog structure, may contain null
 *   "playerEvents": [[...], [...], [...], [...]],  // Events for all 4 players
 *   "heroSeat": 0,               // 0-3
 *   "rule": { "aka": 1 }         // Rule configuration
 * }
 *
 * Options:
 *   --pretty    Format output JSON
 *   --stdin     Read from standard input
 *   --url       Output Tenhou player URL
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GeneratorInput, TenhouLogJson } from '../types';
import { generate } from '../core/generator/LogGenerator';
import type { GeneratorOptions } from '../core/generator/LogGenerator';
import { validateGeneratorInput, formatValidationResult } from '../utils/validator';

// ==========================================
// CLI Argument Parsing
// ==========================================

interface CliArgs {
  inputFile?: string;
  outputFile?: string;
  pretty: boolean;
  stdin: boolean;
  url: boolean;
  help: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    pretty: false,
    stdin: false,
    url: false,
    help: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--pretty':
      case '-p':
        result.pretty = true;
        break;
      case '--stdin':
        result.stdin = true;
        break;
      case '--url':
      case '-u':
        result.url = true;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          positional.push(arg);
        }
    }
  }

  if (positional.length >= 1) {
    result.inputFile = positional[0];
  }
  if (positional.length >= 2) {
    result.outputFile = positional[1];
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: npx ts-node completeLog.ts [options] [input.json] [output.json]

Complete incomplete Tenhou Log, output complete TenhouLogJson.

Arguments:
  input.json     Input file (GeneratorInput format)
  output.json    Output file (optional, defaults to stdout)

Options:
  --stdin        Read JSON from standard input
  --pretty, -p   Format output JSON
  --url, -u      Output Tenhou player URL
  --help, -h     Show help information

Examples:
  # Read from file, output to stdout
  npx ts-node completeLog.ts input.json

  # Read from file, output to file
  npx ts-node completeLog.ts input.json output.json

  # Read from stdin
  cat input.json | npx ts-node completeLog.ts --stdin

  # Output formatted JSON and URL
  npx ts-node completeLog.ts --pretty --url input.json
`);
}

// ==========================================
// Main Logic
// ==========================================

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

function generateTenhouUrl(log: TenhouLogJson): string {
  const json = JSON.stringify(log);
  return `https://tenhou.net/6/#json=${encodeURIComponent(json)}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Read input
  let inputJson: string;

  if (args.stdin) {
    inputJson = await readStdin();
  } else if (args.inputFile) {
    const inputPath = path.resolve(args.inputFile);
    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }
    inputJson = fs.readFileSync(inputPath, 'utf8');
  } else {
    console.error('Error: No input specified. Use --stdin or provide input file.');
    printHelp();
    process.exit(1);
  }

  // Parse JSON
  let input: GeneratorInput;
  try {
    input = JSON.parse(inputJson) as GeneratorInput;
  } catch (e) {
    console.error('Error: Failed to parse input JSON');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  // Validate input
  const validationResult = validateGeneratorInput(input);
  if (!validationResult.valid) {
    console.error('Error: Invalid input');
    console.error(formatValidationResult(validationResult));
    process.exit(1);
  }

  if (validationResult.warnings.length > 0) {
    console.warn('Warnings:');
    console.warn(formatValidationResult(validationResult));
  }

  // Generate complete log
  const options: GeneratorOptions = {
    roomName: 'Paipu House',
    playerNames: ['East', 'South', 'West', 'North'],
  };

  const result = generate(input, options);

  // Output
  const outputJson = args.pretty
    ? JSON.stringify(result, null, 2)
    : JSON.stringify(result);

  if (args.outputFile) {
    const outputPath = path.resolve(args.outputFile);
    fs.writeFileSync(outputPath, outputJson, 'utf8');
    console.log(`Output written to: ${outputPath}`);
  } else {
    console.log(outputJson);
  }

  if (args.url) {
    console.log('\nTenhou URL:');
    console.log(generateTenhouUrl(result));
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
