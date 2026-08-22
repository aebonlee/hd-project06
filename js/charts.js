/**
 * charts.js — RPM별 출력·토크 곡선 차트 (3.2.1, 3.2.2.2)
 *
 *  - 3.2.1.1 꺾은선 + 각 데이터 지점을 점으로 표시
 *  - 3.2.1.2 점 클릭 시 "70kW @ 2300 rpm" 형식으로 값 표시 (툴팁 + 고정 판독 영역)
 *  - 3.2.1.3 정격 출력 / 최대 토크 상시 주석 라벨 (chartjs-plugin-annotation)
 *  - 3.2.1.4 출력/토크 Y축 각각 min/max 범위 조정
 *  - 3.2.2.2 비교 시 여러 엔진 곡선을 색상 구분하여 겹쳐 표시
 *
 * Chart.js v4 + chartjs-plugin-annotation (모두 lib/ 에 로컬 동봉).
 */
(function (root) {
  "use strict";

  // 비교용 시리즈 색상 (최대 4개 — 색약 안전 순서 검증된 팔레트)
  var SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

  var GRID = "#e1e0d9";
  var MUTED = "#898781";
  var INK2 = "#52514e";

  if (root.Chart && root.Chart.defaults) {
    root.Chart.defaults.font.family =
      'system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
    root.Chart.defaults.color = INK2;
  }

  /** 숫자 → 표시용 (불필요한 소수점 제거). 값이 없으면 "—" */
  function fmt(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return Number(n.toFixed(1)).toString();
  }

  /**
   * 엔진 1개 → 데이터셋 2개(출력/토크).
   * entry: { model, color, curve:[{rpm,power,torque}] }
   * which: "both" | "power" | "torque"
   */
  function buildDatasets(entries, which) {
    var ds = [];
    // 값이 전부 비어 있는 데이터셋(예: 이중축 모드에서 출력 전용 엔트리의 토크)은 제외
    function push(d) {
      if (d.data.some(function (p) { return p.y != null; })) ds.push(d);
    }
    entries.forEach(function (en) {
      var curve = en.curve || []; // 곡선 데이터 없는 엔진도 안전하게 처리
      if (which !== "torque") {
        push({
          label: en.model + " 출력(kW)",
          yAxisID: "yPower",
          metric: "power",
          engineModel: en.model,
          data: curve.map(function (p) { return { x: p.rpm, y: p.power }; }),
          borderColor: en.color,
          backgroundColor: en.color,
          borderWidth: 2,
          pointRadius: 4,          // 3.2.1.1: 각 지점을 점으로
          pointHoverRadius: 6,
          pointBorderColor: "#fcfcfb",
          pointBorderWidth: 1,
          tension: 0.25
        });
      }
      if (which !== "power") {
        push({
          label: en.model + " 토크(Nm)",
          yAxisID: "yTorque",
          metric: "torque",
          engineModel: en.model,
          data: curve.map(function (p) { return { x: p.rpm, y: p.torque }; }),
          borderColor: en.color,
          backgroundColor: en.color,
          borderWidth: 2,
          borderDash: [7, 4],      // 토크는 점선 (출력과 형태로도 구분 — 색상 외 보조 인코딩)
          pointRadius: 4,
          pointHoverRadius: 6,
          pointStyle: "rectRot",
          pointBorderColor: "#fcfcfb",
          pointBorderWidth: 1,
          tension: 0.25
        });
      }
    });
    return ds;
  }

  /**
   * 정격 출력 / 최대 토크 상시 라벨 (3.2.1.3)
   * entry.rated: {kw, rpm} / entry.maxTorque: {nm, rpm}
   */
  function buildAnnotations(entries, which) {
    var anns = {};
    entries.forEach(function (en, i) {
      if (which !== "torque" && en.rated) {
        anns["rated_" + i] = {
          type: "label",
          xValue: en.rated.rpm,
          yValue: en.rated.kw,
          yScaleID: "yPower",
          content: ["정격 " + fmt(en.rated.kw) + "kW", "@ " + en.rated.rpm + " rpm"],
          font: { size: 11, weight: "bold" },
          color: "#0b0b0b",
          backgroundColor: "rgba(252,252,251,0.92)",
          borderColor: en.color,
          borderWidth: 1.5,
          borderRadius: 6,
          padding: 5,
          position: { x: "end", y: "center" },
          xAdjust: -14,
          yAdjust: 26,             // 점 아래쪽 (출력 곡선은 우상향이므로 아래가 비어 있음)
          callout: { display: true, borderColor: en.color, borderWidth: 1.5, margin: 4 }
        };
      }
      if (which !== "power" && en.maxTorque) {
        anns["torque_" + i] = {
          type: "label",
          xValue: en.maxTorque.rpm,
          yValue: en.maxTorque.nm,
          yScaleID: "yTorque",
          content: ["최대 " + fmt(en.maxTorque.nm) + "Nm", "@ " + en.maxTorque.rpm + " rpm"],
          font: { size: 11, weight: "bold" },
          color: "#0b0b0b",
          backgroundColor: "rgba(252,252,251,0.92)",
          borderColor: en.color,
          borderWidth: 1.5,
          borderRadius: 6,
          padding: 5,
          xAdjust: i * 22,         // 비교 시 라벨 겹침 완화
          yAdjust: 34,             // 토크 피크 아래쪽 (피크가 축 상단에 닿아도 잘리지 않도록)
          callout: { display: true, borderColor: en.color, borderWidth: 1.5, margin: 4 }
        };
      }
    });
    return anns;
  }

  /**
   * 곡선 차트 생성.
   * @param {HTMLCanvasElement} canvas
   * @param {Array} entries  [{model, color, curve, rated, maxTorque}]
   * @param {object} opts {
   *   which: "both"|"power"|"torque",
   *   yRanges: {powerMin,powerMax,torqueMin,torqueMax}  (null 이면 자동),
   *   showAnnotations: boolean,
   *   onPointClick: function({model, metric, x, y, color, text})
   * }
   */
  function createCurveChart(canvas, entries, opts) {
    var which = opts.which || "both";
    var yR = opts.yRanges || {};

    var scales = {
      x: {
        type: "linear",
        title: { display: true, text: "엔진 회전수 (rpm)", color: MUTED },
        grid: { color: GRID },
        border: { color: "#c3c2b7" },
        ticks: { color: MUTED, maxTicksLimit: 12 }
      }
    };
    if (which !== "torque") {
      scales.yPower = {
        type: "linear",
        position: "left",
        title: { display: true, text: "출력 (kW)", color: INK2 },
        grid: { color: GRID },
        border: { color: "#c3c2b7" },
        ticks: { color: MUTED },
        min: yR.powerMin == null ? undefined : yR.powerMin,   // 3.2.1.4
        max: yR.powerMax == null ? undefined : yR.powerMax
      };
    }
    if (which !== "power") {
      scales.yTorque = {
        type: "linear",
        position: which === "torque" ? "left" : "right",
        title: { display: true, text: "토크 (Nm)", color: INK2 },
        grid: { drawOnChartArea: which === "torque", color: GRID },
        border: { color: "#c3c2b7" },
        ticks: { color: MUTED },
        min: yR.torqueMin == null ? undefined : yR.torqueMin, // 3.2.1.4
        max: yR.torqueMax == null ? undefined : yR.torqueMax
      };
    }

    function pointText(dataset, pt) {
      var unit = dataset.metric === "power" ? "kW" : "Nm";
      return fmt(pt.y) + unit + " @ " + pt.x + " rpm";  // 3.2.1.2 형식
    }

    var chart = new root.Chart(canvas.getContext("2d"), {
      type: "line",
      data: { datasets: buildDatasets(entries, which) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: "nearest", intersect: true },
        scales: scales,
        plugins: {
          legend: {
            position: "top",
            labels: { usePointStyle: false, boxWidth: 26, boxHeight: 2 }
          },
          tooltip: {
            displayColors: false,
            backgroundColor: "rgba(11,11,11,0.85)",
            callbacks: {
              title: function () { return ""; },
              label: function (ctx) {
                return ctx.dataset.engineModel + " · " + pointText(ctx.dataset, ctx.parsed);
              }
            }
          },
          annotation: {
            annotations: opts.showAnnotations === false ? {} : buildAnnotations(entries, which)
          }
        },
        // 3.2.1.2: 점 클릭 시 값 표시 — 툴팁 고정 + 판독 영역 콜백
        onClick: function (evt) {
          var els = chart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
          if (!els.length) return;
          var el = els[0];
          var ds = chart.data.datasets[el.datasetIndex];
          var pt = ds.data[el.index];
          chart.tooltip.setActiveElements(
            [{ datasetIndex: el.datasetIndex, index: el.index }],
            { x: evt.x, y: evt.y }
          );
          chart.setActiveElements([{ datasetIndex: el.datasetIndex, index: el.index }]);
          chart.update();
          if (typeof opts.onPointClick === "function") {
            opts.onPointClick({
              model: ds.engineModel,
              metric: ds.metric,
              x: pt.x,
              y: pt.y,
              color: ds.borderColor,
              text: pointText(ds, pt)
            });
          }
        },
        onHover: function (evt, els) {
          evt.native.target.style.cursor = els.length ? "pointer" : "default";
        }
      }
    });
    return chart;
  }

  root.EngineCharts = {
    SERIES_COLORS: SERIES_COLORS,
    createCurveChart: createCurveChart
  };
})(typeof self !== "undefined" ? self : this);
