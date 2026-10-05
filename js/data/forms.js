/* =========================================================================
 * 신고서 양식 정의
 * - sections: 대항목([ ]), fields: 소항목(참가자 입력칸)
 * - field.type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'attachments'
 *     attachments: CASE의 참고자료 목록을 보여주고 첨부할 자료를 선택
 * - field.width: 'full'(기본) | 'half' | 'third'
 * - field.required: false로 두면 선택 항목 (기본은 필수)
 * - field.min: checkbox/attachments 최소 선택 개수 (기본 1)
 * - field.showIf: { field, equals } 조건을 만족할 때만 표시·검증
 * - field.docLabel: 신고서 확인화면/관리자 화면에 표시할 짧은 이름
 * ========================================================================= */
(function () {
  var JOB_RELATED = [
    '공직자의 직무수행과 관련하여 일정한 행위나 조치를 요구하는 개인이나 법인 또는 단체',
    '공직자의 직무수행과 관련하여 이익 또는 불이익을 직접적으로 받는 개인이나 법인 또는 단체',
    '공직자가 소속된 공공기관과 계약을 체결하거나 체결하려는 것이 명백한 개인이나 법인 또는 단체',
    '공직자의 직무수행과 관련하여 이익 또는 불이익을 직접적으로 받는 다른 공직자'
  ];

  function person(prefix) {
    return [
      { id: prefix + '_name', label: '성명', type: 'text', width: 'third', placeholder: '예) 김보호' },
      { id: prefix + '_dept', label: '소속', type: 'text', width: 'third', placeholder: '예) ○○부' },
      { id: prefix + '_position', label: '직위(직급)', type: 'text', width: 'third', placeholder: '예) 주임' }
    ];
  }

  var CONSENT = {
    id: 'identity_consent',
    label: '※ 신고내용을 확인･조사하는 과정에서 신고자의 신분을 밝히는데 동의하는지 여부',
    docLabel: '신분공개 동의 여부',
    type: 'radio',
    options: ['동의', '부동의']
  };

  window.FORMS = {
    /* 1. 행동강령 위반행위 신고서 (CASE 01, 03) */
    conduct: {
      id: 'conduct',
      icon: '⚖️',
      title: '행동강령 위반행위 신고서',
      description: '임직원의 행동강령 위반행위(부당한 지시·예산 부당집행·청탁에 따른 직무수행 등)를 알게 된 경우',
      sections: [
        { title: '신고자', fields: person('reporter') },
        { title: '피신고자(신고대상)', fields: person('target').concat([CONSENT]) },
        { title: '신고취지 및 이유', fields: [
          { id: 'purpose', label: '신고취지 및 이유', type: 'textarea', rows: 4, placeholder: '어떤 행위를 왜 신고하는지 간단히 작성해 주세요.' }
        ] },
        { title: '행동강령 위반행위 내용', fields: [
          { id: 'violation_datetime', label: '일시', type: 'text', width: 'half', placeholder: '예) 2026. ○. ○.(○) 00:00' },
          { id: 'violation_place', label: '장소', type: 'text', width: 'half', placeholder: '예) ○○부 사무실' },
          { id: 'violation_content', label: '내용', type: 'textarea', rows: 6, placeholder: '누가, 언제, 어디서, 무엇을, 어떻게 하였는지 구체적으로 작성해 주세요.' }
        ] },
        { title: '증거자료 목록', note: '상황에서 제공된 자료 중 신고서에 첨부할 자료를 선택하세요.', fields: [
          { id: 'evidence', label: '첨부할 증거자료', docLabel: '첨부 자료', type: 'attachments', min: 1 }
        ] }
      ]
    },

    /* 2. 갑질신고서 (CASE 02) */
    gapjil: {
      id: 'gapjil',
      icon: '🗣️',
      title: '갑질신고서',
      description: '직위·직급 등 우월적 지위를 이용한 부당한 요구나 폭언 등으로 피해를 입거나 이를 목격한 경우',
      sections: [
        { title: '신고자', fields: person('reporter') },
        { title: '피신고자(신고대상)', fields: person('target').concat([CONSENT]) },
        { title: '신고 내용', fields: [
          { id: 'report_content', label: '신고 내용', type: 'textarea', rows: 8, placeholder: '언제, 어떤 행위가 있었는지, 반복 여부와 피해 내용을 구체적으로 작성해 주세요.' }
        ] },
        { title: '해당행위 확인방법', note: '상황에서 제공된 자료 중 신고서에 첨부할 자료를 선택하세요.', fields: [
          { id: 'evidence', label: '첨부할 확인자료', docLabel: '첨부 자료', type: 'attachments', min: 1 }
        ] }
      ]
    },

    /* 3. 수수금지 금품등 신고서 (CASE 04) */
    gift: {
      id: 'gift',
      icon: '🎁',
      title: '수수금지 금품등 신고서',
      description: '직무와 관련하여 수수가 금지된 금품등을 받거나 그 제공의 약속 또는 의사표시를 받은 경우',
      sections: [
        { title: '신고자', fields: person('reporter') },
        { title: '금품등을 제공한 자', fields: [
          { id: 'giver_name', label: '성명', type: 'text', width: 'third', placeholder: '예) 김보호' },
          { id: 'giver_job', label: '직업(소속)', type: 'text', width: 'third', placeholder: '예) ○○업체 담당자' },
          { id: 'giver_contact', label: '연락처', type: 'text', width: 'third', placeholder: '예) 010-0000-0000' }
        ] },
        { title: '신고취지 및 이유', fields: [
          { id: 'purpose', label: '신고취지 및 이유', type: 'textarea', rows: 4, placeholder: '어떤 금품등을 왜 신고하는지 간단히 작성해 주세요.' }
        ] },
        { title: '금품 등 수수 내용', fields: [
          { id: 'receive_datetime', label: '일시', type: 'text', width: 'third', placeholder: '예) 2026. ○. ○. 오후' },
          { id: 'receive_place', label: '장소', type: 'text', width: 'third', placeholder: '예) 사무실' },
          { id: 'gift_detail', label: '금품등의 종류 및 가액', type: 'text', width: 'third', placeholder: '예) ○○ 선물세트 / 약 00,000원' }
        ] },
        { title: '금품 반환여부 및 방법', fields: [
          { id: 'returned', label: '반환여부', type: 'radio', options: ['반환', '미반환'] },
          { id: 'return_detail', label: '반환 일시·장소 및 방법', docLabel: '반환 일시·장소 및 방법', type: 'textarea', rows: 3,
            help: '반환한 경우 작성', placeholder: '예) 2026. ○. ○. 사무실에서 택배로 반환', showIf: { field: 'returned', equals: '반환' } }
        ] },
        { title: '증거자료', note: '상황에서 제공된 자료 중 신고서에 첨부할 자료를 선택하세요.', fields: [
          { id: 'evidence', label: '첨부할 증거자료', docLabel: '첨부 자료', type: 'attachments', min: 1 }
        ] }
      ]
    },

    /* 4. 사적이해관계자 신고 및 회피신청서 (CASE 05) */
    privateInterest: {
      id: 'privateInterest',
      icon: '🤝',
      title: '사적이해관계자 신고 및 회피신청서',
      description: '직무관련자가 본인의 사적이해관계자임을 알게 된 경우 (신고 및 회피 신청)',
      sections: [
        { title: '신고·신청인', fields: [
          { id: 'reporter_name', label: '성명', type: 'text', width: 'half', placeholder: '예) 김보호' },
          { id: 'reporter_dept', label: '소속', type: 'text', width: 'half', placeholder: '예) ○○부' },
          { id: 'reporter_position', label: '직위(직급)', type: 'text', width: 'half', placeholder: '예) 주임' },
          { id: 'reporter_duty', label: '담당업무', type: 'text', width: 'half', placeholder: '예) ○○ 업무' }
        ] },
        { title: '직무관련자(사적이해관계자)', fields: [
          { id: 'rel_name', label: '성명', type: 'text', width: 'half', placeholder: '개인 성명 또는 법인·단체명' },
          { id: 'rel_contact', label: '연락처', type: 'text', width: 'half', placeholder: '예) 02-000-0000' },
          { id: 'rel_org', label: '소속', type: 'text', width: 'half', placeholder: '예) ○○업체' },
          { id: 'rel_org_type', label: '구분', docLabel: '소속 구분', type: 'radio', width: 'half', options: ['개인', '법인', '단체', '공직자'] },
          { id: 'rel_private', label: '사적이해관계', type: 'textarea', rows: 3, placeholder: '본인과 어떤 사적이해관계가 있는지 작성해 주세요.' },
          { id: 'rel_duty', label: '관련 직무', type: 'textarea', rows: 3, placeholder: '해당 직무관련자와 관련된 본인의 직무를 작성해 주세요.' },
          { id: 'rel_category', label: '직무관련자 유형 (해당 항목 모두 체크)', docLabel: '직무관련자 유형', type: 'checkbox', layout: 'stack', options: JOB_RELATED, min: 1 }
        ] }
      ]
    },

    /* 5. 퇴직자 사적 접촉 신고서 (CASE 06) */
    retiree: {
      id: 'retiree',
      icon: '⛳',
      title: '퇴직자 사적 접촉 신고서',
      description: '직무관련자인 퇴직자와 골프·여행·사행성 오락 등 사적으로 접촉한 경우',
      sections: [
        { title: '신고인', fields: person('reporter') },
        { title: '직무관련자(퇴직자)', fields: [
          { id: 'retiree_name', label: '성명', type: 'text', width: 'half', placeholder: '예) 김보호' },
          { id: 'retiree_contact', label: '연락처', type: 'text', width: 'half', placeholder: '예) 010-0000-0000' },
          { id: 'retiree_current_org', label: '현 소속 기관', type: 'text', width: 'half', placeholder: '예) ○○업체' },
          { id: 'retiree_prev_org', label: '퇴직 전 소속 기관', type: 'text', width: 'half', placeholder: '예) 한국저작권보호원 ○○부' },
          { id: 'retiree_category', label: '직무관련자 유형 (해당 항목 모두 체크)', docLabel: '직무관련자 유형', type: 'checkbox', layout: 'stack', options: JOB_RELATED, min: 1 },
          { id: 'retiree_relevance', label: '신고인의 담당 업무와 관련한 퇴직자의 직무 관련성', docLabel: '퇴직자의 직무 관련성', type: 'textarea', rows: 3,
            placeholder: '본인의 담당 업무와 퇴직자(현 소속)가 어떻게 관련되는지 작성해 주세요.' }
        ] },
        { title: '접촉사항', fields: [
          { id: 'contact_datetime', label: '일시', type: 'text', width: 'half', placeholder: '예) 2026. ○. ○.(토)' },
          { id: 'contact_reason', label: '사유', type: 'text', width: 'half', placeholder: '예) 친목 모임' },
          { id: 'contact_type', label: '유형', type: 'radio', options: ['골프', '여행', '사행성오락'] },
          { id: 'payer', label: '비용부담자', type: 'radio', options: ['신고인', '퇴직공무원', '기타'] },
          { id: 'payer_other', label: '기타 사유', type: 'text', placeholder: '기타를 선택한 경우 간단히 작성해 주세요.', showIf: { field: 'payer', equals: '기타' } }
        ] }
      ]
    }
  };
})();
