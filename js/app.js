/**
 * app.js — 화면 로직 (조회 3.2 / 그래프 3.2.1 / 비교 3.3 / Import·Export 3.1.3~3.1.4)
 *
 * 데이터 흐름:
 *   엑셀 Import(또는 샘플) → EngineData.workbookToData → state.data
 *   → localStorage 자동 저장(세션 간 유지) → 엑셀 Export 로 영속화/공유
 */
(function () {
  "use strict";

  var STORAGE_KEY = "hd06_engine_db_v1";
  var COLORS = EngineCharts.SERIES_COLORS;

  var state = {
    data: null,          // {schema, engines, curves}
    selectedModel: null, // 조회 화면에서 선택된 엔진
    search: "",
    compare: [],         // 비교 대상 모델명 (최대 4)
    chartMode: "dual"    // "dual" | "split"
  };

  var charts = { dual: null, power: null, torque: null, compare: null };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------- 알림 (비차단 토스트) */

  var toastTimer = null;
  function showToast(msg) {
    var el = $("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 8000);
  }

  /* ---------------------------------------------------------- 저장/복원 */

  function saveLocal() {
    try {
      if (state.data) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // 용량 초과, 저장소 차단(file:// 등) — 조용히 넘기지 않고 사용자에게 알린다
      showToast("브라우저 저장소에 데이터를 저장하지 못했습니다 (" + e.message + "). " +
        "창을 닫으면 데이터가 사라지니 엑셀 Export 로 보관하세요.");
    }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state.data = EngineData.normalizeData(JSON.parse(raw));
    } catch (e) {
      state.data = null;
      showToast("브라우저 저장소의 데이터를 불러오지 못했습니다 (" + e.message + "). " +
        "엑셀 Import 로 다시 불러오세요.");
    }
  }

  /* ---------------------------------------------------------- 데이터 설정 */

  function setData(data) {
    state.data = data;
    // 사라진 엔진 참조 정리
    if (data) {
      var models = data.engines.map(function (e) { return e[EngineData.KEY_MODEL]; });
      if (models.indexOf(state.selectedModel) < 0) state.selectedModel = models[0] || null;
      state.compare = state.compare.filter(function (m) { return models.indexOf(m) >= 0; });
    } else {
      state.selectedModel = null;
      state.compare = [];
    }
    saveLocal();
    renderAll();
  }

  /* ---------------------------------------------------------- 툴바 */

  function bindToolbar() {
    $("btnImport").addEventListener("click", function () { $("fileImport").click(); });

    // 3.1.3 엑셀 Import
    $("fileImport").addEventListener("change", function (ev) {
      var file = ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: "array" });
          var result = EngineData.importWorkbook(wb, XLSX);
          if (!result.data.engines.length) {
            alert("엔진 데이터가 없습니다. engines 시트를 확인하세요.");
          }
          setData(result.data);
          // 제외된 행(숫자가 아닌 RPM/출력/토크 등)을 행 번호와 함께 알린다
          if (result.warnings.length) {
            var w = result.warnings;
            showToast("Import 경고 " + w.length + "건 — " + w.slice(0, 3).join(" / ") +
              (w.length > 3 ? " 외 " + (w.length - 3) + "건" : ""));
          }
        } catch (err) {
          alert("Import 실패: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    // 3.1.4 엑셀 Export — Import 양식과 완전 동일
    $("btnExport").addEventListener("click", function () {
      if (!state.data || !state.data.engines.length) {
        alert("내보낼 데이터가 없습니다. 먼저 Import 하거나 샘플 데이터를 불러오세요.");
        return;
      }
      var wb = EngineData.dataToWorkbook(state.data, XLSX);
      var d = new Date();
      var stamp = d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
      XLSX.writeFile(wb, "엔진사양_DB_" + stamp + ".xlsx");
    });

    // 내장 샘플 (templates/엔진사양_샘플.xlsx 와 동일 내용)
    $("btnSample").addEventListener("click", function () {
      setData(EngineData.normalizeData(EngineData.deepClone(SAMPLE_DATA)));
    });

    $("btnClear").addEventListener("click", function () {
      if (!state.data) return;
      if (confirm("화면과 브라우저 저장소의 데이터를 지웁니다. (엑셀로 Export 하지 않은 데이터는 사라집니다)")) {
        setData(null);
      }
    });
  }

  /* ---------------------------------------------------------- 탭 */

  function bindTabs() {
    $("tabBrowse").addEventListener("click", function () { switchView("browse"); });
    $("tabCompare").addEventListener("click", function () { switchView("compare"); });
  }

  function switchView(v) {
    $("tabBrowse").classList.toggle("active", v === "browse");
    $("tabCompare").classList.toggle("active", v === "compare");
    $("viewBrowse").classList.toggle("active", v === "browse");
    $("viewCompare").classList.toggle("active", v === "compare");
    // 탭 전환 후 차트 리사이즈 반영
    Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].resize(); });
  }

  /* ---------------------------------------------------------- 조회: 목록/검색 (3.2) */

  function renderStatus() {
    var n = state.data ? state.data.engines.length : 0;
    $("dataStatus").textContent = n ? "엔진 " + n + "개 로드됨" : "데이터 없음";
  }

  function renderEngineList() {
    var ul = $("engineList");
    ul.innerHTML = "";
    if (!state.data || !state.data.engines.length) {
      ul.innerHTML = '<li class="empty-note">데이터가 없습니다.<br>엑셀 Import 또는 샘플 데이터를 불러오세요.</li>';
      return;
    }
    var list = EngineData.searchEngines(state.data, state.search);
    if (!list.length) {
      ul.innerHTML = '<li class="empty-note">검색 결과가 없습니다.</li>';
      return;
    }
    list.forEach(function (e) {
      var model = e[EngineData.KEY_MODEL];
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.className = model === state.selectedModel ? "selected" : "";
      btn.innerHTML =
        '<span class="model"></span><span class="maker"></span><span class="forks"></span>';
      btn.querySelector(".model").textContent = model;
      btn.querySelector(".maker").textContent = e.manufacturer || "";
      btn.querySelector(".forks").textContent = e[EngineData.KEY_FORKLIFTS] || "";
      btn.addEventListener("click", function () {
        state.selectedModel = model;
        renderEngineList();
        renderSpec();
        renderBrowseChart();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  /* ---------------------------------------------------------- 조회: 제원 표 (4그룹) */

  function renderSpec() {
    var body = $("specBody");
    var engine = state.data && state.selectedModel
      ? EngineData.findEngine(state.data, state.selectedModel) : null;

    if (!engine) {
      $("specTitle").textContent = "엔진 제원";
      body.innerHTML = '<p class="empty-note">왼쪽 목록에서 엔진을 선택하세요. ' +
        '데이터가 없으면 <b>엑셀 Import</b> 또는 <b>샘플 데이터 불러오기</b>를 먼저 실행하세요.</p>';
      $("chartCard").hidden = true;
      return;
    }

    $("specTitle").textContent = engine[EngineData.KEY_MODEL] + " 제원";
    // 3.1.2: schema 시트 기반 그룹핑 — schema 에 없는 항목은 "기타" 그룹
    var groups = EngineData.groupSpecs(state.data, engine);
    var table = document.createElement("table");
    table.className = "spec-table";
    var tbody = document.createElement("tbody");
    groups.forEach(function (g) {
      var trg = document.createElement("tr");
      var th = document.createElement("th");
      th.className = "group-row";
      th.colSpan = 2;
      th.textContent = g.group;
      trg.appendChild(th);
      tbody.appendChild(trg);
      g.items.forEach(function (item) {
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.className = "label";
        td1.textContent = item.label;
        var td2 = document.createElement("td");
        td2.className = "value";
        td2.textContent = EngineData.formatValue(item.value, item.unit);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tbody.appendChild(tr);
      });
    });
    table.appendChild(tbody);
    body.innerHTML = "";
    body.appendChild(table);

    // 곡선 데이터가 없는 엔진: 그래프 카드를 숨기는 대신 이유를 안내한다
    var curve = (state.data.curves || {})[engine[EngineData.KEY_MODEL]] || [];
    if (!curve.length) {
      var note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = "이 엔진은 RPM별 곡선(curves 시트) 데이터가 없어 그래프를 표시할 수 없습니다.";
      body.appendChild(note);
    }
  }

  /* ---------------------------------------------------------- 그래프 공통 */

  function numOrNull(id) {
    var v = $(id).value;
    return v === "" ? null : Number(v);
  }

  function chartEntry(model, color) {
    var e = state.data ? EngineData.findEngine(state.data, model) : null;
    var curve = (state.data && state.data.curves[model]) || [];
    var entry = { model: model, color: color, curve: curve, rated: null, maxTorque: null };
    if (e && typeof e.rated_power_kw === "number" && typeof e.rated_power_rpm === "number") {
      entry.rated = { kw: e.rated_power_kw, rpm: e.rated_power_rpm };   // 3.2.1.3
    }
    if (e && typeof e.max_torque_nm === "number" && typeof e.max_torque_rpm === "number") {
      entry.maxTorque = { nm: e.max_torque_nm, rpm: e.max_torque_rpm }; // 3.2.1.3
    }
    return entry;
  }

  function showReadout(elId, info) {
    var el = $(elId);
    el.innerHTML = '<span class="swatch"></span><strong></strong> <span class="model-tag"></span>';
    el.querySelector(".swatch").style.background = info.color;
    el.querySelector("strong").textContent = info.text;
    el.querySelector(".model-tag").textContent =
      "— " + info.model + " " + (info.metric === "power" ? "출력" : "토크");
  }

  /* ---------------------------------------------------------- 조회: 곡선 (3.2.1) */

  function destroyBrowseCharts() {
    ["dual", "power", "torque"].forEach(function (k) {
      if (charts[k]) { charts[k].destroy(); charts[k] = null; }
    });
  }

  function renderBrowseChart() {
    destroyBrowseCharts();
    var model = state.selectedModel;
    var hasCurve = !!(state.data && model && (state.data.curves[model] || []).length > 0);
    $("chartCard").hidden = !hasCurve;
    if (!hasCurve) return;

    var entry = chartEntry(model, COLORS[0]);
    // 단일 엔진 화면에서는 토크를 주황(시리즈 2)으로 구분
    var powerEntry = Object.assign({}, entry, { color: COLORS[0] });
    var torqueEntry = Object.assign({}, entry, { color: COLORS[1] });

    var yRanges = {
      powerMin: numOrNull("bPowerMin"), powerMax: numOrNull("bPowerMax"),
      torqueMin: numOrNull("bTorqueMin"), torqueMax: numOrNull("bTorqueMax")
    };
    var onClick = function (info) { showReadout("browseReadout", info); };

    var split = state.chartMode === "split";
    $("browseDualWrap").hidden = split;
    $("browseSplitWrap").hidden = !split;

    if (!split) {
      // 이중 Y축 한 차트 (출력=실선/파랑, 토크=점선/주황)
      charts.dual = EngineCharts.createCurveChart($("canvasDual"),
        [{ model: model, color: COLORS[0], curve: entry.curve, rated: entry.rated, maxTorque: null },
         { model: model, color: COLORS[1], curve: entry.curve, rated: null, maxTorque: entry.maxTorque }]
          .map(fixDualEntry),
        { which: "both", yRanges: yRanges, onPointClick: onClick });
    } else {
      charts.power = EngineCharts.createCurveChart($("canvasPower"), [powerEntry],
        { which: "power", yRanges: yRanges, onPointClick: onClick });
      charts.torque = EngineCharts.createCurveChart($("canvasTorque"), [torqueEntry],
        { which: "torque", yRanges: yRanges, onPointClick: onClick });
    }
  }

  /**
   * 이중축 모드에서 출력/토크에 서로 다른 색을 주기 위한 보정:
   * createCurveChart 는 엔진 1개당 출력+토크 데이터셋을 만들므로,
   * 첫 엔트리는 출력만(rated 라벨), 둘째 엔트리는 토크만(최대 토크 라벨) 남긴다.
   */
  function fixDualEntry(en, i) {
    var curve = en.curve.map(function (p) {
      return { rpm: p.rpm, power: i === 0 ? p.power : null, torque: i === 1 ? p.torque : null };
    }).filter(function (p) { return p.power != null || p.torque != null; });
    return Object.assign({}, en, { curve: curve });
  }

  function bindBrowseChartControls() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="chartMode"]'), function (r) {
      r.addEventListener("change", function () {
        state.chartMode = this.value;
        renderBrowseChart();
      });
    });
    ["bPowerMin", "bPowerMax", "bTorqueMin", "bTorqueMax"].forEach(function (id) {
      $(id).addEventListener("change", renderBrowseChart);
    });
    $("btnBrowseYReset").addEventListener("click", function () {
      ["bPowerMin", "bPowerMax", "bTorqueMin", "bTorqueMax"].forEach(function (id) { $(id).value = ""; });
      renderBrowseChart();
    });
  }

  /* ---------------------------------------------------------- 비교 (3.3) */

  function renderComparePicker() {
    var ul = $("compareChecks");
    ul.innerHTML = "";
    if (!state.data || !state.data.engines.length) {
      ul.innerHTML = '<li class="empty-note">데이터가 없습니다. 먼저 Import 하거나 샘플 데이터를 불러오세요.</li>';
      return;
    }
    state.data.engines.forEach(function (e) {
      var model = e[EngineData.KEY_MODEL];
      var checked = state.compare.indexOf(model) >= 0;
      var disabled = !checked && state.compare.length >= 4; // 최대 4개
      var li = document.createElement("li");
      var label = document.createElement("label");
      label.className = (checked ? "checked" : "") + (disabled ? " disabled" : "");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      cb.disabled = disabled;
      cb.addEventListener("change", function () {
        if (this.checked) {
          if (state.compare.length >= 4) { this.checked = false; return; }
          state.compare.push(model);
        } else {
          state.compare = state.compare.filter(function (m) { return m !== model; });
        }
        renderCompare();
      });
      var span = document.createElement("span");
      span.textContent = model + " ";
      var maker = document.createElement("span");
      maker.className = "maker";
      maker.textContent = e.manufacturer || "";
      label.appendChild(cb);
      label.appendChild(span);
      label.appendChild(maker);
      li.appendChild(label);
      ul.appendChild(li);
    });
  }

  // 3.2.2.1: 엔진 1개당 1컬럼, 왼쪽과 동일하면 "<-"
  function renderCompareTable() {
    var wrap = $("compareTableWrap");
    if (state.compare.length < 2) {
      wrap.innerHTML = '<p class="empty-note">위에서 엔진을 2개 이상 선택하세요.</p>';
      return;
    }
    var rows = EngineData.buildComparisonRows(state.data, state.compare);
    var table = document.createElement("table");
    table.className = "compare-table";

    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    var th0 = document.createElement("th");
    th0.textContent = "항목";
    trh.appendChild(th0);
    state.compare.forEach(function (m, i) {
      var th = document.createElement("th");
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = COLORS[i];
      th.appendChild(dot);
      th.appendChild(document.createTextNode(m));
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var lastGroup = null;
    rows.forEach(function (r) {
      if (r.group !== lastGroup) {
        lastGroup = r.group;
        var trg = document.createElement("tr");
        var thg = document.createElement("th");
        thg.className = "group-row";
        thg.colSpan = 1 + state.compare.length;
        thg.textContent = r.group;
        trg.appendChild(thg);
        tbody.appendChild(trg);
      }
      var tr = document.createElement("tr");
      var tdl = document.createElement("td");
      tdl.className = "label";
      tdl.textContent = r.label + (r.unit ? " (" + r.unit + ")" : "");
      tr.appendChild(tdl);
      r.cells.forEach(function (c) {
        var td = document.createElement("td");
        if (c.same) {
          td.className = "same";
          td.textContent = EngineData.SAME_MARK; // "<-"
        } else {
          td.textContent = EngineData.formatValue(c.raw, ""); // 단위는 항목 열에 표기
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  // 3.2.2.2: 곡선 겹쳐 보기 (엔진별 색상 구분)
  function renderCompareChart() {
    if (charts.compare) { charts.compare.destroy(); charts.compare = null; }
    if (!state.data) { $("compareChartCard").hidden = true; return; }
    var models = state.compare.filter(function (m) {
      return (state.data.curves[m] || []).length > 0;
    });
    var show = state.compare.length >= 2 && models.length >= 1;
    $("compareChartCard").hidden = !show;
    if (!show) return;

    var entries = models.map(function (m, i) { return chartEntry(m, COLORS[i]); });
    charts.compare = EngineCharts.createCurveChart($("canvasCompare"), entries, {
      which: "both",
      yRanges: {
        powerMin: numOrNull("cPowerMin"), powerMax: numOrNull("cPowerMax"),
        torqueMin: numOrNull("cTorqueMin"), torqueMax: numOrNull("cTorqueMax")
      },
      showAnnotations: $("compareAnnoToggle").checked, // 라벨 과밀 시 끌 수 있음
      onPointClick: function (info) { showReadout("compareReadout", info); }
    });
  }

  function renderCompare() {
    if (!state.data) {
      renderComparePicker();
      $("compareTableWrap").innerHTML =
        '<p class="empty-note">데이터가 없습니다. 먼저 Import 하거나 샘플 데이터를 불러오세요.</p>';
      $("compareChartCard").hidden = true;
      return;
    }
    renderComparePicker();
    renderCompareTable();
    renderCompareChart();
  }

  function bindCompareControls() {
    ["cPowerMin", "cPowerMax", "cTorqueMin", "cTorqueMax"].forEach(function (id) {
      $(id).addEventListener("change", renderCompareChart);
    });
    $("compareAnnoToggle").addEventListener("change", renderCompareChart);
    $("btnCompareYReset").addEventListener("click", function () {
      ["cPowerMin", "cPowerMax", "cTorqueMin", "cTorqueMax"].forEach(function (id) { $(id).value = ""; });
      renderCompareChart();
    });
  }

  /* ---------------------------------------------------------- 전체 렌더 */

  function renderAll() {
    renderStatus();
    renderEngineList();
    renderSpec();
    renderBrowseChart();
    renderCompare();
  }

  /* ---------------------------------------------------------- 초기화 */

  document.addEventListener("DOMContentLoaded", function () {
    bindToolbar();
    bindTabs();
    bindBrowseChartControls();
    bindCompareControls();
    $("searchBox").addEventListener("input", function () {
      state.search = this.value;
      renderEngineList();
    });
    loadLocal();       // 세션 간 데이터 유지 (제약 5: Export 가 영속 저장소)
    if (state.data) {
      state.selectedModel = state.data.engines.length
        ? state.data.engines[0][EngineData.KEY_MODEL] : null;
    }
    renderAll();
  });
})();
