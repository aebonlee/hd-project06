/**
 * sample-data.js — 내장 샘플 데이터 (make_samples.py 가 자동 생성; 직접 수정 금지)
 * templates/엔진사양_샘플.xlsx 와 동일한 내용. '샘플 데이터 불러오기' 버튼에서 사용.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SAMPLE_DATA = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    "schema": [
      {
        "key": "manufacturer",
        "label": "엔진 제조사",
        "group": "기본 정보",
        "unit": "",
        "order": 10
      },
      {
        "key": "engine_model",
        "label": "엔진 모델명",
        "group": "기본 정보",
        "unit": "",
        "order": 20
      },
      {
        "key": "forklift_models",
        "label": "적용 지게차 모델",
        "group": "기본 정보",
        "unit": "",
        "order": 30
      },
      {
        "key": "rated_power_kw",
        "label": "정격 출력",
        "group": "성능",
        "unit": "kW",
        "order": 40
      },
      {
        "key": "rated_power_rpm",
        "label": "정격 출력 RPM",
        "group": "성능",
        "unit": "rpm",
        "order": 50
      },
      {
        "key": "max_torque_nm",
        "label": "최대 토크",
        "group": "성능",
        "unit": "Nm",
        "order": 60
      },
      {
        "key": "max_torque_rpm",
        "label": "최대 토크 RPM",
        "group": "성능",
        "unit": "rpm",
        "order": 70
      },
      {
        "key": "low_idle_rpm",
        "label": "Low Idle RPM",
        "group": "성능",
        "unit": "rpm",
        "order": 80
      },
      {
        "key": "high_idle_rpm",
        "label": "High Idle RPM",
        "group": "성능",
        "unit": "rpm",
        "order": 90
      },
      {
        "key": "weight_kg",
        "label": "무게",
        "group": "주요 제원",
        "unit": "kg",
        "order": 100
      },
      {
        "key": "engine_type",
        "label": "엔진 타입",
        "group": "주요 제원",
        "unit": "",
        "order": 110
      },
      {
        "key": "cylinders",
        "label": "실린더 수",
        "group": "주요 제원",
        "unit": "개",
        "order": 120
      },
      {
        "key": "displacement_cc",
        "label": "배기량",
        "group": "주요 제원",
        "unit": "cc",
        "order": 130
      },
      {
        "key": "oil_capacity_l",
        "label": "오일 용량",
        "group": "주요 제원",
        "unit": "L",
        "order": 140
      },
      {
        "key": "coolant_capacity_l",
        "label": "냉각수 용량",
        "group": "주요 제원",
        "unit": "L",
        "order": 150
      },
      {
        "key": "fuel_consumption",
        "label": "연비(정격점)",
        "group": "주요 제원",
        "unit": "g/kWh",
        "order": 160
      },
      {
        "key": "alternator",
        "label": "알터네이터 스펙",
        "group": "주요 제원",
        "unit": "",
        "order": 170
      },
      {
        "key": "starter_motor_kw",
        "label": "스타터 모터 출력",
        "group": "주요 제원",
        "unit": "kW",
        "order": 180
      },
      {
        "key": "emission_cert",
        "label": "배기 규제 인증",
        "group": "규제·인증",
        "unit": "",
        "order": 190
      },
      {
        "key": "aftertreatment",
        "label": "후처리장치 타입",
        "group": "규제·인증",
        "unit": "",
        "order": 200
      }
    ],
    "engines": [
      {
        "manufacturer": "대한파워텍",
        "engine_model": "DP34T",
        "forklift_models": "HF250D-9, HF300D-9, HF330D-9",
        "rated_power_kw": 55.3,
        "rated_power_rpm": 2200,
        "max_torque_nm": 270.0,
        "max_torque_rpm": 1500,
        "low_idle_rpm": 800,
        "high_idle_rpm": 2400,
        "weight_kg": 305,
        "engine_type": "전자식",
        "cylinders": 4,
        "displacement_cc": 3409,
        "oil_capacity_l": 8.5,
        "coolant_capacity_l": 5.4,
        "fuel_consumption": 228,
        "alternator": "24V 45A",
        "starter_motor_kw": 3.2,
        "emission_cert": "Tier 4 Final / Stage V",
        "aftertreatment": "DOC + DPF"
      },
      {
        "manufacturer": "대한파워텍",
        "engine_model": "DP24E",
        "forklift_models": "HF180D-9, HF200D-9",
        "rated_power_kw": 41.3,
        "rated_power_rpm": 2400,
        "max_torque_nm": 184.7,
        "max_torque_rpm": 1500,
        "low_idle_rpm": 780,
        "high_idle_rpm": 2600,
        "weight_kg": 248,
        "engine_type": "전자식",
        "cylinders": 4,
        "displacement_cc": 2392,
        "oil_capacity_l": 6.7,
        "coolant_capacity_l": 4.5,
        "fuel_consumption": 235,
        "alternator": "12V 60A",
        "starter_motor_kw": 2.7,
        "emission_cert": "Tier 4 Final",
        "aftertreatment": "DOC"
      },
      {
        "manufacturer": "CK엔진코리아",
        "engine_model": "QF3.8L",
        "forklift_models": "HF250D-9, HF350D-9, HF400D-9",
        "rated_power_kw": 64.2,
        "rated_power_rpm": 2300,
        "max_torque_nm": 300.0,
        "max_torque_rpm": 1500,
        "low_idle_rpm": 825,
        "high_idle_rpm": 2500,
        "weight_kg": 331,
        "engine_type": "전자식",
        "cylinders": 4,
        "displacement_cc": 3760,
        "oil_capacity_l": 9.5,
        "coolant_capacity_l": 6.0,
        "fuel_consumption": 222,
        "alternator": "24V 70A",
        "starter_motor_kw": 3.6,
        "emission_cert": "Stage V",
        "aftertreatment": "DOC + DPF + SCR"
      },
      {
        "manufacturer": "CK엔진코리아",
        "engine_model": "QF2.8M",
        "forklift_models": "HF150D-7, HF180D-7",
        "rated_power_kw": 40.7,
        "rated_power_rpm": 2500,
        "max_torque_nm": 175.0,
        "max_torque_rpm": 1700,
        "low_idle_rpm": 750,
        "high_idle_rpm": 2700,
        "weight_kg": 214,
        "engine_type": "기계식",
        "cylinders": 4,
        "displacement_cc": 2776,
        "oil_capacity_l": 6.0,
        "coolant_capacity_l": 4.2,
        "fuel_consumption": 242,
        "alternator": "12V 45A",
        "starter_motor_kw": 2.5,
        "emission_cert": "Tier 3",
        "aftertreatment": "없음"
      },
      {
        "manufacturer": "YS디젤",
        "engine_model": "4YS98T",
        "forklift_models": "HF200D-9, HF250D-9",
        "rated_power_kw": 55.8,
        "rated_power_rpm": 2400,
        "max_torque_nm": 249.7,
        "max_torque_rpm": 1650,
        "low_idle_rpm": 800,
        "high_idle_rpm": 2600,
        "weight_kg": 238,
        "engine_type": "전자식",
        "cylinders": 4,
        "displacement_cc": 3319,
        "oil_capacity_l": 7.4,
        "coolant_capacity_l": 5.0,
        "fuel_consumption": 230,
        "alternator": "12V 55A",
        "starter_motor_kw": 3.0,
        "emission_cert": "Tier 4 Final / Stage V",
        "aftertreatment": "DPF"
      },
      {
        "manufacturer": "YS디젤",
        "engine_model": "4YS88",
        "forklift_models": "HF150D-7, HF160D-7, HF180D-7",
        "rated_power_kw": 33.9,
        "rated_power_rpm": 2600,
        "max_torque_nm": 140.0,
        "max_torque_rpm": 1650,
        "low_idle_rpm": 730,
        "high_idle_rpm": 2800,
        "weight_kg": 183,
        "engine_type": "기계식",
        "cylinders": 4,
        "displacement_cc": 2189,
        "oil_capacity_l": 5.5,
        "coolant_capacity_l": 3.8,
        "fuel_consumption": 248,
        "alternator": "12V 40A",
        "starter_motor_kw": 2.3,
        "emission_cert": "Tier 3",
        "aftertreatment": "없음"
      }
    ],
    "curves": {
      "DP34T": [
        {
          "rpm": 900,
          "power": 23.4,
          "torque": 248.0
        },
        {
          "rpm": 1100,
          "power": 30.0,
          "torque": 260.2
        },
        {
          "rpm": 1300,
          "power": 36.4,
          "torque": 267.6
        },
        {
          "rpm": 1500,
          "power": 42.4,
          "torque": 270.0
        },
        {
          "rpm": 1700,
          "power": 47.6,
          "torque": 267.6
        },
        {
          "rpm": 1900,
          "power": 51.8,
          "torque": 260.2
        },
        {
          "rpm": 2000,
          "power": 53.3,
          "torque": 254.7
        },
        {
          "rpm": 2100,
          "power": 54.5,
          "torque": 248.0
        },
        {
          "rpm": 2200,
          "power": 55.3,
          "torque": 240.0
        }
      ],
      "DP24E": [
        {
          "rpm": 900,
          "power": 16.0,
          "torque": 169.3
        },
        {
          "rpm": 1100,
          "power": 20.4,
          "torque": 177.0
        },
        {
          "rpm": 1300,
          "power": 24.8,
          "torque": 182.1
        },
        {
          "rpm": 1500,
          "power": 29.0,
          "torque": 184.7
        },
        {
          "rpm": 1700,
          "power": 32.9,
          "torque": 184.7
        },
        {
          "rpm": 1900,
          "power": 36.2,
          "torque": 182.1
        },
        {
          "rpm": 2100,
          "power": 38.9,
          "torque": 177.0
        },
        {
          "rpm": 2250,
          "power": 40.4,
          "torque": 171.4
        },
        {
          "rpm": 2400,
          "power": 41.3,
          "torque": 164.4
        }
      ],
      "QF3.8L": [
        {
          "rpm": 800,
          "power": 23.0,
          "torque": 274.5
        },
        {
          "rpm": 1000,
          "power": 30.1,
          "torque": 287.0
        },
        {
          "rpm": 1200,
          "power": 37.1,
          "torque": 295.3
        },
        {
          "rpm": 1400,
          "power": 43.9,
          "torque": 299.5
        },
        {
          "rpm": 1500,
          "power": 47.1,
          "torque": 300.0
        },
        {
          "rpm": 1600,
          "power": 50.2,
          "torque": 299.5
        },
        {
          "rpm": 1800,
          "power": 55.7,
          "torque": 295.3
        },
        {
          "rpm": 2000,
          "power": 60.1,
          "torque": 287.0
        },
        {
          "rpm": 2100,
          "power": 61.8,
          "torque": 281.2
        },
        {
          "rpm": 2200,
          "power": 63.2,
          "torque": 274.5
        },
        {
          "rpm": 2300,
          "power": 64.2,
          "torque": 266.7
        }
      ],
      "QF2.8M": [
        {
          "rpm": 900,
          "power": 14.7,
          "torque": 155.6
        },
        {
          "rpm": 1100,
          "power": 18.9,
          "torque": 164.1
        },
        {
          "rpm": 1300,
          "power": 23.2,
          "torque": 170.1
        },
        {
          "rpm": 1500,
          "power": 27.3,
          "torque": 173.8
        },
        {
          "rpm": 1700,
          "power": 31.2,
          "torque": 175.0
        },
        {
          "rpm": 1900,
          "power": 34.6,
          "torque": 173.8
        },
        {
          "rpm": 2100,
          "power": 37.4,
          "torque": 170.1
        },
        {
          "rpm": 2300,
          "power": 39.5,
          "torque": 164.1
        },
        {
          "rpm": 2400,
          "power": 40.2,
          "torque": 160.1
        },
        {
          "rpm": 2500,
          "power": 40.7,
          "torque": 155.6
        }
      ],
      "4YS98T": [
        {
          "rpm": 850,
          "power": 20.5,
          "torque": 230.2
        },
        {
          "rpm": 1050,
          "power": 26.4,
          "torque": 239.8
        },
        {
          "rpm": 1250,
          "power": 32.2,
          "torque": 246.2
        },
        {
          "rpm": 1450,
          "power": 37.9,
          "torque": 249.5
        },
        {
          "rpm": 1650,
          "power": 43.1,
          "torque": 249.7
        },
        {
          "rpm": 1850,
          "power": 47.8,
          "torque": 246.7
        },
        {
          "rpm": 2000,
          "power": 50.8,
          "torque": 242.4
        },
        {
          "rpm": 2150,
          "power": 53.2,
          "torque": 236.3
        },
        {
          "rpm": 2300,
          "power": 55.0,
          "torque": 228.4
        },
        {
          "rpm": 2400,
          "power": 55.8,
          "torque": 222.2
        }
      ],
      "4YS88": [
        {
          "rpm": 900,
          "power": 12.3,
          "torque": 130.3
        },
        {
          "rpm": 1150,
          "power": 16.3,
          "torque": 135.7
        },
        {
          "rpm": 1400,
          "power": 20.4,
          "torque": 138.9
        },
        {
          "rpm": 1650,
          "power": 24.2,
          "torque": 140.0
        },
        {
          "rpm": 1900,
          "power": 27.6,
          "torque": 138.9
        },
        {
          "rpm": 2100,
          "power": 30.0,
          "torque": 136.5
        },
        {
          "rpm": 2300,
          "power": 32.0,
          "torque": 132.7
        },
        {
          "rpm": 2450,
          "power": 33.1,
          "torque": 129.0
        },
        {
          "rpm": 2600,
          "power": 33.9,
          "torque": 124.4
        }
      ]
    }
  };
});
