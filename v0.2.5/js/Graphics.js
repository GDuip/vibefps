const DEFAULT_FOV = 75;
const DEFAULT_NEAR_PLANE = 0.1;
const DEFAULT_FAR_PLANE = 1000;
const DEFAULT_CAMERA_Y = 1.6;
const DEFAULT_BACKGROUND_COLOR = 0x87CEEB;
const DEFAULT_AMBIENT_LIGHT_COLOR = 0x606070;
const DEFAULT_AMBIENT_LIGHT_INTENSITY = 1.0;
const DEFAULT_DIR_LIGHT_COLOR = 0xffffff;
const DEFAULT_DIR_LIGHT_INTENSITY = 1.5;
const DEFAULT_DIR_LIGHT_POS = { x: 15, y: 30, z: 20 };
const DEFAULT_SHADOW_MAP_SIZE = 2048;
const SHADOW_CAMERA_RANGE = 60;
const SHADOW_CAMERA_NEAR = 1;
const SHADOW_CAMERA_FAR = 100;
const SHADOW_BIAS = -0.001;
const MAX_PIXEL_RATIO = 2;

const EFFECTS_CONTAINER_ID = 'game-effects-overlay';
const HIT_MARKER_ID = 'hitMarker';
const CSS_GUN_FLASH = 'gun-flash-effect';
const CSS_BONUS_EFFECT = 'bonus-screen-flash';
const CSS_PENALTY_EFFECT = 'penalty-screen-flash';
const CSS_SCORE_TEXT = 'score-text-effect';
const WEBGL_ERROR_MESSAGE_ID = 'webgl-error-message';

// --- EffectElementPool Class --- (Keep class from previous version)
class EffectElementPool {
    constructor(creationFn, maxSize = 20) { /* ... */ }
    get() { /* ... */ }
    release(element) { /* ... */ }
    dispose() { /* ... */ }
}
// --- Paste the full EffectElementPool class code here ---
class EffectElementPool {
    constructor(creationFn, maxSize = 20) {
        if (typeof creationFn !== 'function') {
            throw new Error("EffectElementPool requires a creation function.");
        }
        this.pool = [];
        this.creationFn = creationFn;
        this.maxSize = maxSize;
    }

    get() {
        if (this.pool.length > 0) {
            const element = this.pool.pop();
            // Reset common animated properties
            element.style.opacity = '1';
            element.style.transform = ''; // Reset transform if used
            // Reset any other potentially modified styles
            element.style.top = '';
            element.style.left = '';
            element.className = element.baseClassName || ''; // Restore base class if needed
            return element;
        }
        const newElement = this.creationFn();
        newElement.baseClassName = newElement.className; // Store base class on creation
        return newElement;
    }

    release(element) {
        if (element && this.pool.length < this.maxSize) {
            element.style.opacity = '0'; // Hide it visually
            element.remove(); // Remove from DOM to prevent clutter
            this.pool.push(element);
        } else if (element) {
            // Pool full or element invalid, just remove from DOM
            element.remove();
        }
    }

    dispose() {
        // Ensure all pooled elements are removed from DOM on dispose
        this.pool.forEach(element => element.remove());
        this.pool = [];
    }
}


/**
 * Manages all graphical aspects of the game using Three.js.
 */
export class GraphicsManager { // Use export if using modules

    // Inject GameSettings and EventSystem instances
    constructor(options = {}) {
        // Dependencies
        this.gameSettings = options.gameSettings || window.GameSettings; // Fallback to global
        this.eventSystem = options.eventSystem || window.EventSystem;   // Fallback to global
        this.containerElement = options.containerElement || document.body;

        if (!this.gameSettings) console.error("GraphicsManager: GameSettings not provided or found globally.");
        if (!this.eventSystem) console.error("GraphicsManager: EventSystem not provided or found globally.");

        // Core THREE components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.lights = {};

        // Internal state
        this.trackedObjects = new Set();
        this._isInitialized = false;
        this._animationFrameRequestId = null;
        this._activeScoreAnimations = new Set();

        // DOM Effect related properties
        this.effectsContainer = null;
        this.hitMarkerElement = null;
        this.gunFlashPool = null;
        this.bonusEffectPool = null;
        this.penaltyEffectPool = null;
        this.scoreTextPool = null;

        // Configuration derived from settings or defaults
        // Initialize settings based on potentially available gameSettings
        this.settings = this._extractGraphicsSettings(this.gameSettings);

        // Bind necessary methods
        this._onWindowResize = this._onWindowResize.bind(this);
        this._onSettingsUpdated = this._onSettingsUpdated.bind(this); // Handler for settings changes
    }

    /**
     * Extracts and validates graphics settings from the GameSettings module/object.
     * Provides defaults if settings are missing or invalid.
     */
    _extractGraphicsSettings(gameSettings) {
        // Use defaults first
        const defaults = {
            antialias: true,
            shadowQuality: 'high',
            pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
            powerPreference: 'default',
            fogEnabled: false,
            fogColor: DEFAULT_BACKGROUND_COLOR,
            fogNear: 50,
            fogFar: 150
        };

        // Try to get settings from the injected/global object
        const settingsSource = gameSettings?.graphics || gameSettings?.getSettings?.()?.graphics;

        if (settingsSource) {
            // Merge defaults with loaded settings, ensuring type safety where needed
            return {
                antialias: typeof settingsSource.antialias === 'boolean' ? settingsSource.antialias : defaults.antialias,
                shadowQuality: ['low', 'medium', 'high', 'ultra'].includes(settingsSource.shadowQuality) ? settingsSource.shadowQuality : defaults.shadowQuality,
                pixelRatio: typeof settingsSource.pixelRatio === 'number' ? Math.min(settingsSource.pixelRatio, MAX_PIXEL_RATIO) : defaults.pixelRatio,
                powerPreference: ['high-performance', 'low-power', 'default'].includes(settingsSource.powerPreference) ? settingsSource.powerPreference : defaults.powerPreference,
                fogEnabled: typeof settingsSource.fogEnabled === 'boolean' ? settingsSource.fogEnabled : defaults.fogEnabled,
                fogColor: typeof settingsSource.fogColor === 'number' ? settingsSource.fogColor : defaults.fogColor,
                fogNear: typeof settingsSource.fogNear === 'number' ? settingsSource.fogNear : defaults.fogNear,
                fogFar: typeof settingsSource.fogFar === 'number' ? settingsSource.fogFar : defaults.fogFar,
            };
        } else {
            // Return defaults if GameSettings or its graphics property isn't available
            return defaults;
        }
    }

    isWebGLAvailable() { /* ... keep implementation ... */ }
    _showInitializationError(message) { /* ... keep implementation ... */ }

    init() {
        if (this._isInitialized) { /* ... */ return true; }
        console.log("GraphicsManager: Initializing...");

        if (!this.isWebGLAvailable()) {
            const errorMsg = "WebGL is not available or enabled.";
            console.error("GraphicsManager Error:", errorMsg);
            this._showInitializationError(errorMsg);
            // Use injected EventSystem
            this.eventSystem?.emit('GRAPHICS_ERROR', { message: errorMsg });
            return false;
        }

        try {
            // Re-extract settings *before* creating components that depend on them
            this.settings = this._extractGraphicsSettings(this.gameSettings);
            console.log("GraphicsManager: Initial settings:", this.settings);


            if (getComputedStyle(this.containerElement).position === 'static') { /* ... */ }

            // 1. Scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(DEFAULT_BACKGROUND_COLOR);
            if (this.settings.fogEnabled) {
                 this.scene.fog = new THREE.Fog(this.settings.fogColor, this.settings.fogNear, this.settings.fogFar);
            }

            // 2. Camera
            const aspect = this.containerElement.clientWidth / this.containerElement.clientHeight;
            this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, aspect, DEFAULT_NEAR_PLANE, DEFAULT_FAR_PLANE);
            this.camera.position.y = DEFAULT_CAMERA_Y;
            this.addObject(this.camera); // Use addObject to track

            // 3. Renderer (Use this.settings)
            this.renderer = new THREE.WebGLRenderer({
                antialias: this.settings.antialias,
                powerPreference: this.settings.powerPreference,
            });
            this.renderer.setPixelRatio(this.settings.pixelRatio);
            this.renderer.setSize(this.containerElement.clientWidth, this.containerElement.clientHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.containerElement.appendChild(this.renderer.domElement);

            // 4. Clock
            this.clock = new THREE.Clock();

            // 5. Lights (Configured based on this.settings)
            this.setupLights();

            // 6. DOM Effects Setup
            this._setupEffectElements();

            // 7. Event Listeners
            window.addEventListener('resize', this._onWindowResize, false);
            // Subscribe using injected EventSystem
            this.eventSystem?.on('SETTINGS_UPDATED', this._onSettingsUpdated, this); // Pass context

            this._isInitialized = true;
            console.log("GraphicsManager: Initialization complete.");
            // Emit using injected EventSystem
            this.eventSystem?.emit('GRAPHICS_READY');

            document.getElementById(WEBGL_ERROR_MESSAGE_ID)?.remove();
            return true;

        } catch (error) {
            console.error("GraphicsManager: Initialization failed!", error);
            this._showInitializationError(`An unexpected error occurred: ${error.message}`);
            // Emit using injected EventSystem
            this.eventSystem?.emit('GRAPHICS_ERROR', { message: error.message, errorObject: error });
            this.dispose();
            return false;
        }
    }

    _setupEffectElements() { /* ... keep implementation ... */ }
    _createEffectElement(cssClass, isFullscreen = false) { /* ... keep implementation ... */ }


    dispose() {
        if (!this._isInitialized && !this.renderer) { return; }
        console.log("GraphicsManager: Disposing resources...");

        this.stopRenderLoop();

        // Unsubscribe using injected EventSystem
        this.eventSystem?.off('SETTINGS_UPDATED', this._onSettingsUpdated, this); // Ensure context matches
        window.removeEventListener('resize', this._onWindowResize, false);

        // Clear animations and pools
        this._activeScoreAnimations.forEach(anim => { /* ... */ });
        this._activeScoreAnimations.clear();
        this.gunFlashPool?.dispose();
        this.bonusEffectPool?.dispose();
        this.penaltyEffectPool?.dispose();
        this.scoreTextPool?.dispose();

        // DOM cleanup
        this.effectsContainer = null;
        this.hitMarkerElement = null;

        // Dispose THREE resources
        if (this.scene) {
            // ... (scene traversal and disposal logic) ...
             this.trackedObjects.forEach(obj => {
                this.scene.remove(obj);
                if(obj.dispose) obj.dispose();
            });
            this.trackedObjects.clear();
        }

        this.renderer?.dispose();
        this.renderer?.domElement?.remove();

        // Clear references
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.lights = {};

        document.getElementById(WEBGL_ERROR_MESSAGE_ID)?.remove();
        this._isInitialized = false;
        console.log("GraphicsManager: Disposal complete.");
    }

    _onWindowResize() { /* ... keep implementation ... */ }

    /**
     * Handles updates pushed via the 'SETTINGS_UPDATED' event from EventSystem.
     * @param {object} fullSettingsObject - The complete settings object from GameSettings.
     */
    _onSettingsUpdated(fullSettingsObject) {
        if (!this._isInitialized) return; // Don't apply if not ready

        console.log("GraphicsManager: Received SETTINGS_UPDATED event.");
        const oldSettings = { ...this.settings }; // Shallow copy for comparison
        // Re-extract and validate settings from the received object
        this.settings = this._extractGraphicsSettings({ graphics: fullSettingsObject.graphics });

        let requiresRendererUpdate = false;
        let requiresLightUpdate = false;
        let requiresFogUpdate = false;

        // --- Compare and Apply ---

        // Renderer settings (some require recreation, handled as warnings)
        if (oldSettings.pixelRatio !== this.settings.pixelRatio && this.renderer) {
            console.log(`GraphicsManager: Updating pixel ratio to ${this.settings.pixelRatio}`);
            this.renderer.setPixelRatio(this.settings.pixelRatio);
            // May need renderer.setSize again if layout depends on pixelRatio? Usually not.
        }
        if (oldSettings.antialias !== this.settings.antialias) {
            console.warn("GraphicsManager: Antialias setting change requires application restart or renderer recreation to take effect.");
        }
        if (oldSettings.powerPreference !== this.settings.powerPreference) {
            console.warn("GraphicsManager: Power preference setting change requires application restart or renderer recreation to take effect.");
        }

        // Shadow Quality
        if (oldSettings.shadowQuality !== this.settings.shadowQuality && this.lights.directional) {
            console.log(`GraphicsManager: Updating shadow quality to ${this.settings.shadowQuality}`);
            requiresLightUpdate = true; // Re-run setupLights which reads the new setting
        }

        // Fog Settings
        if (oldSettings.fogEnabled !== this.settings.fogEnabled) {
            console.log(`GraphicsManager: Updating fog enabled to ${this.settings.fogEnabled}`);
            requiresFogUpdate = true;
        } else if (this.settings.fogEnabled && (oldSettings.fogColor !== this.settings.fogColor || oldSettings.fogNear !== this.settings.fogNear || oldSettings.fogFar !== this.settings.fogFar)) {
             console.log(`GraphicsManager: Updating fog parameters.`);
             requiresFogUpdate = true;
        }

        // --- Apply Updates ---
        if (requiresLightUpdate) {
            this.setupLights(); // Recreates lights based on new settings
        }

        if (requiresFogUpdate && this.scene) {
             if (this.settings.fogEnabled) {
                if (!this.scene.fog) {
                    this.scene.fog = new THREE.Fog(this.settings.fogColor, this.settings.fogNear, this.settings.fogFar);
                } else {
                    // Update existing fog object
                    this.scene.fog.color.setHex(this.settings.fogColor);
                    this.scene.fog.near = this.settings.fogNear;
                    this.scene.fog.far = this.settings.fogFar;
                }
             } else {
                // Disable fog
                this.scene.fog = null;
             }
        }

        console.log("GraphicsManager: Applied settings changes.");
    }


    _getShadowMapSize(quality) { /* ... keep implementation ... */ }

    /**
     * Configures and adds scene lighting based on current this.settings.
     */
    setupLights() {
        // Remove existing lights before adding new ones
        if (this.lights.ambient) this.removeObject(this.lights.ambient);
        if (this.lights.directional) this.removeObject(this.lights.directional);
        if (this.lights.directional?.target) this.removeObject(this.lights.directional.target);
        this.lights = {};

        // Ambient Light
        this.lights.ambient = new THREE.AmbientLight(
            DEFAULT_AMBIENT_LIGHT_COLOR,
            DEFAULT_AMBIENT_LIGHT_INTENSITY
        );
        this.addObject(this.lights.ambient);

        // Directional Light (Use settings for shadow map size)
        const dirLight = new THREE.DirectionalLight(
            DEFAULT_DIR_LIGHT_COLOR,
            DEFAULT_DIR_LIGHT_INTENSITY
        );
        dirLight.position.set(DEFAULT_DIR_LIGHT_POS.x, DEFAULT_DIR_LIGHT_POS.y, DEFAULT_DIR_LIGHT_POS.z);
        dirLight.castShadow = true;

        const shadowMapSize = this._getShadowMapSize(this.settings.shadowQuality); // Read from current settings
        dirLight.shadow.mapSize.width = shadowMapSize;
        dirLight.shadow.mapSize.height = shadowMapSize;
        dirLight.shadow.camera.left = -SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.right = SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.top = SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.bottom = -SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
        dirLight.shadow.camera.far = SHADOW_CAMERA_FAR;
        dirLight.shadow.bias = SHADOW_BIAS;
        // Force shadow map regeneration if settings changed
        dirLight.shadow.map = null;


        this.lights.directional = dirLight;
        this.addObject(this.lights.directional);
        this.addObject(this.lights.directional.target);

        console.log(`GraphicsManager: Lights setup with shadow quality ${this.settings.shadowQuality} (${shadowMapSize}x${shadowMapSize}).`);
    }

    addObject(object) { /* ... keep implementation ... */ }
    removeObject(object) { /* ... keep implementation ... */ }
    render(deltaTime) { /* ... keep implementation ... */ }
    startRenderLoop() { /* ... keep implementation ... */ }
    stopRenderLoop() { /* ... keep implementation ... */ }

    // --- Effect Methods --- (Keep implementations from previous version)
    createGunFlash() { /* ... */ }
    showHitMarker() { /* ... */ }
    _showScreenFlash(pool, duration = 100, fadeOut = 300) { /* ... */ }
    showBonusEffect() { /* ... */ }
    showPenaltyEffect() { /* ... */ }
    showScoreText(points, worldPosition) { /* ... */ }
    _updateScoreTextAnimations(deltaTime) { /* ... */ }
    // _animateSingleScoreText(animData) { /* ... */ } // Keep fallback if needed

} // End of GraphicsManager class

// If not using modules, you might expose the class globally:
// window.GraphicsManager = GraphicsManager;
