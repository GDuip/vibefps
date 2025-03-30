const Graphics = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    composer: null, // Postprocessing composer
    bloomPass: null, // Bloom pass for glowing effects
    hitMarkerElement: null, // Hitmarker DOM element
    gunEffectsElement: null, // Gun effects container DOM element

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.6, 5); // More sensible default position

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Smoother shadows
        document.body.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();

        this.setupPostProcessing();
        this.setupLights();

        // Pre-fetch DOM elements
        this.hitMarkerElement = document.getElementById('hitMarker');
        this.gunEffectsElement = document.getElementById('gunEffects');

        window.addEventListener('resize', this.onWindowResize.bind(this));
    },

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);

        // Render pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Bloom pass
        const bloomStrength = 0.5;
        const bloomRadius = 0.2;
        const bloomThreshold = 0.2;
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), bloomStrength, bloomRadius, bloomThreshold);
        this.composer.addPass(this.bloomPass);

        // FXAA pass (Anti-aliasing)
        const fxaaPass = new ShaderPass(FXAAShader);
        const pixelRatio = this.renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
        this.composer.addPass(fxaaPass);
    },

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight); // Update composer size

        // Update FXAA resolution on resize
        const pixelRatio = this.renderer.getPixelRatio();
        this.composer.passes[this.composer.passes.length - 1].material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
        this.composer.passes[this.composer.passes.length - 1].material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
    },

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Adjusted intensity
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Adjusted intensity
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.bias = -0.001;
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

        this.gunEffectsElement.appendChild(flash);

        // Use a promise-based approach for cleaner asynchronous handling
        new Promise(resolve => setTimeout(resolve, 100))
            .then(() => {
                flash.remove();
            });
    },

    showHitMarker() {
        this.hitMarkerElement.style.opacity = '1';

        // Use a promise-based approach for cleaner asynchronous handling
        new Promise(resolve => setTimeout(resolve, 200))
            .then(() => {
                this.hitMarkerElement.style.opacity = '0';
            });
    },

    showBonusEffect() {
        this.showFullScreenFlash('rgba(255, 215, 0, 0.2)'); // Gold flash
    },

    showPenaltyEffect() {
        this.showFullScreenFlash('rgba(0, 255, 0, 0.2)'); // Green flash
    },

    showFullScreenFlash(color) {
        const flash = document.createElement('div');
        flash.style.position = 'absolute';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = color;
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.3s';
        flash.style.opacity = '1'; // Start with opacity 1

        document.body.appendChild(flash);

        // Use a promise-based approach for cleaner asynchronous handling
        new Promise(resolve => setTimeout(resolve, 100))
            .then(() => {
                flash.style.opacity = '0'; // Fade out
                return new Promise(resolve => setTimeout(resolve, 300)); // Wait for fade out
            })
            .then(() => {
                flash.remove(); // Remove after fade out
            });
    },

    showScoreText(points, position) {
        const vector = position.clone();
        vector.project(this.camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

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

        // Animate using GSAP for smoother and more controllable animations
        gsap.to(scoreText, {
            duration: 1, // Animation duration
            y: y - 50, // Move upwards
            opacity: 0, // Fade out
            ease: "power2.out", // Easing function
            onComplete: () => {
                scoreText.remove(); // Remove after animation
            }
        });
    },

    render() {
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(this.render.bind(this));

        // Update scene logic here (e.g., animations, physics)

        // Render the scene using the composer
        this.composer.render();
    }
};

export default Graphics;
