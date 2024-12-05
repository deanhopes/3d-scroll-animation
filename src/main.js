import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Register the ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

// Configuration constants
const CONFIG = {
  model: {
    path: "./josta.glb",
    floatAmplitude: 0.05,
    floatFrequency: 1.5,
    rotationSpeed: 0.25,
  },
  renderer: {
    background: 0xfefdfd,
    exposure: 3.0,
  },
  camera: {
    fov: 75,
    near: 0.1,
    far: 100,
    position: { x: 0, y: 0, z: 5 },
  },
};

class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = this.setupCamera();
    this.renderer = this.setupRenderer();
    this.model = null;
    this.isFloating = true;
    this.animationFrameId = null;

    this.setupLights();
    this.setupLenis();
    this.setupEnvironment();

    this.initialScale = 1;
    this.targetScale = 0;
  }

  setupCamera() {
    const camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      CONFIG.camera.near,
      CONFIG.camera.far
    );
    camera.position.set(
      CONFIG.camera.position.x,
      CONFIG.camera.position.y,
      CONFIG.camera.position.z
    );
    return camera;
  }

  setupRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(CONFIG.renderer.background, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.renderer.exposure;

    document.querySelector(".model").appendChild(renderer.domElement);
    return renderer;
  }

  setupLights() {
    const lights = [
      new THREE.AmbientLight(0xffffff, 1),
      new THREE.DirectionalLight(0xffffff, 2),
      new THREE.DirectionalLight(0xffffff, 1),
      new THREE.HemisphereLight(0xffffff, 0x080808, 3)
    ];

    lights[1].position.set(10, 10, 10);
    lights[2].position.set(-10, -10, -10);
    lights[3].position.set(0, 10, 0);

    lights.forEach(light => this.scene.add(light));
  }

  setupLenis() {
    const lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  setupEnvironment() {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setPath('/');
    rgbeLoader.load(
      'studio_small_09_2k.hdr',
      this.handleEnvironmentLoaded.bind(this),
      this.handleLoadProgress,
      this.handleLoadError
    );
  }

  handleEnvironmentLoaded(texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.environment = texture;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  handleLoadProgress(progress) {
    console.log('Loading HDR:', (progress.loaded / progress.total * 100) + '%');
  }

  handleLoadError(error) {
    console.error('Error loading HDR:', error);
    this.scene.environment = null;
    this.renderer.toneMapping = THREE.NoToneMapping;
  }

  loadModel() {
    const loader = new GLTFLoader();
    loader.load(
      CONFIG.model.path,
      this.handleModelLoaded.bind(this),
      undefined,
      error => console.error('Error loading model:', error)
    );
  }

  handleModelLoaded(gltf) {
    this.model = gltf.scene;
    this.setupModelProperties();
    this.positionModel();
    this.scene.add(this.model);
    this.animate();
  }

  setupModelProperties() {
    this.model.traverse((node) => {
      if (node.isMesh) {
        Object.assign(node.material, {
          metalness: 0.9,
          roughness: 0.5,
          envMapIntensity: 1.5,
        });
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  positionModel() {
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    this.camera.position.z = maxDim * 2;
  }

  animate() {
    if (this.model && this.isFloating) {
      const time = Date.now() * 0.001;
      this.model.position.y = Math.sin(time * CONFIG.model.floatFrequency) * CONFIG.model.floatAmplitude;
      this.model.rotation.y += CONFIG.model.rotationSpeed * 0.01;
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }

  scaleModel(scale) {
    if (this.model) {
      gsap.to(this.model.scale, {
        x: scale,
        y: scale,
        z: scale,
        duration: 1,
        ease: "power2.inOut"
      });
    }
  }
}

// Initialize the application
const sceneManager = new SceneManager();
sceneManager.loadModel();

// Setup scroll triggers
const setupScrollTriggers = () => {
  // Create timeline for animations
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".scanner",
      start: "top top",
      end: () => `${window.innerHeight}px`,
      pin: true,
      // pinSpacing: false,
      onEnter: () => {
        sceneManager.isFloating = false;
        sceneManager.scaleModel(sceneManager.targetScale);

        // Animate scan container
        gsap.to(".scan-container", {
          scale: 0,
          duration: 1,
          ease: "power2.inOut"
        });
      },
      onEnterBack: () => {
        sceneManager.isFloating = true;
        sceneManager.scaleModel(sceneManager.initialScale);

        // Reset scan container
        gsap.to(".scan-container", {
          scale: 1,
          duration: 1,
          ease: "power2.inOut"
        });
      }
    }
  });
};

setupScrollTriggers();

