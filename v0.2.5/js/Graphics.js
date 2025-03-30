/**
 * Graphics.js
 * Manages the Three.js scene, rendering pipeline, camera, lighting,
 * and visual effects (both 3D and DOM-based).
 * Integrates with GameSettings for quality configuration and
 * EventSystem for decoupling.
 */

import * as THREE from 'three';
// Assumed imports based on your architecture diagram. Adjust paths as needed.
 import { GameSettings } from './GameSettings.js'; // Optional: Inject or import directly
 import { EventSystem } from './EventSystem.js';   // Optional: Inject or import directly

// --- Constants ---
const DEFAULT_FOV = 75;
const DEFAULT_NEAR_PLANE = 0.1;
const DEFAULT_FAR_PLANE = 1000;
const DEFAULT_CAMERA_Y = 1.6; // Standard eye-level height
const DEFAULT_BACKGROUND_COLOR = 0x87CEEB; // Sky blue
const DEFAULT_AMBIENT_LIGHT_COLOR = 0x606070; // Slightly darker/bluer ambient
const DEFAULT_AMBIENT_LIGHT_INTENSITY = 1.0;
const DEFAULT_DIR_LIGHT_COLOR = 0xffffff;
const DEFAULT_DIR_LIGHT_INTENSITY = 1.5; // Slightly brighter for contrast
const DEFAULT_DIR_LIGHT_POS = { x: 15, y: 30, z: 20 };
const DEFAULT_SHADOW_MAP_SIZE = 2048;
const SHADOW_CAMERA_RANGE = 60; // Defines ortho bounds for shadow camera
const SHADOW_CAMERA_NEAR = 1; // Adjusted near for better shadow stability
const SHADOW_CAMERA_FAR = 100;
const SHADOW_BIAS = -0.001;
const MAX_PIXEL_RATIO = 2; // Cap pixel ratio for performance on high-DPI screens

// DOM Element IDs and CSS Classes (ensure these exist in your HTML/CSS)
const EFFECTS_CONTAINER_ID = 'game-effects-overlay'; // Expected container for DOM effects
const HIT_MARKER_ID = 'hitMarker';                   // Expected hit marker element ID
const CSS_GUN_FLASH = 'gun-flash-effect';
const CSS_BONUS_EFFECT = 'bonus-screen-flash';
const CSS_PENALTY_EFFECT = 'penalty-screen-flash';
const CSS_SCORE_TEXT = 'score-text-effect';
const WEBGL_ERROR_MESSAGE_ID = 'webgl-error-message';

/**
 * Simple pool for reusing frequently created/destroyed DOM elements for effects.
 */
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
            element.style.transform = '';
            return element;
        }
        return this.creationFn();
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
export class GraphicsManager {
    constructor(options = {}) {
        // Dependencies (Injected or defaulted)
        this.gameSettings = options.gameSettings; // || GameSettings; // Or import/use default
        this.eventSystem = options.eventSystem;   // || EventSystem;   // Or import/use default
        this.containerElement = options.containerElement || document.body;

        // Core THREE components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.lights = {}; // Store references: { ambient, directional }

        // Internal state
        this.trackedObjects = new Set(); // For easier cleanup
        this._isInitialized = false;
        this._animationFrameRequestId = null; // Only used if running internal loop
        this._activeScoreAnimations = new Set(); // Track ongoing score text animations

        // DOM Effect related properties
        this.effectsContainer = null;
        this.hitMarkerElement = null;
        this.gunFlashPool = null;
        this.bonusEffectPool = null;
        this.penaltyEffectPool = null;
        this.scoreTextPool = null;

        // Configuration derived from settings or defaults
        this.settings = this._extractGraphicsSettings(this.gameSettings);

        // Bind necessary methods
        this._onWindowResize = this._onWindowResize.bind(this);
        this._onSettingsUpdated = this._onSettingsUpdated.bind(this); // Handler for settings changes
    }

    /**
     * Extracts and validates graphics settings from the GameSettings module/object.
     * Provides defaults if settings are missing.
     */
    _extractGraphicsSettings(gameSettings) {
        const graphics = gameSettings?.getSettings?.()?.graphics || {}; // Safely access nested settings
        return {
            antialias: graphics.antialias ?? true,
            shadowQuality: graphics.shadowQuality ?? 'high', // e.g., 'low', 'medium', 'high', 'ultra'
            pixelRatio: Math.min(graphics.pixelRatio ?? window.devicePixelRatio, MAX_PIXEL_RATIO),
            powerPreference: graphics.powerPreference ?? 'default', // 'high-performance', 'low-power'
            showFps: graphics.showFps ?? false, // Example: adding FPS counter setting
            fogEnabled: graphics.fogEnabled ?? false,
            fogColor: graphics.fogColor ?? DEFAULT_BACKGROUND_COLOR,
            fogNear: graphics.fogNear ?? 50,
            fogFar: graphics.fogFar ?? 150
        };
    }

    /**
     * Checks for WebGL compatibility.
     * @returns {boolean} True if WebGL seems available.
     */
    isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    /**
     * Displays a prominent error message if WebGL initialization fails.
     * @param {string} message - Error details.
     */
    _showInitializationError(message) {
        // Remove any previous error message
        document.getElementById(WEBGL_ERROR_MESSAGE_ID)?.remove();

        const errorDiv = document.createElement('div');
        errorDiv.id = WEBGL_ERROR_MESSAGE_ID;
        // Apply basic styling for visibility (consider moving to CSS)
        Object.assign(errorDiv.style, {
            position: 'absolute', top: '0', left: '0', width: '100%',
            padding: '20px', backgroundColor: 'rgba(200, 0, 0, 0.9)', color: 'white',
            textAlign: 'center', zIndex: '9999', borderBottom: '2px solid #600',
            boxSizing: 'border-box'
        });
        errorDiv.innerHTML = `
            <h2 style="margin:0 0 10px;">Graphics Initialization Failed</h2>
            <p style="margin:5px 0;">${message}</p>
            <p style="margin:5px 0; font-size: 0.9em;">Please ensure your browser supports WebGL and hardware acceleration is enabled. Updating graphics drivers may help.</p>
        `;
        this.containerElement.appendChild(errorDiv);
    }

    /**
     * Initializes the Scene, Camera, Renderer, Lights, and Effect handlers.
     * @returns {boolean} True if initialization was successful, false otherwise.
     */
    init() {
        if (this._isInitialized) {
            console.warn("GraphicsManager: Already initialized.");
            return true;
        }

        console.log("GraphicsManager: Initializing...");

        if (!this.isWebGLAvailable()) {
            const errorMsg = "WebGL is not available or enabled in your browser.";
            console.error("GraphicsManager Error:", errorMsg);
            this._showInitializationError(errorMsg);
            this.eventSystem?.publish('GRAPHICS_ERROR', { message: errorMsg });
            return false;
        }

        try {
            // Ensure container is ready for positioning
            if (getComputedStyle(this.containerElement).position === 'static') {
                this.containerElement.style.position = 'relative';
            }

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
            this.scene.add(this.camera); // Add camera to scene (e.g., for AudioListener attachment)
            this.trackedObjects.add(this.camera);

            // 3. Renderer
            this.renderer = new THREE.WebGLRenderer({
                antialias: this.settings.antialias,
                powerPreference: this.settings.powerPreference,
                // alpha: true, // Set to true if you need transparency to HTML background
            });
            this.renderer.setPixelRatio(this.settings.pixelRatio);
            this.renderer.setSize(this.containerElement.clientWidth, this.containerElement.clientHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Default to soft shadows
             // Output encoding for better color representation (esp. with post-processing)
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;

            this.containerElement.appendChild(this.renderer.domElement);

            // 4. Clock
            this.clock = new THREE.Clock();

            // 5. Lights (Configured based on settings)
            this.setupLights();

            // 6. DOM Effects Setup
            this._setupEffectElements();

            // 7. Event Listeners
            window.addEventListener('resize', this._onWindowResize, false);
            this.eventSystem?.subscribe('SETTINGS_UPDATED', this._onSettingsUpdated);

            this._isInitialized = true;
            console.log("GraphicsManager: Initialization complete.");
            this.eventSystem?.publish('GRAPHICS_READY');

            // Remove potential error message on success
            document.getElementById(WEBGL_ERROR_MESSAGE_ID)?.remove();

            return true;

        } catch (error) {
            console.error("GraphicsManager: Initialization failed!", error);
            this._showInitializationError(`An unexpected error occurred: ${error.message}`);
            this.eventSystem?.publish('GRAPHICS_ERROR', { message: error.message, errorObject: error });
            this.dispose(); // Attempt cleanup
            return false;
        }
    }

    /**
     * Sets up the DOM elements and pools required for visual effects.
     */
    _setupEffectElements() {
        // Find or create the main container for overlays
        this.effectsContainer = document.getElementById(EFFECTS_CONTAINER_ID);
        if (!this.effectsContainer) {
            console.warn(`GraphicsManager: Element with ID #${EFFECTS_CONTAINER_ID} not found. Creating one.`);
            this.effectsContainer = document.createElement('div');
            this.effectsContainer.id = EFFECTS_CONTAINER_ID;
            // Essential styles for the overlay container
            Object.assign(this.effectsContainer.style, {
                position: 'absolute', top: '0', left: '0',
                width: '100%', height: '100%',
                pointerEvents: 'none', // Crucial: allow interaction with underlying canvas/elements
                overflow: 'hidden', zIndex: '10' // Adjust z-index as needed
            });
             this.containerElement.appendChild(this.effectsContainer);
        } else {
            // Ensure existing container allows interaction passthrough
            if (getComputedStyle(this.effectsContainer).pointerEvents !== 'none') {
                console.warn(`GraphicsManager: #${EFFECTS_CONTAINER_ID} should have 'pointer-events: none;'`);
                this.effectsContainer.style.pointerEvents = 'none';
            }
             // Ensure it can position children absolutely
             if (getComputedStyle(this.effectsContainer).position === 'static') {
                this.effectsContainer.style.position = 'relative';
            }
        }


        // Find the dedicated hit marker element (expected to exist in HTML)
        this.hitMarkerElement = document.getElementById(HIT_MARKER_ID);
        if (!this.hitMarkerElement) {
            console.warn(`GraphicsManager: Hit marker element with ID #${HIT_MARKER_ID} not found. Hit markers disabled.`);
        } else {
             // Ensure it starts hidden
             this.hitMarkerElement.style.opacity = '0';
        }

        // Create element pools
        // Assumes CSS classes define appearance & potentially basic transitions/animations
        this.gunFlashPool = new EffectElementPool(() => this._createEffectElement(CSS_GUN_FLASH));
        this.bonusEffectPool = new EffectElementPool(() => this._createEffectElement(CSS_BONUS_EFFECT, true), 5);
        this.penaltyEffectPool = new EffectElementPool(() => this._createEffectElement(CSS_PENALTY_EFFECT, true), 5);
        this.scoreTextPool = new EffectElementPool(() => this._createEffectElement(CSS_SCORE_TEXT), 30); // Pool more score texts
    }

    /**
     * Utility function to create a base DOM element for effects pools.
     * @param {string} cssClass - The CSS class to assign.
     * @param {boolean} isFullscreen - Whether the element should span the full container.
     * @returns {HTMLElement} The created DOM element (not yet appended).
     */
    _createEffectElement(cssClass, isFullscreen = false) {
        const element = document.createElement('div');
        element.classList.add(cssClass);
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none'; // Default for effects
        element.style.opacity = '0'; // Start hidden

        if (isFullscreen) {
            Object.assign(element.style, { top: '0', left: '0', width: '100%', height: '100%' });
        }
        return element;
    }


    /**
     * Cleans up all resources: THREE objects, DOM elements, event listeners.
     */
    dispose() {
        if (!this._isInitialized && !this.renderer) { // Avoid disposing if never initialized properly
             console.log("GraphicsManager: Dispose called but not initialized or already disposed.");
             return;
        }
        console.log("GraphicsManager: Disposing resources...");

        // Stop any internal animation loop
        this.stopRenderLoop(); // Clears _animationFrameRequestId

        // Remove event listeners
        window.removeEventListener('resize', this._onWindowResize, false);
        this.eventSystem?.unsubscribe('SETTINGS_UPDATED', this._onSettingsUpdated);

        // Clear active animations and pools
        this._activeScoreAnimations.forEach(anim => {
            cancelAnimationFrame(anim.requestId); // Stop individual rAF if used
            anim.element?.remove();
        });
        this._activeScoreAnimations.clear();
        this.gunFlashPool?.dispose();
        this.bonusEffectPool?.dispose();
        this.penaltyEffectPool?.dispose();
        this.scoreTextPool?.dispose();

        // Remove dynamically created effects container if we created it
        if (this.effectsContainer && this.effectsContainer.parentElement === this.containerElement && this.effectsContainer.id === EFFECTS_CONTAINER_ID) {
           // Be careful here: Only remove if WE created it, maybe check for a specific attribute?
           // Or, assume if it exists at startup, it's managed externally. If created here, safe to remove.
           // Let's assume for now if it exists, we don't remove it, only if we created it (e.g., check if it lacked the ID initially)
           // For simplicity now: Just clear reference, don't remove the element itself to be safe.
        }
        this.effectsContainer = null;
        this.hitMarkerElement = null; // Clear reference


        // Dispose THREE.js resources
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.isMesh) {
                    object.geometry?.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material?.dispose());
                        } else {
                            object.material?.dispose();
                        }
                    }
                }
                // Basic texture cleanup (Advanced needs Asset Manager)
                if (object.material?.map) object.material.map.dispose();
                // Add other map types: normalMap, envMap, etc.
            });
            // Remove objects added explicitly
             this.trackedObjects.forEach(obj => {
                this.scene.remove(obj);
                // Potentially dispose objects that GraphicsManager 'owns' like lights
                if(obj.dispose) obj.dispose(); // e.g., for lights or helpers
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
        // Don't nullify containerElement or injected dependencies usually

        // Remove error message if it exists
        document.getElementById(WEBGL_ERROR_MESSAGE_ID)?.remove();

        this._isInitialized = false;
        console.log("GraphicsManager: Disposal complete.");
    }

    /**
     * Handles window resize events. Debouncing could be added for complex scenes.
     */
    _onWindowResize() {
        if (!this.camera || !this.renderer || !this.containerElement) return;

        const width = this.containerElement.clientWidth;
        const height = this.containerElement.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        // Re-apply pixel ratio in case it changes dynamically (uncommon but possible)
        // this.renderer.setPixelRatio(this.settings.pixelRatio);
    }

    /**
     * Handles updates to game settings, applying relevant changes.
     * @param {object} newSettings - The complete new settings object from GameSettings.
     */
    _onSettingsUpdated(newSettings) {
        console.log("GraphicsManager: Settings updated, applying changes...");
        const oldSettings = this.settings;
        this.settings = this._extractGraphicsSettings({ getSettings: () => newSettings }); // Re-extract

        // Apply changes that can be done live
        if (this.renderer) {
            // Pixel Ratio (Requires renderer resize potentially)
            if (oldSettings.pixelRatio !== this.settings.pixelRatio) {
                 this.renderer.setPixelRatio(this.settings.pixelRatio);
                 // No need to resize here unless logic changes based on pixelRatio elsewhere
            }
             // Antialias (Requires renderer recreation - complex, often deferred until restart)
            if (oldSettings.antialias !== this.settings.antialias) {
                 console.warn("GraphicsManager: Antialias setting change requires application restart or renderer recreation.");
                 // Optionally: trigger event for UI to notify user
            }
            // Power Preference (Requires renderer recreation)
             if (oldSettings.powerPreference !== this.settings.powerPreference) {
                 console.warn("GraphicsManager: Power preference setting change requires application restart or renderer recreation.");
            }
        }

         // Shadow Quality
        if (this.lights.directional && oldSettings.shadowQuality !== this.settings.shadowQuality) {
            const shadowMapSize = this._getShadowMapSize(this.settings.shadowQuality);
            this.lights.directional.shadow.mapSize.width = shadowMapSize;
            this.lights.directional.shadow.mapSize.height = shadowMapSize;
             // Need to update the shadow map itself
            this.lights.directional.shadow.map = null; // Force regeneration
            console.log(`GraphicsManager: Shadow quality set to ${this.settings.shadowQuality} (${shadowMapSize}x${shadowMapSize})`);
        }

        // Fog
        if (oldSettings.fogEnabled !== this.settings.fogEnabled) {
             if (this.settings.fogEnabled && this.scene) {
                this.scene.fog = new THREE.Fog(this.settings.fogColor, this.settings.fogNear, this.settings.fogFar);
             } else if (this.scene){
                this.scene.fog = null;
             }
        } else if (this.scene?.fog && (oldSettings.fogColor !== this.settings.fogColor || oldSettings.fogNear !== this.settings.fogNear || oldSettings.fogFar !== this.settings.fogFar)) {
             this.scene.fog.color.set(this.settings.fogColor);
             this.scene.fog.near = this.settings.fogNear;
             this.scene.fog.far = this.settings.fogFar;
        }


        // Add more settings updates here (e.g., post-processing toggles)

        console.log("GraphicsManager: Applied settings changes.");
        // Optional: Force a re-render immediately if needed
        // if(this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    }


    /**
     * Determines the appropriate shadow map resolution based on quality setting.
     * @param {string} quality - 'low', 'medium', 'high', 'ultra'.
     * @returns {number} The width/height for the shadow map (power of 2).
     */
    _getShadowMapSize(quality) {
        switch (quality?.toLowerCase()) {
            case 'low': return 512;
            case 'medium': return 1024;
            case 'high': return DEFAULT_SHADOW_MAP_SIZE; // 2048
            case 'ultra': return 4096;
            default:
                console.warn(`GraphicsManager: Unknown shadow quality "${quality}". Defaulting to high.`);
                return DEFAULT_SHADOW_MAP_SIZE;
        }
    }

    /**
     * Configures and adds scene lighting. Call during init and potentially if settings change.
     */
    setupLights() {
        // Remove existing lights first if re-configuring
        if (this.lights.ambient) this.removeObject(this.lights.ambient);
        if (this.lights.directional) this.removeObject(this.lights.directional);
        if (this.lights.directional?.target) this.removeObject(this.lights.directional.target); // Remove target too
        this.lights = {};

        // Ambient Light
        this.lights.ambient = new THREE.AmbientLight(
            DEFAULT_AMBIENT_LIGHT_COLOR,
            DEFAULT_AMBIENT_LIGHT_INTENSITY
        );
        this.addObject(this.lights.ambient); // Use addObject to track

        // Directional Light (Primary light source, casts shadows)
        const dirLight = new THREE.DirectionalLight(
            DEFAULT_DIR_LIGHT_COLOR,
            DEFAULT_DIR_LIGHT_INTENSITY
        );
        dirLight.position.set(
            DEFAULT_DIR_LIGHT_POS.x,
            DEFAULT_DIR_LIGHT_POS.y,
            DEFAULT_DIR_LIGHT_POS.z
        );
        dirLight.castShadow = true;

        const shadowMapSize = this._getShadowMapSize(this.settings.shadowQuality);
        dirLight.shadow.mapSize.width = shadowMapSize;
        dirLight.shadow.mapSize.height = shadowMapSize;

        dirLight.shadow.camera.left = -SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.right = SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.top = SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.bottom = -SHADOW_CAMERA_RANGE;
        dirLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
        dirLight.shadow.camera.far = SHADOW_CAMERA_FAR;
        dirLight.shadow.bias = SHADOW_BIAS;
         // Optional: Optimize shadow bounds if scene size is known and smaller
         // dirLight.shadow.camera.updateProjectionMatrix(); // Needed if bounds change significantly

        this.lights.directional = dirLight;
        this.addObject(this.lights.directional);
        // Important: Add the target to the scene and track it if you manipulate it
        this.addObject(this.lights.directional.target); // Target defaults to (0,0,0)

        // Optional: Add helpers for debugging light positions and shadows
        // const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 5);
        // this.addObject(dirLightHelper);
        // const shadowHelper = new THREE.CameraHelper(dirLight.shadow.camera);
        // this.addObject(shadowHelper);
        console.log(`GraphicsManager: Lights setup with shadow quality ${this.settings.shadowQuality} (${shadowMapSize}x${shadowMapSize}).`);

    }

    /**
     * Adds a THREE.Object3D to the scene and tracks it for disposal.
     * @param {THREE.Object3D} object The object to add.
     */
    addObject(object) {
        if (!this.scene) {
             console.warn("GraphicsManager: Cannot add object, scene not initialized.");
            return;
        }
        if (!object) {
             console.warn("GraphicsManager: Attempted to add null or undefined object.");
             return;
        }
        this.scene.add(object);
        this.trackedObjects.add(object);
    }

    /**
     * Removes a THREE.Object3D from the scene and stops tracking it.
     * Attempts basic disposal of geometry/material if it's a Mesh.
     * Note: Shared resource disposal (textures, materials) is complex and best
     * handled by a dedicated Asset Manager.
     * @param {THREE.Object3D} object The object to remove.
     */
    removeObject(object) {
        if (!this.scene || !object || !this.trackedObjects.has(object)) return;

        this.scene.remove(object);
        this.trackedObjects.delete(object);

        // Basic cleanup for simple meshes owned/added via this manager
        // Does not handle shared assets well.
        if (object.isMesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
                object.material.forEach(m => m?.dispose());
            } else {
                object.material?.dispose();
            }
        }
        // If the object has children, they are removed from the scene implicitly
        // but their resources aren't disposed unless explicitly handled.
    }

    /**
     * The main render function, intended to be called by the external game loop.
     * @param {number} deltaTime - Time elapsed since the last frame in seconds.
     */
    render(deltaTime) {
        if (!this._isInitialized || !this.scene || !this.camera || !this.renderer) {
             // Log this maybe once, not every frame
             // console.warn("GraphicsManager: Render called before initialization or after disposal.");
             return;
        }

        // Update components that rely on delta time
        this._updateScoreTextAnimations(deltaTime);

        // Optional: Add other time-dependent updates here (e.g., shader uniforms)

        // Execute the render command
        this.renderer.render(this.scene, this.camera);
    }

    /**
      * Starts an internal render loop using requestAnimationFrame.
      * NOTE: Prefer using an external game loop (e.g., in Game.js) that calls
      * `graphicsManager.render(deltaTime)` for better synchronization with
      * physics and game logic updates. Use this only if GraphicsManager
      * must run independently.
      */
    startRenderLoop() {
        if (!this._isInitialized) {
            console.error("GraphicsManager: Cannot start render loop, not initialized.");
            return;
        }
        if (this._animationFrameRequestId) {
            console.warn("GraphicsManager: Render loop already running.");
            return;
        }

        console.log("GraphicsManager: Starting internal render loop...");
        this.clock.start(); // Ensure clock is running

        const animate = () => {
            if (!this._isInitialized) { // Check if disposed mid-loop
                console.log("GraphicsManager: Stopping internal render loop due to disposal.");
                this.clock.stop();
                this._animationFrameRequestId = null;
                return;
            }

            const deltaTime = this.clock.getDelta();
            this.render(deltaTime); // Call the main render method

            this._animationFrameRequestId = requestAnimationFrame(animate);
        };
        this._animationFrameRequestId = requestAnimationFrame(animate);
    }

    /**
     * Stops the internal render loop if it's running.
     */
    stopRenderLoop() {
        if (this._animationFrameRequestId) {
            cancelAnimationFrame(this._animationFrameRequestId);
            this._animationFrameRequestId = null;
            this.clock.stop();
            console.log("GraphicsManager: Stopped internal render loop.");
        }
    }


    // --- Effect Methods ---

    /**
     * Displays a short gun flash effect near the center of the screen.
     * Uses pooled DOM elements and relies on CSS for appearance/animation.
     * Recommended CSS: Define '.gun-flash-effect' with positioning (e.g., top: 50%, left: 50%, transform: translate(-50%, -50%)),
     * appearance (background, shadow), and an animation for fade-in/out or scaling.
     */
    createGunFlash() {
        if (!this.effectsContainer || !this.gunFlashPool) return;
        const flash = this.gunFlashPool.get();

        // Position is usually best handled by CSS for centered effects
        // Example dynamic positioning if needed:
        // flash.style.left = `${this.containerElement.clientWidth / 2}px`;
        // flash.style.top = `${this.containerElement.clientHeight / 2}px`;

        this.effectsContainer.appendChild(flash);
        flash.style.opacity = '1'; // Trigger CSS animation/visibility

        // Release back to pool after animation duration (sync with CSS)
        setTimeout(() => {
             // Check element hasn't been removed by disposal etc.
             if (flash.parentElement === this.effectsContainer) {
                 this.gunFlashPool.release(flash);
            }
        }, 150); // Adjust timeout based on CSS animation/transition duration
    }

    /**
     * Shows the hit marker element briefly.
     * Assumes element #hitMarker exists and uses CSS class 'show' for visibility/animation.
     * Recommended CSS: Define #hitMarker style (position, appearance) and a transition
     * for opacity, triggered by the '.show' class.
     * Example: #hitMarker { opacity: 0; transition: opacity 0.1s ease-out; }
     *          #hitMarker.show { opacity: 1; }
     */
    showHitMarker() {
        if (!this.hitMarkerElement) return;

        this.hitMarkerElement.classList.add('show');
        // Fallback direct style manipulation if CSS classes aren't used for animation
        // this.hitMarkerElement.style.opacity = '1';

        setTimeout(() => {
            this.hitMarkerElement?.classList.remove('show');
            // Fallback: if (this.hitMarkerElement) this.hitMarkerElement.style.opacity = '0';
        }, 200); // Duration the marker stays fully visible before fading
    }

    /**
     * Helper to show a fullscreen flash effect (bonus or penalty).
     * Uses pooled elements and relies on CSS for appearance/animation.
     * Recommended CSS: Define .bonus-screen-flash and .penalty-screen-flash
     * with background-color and opacity transition/animation.
     */
    _showScreenFlash(pool, duration = 100, fadeOut = 300) {
        if (!this.effectsContainer || !pool) return;

        const flash = pool.get();
        this.effectsContainer.appendChild(flash);
        flash.style.opacity = '1'; // Trigger fade-in/visibility

        setTimeout(() => {
            // Check if element still exists before trying to fade/release
            if (flash.parentElement !== this.effectsContainer) return;

             // Start fade out (assumes CSS transition handles the fade)
            flash.style.opacity = '0';
             setTimeout(() => {
                 // Release after fade-out completes
                 if (flash.parentElement === this.effectsContainer) {
                    pool.release(flash);
                }
             }, fadeOut);
        }, duration);
    }

    /** Displays a gold-tinted flash for bonus hits. */
    showBonusEffect() {
        this._showScreenFlash(this.bonusEffectPool, 100, 300);
    }

    /** Displays a red-tinted (or other color) flash for penalty hits. */
    showPenaltyEffect() {
        this._showScreenFlash(this.penaltyEffectPool, 100, 300); // Green in original example
    }

    /**
     * Displays animated floating score text projected from a 3D position.
     * Uses pooled DOM elements and relies on CSS class '.score-text-effect' for base style.
     * Recommended CSS: Define .score-text-effect { position: absolute; ... base font styles ... }
     *                 Define color/size variations via inline styles or more specific classes if needed.
     * @param {number} points - The score value (positive or negative).
     * @param {THREE.Vector3} worldPosition - The 3D world position where the text should originate.
     */
    showScoreText(points, worldPosition) {
        if (!this.effectsContainer || !this.scoreTextPool || !this.camera) return;

        const position = worldPosition.clone(); // Work with a copy
        const screenPos = position.project(this.camera);

        // Check if position is clipped (behind camera or outside normalized device coords)
        if (screenPos.z > 1 || Math.abs(screenPos.x) > 1.1 || Math.abs(screenPos.y) > 1.1) {
             // Slightly wider threshold than 1 to catch edges smoothly
            return;
        }

        // Convert NDC (-1 to +1) to screen pixels (0 to width/height)
        const x = (screenPos.x * 0.5 + 0.5) * this.containerElement.clientWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * this.containerElement.clientHeight;

        const scoreText = this.scoreTextPool.get();

        // Set content and initial state
        scoreText.textContent = points > 0 ? `+${points}` : `${points}`;
        scoreText.style.left = `${x}px`;
        scoreText.style.top = `${y}px`;
        scoreText.style.opacity = '1'; // Reset opacity from pool state
        scoreText.style.transform = 'translate(-50%, -50%) scale(1)'; // Center and reset scale

        // Apply dynamic styles based on score (consider abstracting to CSS classes)
        scoreText.style.color = points > 0 ? (points >= 25 ? '#FFD700' : '#FFFFFF') : '#FF4444'; // Gold/White/Red
        const fontSize = Math.min(36, Math.max(14, 16 + Math.abs(points) / 5)); // Clamp font size
        scoreText.style.fontSize = `${fontSize}px`;
        // Adjust shadow slightly based on size/importance?
        scoreText.style.textShadow = `1px 1px 2px rgba(0,0,0,0.7)`;


        this.effectsContainer.appendChild(scoreText);

        // Add to managed animation list
        const animationData = {
            element: scoreText,
            initialY: y,
            currentY: y,
            opacity: 1,
            life: 0, // Time alive in seconds
            duration: 1.5, // seconds
            velocity: -60, // pixels per second upwards
            requestId: null // For independent rAF loop (fallback)
        };
        this._activeScoreAnimations.add(animationData);

        // If using independent rAF loops per text (less ideal):
        // this._animateSingleScoreText(animationData);
    }

     /**
      * Updates all active score text animations. Called by the main render loop.
      * @param {number} deltaTime - Time elapsed since last frame in seconds.
      */
     _updateScoreTextAnimations(deltaTime) {
         if (!this._activeScoreAnimations.size) return;

         const animationsToDelete = [];

         this._activeScoreAnimations.forEach(anim => {
             anim.life += deltaTime;
             if (anim.life >= anim.duration) {
                 animationsToDelete.push(anim);
                 return;
             }

             // Calculate progress and apply effects
             const progress = anim.life / anim.duration;
             anim.currentY += anim.velocity * deltaTime;
             // Fade out more quickly towards the end
             anim.opacity = 1 - Math.pow(progress, 2);
              // Optional: Add scaling effect
              const scale = 1 + progress * 0.5;


             // Apply styles
             anim.element.style.top = `${anim.currentY}px`;
             anim.element.style.opacity = anim.opacity;
             anim.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
         });

         // Cleanup finished animations
         animationsToDelete.forEach(anim => {
            // Ensure element removal only happens once
            if(anim.element && anim.element.parentElement) {
                 this.scoreTextPool.release(anim.element);
            }
             this._activeScoreAnimations.delete(anim);
         });
     }

     /*
      // Fallback: Independent animation loop per score text (Use if not integrated into main loop)
      _animateSingleScoreText(animData) {
          const startTime = performance.now();
          const animate = (currentTime) => {
              const elapsedMs = currentTime - startTime;
              if (elapsedMs >= animData.duration * 1000 || !animData.element.parentElement) {
                  if(animData.element.parentElement) this.scoreTextPool.release(animData.element);
                  this._activeScoreAnimations.delete(animData);
                  return;
              }

              const progress = elapsedMs / (animData.duration * 1000);
              const currentY = animData.initialY + animData.velocity * (elapsedMs / 1000);
              const opacity = 1 - Math.pow(progress, 2);
              const scale = 1 + progress * 0.5;


              animData.element.style.top = `${currentY}px`;
              animData.element.style.opacity = opacity;
              animData.element.style.transform = `translate(-50%, -50%) scale(${scale})`;

              animData.requestId = requestAnimationFrame(animate);
          };
          animData.requestId = requestAnimationFrame(animate);
      }
     */

} // End of GraphicsManager class
