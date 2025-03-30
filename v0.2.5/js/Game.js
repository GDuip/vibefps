const Game = {
  gameStarted: false,
  score: 0,
  ammo: 3000,
  maxAmmo: 3000,
  timeLeft: 60,
  health: 100,
  playerVelocity: new THREE.Vector3(),
  playerDirection: new THREE.Vector3(),
  timerInterval: null,
  isInitialized: false,
  assetsLoaded: false,
  isSettingsOpen: false, // 설정 화면 상태 추적
  
  sendGameState(state) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'gameStateUpdate',
        state: state
      }, '*');
    }
  },
  
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    
    console.log("Game.init() 호출됨");
    
    if (typeof THREE !== 'undefined' && typeof CANNON !== 'undefined') {
      this.initializeModules();
    } else {
      this.waitForDependencies()
        .then(() => {
          this.initializeModules();
        })
        .catch(error => {
          console.error('Game initialization failed:', error);
          setTimeout(() => {
            this.isInitialized = false;
            this.init();
          }, 3000);
        });
    }
    
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    
    // 표적 명중 이벤트 수신: 점수 추가
    EventSystem.on('targetHit', (data) => {
      this.addScore(data.totalPoints);
    });

    // 새로 추가: gameStateChanged 이벤트 구독
    EventSystem.on('gameStateChanged', (data) => {
      // GitHub 팝업 관련 상태 처리
      if (data.state === 'paused' && data.reason === 'githubPopup') {
        this.gameStarted = false;
      } else if (data.state === 'playing' && data.reason === 'githubPopupClosed') {
        this.gameStarted = true;
        
        // 애니메이션 루프 재시작
        this.animate();
        
        // 포인터 락 요청
        setTimeout(() => {
          try {
            Graphics.renderer.domElement.requestPointerLock();
          } catch (e) {
            console.warn('Pointer lock request failed:', e);
          }
        }, 100);
      }
    });

    // Graphics 및 Physics 초기화 후 TimeWeatherSystem 초기화
    if (typeof TimeWeatherSystem !== 'undefined') {
      TimeWeatherSystem.init();
      
      // 옵션: 랜덤 시간대 시작 또는 특정 시간대 설정
      TimeWeatherSystem.randomizeTimeAndWeather();
      // TimeWeatherSystem.setTimeOfDay('evening');
      
      // 옵션: 자동 시간 진행 활성화 (10분 주기)
      // TimeWeatherSystem.setAutoTimeProgression(true, 600);
    }
    
    // 게임 초기화 이벤트 발생
    EventSystem.emit('gameStateChanged', { state: 'initialized' });
  },
  
  onPointerLockChange() {
    const isLocked = document.pointerLockElement !== null;
    if (isLocked && this.isSettingsOpen) {
      document.exitPointerLock();
    }
  },
  
  initializeModules() {
    console.log("Initializing game modules...");
    
    Graphics.init();
    Physics.init();
    Graphics.setupLights();
    Environment.init();

    // Initialize PortalSystem after the environment is created
    if (typeof PortalSystem !== 'undefined') {
      PortalSystem.init();
    }
    
    if (typeof ParticleSystem !== 'undefined') {
      ParticleSystem.init();
    }
    
    TargetManager.init();
    
    if (typeof GitHubTarget !== 'undefined') {
      GitHubTarget.init();
    }
    
    // 오디오 시스템 초기화
    AudioManager.init();
    
    // BGM 관리자 초기화
    if (typeof BGMManager !== 'undefined') {
      BGMManager.init();
    }
    
    if (typeof BulletPhysics !== 'undefined') {
      console.log("총알 물리 시스템 초기화...");
      BulletPhysics.init();
      BulletPhysics.integrateWithGame();
    }

    InputManager.init();
    
    Physics.playerBody.position.set(0, 1.6, 0);
    Physics.playerBody.velocity.set(0, 0, 0);
    
    Graphics.camera.rotation.order = 'YXZ';
    
    this.setupUIEvents();
    
    GameSettings.loadSettings();
    this.assetsLoaded = true;
    
    console.log('Game initialized successfully');
    this.sendGameState('ready');
  },
  
  waitForDependencies() {
    return new Promise((resolve, reject) => {
      const maxWaitTime = 10000;
      const startTime = Date.now();
      
      const checkLibraries = () => {
        if (typeof THREE !== 'undefined' && typeof CANNON !== 'undefined') {
          resolve();
          return;
        }
        if (Date.now() - startTime > maxWaitTime) {
          reject(new Error('Dependencies loading timeout'));
          return;
        }
        setTimeout(checkLibraries, 100);
      };
      
      checkLibraries();
    });
  },
  
  setupUIEvents() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
      startButton.addEventListener('click', () => {
        document.getElementById('startScreen').style.display = 'none';
        this.startGame();
      });
    }
    
    const restartButton = document.getElementById('restartButton');
    if (restartButton) {
      restartButton.addEventListener('click', () => {
        document.getElementById('gameOverScreen').style.display = 'none';
        location.reload();
      });
    }
    
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        this.showSettings();
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSettingsOpen) {
        this.closeSettings();
      }
    });
    
    const closeSettingsButton = document.getElementById('closeSettings');
    if (closeSettingsButton) {
      closeSettingsButton.addEventListener('click', () => {
        this.closeSettings();
      });
    }
    
    const settingInputs = document.querySelectorAll('#settingsScreen select, #settingsScreen input');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        GameSettings.saveSettings();
        if (input.id === 'languageSelect' && typeof Localization !== 'undefined') {
          Localization.setLanguage(input.value);
        }
      });
    });
    
    const musicVolumeSlider = document.getElementById('musicVolume');
    if (musicVolumeSlider) {
      musicVolumeSlider.addEventListener('input', () => {
        const volume = parseFloat(musicVolumeSlider.value);
        // BGMManager를 사용하여 볼륨 조절
        if (typeof BGMManager !== 'undefined') {
          BGMManager.setVolume(volume);
        }
        GameSettings.volumes.music = volume;
      });
    }
    
    const sfxVolumeSlider = document.getElementById('sfxVolume');
    if (sfxVolumeSlider) {
      sfxVolumeSlider.addEventListener('input', () => {
        if (typeof AudioManager !== 'undefined') {
          AudioManager.setVolume('sfx', parseFloat(sfxVolumeSlider.value));
        }
      });
    }
    
    document.addEventListener('localizationUpdated', () => {
      this.updateGameUI();
    });
  },
  
  closeSettings() {
    document.getElementById('settingsScreen').style.display = 'none';
    this.isSettingsOpen = false;
    GameSettings.saveSettings();
    
    // 게임 종료 화면의 z-index 복원
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (gameOverScreen && gameOverScreen.dataset.originalZIndex) {
      gameOverScreen.style.zIndex = gameOverScreen.dataset.originalZIndex;
      delete gameOverScreen.dataset.originalZIndex;
    }
    
    // 게임 실행 중일 때만 포인터 락 요청
    if (this.gameStarted && !this.isGameOver()) {
      try {
        setTimeout(() => {
          Graphics.renderer.domElement.requestPointerLock();
        }, 100);
      } catch (e) {
        console.warn('Pointer lock request failed:', e);
      }
    }
  },
  
  updateGameUI() {
    // 다국어 처리가 자동으로 되지 않는 부분만 별도로 갱신
  },
  
  startGame() {
    console.log("Game.startGame() 호출됨");
    if (!this.assetsLoaded) {
      console.log('게임 리소스 로드 중... 0.5초 후 다시 시도');
      setTimeout(() => this.startGame(), 500);
      return;
    }
    
    console.log("게임 시작 실행");
    this.gameStarted = true;
    this.sendGameState('playing');
    
    // 게임 상태 변경 이벤트 발생 (BGMManager가 감지하여 음악 재생)
    EventSystem.emit('gameStateChanged', { state: 'playing' });
    
    this.score = 0;
    this.ammo = this.maxAmmo;
    this.timeLeft = 60;
    this.health = 100;
    
    document.getElementById('score').textContent = this.score;
    document.getElementById('ammo').textContent = this.ammo;
    document.getElementById('maxAmmo').textContent = this.maxAmmo;
    document.getElementById('timer').textContent = this.timeLeft;
    document.getElementById('healthFill').style.width = '100%';
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    this.startTimer();
    // 음악은 이제 BGMManager가 이벤트를 통해 처리
    this.animate();
    
    try {
      Graphics.renderer.domElement.requestPointerLock();
    } catch (e) {
      console.warn('Pointer lock request failed:', e);
    }
  },
  
  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      document.getElementById('timer').textContent = this.timeLeft;
      
      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.gameOver();
      }
    }, 1000);
  },
  
  gameOver() {
    this.gameStarted = false;
    clearInterval(this.timerInterval);
    
    // 게임 상태 변경 이벤트 발생 (BGMManager가 감지하여 음악 변경)
    EventSystem.emit('gameStateChanged', { state: 'gameOver' });
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    
    document.getElementById('finalScore').textContent = this.score;
    document.getElementById('gameOverScreen').style.display = 'flex';
    
    this.sendGameState('gameOver');
  },
  
  shoot() {
    if (!this.gameStarted || this.ammo <= 0) {
      if (this.ammo <= 0) {
        AudioManager.play('emptyGun');
      }
      return;
    }
    
    this.ammo--;
    document.getElementById('ammo').textContent = this.ammo;
    
    Graphics.createGunFlash();
    
    // 현재 플레이어 위치 정보
    const playerPosition = Physics.playerBody.position.clone();
    
    // 이벤트 시스템을 통해 발사 이벤트 발생
    EventSystem.emit('shootEvent', {
      position: playerPosition,
      type: 'powerful',
      volume: 1.0
    });
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(), Graphics.camera);
    
    let hit = false;
    if (typeof GitHubTarget !== 'undefined') {
      hit = GitHubTarget.checkHit(raycaster);
    }
    if (!hit) {
      TargetManager.checkHit(raycaster);
    }
  },
  
  reload() {
    if (this.ammo < this.maxAmmo) {
      AudioManager.play('reload');
      this.ammo = this.maxAmmo;
      document.getElementById('ammo').textContent = this.ammo;
    }
  },
  
  addScore(points) {
    this.score += points;
    document.getElementById('score').textContent = this.score;
  },
  
  takeDamage(amount) {
    this.health -= amount;
    this.health = Math.max(0, this.health);
    document.getElementById('healthFill').style.width = `${this.health}%`;
    
    if (this.health <= 0) {
      this.gameOver();
    }
  },
  
  updatePlayer(delta) {
    if (!this.gameStarted || this.isSettingsOpen) return;
    
    this.playerDirection.z = Number(InputManager.keys.moveBackward) - Number(InputManager.keys.moveForward);
    this.playerDirection.x = Number(InputManager.keys.moveRight) - Number(InputManager.keys.moveLeft);
    this.playerDirection.normalize();
    
    const yawRotation = new THREE.Euler(0, InputManager.cameraYaw, 0);
    this.playerDirection.applyEuler(yawRotation);
    
    const speed = 5;
    this.playerVelocity.x = this.playerDirection.x * speed * delta;
    this.playerVelocity.z = this.playerDirection.z * speed * delta;
    
    Physics.playerBody.velocity.x = this.playerVelocity.x * 20;
    Physics.playerBody.velocity.z = this.playerVelocity.z * 20;
    
    Graphics.camera.position.x = Physics.playerBody.position.x;
    Graphics.camera.position.y = Physics.playerBody.position.y;
    Graphics.camera.position.z = Physics.playerBody.position.z;

    // Emit player position for other systems (like PortalSystem)
    EventSystem.emit('playerMoved', {
      position: new THREE.Vector3(
        Physics.playerBody.position.x,
        Physics.playerBody.position.y,
        Physics.playerBody.position.z
      ),
      velocity: new THREE.Vector3(
        Physics.playerBody.velocity.x,
        Physics.playerBody.velocity.y,
        Physics.playerBody.velocity.z
      )
    });
  },
  
  showSettings() {
    this.isSettingsOpen = true;
    
    // 게임 종료 화면이 표시 중인지 확인
    const isGameOverScreenVisible = document.getElementById('gameOverScreen').style.display === 'flex';
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
      setTimeout(() => {
        this._showSettingsUI();
      }, 50);
    } else {
      this._showSettingsUI();
    }
    
    // 게임 종료 화면이 표시 중이면 설정 화면 위에 표시되도록 z-index 조정
    if (isGameOverScreenVisible) {
      const gameOverScreen = document.getElementById('gameOverScreen');
      const settingsScreen = document.getElementById('settingsScreen');
      
      if (gameOverScreen && settingsScreen) {
        // 기존 z-index 값 저장
        gameOverScreen.dataset.originalZIndex = gameOverScreen.style.zIndex || '100';
        
        // 설정 화면이 게임 종료 화면 위에 오도록 z-index 조정
        settingsScreen.style.zIndex = '101';
      }
    }
  },
  
  _showSettingsUI() {
    GameSettings.loadSettings();
    
    if (typeof Localization !== 'undefined') {
      const languageSelect = document.getElementById('languageSelect');
      if (languageSelect) {
        languageSelect.value = Localization.currentLanguage;
      }
    }
    
    document.getElementById('settingsScreen').style.display = 'flex';
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    // 오디오 테스트 UI 초기화 (GameSettings 모듈에서 관리)
    if (typeof GameSettings.initAudioTestUI === 'function') {
      // 약간의 지연을 두고 초기화 (설정 화면이 표시된 후)
      setTimeout(() => {
        GameSettings.initAudioTestUI();
      }, 100);
    }
  },
  
  animate() {
    if (!this.gameStarted) return;
    
    requestAnimationFrame(this.animate.bind(this));
    const delta = Graphics.clock.getDelta();
    
    Physics.update(delta);
    this.updatePlayer(delta);
    TargetManager.update();
    
    if (typeof GitHubTarget !== 'undefined') {
      GitHubTarget.update(delta);
    }

    // Update portal system
    if (typeof PortalSystem !== 'undefined') {
      PortalSystem.update();
    }
    
    Graphics.renderer.render(Graphics.scene, Graphics.camera);
  },

  isGameOver() {
    return document.getElementById('gameOverScreen').style.display === 'flex';
  }
};

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message && message.type === 'checkGameState') {
    if (Game.gameStarted) {
      Game.sendGameState('playing');
    } else {
      if (document.getElementById('gameOverScreen').style.display === 'flex') {
        Game.sendGameState('gameOver');
      } else {
        Game.sendGameState('menu');
      }
    }
  }
});

(function() {
  setTimeout(function() {
    Game.init();
  }, 10);
})();
