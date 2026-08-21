/**
 * data.js — 지게차 엔진 사양 데이터 코어 모듈 (UMD)
 *
 * 브라우저와 Node.js(테스트)에서 동일하게 사용한다.
 *  - 3.1.2  스키마를 데이터로 관리: schema 시트가 화면 표시 항목/그룹/순서를 결정
 *  - 3.1.3  엑셀 Import: workbookToData()
 *  - 3.1.4  엑셀 Export: dataToWorkbook() — Import 양식과 완전 동일 (round-trip 보장)
 *  - 3.2.2.1 비교 표 "<-" 표기 로직: isSameValue(), buildComparisonRows()
 *
 * 외부 네트워크·외부 AI API 호출 없음. (사내 대외비 데이터 전제)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(); // Node.js (테스트)
  } else {
    root.EngineData = factory(); // 브라우저
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* 상수: 시트 이름 / 헤더 (Import 양식 = Export 양식, 완전 동일해야 함) */
  /* ------------------------------------------------------------------ */

  var SHEET_ENGINES = "engines";
  var SHEET_CURVES = "curves";
  var SHEET_SCHEMA = "schema";

  // schema 시트 헤더 (3.1.2)
  var SCHEMA_HEADERS = ["항목 키", "표시명", "그룹", "단위", "순서"];

  // curves 시트 헤더 (시트 2: RPM별 곡선)
  var CURVE_HEADERS = ["엔진 모델명", "RPM", "출력(kW)", "토크(Nm)"];

  // 화면 그룹 표시 순서 (schema 에 없는 항목은 "기타" 그룹으로 — graceful)
  var GROUP_ORDER = ["기본 정보", "성능", "주요 제원", "규제·인증", "기타"];
  var GROUP_ETC = "기타";

  // 검색(3.2)에 쓰는 특수 키
  var KEY_MODEL = "engine_model";
  var KEY_FORKLIFTS = "forklift_models";

  /**
   * 기본 스키마 — schema 시트가 없는 통합문서를 Import 했을 때의 fallback.
   * (표준 양식/샘플 엑셀에는 동일한 내용의 schema 시트가 들어 있다)
   */
  var DEFAULT_SCHEMA = [
    // [항목 키, 표시명, 그룹, 단위, 순서]
    ["manufacturer", "엔진 제조사", "기본 정보", "", 10],
    ["engine_model", "엔진 모델명", "기본 정보", "", 20],
    ["forklift_models", "적용 지게차 모델", "기본 정보", "", 30],
    ["rated_power_kw", "정격 출력", "성능", "kW", 40],
    ["rated_power_rpm", "정격 출력 RPM", "성능", "rpm", 50],
    ["max_torque_nm", "최대 토크", "성능", "Nm", 60],
    ["max_torque_rpm", "최대 토크 RPM", "성능", "rpm", 70],
    ["low_idle_rpm", "Low Idle RPM", "성능", "rpm", 80],
    ["high_idle_rpm", "High Idle RPM", "성능", "rpm", 90],
    ["weight_kg", "무게", "주요 제원", "kg", 100],
    ["engine_type", "엔진 타입", "주요 제원", "", 110],
    ["cylinders", "실린더 수", "주요 제원", "개", 120],
    ["displacement_cc", "배기량", "주요 제원", "cc", 130],
    ["oil_capacity_l", "오일 용량", "주요 제원", "L", 140],
    ["coolant_capacity_l", "냉각수 용량", "주요 제원", "L", 150],
    ["fuel_consumption", "연비(정격점)", "주요 제원", "g/kWh", 160],
    ["alternator", "알터네이터 스펙", "주요 제원", "", 170],
    ["starter_motor_kw", "스타터 모터 출력", "주요 제원", "kW", 180],
    ["emission_cert", "배기 규제 인증", "규제·인증", "", 190],
    ["aftertreatment", "후처리장치 타입", "규제·인증", "", 200]
  ].map(function (r) {
    return { key: r[0], label: r[1], group: r[2], unit: r[3], order: r[4] };
  });

  /* ------------------------------------------------------------------ */
  /* 내부 유틸                                                            */
  /* ------------------------------------------------------------------ */

  function isBlank(v) {
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  }

  /** 셀 값 정규화: 문자열 trim, 숫자 문자열은 숫자로, 빈 값은 null */
  function normalizeCell(v) {
    if (isBlank(v)) return null;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    var s = String(v).trim();
    if (s === "") return null;
    // 순수 숫자 형태(천단위 콤마 없이)만 숫자로 변환
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ------------------------------------------------------------------ */
  /* 정규화 (Import 직후 / Export 직전에 항상 같은 형태 보장)              */
  /* ------------------------------------------------------------------ */

  /**
   * 데이터 정규화:
   *  - engines: 각 셀 normalizeCell, null 값 키 제거
   *  - curves: RPM 오름차순 정렬, 숫자화
   *  - schema: 순서 오름차순 정렬
   * round-trip(Import→Export→재Import) 시 동일성을 보장하는 기준 형태.
   */
  function normalizeData(data) {
    var schema = (data.schema && data.schema.length ? data.schema : DEFAULT_SCHEMA)
      .map(function (s) {
        return {
          key: String(s.key == null ? "" : s.key).trim(),
          label: isBlank(s.label) ? String(s.key) : String(s.label).trim(),
          group: isBlank(s.group) ? GROUP_ETC : String(s.group).trim(),
          unit: isBlank(s.unit) ? "" : String(s.unit).trim(),
          order: typeof s.order === "number" ? s.order : Number(s.order) || 0
        };
      })
      .filter(function (s) { return s.key !== ""; })
      .sort(function (a, b) { return a.order - b.order; });

    var engines = (data.engines || []).map(function (row) {
      var out = {};
      Object.keys(row).forEach(function (k) {
        var v = normalizeCell(row[k]);
        if (v !== null) out[String(k).trim()] = v;
      });
      return out;
    }).filter(function (row) { return !isBlank(row[KEY_MODEL]); });

    var curves = {};
    Object.keys(data.curves || {}).forEach(function (model) {
      var pts = (data.curves[model] || [])
        .map(function (p) {
          return {
            rpm: Number(p.rpm),
            power: p.power == null || p.power === "" ? null : Number(p.power),
            torque: p.torque == null || p.torque === "" ? null : Number(p.torque)
          };
        })
        .filter(function (p) { return isFinite(p.rpm); })
        .sort(function (a, b) { return a.rpm - b.rpm; });
      if (pts.length) curves[String(model).trim()] = pts;
    });

    return { schema: schema, engines: engines, curves: curves };
  }

  /* ------------------------------------------------------------------ */
  /* Import: 통합문서(workbook) → 데이터 (3.1.3)                          */
  /* ------------------------------------------------------------------ */

  /**
   * XLSX 통합문서를 내부 데이터 구조로 변환한다.
   * @param {object} wb   SheetJS workbook
   * @param {object} XLSX SheetJS 라이브러리 객체
   */
  function workbookToData(wb, XLSX) {
    var enginesSheet = wb.Sheets[SHEET_ENGINES];
    if (!enginesSheet) {
      throw new Error("표준 양식이 아닙니다: 'engines' 시트가 없습니다.");
    }
    var engineRows = XLSX.utils.sheet_to_json(enginesSheet, { defval: null });

    var curveMap = {};
    if (wb.Sheets[SHEET_CURVES]) {
      XLSX.utils.sheet_to_json(wb.Sheets[SHEET_CURVES], { defval: null }).forEach(function (r) {
        var model = normalizeCell(r[CURVE_HEADERS[0]]);
        if (isBlank(model)) return;
        if (!curveMap[model]) curveMap[model] = [];
        curveMap[model].push({
          rpm: normalizeCell(r[CURVE_HEADERS[1]]),
          power: normalizeCell(r[CURVE_HEADERS[2]]),
          torque: normalizeCell(r[CURVE_HEADERS[3]])
        });
      });
    }

    var schemaRows = [];
    if (wb.Sheets[SHEET_SCHEMA]) {
      XLSX.utils.sheet_to_json(wb.Sheets[SHEET_SCHEMA], { defval: null }).forEach(function (r) {
        schemaRows.push({
          key: r[SCHEMA_HEADERS[0]],
          label: r[SCHEMA_HEADERS[1]],
          group: r[SCHEMA_HEADERS[2]],
          unit: r[SCHEMA_HEADERS[3]],
          order: r[SCHEMA_HEADERS[4]]
        });
      });
    }

    return normalizeData({ schema: schemaRows, engines: engineRows, curves: curveMap });
  }

  /* ------------------------------------------------------------------ */
  /* Export: 데이터 → 통합문서 (3.1.4 — Import 양식과 완전 동일)           */
  /* ------------------------------------------------------------------ */

  /**
   * engines 시트의 컬럼(항목 키) 순서:
   * schema 순서를 따르고, schema 에 없는 키(기타 항목)는 뒤에 등장 순서대로 붙인다.
   */
  function engineColumnKeys(data) {
    var keys = [];
    var seen = {};
    data.schema.forEach(function (s) {
      if (!seen[s.key]) { seen[s.key] = true; keys.push(s.key); }
    });
    data.engines.forEach(function (row) {
      Object.keys(row).forEach(function (k) {
        if (!seen[k]) { seen[k] = true; keys.push(k); }
      });
    });
    return keys;
  }

  function dataToWorkbook(data, XLSX) {
    var norm = normalizeData(data);
    var wb = XLSX.utils.book_new();

    // 시트 1: engines
    var keys = engineColumnKeys(norm);
    var engineAoa = [keys];
    norm.engines.forEach(function (row) {
      engineAoa.push(keys.map(function (k) {
        return row[k] === undefined ? null : row[k];
      }));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(engineAoa), SHEET_ENGINES);

    // 시트 2: curves
    var curveAoa = [CURVE_HEADERS.slice()];
    // 곡선 행 순서는 engines 시트의 엔진 순서를 따른다 (round-trip 안정성)
    var modelOrder = norm.engines.map(function (e) { return e[KEY_MODEL]; });
    Object.keys(norm.curves).forEach(function (m) {
      if (modelOrder.indexOf(m) < 0) modelOrder.push(m);
    });
    modelOrder.forEach(function (model) {
      (norm.curves[model] || []).forEach(function (p) {
        curveAoa.push([model, p.rpm, p.power, p.torque]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(curveAoa), SHEET_CURVES);

    // 시트 3: schema (3.1.2)
    var schemaAoa = [SCHEMA_HEADERS.slice()];
    norm.schema.forEach(function (s) {
      schemaAoa.push([s.key, s.label, s.group, s.unit, s.order]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(schemaAoa), SHEET_SCHEMA);

    return wb;
  }

  /* ------------------------------------------------------------------ */
  /* 조회 (3.2)                                                          */
  /* ------------------------------------------------------------------ */

  /** 엔진 모델명 또는 적용 지게차 모델명(쉼표 구분 목록)으로 검색 */
  function searchEngines(data, query) {
    var q = String(query || "").trim().toLowerCase();
    if (q === "") return data.engines.slice();
    return data.engines.filter(function (e) {
      var model = String(e[KEY_MODEL] || "").toLowerCase();
      if (model.indexOf(q) >= 0) return true;
      var forks = String(e[KEY_FORKLIFTS] || "").toLowerCase().split(",");
      return forks.some(function (f) { return f.trim().indexOf(q) >= 0; });
    });
  }

  function findEngine(data, model) {
    for (var i = 0; i < data.engines.length; i++) {
      if (data.engines[i][KEY_MODEL] === model) return data.engines[i];
    }
    return null;
  }

  /**
   * 스키마 기반 그룹핑 (3.1.2):
   * schema 순서대로 4개 그룹에 항목을 배치하고,
   * schema 에 없는 엔진 컬럼은 "기타" 그룹으로 표시한다(코드 수정 없이 열 추가 인식).
   * @returns [{group, items:[{key,label,unit,value}]}]
   */
  function groupSpecs(data, engine) {
    var groups = {};
    var groupNames = [];
    function bucket(name) {
      if (!groups[name]) {
        groups[name] = [];
        groupNames.push(name);
      }
      return groups[name];
    }
    // 그룹 기본 순서 고정
    GROUP_ORDER.forEach(function (g) { bucket(g); });

    var known = {};
    data.schema.forEach(function (s) {
      known[s.key] = true;
      bucket(s.group).push({
        key: s.key,
        label: s.label,
        unit: s.unit,
        value: engine ? (engine[s.key] === undefined ? null : engine[s.key]) : null
      });
    });
    // schema 에 없는 항목 → 기타
    if (engine) {
      Object.keys(engine).forEach(function (k) {
        if (!known[k]) {
          bucket(GROUP_ETC).push({ key: k, label: k, unit: "", value: engine[k] });
        }
      });
    }
    return groupNames
      .map(function (g) { return { group: g, items: groups[g] }; })
      .filter(function (g) { return g.items.length > 0; });
  }

  /* ------------------------------------------------------------------ */
  /* 비교 (3.3 / 3.2.2.1)                                                */
  /* ------------------------------------------------------------------ */

  var SAME_MARK = "<-";

  /**
   * 왼쪽 컬럼과 동일 값 판정 (3.2.2.1):
   *  - 둘 다 숫자면 수치 동등 비교
   *  - 그 외에는 문자열 완전 일치(trim 후)
   *  - 둘 다 빈 값이면 동일로 본다
   */
  function isSameValue(a, b) {
    var av = isBlank(a) ? null : a;
    var bv = isBlank(b) ? null : b;
    if (av === null && bv === null) return true;
    if (av === null || bv === null) return false;
    if (typeof av === "number" && typeof bv === "number") return av === bv;
    var an = normalizeCell(av), bn = normalizeCell(bv);
    if (typeof an === "number" && typeof bn === "number") return an === bn;
    return String(av).trim() === String(bv).trim();
  }

  /**
   * 비교 표 행 생성 (최대 4개 엔진).
   * 각 셀: 왼쪽 엔진과 값이 동일하면 "<-", 아니면 실제 값.
   * @returns [{group, label, unit, key, cells:[{text, same, raw}]}]
   */
  function buildComparisonRows(data, models) {
    if (models.length > 4) throw new Error("엔진 비교는 최대 4개까지 가능합니다.");
    var engines = models.map(function (m) { return findEngine(data, m) || {}; });

    // 대표 스키마 그룹핑(모든 엔진의 기타 항목 포함)
    var allKeys = [];
    var meta = {};
    data.schema.forEach(function (s) {
      allKeys.push(s.key);
      meta[s.key] = s;
    });
    engines.forEach(function (e) {
      Object.keys(e).forEach(function (k) {
        if (!meta[k]) {
          meta[k] = { key: k, label: k, group: GROUP_ETC, unit: "" };
          allKeys.push(k);
        }
      });
    });

    var rows = [];
    GROUP_ORDER.forEach(function (g) {
      allKeys.forEach(function (k) {
        if (meta[k].group !== g) return;
        var cells = [];
        for (var i = 0; i < engines.length; i++) {
          var raw = engines[i][k] === undefined ? null : engines[i][k];
          var same = i > 0 && isSameValue(raw, engines[i - 1][k] === undefined ? null : engines[i - 1][k]);
          cells.push({ raw: raw, same: same, text: same ? SAME_MARK : formatValue(raw, meta[k].unit) });
        }
        rows.push({ group: g, key: k, label: meta[k].label, unit: meta[k].unit, cells: cells });
      });
    });
    return rows;
  }

  /** 값 + 단위 표시 문자열 */
  function formatValue(v, unit) {
    if (isBlank(v)) return "-";
    var s = typeof v === "number" ? String(v) : String(v).trim();
    return unit ? s + " " + unit : s;
  }

  /* ------------------------------------------------------------------ */
  /* 공개 API                                                            */
  /* ------------------------------------------------------------------ */

  return {
    SHEET_ENGINES: SHEET_ENGINES,
    SHEET_CURVES: SHEET_CURVES,
    SHEET_SCHEMA: SHEET_SCHEMA,
    SCHEMA_HEADERS: SCHEMA_HEADERS,
    CURVE_HEADERS: CURVE_HEADERS,
    GROUP_ORDER: GROUP_ORDER,
    KEY_MODEL: KEY_MODEL,
    KEY_FORKLIFTS: KEY_FORKLIFTS,
    SAME_MARK: SAME_MARK,
    DEFAULT_SCHEMA: DEFAULT_SCHEMA,
    normalizeData: normalizeData,
    workbookToData: workbookToData,
    dataToWorkbook: dataToWorkbook,
    engineColumnKeys: engineColumnKeys,
    searchEngines: searchEngines,
    findEngine: findEngine,
    groupSpecs: groupSpecs,
    isSameValue: isSameValue,
    buildComparisonRows: buildComparisonRows,
    formatValue: formatValue,
    deepClone: deepClone
  };
});
