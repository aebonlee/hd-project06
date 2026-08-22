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

// ---------------------------------------------------------------- 6. Import 유효성 검사
function buildWb(mutate) {
  // 샘플 데이터를 aoa 로 재조립한 통합문서를 만들고 mutate 로 변형한다
  const wb = EngineData.dataToWorkbook(data1, XLSX);
  const sheets = {};
  wb.SheetNames.forEach((n) => {
    sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
  });
  mutate(sheets);
  const out = XLSX.utils.book_new();
  Object.keys(sheets).forEach((n) => {
    if (sheets[n]) XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(sheets[n]), n);
  });
  return out;
}

ok("유효성: 'curves' 시트 없으면 시트명을 명시한 오류", () => {
  const wb = buildWb((s) => { s.curves = null; });
  assert.throws(() => EngineData.importWorkbook(wb, XLSX), /'curves' 시트가 없습니다/);
});

ok("유효성: 'engines' 시트 없으면 시트명을 명시한 오류", () => {
  const wb = buildWb((s) => { s.engines = null; });
  assert.throws(() => EngineData.importWorkbook(wb, XLSX), /'engines' 시트가 없습니다/);
});

ok("유효성: engines 시트에 engine_model 컬럼 없으면 컬럼명을 명시한 오류", () => {
  const wb = buildWb((s) => {
    const idx = s.engines[0].indexOf("engine_model");
    s.engines = s.engines.map((row) => row.filter((_, i) => i !== idx));
  });
  assert.throws(() => EngineData.importWorkbook(wb, XLSX), /engines 시트에 필수 컬럼 'engine_model'/);
});

ok("유효성: curves 시트에 필수 컬럼 없으면 컬럼명을 명시한 오류", () => {
  const wb = buildWb((s) => {
    s.curves = s.curves.map((row) => row.slice(0, 3)); // '토크(Nm)' 열 제거
  });
  assert.throws(() => EngineData.importWorkbook(wb, XLSX), /curves 시트에 필수 컬럼 '토크\(Nm\)'/);
});

ok("유효성: 숫자가 아닌 곡선 행은 행 번호와 함께 경고 + 제외 (NaN 방지)", () => {
  const wb = buildWb((s) => {
    s.curves[2][1] = "약 1200";   // 3행 RPM 을 숫자 아닌 값으로
    s.curves[5][2] = "N/A";       // 6행 출력(kW) 을 숫자 아닌 값으로
  });
  const result = EngineData.importWorkbook(wb, XLSX);
  assert.strictEqual(result.warnings.length, 2);
  assert.ok(/curves 시트 3행/.test(result.warnings[0]), result.warnings[0]);
  assert.ok(/RPM '약 1200'/.test(result.warnings[0]), result.warnings[0]);
  assert.ok(/curves 시트 6행/.test(result.warnings[1]), result.warnings[1]);
  assert.ok(/출력\(kW\) 'N\/A'/.test(result.warnings[1]), result.warnings[1]);
  // 문제 행 2건만 제외되고 나머지는 그대로 Import
  const total = (d) => Object.values(d.curves).reduce((n, pts) => n + pts.length, 0);
  assert.strictEqual(total(result.data), total(data1) - 2);
  // 남은 곡선 값은 전부 유한한 숫자 (차트에 NaN 이 들어가지 않음)
  Object.values(result.data.curves).forEach((pts) => pts.forEach((p) => {
    assert.ok(Number.isFinite(p.rpm));
    assert.ok(p.power === null || Number.isFinite(p.power));
    assert.ok(p.torque === null || Number.isFinite(p.torque));
  }));
});

ok("유효성: 정상 파일은 경고 없음 (importWorkbook == workbookToData)", () => {
  const result = EngineData.importWorkbook(wb1, XLSX);
  assert.deepStrictEqual(result.warnings, []);
  assert.deepStrictEqual(result.data, data1);
});

console.log("총 " + passed + "건 통과");
