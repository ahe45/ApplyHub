(function(scope){
  const labels={load:['불러오는 중','info'],save:['저장 중','info'],check:['연결 확인 중','info'],saved:['저장됨','info'],verified:['연결 확인됨','success'],changed:['변경 중','info'],checkFailed:['연결 실패','error'],saveFailed:['저장 실패','error'],loadFailed:['불러오기 실패','error']};
  scope.AdmitCardSettingsFeedback={
    notify(message,type='success'){scope.dispatchEvent(new CustomEvent('applyhub:settings-toast',{detail:{message,type}}));},
    badge({busy,result,registered,needsReset}){
      const [label,tone]=labels[busy]||labels[result]||(needsReset?['재입력 필요','warning']:registered?['등록됨','info']:['미등록','neutral']);
      return '<span class="settings-state-badge is-'+tone+'" role="status" aria-live="polite" data-settings-status>'+label+'</span>';
    },
  };
})(window);
