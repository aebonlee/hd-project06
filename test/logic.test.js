/**
 * logic.test.js — 화면 로직 단위 테스트
 *
 *   1) "<-" 동일 값 표기 로직 (3.2.2.1)
 *   2) 스키마 기반 그룹핑 (3.1.2) — schema 에 없는 항목은 "기타" 그룹
 *   3) 검색 (3.2) — 엔진 모델명 / 적용 지게차 모델명
 *
 * 실행: node test/logic.test.js
 */
"use strict";

const path = require("path");
const assert = require("assert");

const EngineData = require(path.join(__dirname, "..", "js", "data.js"));
const SAMPLE = require(path.join(__dirname, "..", "js", "sample-data.js"));

const data = EngineData.normalizeData(EngineData.deepClone(SAMPLE));

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log("  [통과] " + name);
}

console.log("== 로직 단위 테스트 ==");

/* ---------------------------------------------------------------- "<-" (3.2.2.1) */

ok("isSameValue: 숫자는 수치 동등 비교", () => {
  assert.strictEqual(EngineData.isSameValue(4, 4), true);
  assert.strictEqual(EngineData.isSameValue(4, "4"), true); // 엑셀 셀 서식 차이 허용
  assert.strictEqual(EngineData.isSameValue(4.0, 4), true);
  assert.strictEqual(EngineData.isSameValue(4, 6), false);
  assert.strictEqual(EngineData.isSameValue(55.3, 55.30001), false); // 허용 오차 없음(완전 일치)
});

ok("isSameValue: 문자열은 trim 후 완전 일치", () => {
  assert.strictEqual(EngineData.isSameValue("전자식", "전자식 "), true);
  assert.strictEqual(EngineData.isSameValue("전자식", "기계식"), false);
  assert.strictEqual(EngineData.isSameValue("DOC + DPF", "DOC+DPF"), false);
});

ok("isSameValue: 빈 값끼리는 동일, 빈 값 vs 값은 다름", () => {
  assert.strictEqual(EngineData.isSameValue(null, undefined), true);
  assert.strictEqual(EngineData.isSameValue("", null), true);
  assert.strictEqual(EngineData.isSameValue(null, 0), false);
});

ok("buildComparisonRows: 왼쪽 컬럼과 동일하면 '<-'", () => {
  // DP34T, DP24E 는 같은 제조사(대한파워텍)·실린더 4개
  const rows = EngineData.buildComparisonRows(data, ["DP34T", "DP24E"]);
  const maker = rows.find((r) => r.key === "manufacturer");
  assert.strictEqual(maker.cells[0].text, "대한파워텍");
  assert.strictEqual(maker.cells[1].text, "<-");
  assert.strictEqual(maker.cells[1].same, true);
  const cyl = rows.find((r) => r.key === "cylinders");
  assert.strictEqual(cyl.cells[1].text, "<-");
  const weight = rows.find((r) => r.key === "weight_kg");
  assert.strictEqual(weight.cells[0].text, "305 kg");
  assert.notStrictEqual(weight.cells[1].text, "<-");
});

ok("buildComparisonRows: '<-' 는 바로 왼쪽 컬럼 기준(첫 컬럼 기준 아님)", () => {
  const rows = EngineData.buildComparisonRows(data, ["DP34T", "QF2.8M", "4YS88"]);
  const cyl = rows.find((r) => r.key === "cylinders"); // 4, 4, 4
  assert.deepStrictEqual(cyl.cells.map((c) => c.text), ["4 개", "<-", "<-"]);
  const type = rows.find((r) => r.key === "engine_type"); // 전자식, 기계식, 기계식
  assert.deepStrictEqual(type.cells.map((c) => c.text), ["전자식", "기계식", "<-"]);
});

ok("buildComparisonRows: 4개 초과는 예외 (최대 4개)", () => {
  assert.throws(() => {
    EngineData.buildComparisonRows(data, ["a", "b", "c", "d", "e"]);
  }, /최대 4개/);
});

/* ---------------------------------------------------------------- 스키마 그룹핑 (3.1.2) */

ok("groupSpecs: 4개 그룹이 schema 순서대로 구성", () => {
  const engine = EngineData.findEngine(data, "DP34T");
  const groups = EngineData.groupSpecs(data, engine);
  assert.deepStrictEqual(
    groups.map((g) => g.group),
    ["기본 정보", "성능", "주요 제원", "규제·인증"]
  );
  const perf = groups.find((g) => g.group === "성능");
  assert.strictEqual(perf.items[0].label, "정격 출력");
  assert.strictEqual(perf.items[0].value, 55.3);
  assert.strictEqual(perf.items[0].unit, "kW");
});

ok("groupSpecs: schema 에 없는 항목은 '기타' 그룹으로 표시 (graceful)", () => {
  const engine = Object.assign({}, EngineData.findEngine(data, "DP34T"), {
    "미등록항목X": "값123"
  });
  const groups = EngineData.groupSpecs(data, engine);
  const etc = groups.find((g) => g.group === "기타");
  assert.ok(etc, "기타 그룹 존재");
  assert.strictEqual(etc.items[0].label, "미등록항목X");
  assert.strictEqual(etc.items[0].value, "값123");
});

ok("groupSpecs: schema 행 추가만으로 새 항목이 지정 그룹에 표시 (코드 수정 없음)", () => {
  const d2 = EngineData.deepClone(data);
  d2.schema.push({ key: "warranty_hours", label: "엔진 보증 수명", group: "주요 제원", unit: "시간", order: 165 });
  const norm = EngineData.normalizeData(d2);
  const engine = Object.assign({}, EngineData.findEngine(norm, "DP34T"), { warranty_hours: 10000 });
  const groups = EngineData.groupSpecs(norm, engine);
  const main = groups.find((g) => g.group === "주요 제원");
  const item = main.items.find((i) => i.key === "warranty_hours");
  assert.ok(item, "주요 제원 그룹에 존재");
  assert.strictEqual(item.label, "엔진 보증 수명");
  assert.strictEqual(item.value, 10000);
  // order=165 → 연비(160) 와 알터네이터(170) 사이
  const idx = main.items.map((i) => i.key);
  assert.ok(idx.indexOf("warranty_hours") === idx.indexOf("fuel_consumption") + 1);
});

/* ---------------------------------------------------------------- 검색 (3.2) */

ok("searchEngines: 엔진 모델명으로 검색 (대소문자 무시)", () => {
  const r = EngineData.searchEngines(data, "dp3");
  assert.deepStrictEqual(r.map((e) => e.engine_model), ["DP34T"]);
});

ok("searchEngines: 적용 지게차 모델명으로 검색", () => {
  const r = EngineData.searchEngines(data, "HF250D-9");
  assert.deepStrictEqual(
    r.map((e) => e.engine_model).sort(),
    ["4YS98T", "DP34T", "QF3.8L"]
  );
});

ok("searchEngines: 빈 검색어는 전체 목록", () => {
  assert.strictEqual(EngineData.searchEngines(data, "").length, 6);
});

ok("formatValue: 값 + 단위 / 빈 값은 '-'", () => {
  assert.strictEqual(EngineData.formatValue(55.3, "kW"), "55.3 kW");
  assert.strictEqual(EngineData.formatValue("전자식", ""), "전자식");
  assert.strictEqual(EngineData.formatValue(null, "kW"), "-");
});

console.log("총 " + passed + "건 통과");
