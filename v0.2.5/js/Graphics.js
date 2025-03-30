const Graphics = {
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  
  init() {
    // 씬 생성 및 배경색 설정
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    
    // 카메라 생성 및 위치 설정
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.y = 1.6;
    
    // 렌더러 생성 및 설정
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    
    // 클럭 생성
    this.clock = new THREE.Clock();
    
    // 윈도우 리사이즈 이벤트 핸들러
    window.addEventListener('resize', this.onWindowResize.bind(this));
  },
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },
  
  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;

  // 그림자 카메라 범위 설정 - 전체 게임 영역 커버
  // 맵 크기가 100x100이므로 넉넉히 설정
  directionalLight.shadow.camera.left = -60;
  directionalLight.shadow.camera.right = 60;
  directionalLight.shadow.camera.top = 60;
  directionalLight.shadow.camera.bottom = -60;
  
  // 원거리 및 근거리 절단면 설정
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;
  
  // 그림자 바이어스 설정 - 그림자 끊김 현상 방지
  directionalLight.shadow.bias = -0.001;
  
  // 그림자 카메라 헬퍼 (디버깅용, 제품 버전에서는 주석 처리)
  // const helper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // this.scene.add(helper);

    this.scene.add(directionalLight);
  },
  
  createGunFlash() {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.bottom = '50%';
    flash.style.right = '50%';
    flash.style.width = '50px';
    flash.style.height = '50px';
    flash.style.borderRadius = '50%';
    flash.style.backgroundColor = 'rgba(255, 200, 50, 0.8)';
    flash.style.boxShadow = '0 0 20px 10px rgba(255, 200, 50, 0.5)';
    flash.style.transform = 'translate(50%, 50%)';
    flash.style.opacity = '0.9';
    
    document.getElementById('gunEffects').appendChild(flash);
    
    setTimeout(() => {
      flash.remove();
    }, 100);
  },
  
  showHitMarker() {
    const hitMarker = document.getElementById('hitMarker');
    hitMarker.style.opacity = '1';
    
    setTimeout(() => {
      hitMarker.style.opacity = '0';
    }, 200);
  },
  
  // v0.0.6 추가: 보너스 타겟 명중 시 효과
  showBonusEffect() {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255, 215, 0, 0.2)'; // Gold flash for bonus
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => {
        flash.remove();
      }, 300);
    }, 100);
  },
  
  // v0.0.6 추가: 페널티 타겟 명중 시 효과
  showPenaltyEffect() {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Green flash for penalty
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => {
        flash.remove();
      }, 300);
    }, 100);
  },
  
  // v0.0.6 추가: 점수 표시 텍스트 효과
  showScoreText(points, position) {
    // Convert 3D position to screen position
    const vector = position.clone();
    vector.project(this.camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    // Create score text element
    const scoreText = document.createElement('div');
    scoreText.textContent = points > 0 ? `+${points}` : `${points}`;
    scoreText.style.position = 'absolute';
    scoreText.style.left = `${x}px`;
    scoreText.style.top = `${y}px`;
    scoreText.style.transform = 'translate(-50%, -50%)';
    scoreText.style.color = points > 0 ? 
      (points >= 25 ? '#FFD700' : '#FFFFFF') : '#00FF00';
    scoreText.style.fontWeight = 'bold';
    scoreText.style.fontSize = `${Math.abs(points) / 5 + 16}px`;
    scoreText.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    scoreText.style.pointerEvents = 'none';
    scoreText.style.zIndex = '1000';
    
    document.body.appendChild(scoreText);
    
    // Animate the score text
    let opacity = 1;
    let posY = y;
    
    const animate = () => {
      opacity -= 0.02;
      posY -= 1;
      
      if (opacity <= 0) {
        scoreText.remove();
        return;
      }
      
      scoreText.style.opacity = opacity;
      scoreText.style.top = `${posY}px`;
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }
};
