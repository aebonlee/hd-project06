/**
 * roundtrip.test.js — Import/Export 양식 동일성 자동 테스트 (제약 5)
 *
 * 검증 내용:
 *   샘플 xlsx 읽기 → workbookToData(Import) → dataToWorkbook(Export)
 *   → 버퍼로 write → 재읽기 → workbookToData(재Import) → deep-equal
 *
 * 실행: node test/roundtrip.test.js
 * (웹페이지와 동일한 lib/xlsx.full.min.js, js/data.js 를 그대로 사용한다)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

function readWb(file) {
  return XLSX.read(fs.readFileSync(file), { type: "buffer" });
}

const XLSX = require(path.join(__dirname, "..", "lib", "xlsx.full.min.js"));
const EngineData = require(path.join(__dirname, "..", "js", "data.js"));

const SAMPLE = path.join(__dirname, "..", "templates", "엔진사양_샘플.xlsx");
const TEMPLATE = path.join(__dirname, "..", "templates", "엔진사양_표준양식.xlsx");

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log("  [통과] " + name);
}

console.log("== round-trip 테스트 (Import → Export → 재Import 동일성) ==");

// ---------------------------------------------------------------- 1. 샘플 Import
const wb1 = readWb(SAMPLE);
const data1 = EngineData.workbookToData(wb1, XLSX);

ok("샘플 Import: 엔진 6개 / 제조사 3곳", () => {
  assert.strictEqual(data1.engines.length, 6);
  const makers = new Set(data1.engines.map((e) => e.manufacturer));
  assert.strictEqual(makers.size, 3);
});

ok("샘플 Import: 엔진당 곡선 포인트 8~12개", () => {
  data1.engines.forEach((e) => {
    const pts = data1.curves[e.engine_model];
    assert.ok(pts && pts.length >= 8 && pts.length <= 12, e.engine_model);
  });
});

ok("샘플 데이터 무결성: 정격 출력/최대 토크 값이 곡선과 일치 (3.2.1.3 기준값)", () => {
  data1.engines.forEach((e) => {
    const pts = data1.curves[e.engine_model];
    const maxPower = Math.max(...pts.map((p) => p.power));
    const maxTorque = Math.max(...pts.map((p) => p.torque));
    assert.strictEqual(e.rated_power_kw, maxPower, e.engine_model + " 정격 출력");
    assert.strictEqual(e.max_torque_nm, maxTorque, e.engine_model + " 최대 토크");
    const atRated = pts.find((p) => p.rpm === e.rated_power_rpm);
    assert.ok(atRated && atRated.power === e.rated_power_kw, e.engine_model + " 정격 RPM 지점");
  });
});

// ---------------------------------------------------------------- 2. Export → 재Import
const wb2 = EngineData.dataToWorkbook(data1, XLSX);
const buf = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });
const wb3 = XLSX.read(buf, { type: "buffer" });
const data2 = EngineData.workbookToData(wb3, XLSX);

ok("Export 양식 = Import 양식: 시트 3개 이름 동일 (3.1.4)", () => {
  assert.deepStrictEqual(wb3.SheetNames, ["engines", "curves", "schema"]);
});

ok("Export 양식 = Import 양식: engines 헤더 동일", () => {
  const h1 = XLSX.utils.sheet_to_json(wb1.Sheets.engines, { header: 1 })[0];
  const h3 = XLSX.utils.sheet_to_json(wb3.Sheets.engines, { header: 1 })[0];
  assert.deepStrictEqual(h3, h1);
});

ok("Export 양식 = Import 양식: curves/schema 헤더 동일", () => {
  const c1 = XLSX.utils.sheet_to_json(wb1.Sheets.curves, { header: 1 })[0];
  const c3 = XLSX.utils.sheet_to_json(wb3.Sheets.curves, { header: 1 })[0];
  assert.deepStrictEqual(c3, c1);
  const s1 = XLSX.utils.sheet_to_json(wb1.Sheets.schema, { header: 1 })[0];
  const s3 = XLSX.utils.sheet_to_json(wb3.Sheets.schema, { header: 1 })[0];
  assert.deepStrictEqual(s3, s1);
});

ok("round-trip: Import → Export → 재Import 데이터 완전 동일", () => {
  assert.deepStrictEqual(data2, data1);
});

ok("round-trip 2회차도 동일 (안정 상태)", () => {
  const wb4 = EngineData.dataToWorkbook(data2, XLSX);
  const buf2 = XLSX.write(wb4, { type: "buffer", bookType: "xlsx" });
  const data3 = EngineData.workbookToData(XLSX.read(buf2, { type: "buffer" }), XLSX);
  assert.deepStrictEqual(data3, data2);
});

// ---------------------------------------------------------------- 3. 내장 샘플 = xlsx 샘플
ok("js/sample-data.js 내장 데이터 == 엔진사양_샘플.xlsx (정규화 후 동일)", () => {
  const sample = require(path.join(__dirname, "..", "js", "sample-data.js"));
  const normalized = EngineData.normalizeData(EngineData.deepClone(sample));
  assert.deepStrictEqual(normalized, data1);
});

// ---------------------------------------------------------------- 4. 빈 표준 양식
ok("빈 표준 양식 Import 가능 + schema 20개 항목 로드", () => {
  const wbT = readWb(TEMPLATE);
  const dataT = EngineData.workbookToData(wbT, XLSX);
  assert.strictEqual(dataT.engines.length, 0);
  assert.strictEqual(dataT.schema.length, 20);
});

// ---------------------------------------------------------------- 5. 항목 추가(3.1.2) round-trip
ok("항목 추가(3.1.2): 열+schema 행 추가 후에도 round-trip 동일", () => {
  const extended = EngineData.deepClone(data1);
  extended.schema.push({ key: "warranty_hours", label: "엔진 보증 수명", group: "주요 제원", unit: "시간", order: 165 });
  extended.engines.forEach((e, i) => { e.warranty_hours = 8000 + i * 1000; });
  const norm = EngineData.normalizeData(extended);
  const wbE = EngineData.dataToWorkbook(norm, XLSX);
  const bufE = XLSX.write(wbE, { type: "buffer", bookType: "xlsx" });
  const back = EngineData.workbookToData(XLSX.read(bufE, { type: "buffer" }), XLSX);
  assert.deepStrictEqual(back, norm);
  assert.strictEqual(back.engines[0].warranty_hours, 8000);
});

console.log("총 " + passed + "건 통과");
