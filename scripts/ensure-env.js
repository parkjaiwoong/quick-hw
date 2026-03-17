#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envLocal = path.join(root, ".env.local");
const envExample = path.join(root, ".env.example");

if (!fs.existsSync(envExample)) {
  console.error(".env.example 이 없습니다. 프로젝트 루트를 확인하세요.");
  process.exit(1);
}

if (!fs.existsSync(envLocal)) {
  fs.copyFileSync(envExample, envLocal);
  console.log("✓ .env.local 을 .env.example 에서 생성했습니다. 필요하면 값을 수정한 뒤 다시 실행하세요.");
} else {
  console.log("✓ .env.local 이 이미 있습니다.");
}
