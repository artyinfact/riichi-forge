#!/usr/bin/env npx ts-node
/**
 * completeLog.ts - 补全残缺的 Tenhou Log
 *
 * 输入: 包含残缺 RoundLog 和 PlayerEvent[] 的 GeneratorInput
 * 输出: 完整的 TenhouLogJson
 *
 * 使用方式:
 *   npx ts-node src/scripts/completeLog.ts input.json [output.json]
 *   npx ts-node src/scripts/completeLog.ts --stdin < input.json
 *
 * 输入 JSON 格式 (GeneratorInput):
 * {
 *   "roundLog": [...],           // RoundLog 结构，可含 null
 *   "playerEvents": [[...], [...], [...], [...]],  // 四家的事件
 *   "heroSeat": 0,               // 0-3
 *   "rule": { "aka": 1 }         // 规则配置
 * }
 *
 * 选项:
 *   --pretty    格式化输出 JSON
 *   --stdin     从标准输入读取
 *   --url       输出 Tenhou 播放器 URL
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GeneratorInput, TenhouLogJson } from '../types';
import { generate } from '../core/generator/LogGenerator';
import type { GeneratorOptions } from '../core/generator/LogGenerator';
import { validateGeneratorInput, formatValidationResult } from '../utils/validator';

// ==========================================
// CLI 参数解析
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

补全残缺的 Tenhou Log，输出完整的 TenhouLogJson。

Arguments:
  input.json     输入文件 (GeneratorInput 格式)
  output.json    输出文件 (可选，默认输出到 stdout)

Options:
  --stdin        从标准输入读取 JSON
  --pretty, -p   格式化输出 JSON
  --url, -u      输出 Tenhou 播放器 URL
  --help, -h     显示帮助信息

Examples:
  # 从文件读取，输出到 stdout
  npx ts-node completeLog.ts input.json

  # 从文件读取，输出到文件
  npx ts-node completeLog.ts input.json output.json

  # 从 stdin 读取
  cat input.json | npx ts-node completeLog.ts --stdin

  # 输出格式化 JSON 和 URL
  npx ts-node completeLog.ts --pretty --url input.json
`);
}

// ==========================================
// 主逻辑
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

  // 读取输入
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

  // 解析 JSON
  let input: GeneratorInput;
  try {
    input = JSON.parse(inputJson) as GeneratorInput;
  } catch (e) {
    console.error('Error: Failed to parse input JSON');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  // 验证输入
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

  // 生成完整的 log
  const options: GeneratorOptions = {
    roomName: '牌谱屋',
    playerNames: ['東家', '南家', '西家', '北家'],
  };

  const result = generate(input, options);

  // 输出
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

